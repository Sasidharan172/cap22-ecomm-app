# Analytics pipeline

The analytics path is a **read-only shadow** of the estimation engine. It never
edits estimates, rules, or FX data. It exports the persisted state, recomputes
every estimate independently, and writes reconciliation rows back to Postgres so
differences are visible instead of silent.

The pipeline exists to answer one question: _does the warehouse arrive at the
same landed cost as the backend, given the same inputs?_

## Lifecycle of a refresh run

```
console / CI / curl
        │  POST /api/v1/analytics/refresh
        ▼
analytics_refresh_runs  status=REQUESTED
        │  worker: SELECT … FOR UPDATE SKIP LOCKED
        ▼
                     status=RUNNING
        │
        ├─ export Postgres → Parquet
        ├─ publish Parquet to S3 (SeaweedFS locally)
        ├─ Python Decimal recompute (per estimate)
        ├─ DuckDB or Snowflake shadow recompute (same SQL)
        ├─ compare backend vs recomputed, and Python vs warehouse
        ▼
analytics_reconciliation_results + status=SUCCEEDED | FAILED
```

| State       | Meaning                                                                                       |
| ----------- | --------------------------------------------------------------------------------------------- |
| `REQUESTED` | The API created the run; no worker has claimed it yet.                                        |
| `RUNNING`   | A worker claimed it and is exporting/recomputing.                                             |
| `SUCCEEDED` | Export, both recomputes, and parity checks completed. Reconciliation rows exist.              |
| `FAILED`    | The worker errored, the warehouse adapter was unavailable, or Python/DuckDB parity disagreed. |

`SUCCEEDED` does **not** mean "backend and warehouse agree". A run where the
backend total differs from the warehouse total still succeeds: that difference is
the finding. `FAILED` is reserved for engine problems (parity mismatch, missing
rule version, unreachable warehouse).

Runs are claimed with `FOR UPDATE SKIP LOCKED`, so multiple workers can poll the
same table without double-processing. The local Compose stack runs one worker.

## API

```bash
# Request a run; target defaults to DUCKDB when omitted
curl -s -X POST localhost:8080/api/v1/analytics/refresh \
  -H 'Content-Type: application/json' \
  -d '{"target":"DUCKDB","requestedBy":"demo"}' | jq

# List runs (summaries, newest first)
curl -s localhost:8080/api/v1/analytics/runs | jq

# Latest run with reconciliation rows
curl -s localhost:8080/api/v1/analytics/runs/latest | jq \
  '{status, estimatesExported, estimatesMatched, estimatesMismatched, artifactUri, message, results}'

# A specific run
curl -s localhost:8080/api/v1/analytics/runs/<run-id> | jq
```

Targets are `DUCKDB` (local parity, always available) and `SNOWFLAKE` (requires
full Snowflake configuration; fails fast otherwise).

## What gets exported

The worker writes one Parquet file per table plus `_manifest.json`:

```
runs/<run-id>/
  destinations.parquet
  products.parquet
  orders.parquet
  order_lines.parquet
  rule_versions.parquet
  duty_rules.parquet
  tax_rules.parquet
  fee_schedules.parquet
  fx_rates.parquet
  estimates.parquet
  estimate_components.parquet
  estimate_lines.parquet
  shipments.parquet
  shipment_events.parquet
  shipment_documents.parquet
  delivery_exceptions.parquet
  _manifest.json
```

The manifest records row counts, column names, and the generation timestamp.
Exports are full-table snapshots: the demo dataset is small and correctness is
easier to reason about than incremental watermarks. A production build would
switch to incremental/watermark queries (see the ADR's "Revisit when").

With `S3_ENDPOINT` set, artifacts are uploaded under
`s3://<bucket>/runs/<run-id>/` and that prefix is stored in `artifact_uri`. With
no endpoint, artifacts stay in `ANALYTICS_DATA_DIR` and the URI is a local
`file://` path. Either way the URI is stable for the run.

## Recomputation

There are two independent recomputes, and they must agree with each other:

1. **Python `Decimal` engine** (`cap22_analytics/engine.py`) — a second
   implementation of the Java calculator, using exact decimal arithmetic.
2. **Warehouse SQL** (`cap22_analytics/sql/recompute.sql`) — the same arithmetic
   expressed in SQL, run on DuckDB locally and Snowflake in the cloud.

Both follow the documented rules:

- CIF customs value (goods + freight + insurance);
- freight/insurance allocated by raw line goods value, rounding residual on the
  last line;
- duty/tax rates matched by the **longest HS prefix**;
- de minimis evaluated once against total customs value;
- every component rounded `HALF_UP` to 2 decimals, total = sum of components.

The shared SQL is deliberately dialect-neutral: `QUALIFY ROW_NUMBER()`, window
sums, and `ROUND` are supported by both DuckDB and Snowflake.

### Tolerances

| Comparison            | Tolerance | Meaning                                                                    |
| --------------------- | --------- | -------------------------------------------------------------------------- |
| Backend vs recomputed | `0.005`   | Same money, allowing for storage rounding. Outside this → `matched=false`. |
| Python vs warehouse   | `0.005`   | Engine parity. Outside this → the run is `FAILED`.                         |

A non-matching row is still written. The run summary counts
`estimates_matched` / `estimates_mismatched`, and each row stores the signed
`delta` plus component detail (goods, customs, duty, tax, fee, line count).

## Snowflake target

`cap22_analytics/sql/snowflake_ddl.sql` creates staging tables matching the
exported Parquet columns. When `target=SNOWFLAKE`:

1. the worker connects with the configured account/user/password/warehouse/
   database/schema/role;
2. applies the DDL (`CREATE TABLE IF NOT EXISTS`);
3. loads each Parquet file with `write_pandas(overwrite=True)`;
4. executes the same `recompute.sql`;
5. writes reconciliation rows back to Postgres.

The adapter is configuration-gated. If any of `SNOWFLAKE_ACCOUNT`,
`SNOWFLAKE_USER`, `SNOWFLAKE_PASSWORD`, `SNOWFLAKE_WAREHOUSE`, or
`SNOWFLAKE_DATABASE` is missing, a `SNOWFLAKE` run is marked `FAILED` with an
explicit message rather than silently falling back.

CI does not exercise Snowflake (no account). DuckDB runs the identical SQL on
the exported files, which is the parity gate that keeps the SQL honest.

### Snowpipe

Snowpipe is intentionally deferred. There is no pipe DDL, SQS queue, or S3 event
notification in the repository. See
[adr/0001-defer-snowpipe.md](adr/0001-defer-snowpipe.md) for the decision and
the conditions that would justify revisiting it.

## Scheduling

`.github/workflows/analytics-refresh.yml` requests a run on a daily schedule
(06:00 UTC) and on `workflow_dispatch`, then polls until the run reaches a
terminal state. It requires the repository secret `CAP22_API_BASE` (for example
`https://api.example.com`) and a worker that is running against the same
database.

The workflow fails if the API rejects the request, the run reports `FAILED`, or
the worker does not finish within ten minutes. On success it prints the run
summary and reconciliation rows to the job log.

## Running locally

The Compose stack starts `analytics-worker` automatically:

```bash
docker compose up --build
curl -s -X POST localhost:8080/api/v1/analytics/refresh \
  -H 'Content-Type: application/json' -d '{"target":"DUCKDB"}' | jq
# poll the run
curl -s localhost:8080/api/v1/analytics/runs/latest | jq \
  '{status, estimatesExported, estimatesMatched, estimatesMismatched, artifactUri}'
```

Outside Compose:

```bash
cd analytics
python3.12 -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
DB_URL=jdbc:postgresql://localhost:5432/cap22 \
S3_ENDPOINT=http://localhost:8333 S3_BUCKET=cap22-analytics \
S3_ACCESS_KEY=cap22 S3_SECRET_KEY=cap22-local-dev \
python -m cap22_analytics.worker --once
```

`--once` drains all currently `REQUESTED` runs and exits; without it the worker
polls every `ANALYTICS_POLL_SECONDS`.

## Expected demo result

With the estimates created by [DEMO.md](DEMO.md), a successful DuckDB run
reports matches for every persisted version:

| Order         | Version | Backend    | Recomputed | Result |
| ------------- | ------- | ---------- | ---------- | ------ |
| `ORD-US-1001` | v1      | 266.40 USD | 266.40 USD | match  |
| `ORD-DE-1002` | v1      | 482.09 EUR | 482.09 EUR | match  |
| `ORD-DE-1002` | v2      | 490.67 EUR | 490.67 EUR | match  |

The run always reconciles _all_ persisted estimates, including superseded
versions. That is deliberate: superseded estimates must remain reproducible from
their own rule and FX snapshots. If the demo has not recalculated yet, the run
exports two estimates instead of three; the counts in the run response always
describe what was actually present.

## Failure modes worth knowing

| Symptom                                        | Cause                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------- |
| Run stays `REQUESTED`                          | No worker is running, or the worker cannot reach Postgres.          |
| Run `FAILED` with `SNOWFLAKE … not configured` | Missing Snowflake environment variables.                            |
| Run `FAILED` with `engine_parity=MISMATCH`     | Python engine and warehouse SQL disagree; treat as a code bug.      |
| Run `SUCCEEDED`, row `matched=false`           | Backend and warehouse totals differ; inspect `delta` and `details`. |
| `artifact_uri` is a `file://` path             | `S3_ENDPOINT` was not set; artifacts are local.                     |
| Worker logs `could not poll for refresh runs`  | Migrations have not run yet; the worker retries.                    |

## Carrier webhook ingestion (M4.2)

The backend now exposes a provider-adapter boundary for simulated carrier webhooks:

- `POST /api/v1/carriers/{carrier}/webhooks` accepts a provider event and retains its raw JSON payload in the durable webhook inbox.
- `GET /api/v1/carriers/webhooks/{id}` retrieves the inbox record and processing outcome.
- `POST /api/v1/carriers/webhooks/{id}/retry` retries records that were previously unmatched or unmapped.

Supported adapter identifiers are `DHL`, `UPS`, and `FEDEX`. The current event-code maps are deliberately small **demonstration mappings**, not official or exhaustive carrier API specifications. Real integrations must validate the current carrier webhook schema, authentication/signature mechanism, event-code catalogue, retry policy, and tracking-number semantics against each carrier's official documentation.

Webhook deliveries are idempotent on `(carrier, external_event_id)`. The raw payload is retained, then normalized to the platform's `ShipmentEventType` and sent through the existing `ShipmentService`; the existing shipment status precedence and exception rules remain the single source of business logic. Unmatched tracking numbers and unknown provider event codes are retained with explicit statuses instead of being discarded.


## Incremental Supabase/PostgreSQL -> S3 -> Snowflake -> Power BI path

The business database is the operational source of truth. Supabase is PostgreSQL,
so the Spring Boot application and Python worker connect using its PostgreSQL
connection string. Use Supabase's **direct database connection** for Flyway
migrations where available; transaction-pooler endpoints are not suitable for
all migration/session operations. Enable SSL (`sslmode=require`) and use a
least-privilege runtime role.

Migration `V8__analytics_transactional_outbox.sql` creates a transactional
outbox and triggers on the business tables. Each insert/update/delete is captured
in the same database transaction as the business change. The migration also
queues a one-time initial snapshot of existing rows.

When Snowflake credentials and `SNOWFLAKE_STAGE` are configured, the analytics
worker claims a bounded batch using `FOR UPDATE SKIP LOCKED`, writes a Parquet
file and manifest, uploads them under `s3://<bucket>/cdc/<batch-id>/`, then
issues Snowflake `COPY INTO RAW.CHANGE_EVENTS` from the external stage. Only
after Snowflake confirms the load does the worker mark the Postgres outbox rows
delivered. Failed batches are released for retry and remain visible with
`last_error` and `attempts`. The raw event log is append-only; CLEAN rebuilds
select the latest event per source record and are safe to rerun.

### One-time Snowflake setup

1. Run `analytics/cap22_analytics/sql/snowflake_setup.sql` after replacing
   `YOUR_BUCKET` and `CAP22_S3_STORAGE_INTEGRATION`.
2. Configure the Snowflake storage integration's AWS IAM principal with
   read/list permissions for the bucket's `cdc/` prefix.
3. Set the worker's `SNOWFLAKE_STAGE` to
   `@CAP22_DB.RAW.CAP22_S3_STAGE`, plus account/user/password/warehouse/database.
4. Configure S3 credentials for the worker to upload to that bucket. For AWS,
   set `S3_ENABLED=true`, leave `S3_ENDPOINT` empty, and provide an IAM role or
   scoped access keys. Locally, SeaweedFS is the S3-compatible endpoint.
5. Start the worker. It continuously drains the outbox in batches and refreshes
   CLEAN tables after each successful RAW load.

`clean_transform.sql` creates persisted CLEAN dimensions/facts and Power BI
aggregate views. The reporting model and DAX measures are documented in
[`powerbi/DAX_MEASURES.md`](../powerbi/DAX_MEASURES.md). Power BI connects to
Snowflake's CLEAN schema; it does not connect to the operational Supabase DB.

The older `/api/v1/analytics/refresh` request remains available for independent
landed-cost recomputation and reconciliation. It is a quality-control workflow,
not the CDC transport path.


## Verified exception-resolution workflow

An exception is not resolved by a status-only API call. `POST
/api/v1/exceptions/{id}/resolve` is retained for compatibility but returns
`VERIFIED_ACTION_REQUIRED`.

- Acknowledge/assign: `POST /api/v1/exceptions/{id}/acknowledge` with `actor`
  and an acknowledgement `note`.
- Missing document: register the externally stored document reference with
  `POST /api/v1/shipments/{shipmentId}/documents`, then verify it with
  `POST /api/v1/shipments/{shipmentId}/documents/{documentId}/verify`. Only a
  verified document satisfies a destination requirement and automatically
  resolves its matching exception. The reference should identify the actual
  stored artifact (for example an S3 object key); this API records metadata and
  verification, it does not itself upload file bytes.
- Duplicate carrier event: acknowledge, then use
  `POST /api/v1/exceptions/{id}/actions` with `actionType=REVIEW_DUPLICATE_EVENT`
  and an evidence reference. The original event must still exist; the replay is
  confirmed as idempotent and the original event remains authoritative.
- Conflicting carrier event: acknowledge, then submit
  `actionType=ADJUDICATE_CARRIER_EVENT`, `selectedEventId`, a reviewer, details,
  and evidence reference. The selected event must belong to the shipment; the
  shipment's effective event and derived status are recalculated from it.

`GET /api/v1/exceptions/{id}/actions` and `/activities` expose the corrective
action and audit trail. User identity is accepted from the request at present;
production deployment should derive the actor from authenticated Spring
Security principals rather than trusting a client-supplied actor string.


### Example operator requests

```bash
# Acknowledge and assign
curl -X POST "$API/api/v1/exceptions/$EXCEPTION_ID/acknowledge" \
  -H 'Content-Type: application/json' \
  -d '{"actor":"customs_ops","note":"Assigned for document review"}'

# Move acknowledged exception into active work
curl -X POST "$API/api/v1/exceptions/$EXCEPTION_ID/start" \
  -H 'Content-Type: application/json' \
  -d '{"actor":"customs_ops","note":"Checking carrier evidence"}'

# Record a document reference (for example, an object key already uploaded to S3)
curl -X POST "$API/api/v1/shipments/$SHIPMENT_ID/documents" \
  -H 'Content-Type: application/json' \
  -d '{"documentType":"COMMERCIAL_INVOICE","reference":"s3://cap22-documents/invoice-1001.pdf"}'

# Verify the recorded document. Only this verified state satisfies the checklist.
curl -X POST "$API/api/v1/shipments/$SHIPMENT_ID/documents/$DOCUMENT_ID/verify" \
  -H 'Content-Type: application/json' \
  -d '{"verifiedBy":"customs_ops","verificationNote":"Checked required fields and invoice reference"}'

# Review an idempotent duplicate carrier event
curl -X POST "$API/api/v1/exceptions/$EXCEPTION_ID/actions" \
  -H 'Content-Type: application/json' \
  -d '{"actionType":"REVIEW_DUPLICATE_EVENT","performedBy":"ops","details":"Original event verified; replay made no state change","evidenceReference":"CASE-1001"}'

# Adjudicate conflicting carrier events using the selected event's UUID
curl -X POST "$API/api/v1/exceptions/$EXCEPTION_ID/actions" \
  -H 'Content-Type: application/json' \
  -d '{"actionType":"ADJUDICATE_CARRIER_EVENT","performedBy":"ops","details":"Carrier portal confirms selected scan","evidenceReference":"CARRIER-CASE-22","selectedEventId":"<shipment-event-uuid>"}'

# Read the full audit trail
curl "$API/api/v1/exceptions/$EXCEPTION_ID/activities"
curl "$API/api/v1/exceptions/$EXCEPTION_ID/actions"
```
