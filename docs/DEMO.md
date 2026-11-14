# Demo script

A ten-minute walk-through of what the current milestone (M0–M3) supports:
landed-cost estimation for the US and Germany, shipment event ingestion with
exception resolution, and an analytics shadow recompute that reconciles the
backend against DuckDB (or Snowflake).

Every number below is asserted by the backend and Python test suites.

> Duty and tax rates are simulated. This demo is not legal, tax, or customs
> advice.

## Prerequisites

```bash
docker compose up --build -d
curl -s localhost:8080/actuator/health
```

Open the console at http://localhost:3000 (or use the API directly below). Reset
with `docker compose down -v` if you want the seed data back.

The console has four tabs: **Estimates**, **Shipments**, **Exceptions**, and
**Analytics**. The API calls below mirror what each tab does.

Seed identifiers used in this script:

| Item | Value |
| --- | --- |
| US order | `30000000-0000-0000-0000-000000000001` (`ORD-US-1001`) |
| DE order | `30000000-0000-0000-0000-000000000002` (`ORD-DE-1002`) |
| US shipment | `70000000-0000-0000-0000-000000000001` (`SHIP-US-2001`, UPS) |
| DE shipment | `70000000-0000-0000-0000-000000000002` (`SHIP-DE-2002`, DHL) |
| Seeded DE carrier event | `DHL-EVT-1001` (`IN_TRANSIT`) |
| DE rule change | `2026-11-15T00:00:00Z` |
| FX before / after | `0.9259` (2026-11-10) / `0.9300` (2026-11-16) |

## 1. Show the two destinations

```bash
curl -s localhost:8080/api/v1/rules/destinations | jq
```

Expected: `US` (USD) and `DE` (EUR).

```bash
curl -s 'localhost:8080/api/v1/rules/versions?destination=DE' | jq
```

Expected: v1 effective until 2026-11-15, v2 effective from 2026-11-15. Both are
`PUBLISHED`.

## 2. US order — de minimis waives duty and tax

In the console: select `ORD-US-1001`, keep as-of `2026-11-10T12:00`, click
**Create estimate**.

```bash
curl -s -X POST localhost:8080/api/v1/orders/30000000-0000-0000-0000-000000000001/estimates \
  -H 'Content-Type: application/json' \
  -d '{"asOf":"2026-11-10T12:00:00Z"}' | jq \
  '{version, totalAmount, dutyAmount, taxAmount, feeAmount, deMinimisApplied, fx}'
```

Expected:

```json
{
  "version": 1,
  "totalAmount": 266.4,
  "dutyAmount": 0.0,
  "taxAmount": 0.0,
  "feeAmount": 6.4,
  "deMinimisApplied": true,
  "fx": { "rate": 1.0, "source": "IDENTITY" }
}
```

Talking point: CIF is USD 260.00, below the USD 800 threshold, and the US rule
waives both duty and tax. Only the brokerage fee remains.

## 3. German order — currency conversion and rule v1

Select `ORD-DE-1002` in the console and create an estimate at the same as-of.

```bash
DE_ORDER=30000000-0000-0000-0000-000000000002
FIRST=$(curl -s -X POST localhost:8080/api/v1/orders/$DE_ORDER/estimates \
  -H 'Content-Type: application/json' \
  -d '{"asOf":"2026-11-10T12:00:00Z"}')
echo "$FIRST" | jq '{id, version, totalAmount, dutyAmount, taxAmount, feeAmount, ruleVersion, fx}'
```

Expected:

- `totalAmount` **482.09 EUR**
- `dutyAmount` **10.26 EUR**
- `taxAmount` **75.49 EUR**
- `feeAmount` **9.31 EUR**
- `ruleVersion.version` **1**
- `fx.rate` **0.9259**, `fx.baseCurrency` **USD**, `fx.quoteCurrency` **EUR**

Talking point: order amounts are USD, the estimate is EUR. Freight and insurance
are allocated to lines; the last line absorbs the rounding residual so line
totals reconcile to the estimate total.

## 4. Recalculate after the rule and FX change

The console's **After DE rule change** button sets as-of to `2026-11-16T12:00`.
Then click **Recalculate as v2**.

```bash
FIRST_ID=$(echo "$FIRST" | jq -r '.id')
SECOND=$(curl -s -X POST localhost:8080/api/v1/estimates/$FIRST_ID/recalculate \
  -H 'Content-Type: application/json' \
  -d '{"asOf":"2026-11-16T12:00:00Z"}')
echo "$SECOND" | jq '{id, version, status, supersedesEstimateId, totalAmount, dutyAmount, ruleVersion, fx}'
```

Expected:

- `version` **2**, `supersedesEstimateId` = the v1 id
- `totalAmount` **490.67 EUR**
- `dutyAmount` **15.75 EUR** (electronics duty rises 2.0% → 3.5%)
- `ruleVersion.version` **2**
- `fx.rate` **0.9300**

```bash
SECOND_ID=$(echo "$SECOND" | jq -r '.id')
curl -s localhost:8080/api/v1/estimates/$SECOND_ID/comparison | jq \
  '{totalDelta, componentDeltas: [.componentDeltas[] | {code, delta}]}'
```

Expected: `totalDelta` **8.58 EUR**; `DUTY` delta **5.49 EUR**. The FX movement
and the rate change are both visible, and v1 is now `SUPERSEDED`.

Talking point: estimates are append-only. Nothing was edited; a new version was
appended with its own rule and FX snapshots, and the delta is attributable per
component.

## 5. Exposed assumptions and disclaimer

Every estimate response contains twelve assumptions. The console renders them
under **Exposed assumptions**.

```bash
curl -s localhost:8080/api/v1/meta/assumptions | jq '{disclaimer, count: (.assumptions | length)}'
curl -s localhost:8080/api/v1/estimates/$SECOND_ID | jq '.assumptions[] | {code, label, value}'
```

Talking points:

- A-05 records the exact FX observation, so the estimate is reproducible.
- A-07 records the de minimis comparison and which charges it waived.
- A-10 records the resolved rule version and its effective window.
- A-09 carries the simulated-rate disclaimer into the persisted estimate.

## 6. Shipments, duplicates, conflicts, and missing documents

Both seeded shipments are visible in the **Shipments** tab and via:

```bash
curl -s localhost:8080/api/v1/shipments | jq \
  '.[] | {shipmentNumber, status, missingDocuments, openExceptionCount}'
```

Expected:

- `SHIP-US-2001` — `CREATED`, 2 missing documents, 2 open exceptions.
- `SHIP-DE-2002` — `IN_TRANSIT`, 2 missing documents, 2 open exceptions.

The DE shipment already has one commercial invoice, so only its packing list and
customs declaration are outstanding.

### 6a. Duplicate carrier event (idempotent ingestion)

Replay the seeded `DHL-EVT-1001` event. The API returns the original event with
`duplicate=true`, does not change shipment state, and records one deduped
`DUPLICATE_CARRIER_EVENT` exception:

```bash
curl -s -X POST localhost:8080/api/v1/shipments/70000000-0000-0000-0000-000000000002/events \
  -H 'Content-Type: application/json' \
  -d '{"carrierEventId":"DHL-EVT-1001","eventType":"IN_TRANSIT",
       "occurredAt":"2026-11-11T06:00:00Z"}' | jq \
  '{duplicate, status: .shipment.status,
    duplicateExceptions: [.exceptions[] | select(.code=="DUPLICATE_CARRIER_EVENT")
      | {code, severity, status, dedupeKey}]}'
```

Expected: `duplicate: true`, shipment status unchanged (`IN_TRANSIT`), one
`DUPLICATE_CARRIER_EVENT` at `LOW` severity. Replaying it again does **not**
create a second exception: the dedupe key is `EVENT:DHL-EVT-1001`.

Talking point: the unique key is `(shipment_id, carrier_event_id)`. Duplicate
delivery from a carrier webhook is an operational note, not a state change.

### 6b. Conflicting carrier event (terminal precedence)

Use the US shipment, which has no events yet. First report `DELIVERED`, then a
later `IN_TRANSIT`. The terminal state wins; the contradiction is reported:

```bash
US_SHIP=70000000-0000-0000-0000-000000000001

curl -s -X POST localhost:8080/api/v1/shipments/$US_SHIP/events \
  -H 'Content-Type: application/json' \
  -d '{"carrierEventId":"UPS-EVT-9001","eventType":"DELIVERED",
       "occurredAt":"2026-11-12T09:00:00Z"}' | jq \
  '{status: .shipment.status, deliveredAt: .shipment.deliveredAt}'
# → DELIVERED

curl -s -X POST localhost:8080/api/v1/shipments/$US_SHIP/events \
  -H 'Content-Type: application/json' \
  -d '{"carrierEventId":"UPS-EVT-9002","eventType":"IN_TRANSIT",
       "occurredAt":"2026-11-12T12:00:00Z"}' | jq \
  '{status: .shipment.status,
    conflicts: [.exceptions[] | select(.code=="CONFLICTING_CARRIER_EVENT")
      | {code, severity, status, summary}]}'
```

Expected: shipment status stays `DELIVERED`, `deliveredAt` is
`2026-11-12T09:00:00Z`, and one `HIGH` `CONFLICTING_CARRIER_EVENT` is opened.
The later movement never overrides a terminal event.

Talking point: precedence is `DELIVERED` > `RETURNED` > latest non-terminal,
ordered by `occurred_at` then `received_at`. The conflict is attached only to the
event that introduced it, so replaying old events does not reopen it.

### 6c. Missing document and auto-resolution

The DE shipment is missing a packing list. Receiving it resolves the matching
exception automatically:

```bash
curl -s -X POST localhost:8080/api/v1/shipments/70000000-0000-0000-0000-000000000002/documents \
  -H 'Content-Type: application/json' \
  -d '{"documentType":"PACKING_LIST","reference":"PL-DE-2002"}' | jq \
  '{missingDocuments,
    packingList: [.exceptions[] | select(.dedupeKey=="DOC:PACKING_LIST")
      | {code, status, resolvedAt, resolutionNote}]}'
```

Expected: `missingDocuments` no longer contains `PACKING_LIST`; the
`MISSING_DOCUMENT` exception is `RESOLVED` with the note `Document received`.
`CUSTOMS_DECLARATION` remains missing.

### 6d. Manual acknowledge and resolve

Carrier conflicts and duplicates stay open until an operator closes them. The
**Exceptions** tab filters by status; the API is:

```bash
CONFLICT_ID=$(curl -s 'localhost:8080/api/v1/exceptions?status=OPEN' \
  | jq -r '.[] | select(.code=="CONFLICTING_CARRIER_EVENT") | .id' | head -1)

curl -s -X POST localhost:8080/api/v1/exceptions/$CONFLICT_ID/acknowledge \
  -H 'Content-Type: application/json' \
  -d '{"note":"Carrier contacted; delivery scan is authoritative"}' | jq \
  '{code, status, acknowledgedAt, resolutionNote}'

curl -s -X POST localhost:8080/api/v1/exceptions/$CONFLICT_ID/resolve \
  -H 'Content-Type: application/json' \
  -d '{"note":"Carrier confirmed delivered; stale transit scan"}' | jq \
  '{code, status, resolvedAt, resolutionNote}'
```

Talking point: exceptions affect delivery operations, not the landed-cost
estimate. Re-running an estimate after these events produces the same totals.

## 7. Analytics shadow recompute and reconciliation

The `analytics-worker` service polls Postgres for `REQUESTED` runs. Request one
from the **Analytics** tab or the API:

```bash
RUN=$(curl -s -X POST localhost:8080/api/v1/analytics/refresh \
  -H 'Content-Type: application/json' \
  -d '{"target":"DUCKDB","requestedBy":"demo"}')
echo "$RUN" | jq '{id, target, status}'
# → status REQUESTED

RUN_ID=$(echo "$RUN" | jq -r '.id')
```

Poll until it leaves `REQUESTED` (the worker polls every five seconds):

```bash
for i in $(seq 1 20); do
  STATUS=$(curl -s localhost:8080/api/v1/analytics/runs/$RUN_ID | jq -r '.status')
  echo "attempt $i: $STATUS"
  [ "$STATUS" = "SUCCEEDED" ] || [ "$STATUS" = "FAILED" ] && break
  sleep 2
done

curl -s localhost:8080/api/v1/analytics/runs/$RUN_ID | jq \
  '{status, estimatesExported, estimatesMatched, estimatesMismatched,
    artifactUri, message,
    results: [.results[] | {orderNumber, backendTotal, recomputedTotal, delta, matched}]}'
```

Expected after sections 2–4:

- `status` **SUCCEEDED**
- `estimatesExported` **3** (US v1, DE v1, DE v2 — superseded versions included)
- `estimatesMatched` **3**, `estimatesMismatched` **0**
- every reconciliation row `matched: true`, `delta: 0`
- `artifactUri` **`s3://cap22-analytics/runs/<run-id>/`**
- `message` includes `engine parity ok`

What happened:

1. The worker claimed the run with `FOR UPDATE SKIP LOCKED`.
2. It exported 16 tables to Parquet and uploaded them to SeaweedFS (the local S3
   emulator) under `runs/<run-id>/`.
3. It recomputed every estimate twice: once in Python `Decimal`, once with the
   shared SQL on DuckDB.
4. It compared backend vs recomputed per estimate, and Python vs DuckDB for
   engine parity, then wrote the rows back to Postgres.

Talking points:

- A `SUCCEEDED` run can still contain `matched: false` rows. That is a
  reconciliation finding, not an engine failure. `FAILED` means the pipeline
  itself could not complete or the two engines disagreed.
- Superseded estimates are reconciled from their own rule and FX snapshots, so
  the history stays auditable.
- Select `SNOWFLAKE` to exercise the same SQL against a configured Snowflake
  account. Without `SNOWFLAKE_*` variables the run fails fast with a clear
  message instead of silently falling back.

Inspect the artifacts written by the worker:

```bash
docker compose exec analytics-worker ls /app/data/analytics/runs/$RUN_ID
```

The same files were uploaded to `s3://cap22-analytics/runs/$RUN_ID/`; the
`artifactUri` field is the authoritative location for the run.

## 8. Error paths worth showing

```bash
# Recalculating an already superseded estimate
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  localhost:8080/api/v1/estimates/$FIRST_ID/recalculate \
  -H 'Content-Type: application/json' -d '{"asOf":"2026-11-16T12:00:00Z"}'
# → 409, code ESTIMATE_ALREADY_SUPERSEDED

# Unknown destination
curl -s -X POST localhost:8080/api/v1/orders \
  -H 'Content-Type: application/json' \
  -d '{"destinationCode":"ZZ","currency":"USD","customerRef":"CUST-X",
       "freightAmount":10,"insuranceAmount":2,
       "lines":[{"sku":"P-1001","quantity":1}]}' | jq '{code, detail}'
# → 404 DESTINATION_NOT_FOUND

# Document type the destination does not require
curl -s -X POST localhost:8080/api/v1/shipments/70000000-0000-0000-0000-000000000001/documents \
  -H 'Content-Type: application/json' \
  -d '{"documentType":"PHYTOSANITARY_CERTIFICATE"}' | jq '{code, detail}'
# → 400 UNKNOWN_DOCUMENT_TYPE

# Resolving an already resolved exception
curl -s -X POST localhost:8080/api/v1/exceptions/$CONFLICT_ID/resolve \
  -H 'Content-Type: application/json' -d '{"note":"again"}' | jq '{code, detail}'
# → 409 EXCEPTION_ALREADY_RESOLVED
```
