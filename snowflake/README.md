# Snowflake CDC Pipeline (CAP-22)

Modular SQL for loading CDC files exported by `cdc-worker` from S3 into Snowflake and modeling them for analytics/Power BI.

**Target (current setup):** `CAP22_DB` with schemas `RAW`, `STAGING`, `MART`, warehouse `CAP22_WH` (XSMALL), role `CAP22_ROLE`.

**Source layout:** `s3://<S3_BUCKET>/<S3_PREFIX>/table_name=<table>/dt=YYYY-MM-DD/hour=HH/batch_<id>_<min>_<max>.jsonl.gz` (NDJSON, gzip).

## Placeholders (replace before running)
- `<S3_BUCKET>` — S3 bucket name
- `<S3_PREFIX>` — worker prefix (default `cdc/raw`, no leading/trailing slash)
- `<AWS_ROLE_ARN>` — IAM role ARN for storage integration (recommended)
- `<AWS_KEY_ID>` / `<AWS_SECRET_KEY>` — only if using key-based stage (not recommended)

## Execution order
Run files in order (some statements require `ACCOUNTADMIN` as noted inside files):

| Order | File | Purpose |
|---|---|---|
| 0 | `00_setup_and_grants.sql` | Context, ensure WH/DB/schemas/role exist, grants |
| 1 | `01_storage_integration.sql` | S3 storage integration + IAM trust-policy steps (`DESC`) |
| 2 | `02_file_format_and_stage.sql` | JSONL file format and external stage (integration or keys) |
| 3 | `03_raw_table.sql` | `RAW.CDC_EVENTS` landing table |
| 4 | `04_initial_load_and_validation.sql` | Initial `COPY INTO` from stage + validation queries |
| 5 | `05_ongoing_ingest.sql` | Ongoing loads: scheduled `TASK` (default) and `Snowpipe` option |
| 6 | `06_staging_views.sql` | Parsed/typed, deduped current-state + history views per entity |
| 7 | `07_mart_views.sql` | Business-ready dimensions/facts for Power BI |
| 8 | `08_ops_and_monitoring.sql` | Dedupe helper view, duplicate/load/task/pipe checks |

> `CAP22_SNOWFLAKE_COMPLETE_FLOW.sql` contains the same flow in a single script for reference.
