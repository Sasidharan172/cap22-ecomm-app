# ADR 0001 — Defer Snowpipe; use pull-based analytics refresh

- **Status:** Accepted
- **Date:** 2026-11-11
- **Deciders:** CAP-22 engineering
- **Related:** `docs/RULES.md`, roadmap M3

## Context

The platform must load estimate data into Snowflake, independently recompute
landed cost there ("shadow recompute"), and reconcile the warehouse result
against the backend estimate. The original brief mentioned Snowpipe-style
continuous ingestion as one option.

Constraints at this stage:

- The demo runs locally with SeaweedFS standing in for S3 and DuckDB standing in
  for Snowflake. (MinIO was the original choice, but its public images are no
  longer distributable without credentials.)
- Ingestion volume is small and bursty (demo data, not production traffic).
- Snowpipe requires an S3 event notification, an SQS queue, IAM roles, and a
  storage integration. That is a meaningful amount of cloud wiring to carry
  before the analytics model and reconciliation contract are stable.
- The pipeline must be triggerable on demand from the application and on a
  schedule from CI.

## Decision

Do **not** implement Snowpipe now.

- Refresh is **pull-based**:
  - on demand via `POST /api/v1/analytics/refresh` (M3), and
  - on a schedule via a GitHub Actions workflow (M3).
- The export path writes Parquet to S3 (SeaweedFS locally), and the loader reads that prefix
  into DuckDB locally or Snowflake in the cloud.
- Snowflake objects, storage-integration DDL, and load scripts may be committed
  as deployment assets, but no pipe DDL, SQS queue, or S3 event notification is
  created.
- Reconciliation is part of the job: Snowflake recomputes each estimate from the
  same rule/FX inputs and reports row-level differences; the backend remains the
  system of record.

## Consequences

Positive:

- No cloud event plumbing to build, secure, and debug before the data contract
  is settled.
- The same Parquet artefacts work for DuckDB and Snowflake, keeping local parity.
- Backfills and reruns are ordinary job invocations, not queue replays.
- Failures are visible in CI/job logs rather than in a pipe's error queue.

Negative / accepted risks:

- Latency between backend change and warehouse availability is bounded by the
  schedule (or an explicit refresh call), not seconds.
- The scheduled job must handle overlap/idempotency itself (per-run staging
  prefix and `MERGE`/replace semantics).
- Very high event volumes would eventually make pull-based export inefficient.

## Alternatives considered

1. **Snowpipe with S3 event notifications + SQS.** Best freshness, but too much
   cloud surface for the current milestone and unnecessary at demo volume.
2. **Snowflake Kafka connector.** Adds a broker and streaming semantics the
   project does not otherwise need.
3. **Application writes directly to Snowflake.** Couples the API's transaction
   path to the warehouse and weakens the local-first constraint.
4. **Snowflake tasks on a staged prefix.** Still requires a load mechanism;
   deferring with the rest of the warehouse work.

## Revisit when

- Sustained ingestion latency requirements fall below the schedule interval.
- Event volume makes full/incremental pull exports the bottleneck.
- The Parquet schema and reconciliation contract have been stable for a full
  release cycle.
- Cloud IAM and networking for S3 → SQS → Snowpipe can be reviewed and tested
  as a unit.

## Explicitly not in the repository

To avoid implying capability that does not exist yet:

- no `CREATE PIPE` statements,
- no SQS queue definitions or S3 event configuration,
- no Snowflake storage integration objects,
- no claim that the refresh endpoint existed when this ADR was written; it
  shipped with M3.
