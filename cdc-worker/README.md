# CDC Worker (Postgres outbox -> S3 JSONL)

Polls `cdc_outbox` changes and uploads partitioned gzip JSONL files to S3 for Snowflake ingestion.

## Quick start
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # set DATABASE_URL (Supabase) and S3_* / AWS_* values
python -m cdc_worker.worker
```

See `../docs/SUPABASE_CDC_SNOWFLAKE.md` for end-to-end setup.
