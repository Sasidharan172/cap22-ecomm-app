# Supabase + CDC Worker (S3) + Snowflake + Power BI

This document describes the scaffolded pipeline to move the app database to Supabase and stream database changes to S3 for Snowflake ingestion and Power BI analytics.

## Architecture (current scaffold)

1. **Supabase Postgres** is the primary OLTP database for the Spring Boot backend (Flyway migrations + JPA).
2. **CDC outbox in Postgres** (`cdc_outbox` table + triggers, migration `V3__cdc_outbox.sql`) captures `INSERT`/`UPDATE`/`DELETE` events for domain tables.
3. **Python CDC worker** (`cdc-worker/`) polls pending outbox rows, writes partitioned **JSON Lines (`.jsonl.gz`)** objects to S3, and marks rows exported.
4. **Snowflake RAW** ingests files from the S3 stage/prefix (via `COPY INTO` or Snowpipe) into a `VARIANT` event table.
5. **Snowflake CLEAN** views/tables flatten and de-duplicate events into analytics-ready entities.
6. **Power BI** connects to Snowflake (CLEAN schema) for reporting.

> Credentials/resources (Supabase project, S3 bucket, IAM/storage integration, Snowflake account) are **not** provisioned by this repo; configure them via environment variables and placeholders in SQL.

## 1) Move database to Supabase

### 1.1 Create/configure Supabase project
- Create a Supabase project and obtain the Postgres connection details (host, database, user, password, port).
- Prefer a **direct/session** connection for Flyway migrations and long-lived backend/JPA use (Supavisor session mode/port as provided by Supabase). Ensure `sslmode=require`.

### 1.2 Apply schema and seed
Flyway runs automatically on backend startup (`spring.flyway` default) against the configured datasource.

Set backend environment variables (example):
```bash
DB_URL="jdbc:postgresql://aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require"
DB_USER="postgres.<project-ref>"
DB_PASSWORD="<supabase-db-password>"
APP_USER=admin
APP_PASSWORD=admin123
```

Start backend pointing to Supabase (locally or in container). Migrations `V1__schema.sql`, `V2__seed.sql`, and `V3__cdc_outbox.sql` will be applied in order on a fresh database.

### 1.3 (Optional) migrate existing local data
If you need to move existing local Postgres data to Supabase:
- Export from local: `pg_dump --data-only --inserts ...` (or `pg_dump -Fc`) excluding Flyway-managed conflicts as appropriate.
- Import into Supabase with `psql`/`pg_restore`.
- Be mindful of seed data in `V2__seed.sql` (it inserts fixed UUID rows). For a non-demo migration, consider using a fresh schema without seed conflicts or adapting the seed/migration strategy.

### 1.4 Run the app against Supabase
- **Backend:** set `DB_URL`, `DB_USER`, `DB_PASSWORD` to Supabase values.
- **Local Postgres container:** no longer required. With the updated compose, run without the `localdb` profile:
  ```bash
  docker compose up -d --build backend frontend cdc-worker
  ```
- **Local dev (default, with bundled Postgres):**
  ```bash
  docker compose --profile localdb up -d --build
  ```

## 2) CDC outbox (database)

Migration: `backend/src/main/resources/db/migration/V3__cdc_outbox.sql`

- Creates `cdc_outbox(event_id, table_name, operation, row_id, payload, changed_at, txid, exported_at, export_batch_id)`
- Adds trigger function `cdc_capture_change()` and attaches `AFTER INSERT OR UPDATE OR DELETE` triggers to domain tables:
  `customers, destinations, products, orders, order_items, shipments, shipment_items, destination_rules, exchange_rates, landed_cost_estimates, cost_estimate_components, carrier_events, document_types, shipment_documents, exceptions`
- Each event stores `operation` and full row `payload` (JSONB); deletes capture `OLD`.

This enables reliable change capture (including deletes/updates) without logical replication slots.

## 3) Python CDC worker (DB -> S3)

Location: `cdc-worker/`

### Behavior
- Polls `cdc_outbox` for `exported_at IS NULL` (ordered by `event_id`, `FOR UPDATE SKIP LOCKED`).
- Groups events by `table_name` and time partition (`changed_at` -> `dt=YYYY-MM-DD/hour=HH`).
- Writes gzip-compressed **JSON Lines** files to S3:
  - `s3://<S3_BUCKET>/<S3_PREFIX>/table_name=<table>/dt=<YYYY-MM-DD>/hour=<HH>/batch_<batchId>_<minEvent>_<maxEvent>.jsonl.gz`
- Each line is a JSON object: `{event_id, table_name, operation, row_id, payload, changed_at, txid, exported_at_utc}`.
- Marks exported rows with `exported_at` and `export_batch_id` after successful upload.

### Configuration (env)
See `cdc-worker/.env.example`. Key variables:
- `DATABASE_URL` (recommended, e.g. Supabase Postgres URI with `sslmode=require`) or `DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD/DB_SSLMODE`
- `S3_BUCKET`, `S3_PREFIX` (default `cdc/raw`), `AWS_REGION`
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (or use IAM role/instance/task credentials in your runtime)
- `S3_ENDPOINT_URL` (optional, for S3-compatible stores)
- `CDC_POLL_SECONDS`, `CDC_BATCH_SIZE`, `CDC_MAX_BATCHES_PER_CYCLE`, `CDC_EXPORT_ENABLED`

### Run locally
```bash
cd cdc-worker
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill values
python -m cdc_worker.worker
```

### Run with Docker Compose
```bash
# set required env vars in .env (DATABASE_URL/Supabase, S3_BUCKET, AWS creds, etc.)
docker compose up -d --build cdc-worker
docker compose logs -f cdc-worker
```

## 4) Snowflake ingestion (RAW) and transforms (CLEAN)

SQL scaffolds: `snowflake/01_raw_stage_and_table.sql`, `02_snowpipe_example.sql`, `03_clean_transforms.sql`

### RAW
- Create a storage integration (recommended) and external stage pointing to `s3://<bucket>/<prefix>/`.
- Land events into `RAW.CDC_EVENTS` (VARIANT `payload` + metadata columns).
- Ingest via:
  - **COPY INTO** (manual/scheduled task) for simple setups, or
  - **Snowpipe** with S3 event notifications for near-continuous auto-ingest (see example).

### CLEAN
- Derive latest-state entities by `(table_name, row_id)` using `event_id` ordering and filtering `DELETE` tombstones (for mutable/current-state tables).
- Keep append-only/event-style history where appropriate (e.g. `landed_cost_estimates`, `carrier_events`).
- Example views provided for `customers`, `orders`, `shipments`, `landed_cost_estimates`; extend for remaining tables per Power BI needs.

## 5) Power BI

- Connect Power BI to **Snowflake** and model from the **CLEAN** schema/views (or materialized tables/tasks refreshed from CLEAN logic).
- Recommended: materialize heavy CLEAN transforms as tables with scheduled refresh (Snowflake tasks) for performance/cost predictability.
- Use estimate/version fields and event timestamps for landed-cost and shipment analytics; treat append-only entities accordingly.

## Notes / operational considerations

- **At-least-once export:** events are marked exported after upload; in rare failure/retry scenarios duplicates can be written to S3. Snowflake loads should be idempotent/deduplicated by `event_id` (and `source_file`) in RAW/CLEAN.
- **Schema evolution:** payload is stored as JSON/VARIANT; CLEAN transforms may need updates when columns change.
- **Security:** store secrets in env/secret managers (do not commit). Prefer IAM roles/storage integrations over static keys where possible.
- **Backfill:** existing rows present before `V3__cdc_outbox.sql` are not automatically emitted; to backfill, either snapshot/export tables to S3 separately or insert synthetic outbox events from current state.
- **Supabase compatibility:** trigger/outbox approach uses standard Postgres features available on Supabase.

## Files added/changed for this scaffold

- `backend/src/main/resources/db/migration/V3__cdc_outbox.sql` – outbox table + triggers
- `cdc-worker/` – Python worker, Dockerfile, env example
- `snowflake/*.sql` – RAW ingestion and CLEAN transform examples
- `docker-compose.yml`, `.env.example` – Supabase/CDC worker configuration scaffolding
- `docs/SUPABASE_CDC_SNOWFLAKE.md` – this guide
