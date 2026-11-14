import os
from dataclasses import dataclass


def _get_bool(name: str, default: bool) -> bool:
    v = os.getenv(name)
    if v is None:
        return default
    return v.strip().lower() in {"1", "true", "yes", "y", "on"}


@dataclass
class Settings:
    database_url: str | None
    db_host: str
    db_port: int
    db_name: str
    db_user: str
    db_password: str
    db_sslmode: str | None

    s3_bucket: str
    s3_prefix: str
    aws_region: str
    s3_endpoint_url: str | None

    poll_seconds: float
    batch_size: int
    max_batches_per_cycle: int
    export_enabled: bool

    @classmethod
    def from_env(cls) -> "Settings":
        bucket = os.getenv("S3_BUCKET", "").strip()
        if not bucket:
            raise ValueError("S3_BUCKET is required")
        return cls(
            database_url=os.getenv("DATABASE_URL"),
            db_host=os.getenv("DB_HOST", "localhost"),
            db_port=int(os.getenv("DB_PORT", "5432")),
            db_name=os.getenv("DB_NAME", "postgres"),
            db_user=os.getenv("DB_USER", "postgres"),
            db_password=os.getenv("DB_PASSWORD", ""),
            db_sslmode=os.getenv("DB_SSLMODE"),
            s3_bucket=bucket,
            s3_prefix=os.getenv("S3_PREFIX", "cdc/raw").strip("/"),
            aws_region=os.getenv("AWS_REGION", "us-east-1"),
            s3_endpoint_url=os.getenv("S3_ENDPOINT_URL") or None,
            poll_seconds=float(os.getenv("CDC_POLL_SECONDS", "5")),
            batch_size=int(os.getenv("CDC_BATCH_SIZE", "500")),
            max_batches_per_cycle=int(os.getenv("CDC_MAX_BATCHES_PER_CYCLE", "10")),
            export_enabled=_get_bool("CDC_EXPORT_ENABLED", True),
        )
