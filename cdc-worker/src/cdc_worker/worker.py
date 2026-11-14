import gzip
import json
import logging
import os
import signal
import time
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

import boto3
import psycopg
from psycopg.rows import dict_row

from .config import Settings

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
log = logging.getLogger("cdc-worker")

_stop = False


def _handle_stop(signum, frame):
    global _stop
    _stop = True
    log.info("shutdown requested (signal=%s)", signum)


for sig in (signal.SIGINT, signal.SIGTERM):
    try:
        signal.signal(sig, _handle_stop)
    except Exception:
        pass


def get_conn(settings: Settings):
    if settings.database_url:
        return psycopg.connect(settings.database_url, row_factory=dict_row)
    params = {
        "host": settings.db_host,
        "port": settings.db_port,
        "dbname": settings.db_name,
        "user": settings.db_user,
        "password": settings.db_password,
    }
    if settings.db_sslmode:
        params["sslmode"] = settings.db_sslmode
    return psycopg.connect(**params, row_factory=dict_row)


def get_s3(settings: Settings):
    session = boto3.session.Session(region_name=settings.aws_region)
    return session.client("s3", endpoint_url=settings.s3_endpoint_url)


def fetch_batch(conn, batch_size: int) -> list[dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT event_id, table_name, operation, row_id, payload, changed_at, txid
            FROM cdc_outbox
            WHERE exported_at IS NULL
            ORDER BY event_id
            LIMIT %s
            FOR UPDATE SKIP LOCKED
            """,
            (batch_size,),
        )
        return list(cur.fetchall())


def _json_default(obj):
    if isinstance(obj, datetime):
        if obj.tzinfo is None:
            obj = obj.replace(tzinfo=timezone.utc)
        return obj.isoformat()
    return str(obj)


def partition_key(table: str, changed_at: datetime) -> str:
    if changed_at.tzinfo is None:
        changed_at = changed_at.replace(tzinfo=timezone.utc)
    dt = changed_at.strftime("%Y-%m-%d")
    hh = changed_at.strftime("%H")
    return f"table_name={table}/dt={dt}/hour={hh}"


def upload_group(s3, bucket: str, prefix: str, table: str, part: str, rows: list[dict], batch_id: str):
    event_ids = [r["event_id"] for r in rows]
    key = f"{prefix}/{part}/batch_{batch_id}_{min(event_ids)}_{max(event_ids)}.jsonl.gz"
    lines = []
    for r in rows:
        record = {
            "event_id": r["event_id"],
            "table_name": r["table_name"],
            "operation": r["operation"],
            "row_id": r["row_id"],
            "payload": r["payload"],
            "changed_at": r["changed_at"],
            "txid": r["txid"],
            "exported_at_utc": datetime.now(timezone.utc),
        }
        lines.append(json.dumps(record, default=_json_default, separators=(",", ":")))
    body = gzip.compress(("\n".join(lines) + "\n").encode("utf-8"))
    s3.put_object(
        Bucket=bucket,
        Key=key,
        Body=body,
        ContentType="application/x-ndjson",
        ContentEncoding="gzip",
    )
    return key, event_ids


def process_cycle(conn, s3, settings: Settings) -> int:
    total = 0
    for _ in range(settings.max_batches_per_cycle):
        with conn.transaction():
            rows = fetch_batch(conn, settings.batch_size)
            if not rows:
                return total
            batch_id = uuid.uuid4().hex[:12]
            groups: dict[tuple[str, str], list[dict]] = defaultdict(list)
            for r in rows:
                changed = r["changed_at"]
                if isinstance(changed, str):
                    # defensive; psycopg usually returns datetime
                    changed = datetime.fromisoformat(changed.replace("Z", "+00:00"))
                table = r["table_name"]
                part = partition_key(table, changed)
                groups[(table, part)].append(r)

            all_ids: list[int] = []
            for (table, part), grows in groups.items():
                key, ids = upload_group(s3, settings.s3_bucket, settings.s3_prefix, table, part, grows, batch_id)
                all_ids.extend(ids)
                log.info("uploaded %s events to s3://%s/%s", len(ids), settings.s3_bucket, key)

            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE cdc_outbox
                    SET exported_at = now(), export_batch_id = %s
                    WHERE event_id = ANY(%s)
                    """,
                    (batch_id, all_ids),
                )
            total += len(all_ids)
        # short pause between batches to avoid tight loop
        if _stop:
            break
    return total


def main():
    try:
        try:
            from dotenv import load_dotenv
            load_dotenv()
        except Exception:
            pass
        settings = Settings.from_env()
        log.info(
            "starting cdc-worker bucket=%s prefix=%s poll=%ss batch=%s",
            settings.s3_bucket, settings.s3_prefix, settings.poll_seconds, settings.batch_size,
        )
        if not settings.export_enabled:
            log.warning("CDC_EXPORT_ENABLED is false; worker will idle without exporting")
        s3 = get_s3(settings)
        with get_conn(settings) as conn:
            conn.execute("SET application_name = 'cap22-cdc-worker'")
            while not _stop:
                try:
                    if settings.export_enabled:
                        exported = process_cycle(conn, s3, settings)
                        if exported:
                            log.info("cycle complete: exported %s events", exported)
                        else:
                            time.sleep(settings.poll_seconds)
                    else:
                        time.sleep(settings.poll_seconds)
                except Exception:
                    log.exception("error during export cycle; retrying after backoff")
                    conn.rollback()
                    time.sleep(max(settings.poll_seconds, 5))
        log.info("cdc-worker stopped")
    except Exception:
        log.exception("fatal startup error")
        raise


if __name__ == "__main__":
    main()
