# CAP-22 · Cross-Border E-Commerce Duty & Delivery Exception Resolver

A local-first, cloud-ready reference implementation of cross-border landed-cost
estimation and delivery-exception resolution.

The current milestone (M0–M3) delivers a working estimation engine, an
append-only estimate history, shipment event ingestion with delivery-exception
resolution, an analytics export/shadow-recompute pipeline, an operations
console, containerised local infrastructure, and CI. Cloud deployment and the
Power BI model are planned in later milestones and are called out explicitly
below.

> **Simulated rates.** Duty and tax rates in this repository are simulated for
> demonstration. They are not legal, tax, or customs advice and must not be used
> for real customs filings.

## What works today

- Landed-cost estimates for **US** and **Germany** destinations.
- Effective-dated rule versions with a demonstrable German rate change on
  **2026-11-15**.
- FX conversion with the exact rate observation persisted per estimate.
- CIF customs value, per-line freight/insurance allocation, duty, import tax,
  and brokerage fee, all rounded deterministically.
- De minimis handling (US waives duty and tax; Germany waives duty only).
- Append-only estimate versions: recalculation creates `v+1`, marks the previous
  version `SUPERSEDED`, and exposes component-level deltas.
- Twelve persisted assumptions and a simulated-rate disclaimer on every
  estimate.
- React operations console to select an order, choose an as-of timestamp, create
  and recalculate estimates, and inspect the breakdown.
- Shipment tracking with append-only carrier events, idempotent ingestion keyed
  on `(shipment, carrier event id)`, and terminal-state precedence
  (`DELIVERED` > `RETURNED` > latest non-terminal).
- Missing-document detection driven by destination requirements; exceptions
  auto-resolve when the document is received.
- Deduped operational exceptions for missing documents, duplicate carrier
  events, and conflicting carrier events, with acknowledge/resolve actions.
- Analytics refresh runs: Parquet export to S3/SeaweedFS, independent Python
  `Decimal` recompute, DuckDB (or Snowflake) shadow recompute, and per-estimate
  reconciliation back into Postgres.
- Postgres schema managed by Flyway, deterministic demo seed data, OpenAPI docs.
- 26 backend tests (5 pure calculator, 21 Testcontainers API) and 11 Python
  analytics tests, including golden totals and DuckDB parity.
- Docker Compose stack (Postgres, API, console, analytics worker, local S3
  emulator) and GitHub Actions CI plus a scheduled analytics refresh workflow.

## Stack status

| Technology | Role | Status |
| --- | --- | --- |
| Spring Boot 4.1 / Java 21 | Estimation API | Implemented |
| React 18 + TypeScript + Vite | Operations console | Implemented |
| SQL / PostgreSQL 16 | System of record, Flyway migrations | Implemented |
| Docker / Compose | Local stack | Implemented |
| GitHub Actions | CI (tests, build, compose validation) | Implemented |
| SeaweedFS (local S3 emulator) | S3-compatible object storage | Implemented (Parquet artifacts) |
| Python / Pandas | Analytics export and shadow recompute | Implemented |
| DuckDB | Local Snowflake parity mode | Implemented |
| Snowflake | Warehouse reconciliation target | DDL + shared SQL ready; adapter enabled by config |
| Power BI | Operations dashboards | Planned M4 |
| AWS S3 / EC2 / Elastic Beanstalk / Route 53 / IAM | Cloud deployment path | Planned M4–M5 |

## Architecture

```
┌────────────────────┐        ┌──────────────────────────┐
│ React console      │  /api  │ Spring Boot API          │
│ (nginx or Vite)    │───────▶│ orders · estimates       │
└────────────────────┘        │ rules · FX · assumptions │
                              └────────────┬─────────────┘
                                           │ JDBC / Flyway
                                           ▼
                              ┌──────────────────────────┐
                              │ PostgreSQL 16            │
                              │ rule_versions · fx_rates │
                              │ estimates (append-only)  │
                              │ shipments · exceptions   │
                              │ analytics runs/results   │
                              └────────────┬─────────────┘
                                           │ export
                                           ▼
                     ┌───────────────────────────────────────┐
                     │ analytics worker (Python + Pandas)    │
                     │ Parquet → S3 / SeaweedFS locally     │
                     │ Decimal recompute + DuckDB parity    │
                     │ Snowflake target (optional)          │
                     │ Reconciliation rows back to Postgres │
                     └───────────────────────────────────────┘
```

The estimation API is the system of record. The analytics path never mutates
estimates: it recomputes them independently and reports differences for
reconciliation. The worker is pull-based: the backend writes a `REQUESTED` run,
and the worker claims it with `FOR UPDATE SKIP LOCKED`. See
[docs/ANALYTICS.md](docs/ANALYTICS.md) and
[docs/adr/0001-defer-snowpipe.md](docs/adr/0001-defer-snowpipe.md).

## Repository layout

```
backend/                 Spring Boot API, Flyway migrations, tests
frontend/                React + TypeScript console
analytics/               Python worker, shared recompute SQL, pytest suite
docs/                    Assumptions, rules, analytics, demo script, ADRs
docker-compose.yml       Postgres, S3 emulator, API, console, analytics worker
.github/workflows/       CI and scheduled analytics refresh
```

## Quickstart (Docker Compose)

Requirements: Docker with Compose v2.

```bash
docker compose up --build
```

| Service | URL |
| --- | --- |
| Operations console | http://localhost:3000 |
| API | http://localhost:8080 |
| OpenAPI UI | http://localhost:8080/swagger-ui.html |
| Health | http://localhost:8080/actuator/health |
| Local S3 endpoint | http://localhost:8333 (`cap22` / `cap22-local-dev`) |

Flyway applies the schema and seed data automatically on first start. The
`analytics-worker` service polls Postgres for refresh requests and writes
reconciliation results; request one from the console's **Analytics** tab or with
the API below. To reset local state, `docker compose down -v`.

## Local development

Start only the infrastructure:

```bash
docker compose up -d postgres
```

Run the API (defaults: `jdbc:postgresql://localhost:5432/cap22`, `cap22`/`cap22`):

```bash
cd backend
mvn spring-boot:run
```

Run the console with a dev proxy to port 8080:

```bash
cd frontend
npm install
npm run dev
```

Run the analytics worker against the same database when you need refresh runs
(see [docs/ANALYTICS.md](docs/ANALYTICS.md) for environment variables):

```bash
cd analytics
python -m cap22_analytics.worker        # poll continuously
python -m cap22_analytics.worker --once # drain requested runs and exit
```

## API tour

```bash
# Seeded orders
curl -s localhost:8080/api/v1/orders | jq

# Destinations and effective-dated rule versions
curl -s localhost:8080/api/v1/rules/destinations | jq
curl -s 'localhost:8080/api/v1/rules/versions?destination=DE' | jq

# Create an estimate for the German order before the rule change
curl -s -X POST localhost:8080/api/v1/orders/30000000-0000-0000-0000-000000000002/estimates \
  -H 'Content-Type: application/json' \
  -d '{"asOf":"2026-11-10T12:00:00Z"}' | jq
# → totalAmount 482.09 EUR, ruleVersion.version 1, fx.rate 0.9259

# Recalculate after the rule and FX change
curl -s -X POST localhost:8080/api/v1/estimates/<estimate-id>/recalculate \
  -H 'Content-Type: application/json' \
  -d '{"asOf":"2026-11-16T12:00:00Z"}' | jq
# → totalAmount 490.67 EUR, ruleVersion.version 2, fx.rate 0.9300

# Component-level delta against the previous version
curl -s localhost:8080/api/v1/estimates/<new-estimate-id>/comparison | jq
# → totalDelta 8.58, duty delta 5.49

# Assumption register and disclaimer
curl -s localhost:8080/api/v1/meta/assumptions | jq

# Shipments and their missing-document state
curl -s localhost:8080/api/v1/shipments | jq
curl -s localhost:8080/api/v1/shipments/70000000-0000-0000-0000-000000000002 | jq

# Idempotent carrier ingestion: replaying the same id returns duplicate=true
curl -s -X POST localhost:8080/api/v1/shipments/70000000-0000-0000-0000-000000000002/events \
  -H 'Content-Type: application/json' \
  -d '{"carrierEventId":"DHL-EVT-DEMO-1","eventType":"IN_TRANSIT",
       "occurredAt":"2026-11-12T10:00:00Z"}' | jq

# Receive a required document; the matching exception auto-resolves
curl -s -X POST localhost:8080/api/v1/shipments/70000000-0000-0000-0000-000000000002/documents \
  -H 'Content-Type: application/json' \
  -d '{"documentType":"PACKING_LIST","reference":"PL-DE-2002"}' | jq \
  '{status, missingDocuments, exceptions: [.exceptions[] | {code, status}]}'

# Exception queue
curl -s 'localhost:8080/api/v1/exceptions?status=OPEN' | jq

# Request an analytics refresh (the worker claims it)
curl -s -X POST localhost:8080/api/v1/analytics/refresh \
  -H 'Content-Type: application/json' -d '{"target":"DUCKDB"}' | jq
curl -s localhost:8080/api/v1/analytics/runs/latest | jq \
  '{status, estimatesExported, estimatesMatched, estimatesMismatched, artifactUri, results}'
```

The full walkthrough with expected values is in [docs/DEMO.md](docs/DEMO.md).

## Testing

```bash
cd backend && mvn -B verify                       # 26 tests; Testcontainers needs Docker
cd frontend && npm ci && npm run build            # type-check + production bundle
cd analytics && python -m pytest                  # 11 tests (Decimal engine + DuckDB parity)
```

The API tests assert exact monetary totals, rule-version selection, FX snapshots,
recalculation deltas, idempotent carrier ingestion, exception precedence, and
error codes. The Python suite asserts the same golden totals independently and
checks that the shared warehouse SQL returns identical results on DuckDB.
Changing calculation semantics will intentionally break both suites.

The analytics tests need the package installed once:
`cd analytics && python -m pip install -e '.[dev]'`.

Testcontainers is pinned to `1.21.4` because Docker 29+ refuses clients that
send the old fixed API version (`1.32`); `1.21.4` negotiates with the daemon.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `DB_URL` | `jdbc:postgresql://localhost:5432/cap22` | JDBC URL |
| `DB_USER` / `DB_PASSWORD` | `cap22` / `cap22` | Database credentials |
| `SERVER_PORT` | `8080` | API port |
| `S3_ENDPOINT` | unset | S3-compatible endpoint for analytics artifacts |
| `S3_BUCKET` | `cap22-analytics` (worker) | Analytics bucket |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | unset | S3 credentials |
| `ANALYTICS_DATA_DIR` | `data/analytics` | Local Parquet working directory |
| `ANALYTICS_POLL_SECONDS` | `5` | Worker poll interval |
| `SNOWFLAKE_ACCOUNT` / `SNOWFLAKE_USER` / `SNOWFLAKE_PASSWORD` | unset | Enable the Snowflake target |
| `SNOWFLAKE_WAREHOUSE` / `SNOWFLAKE_DATABASE` / `SNOWFLAKE_SCHEMA` / `SNOWFLAKE_ROLE` | unset / `PUBLIC` / unset | Snowflake target context |

The analytics worker also accepts `DATABASE_URL` (a standard Postgres DSN) and
injects `DB_USER`/`DB_PASSWORD` when the URL has no credentials. Snowflake is
only enabled when account, user, password, warehouse, and database are all set;
otherwise a `SNOWFLAKE` run fails fast with a clear message.

The console reads `VITE_API_BASE` at build time; leave it empty when nginx
proxies `/api` to the backend.

## Documentation

- [docs/ASSUMPTIONS.md](docs/ASSUMPTIONS.md) — A-01…A-12, rationale, limits.
- [docs/RULES.md](docs/RULES.md) — rule resolution, calculation order, rounding.
- [docs/ANALYTICS.md](docs/ANALYTICS.md) — export, shadow recompute, parity, Snowflake target.
- [docs/DEMO.md](docs/DEMO.md) — scripted demo and expected numbers.
- [docs/adr/0001-defer-snowpipe.md](docs/adr/0001-defer-snowpipe.md) — Snowpipe decision.

## Roadmap

| Milestone | Scope |
| --- | --- |
| M0–M2 (done) | Scaffold, schema/seed, rules/FX/landed cost, estimates API, tests, console, Compose, CI |
| M3 (done) | Shipment events, idempotent carrier ingestion, missing-document detection, exception precedence; Python/Pandas export; Parquet on S3; DuckDB parity; Snowflake shadow recompute and reconciliation; on-demand and scheduled refresh |
| M4 | Power BI semantic model and dashboards; operational reporting on the reconciliation data |
| M5 | AWS deployment: Elastic Beanstalk/EC2, Route 53, IAM, GitHub Actions delivery |

## Non-goals and known limits

- Duty/tax rates are simulated and incomplete; real tariff schedules, quotas,
  anti-dumping duties, and destination sales tax are out of scope.
- Warehouse ingestion is pull-based and full-refresh. Snowpipe is deferred; see
  [docs/adr/0001-defer-snowpipe.md](docs/adr/0001-defer-snowpipe.md).
- The Snowflake adapter ships with DDL and shared SQL but is not exercised by CI
  (no Snowflake account); DuckDB is the parity gate for the same SQL.
- The analytics worker processes one run at a time and assumes a small demo
  dataset; production would add incremental exports and backpressure.
- Power BI is not built yet; reconciliation rows and Parquet exports are the
  intended inputs.
- Authentication/authorisation is not implemented; this is a local demo.
- Multi-currency triangulation is not modelled; a direct rate must exist (or the
  currencies must match).

### Carrier webhook API (M4.2)

The backend includes simulated adapter mappings for DHL, UPS, and FedEx. Example:

```bash
curl -X POST http://localhost:8080/api/v1/carriers/DHL/webhooks \\
  -H 'Content-Type: application/json' \\
  -d '{"eventId":"DHL-10001","trackingNumber":"JD0146000062812345",\
       "eventCode":"IT","occurredAt":"2026-11-12T10:00:00Z",\
       "rawPayload":{"provider":"DHL","status":"in_transit"}}'
```

The webhook inbox is idempotent on carrier plus provider event ID. Inspect a delivery with
`GET /api/v1/carriers/webhooks/{id}` and retry an unmatched or unmapped record with
`POST /api/v1/carriers/webhooks/{id}/retry`. The included event-code maps are demonstration
fixtures, not official carrier specifications; production use requires provider-specific
signature verification and schema validation.


## Analytics delivery architecture

Supabase PostgreSQL is the operational source of truth. A PostgreSQL
transactional outbox captures inserts, updates and deletes. The Python worker
batches these changes into Parquet, uploads immutable batch files to S3, and
loads Snowflake RAW through an external stage and `COPY INTO`. Idempotent
transformations build persisted CLEAN fact/dimension tables and Power BI views.
See [docs/ANALYTICS.md](docs/ANALYTICS.md) and [powerbi/DAX_MEASURES.md](powerbi/DAX_MEASURES.md).

For deployment, configure `.env` from `.env.example`; never commit real
Supabase, AWS, or Snowflake credentials.


## Evidence-backed exception resolution

The operations console no longer offers a status-only Resolve button. Operators
acknowledge and assign exceptions first. Missing-document exceptions require a
recorded document reference and a separate verification action. Duplicate
carrier events require an evidence-backed review. Conflicting carrier events
require selecting the authoritative event, after which shipment status and the
effective-event flag are recalculated. Action and activity records are retained
and captured by the analytics outbox. See `docs/ANALYTICS.md` for endpoint
examples and workflow rules.

## Frontend workflow (updated)

The operations UI now opens on **Orders** and remembers the last selected workspace tab in browser storage. The intended operator journey is:

1. **Orders** — create an order using the seeded product catalog, destination list, quantities, prices, freight and insurance. The order is persisted through `POST /api/v1/orders`.
2. **Estimates** — select an order and choose the effective timestamp. “Calculate landed cost” creates an immutable estimate version using the applicable destination rules and FX snapshot. Recalculation creates a new version so operators can compare the impact of rule or input changes. It does not submit a customs declaration or collect payment.
3. **Shipments** — create a shipment linked to an existing order, then record carrier events and document references. Documents must be verified; recording a reference alone does not satisfy a document requirement.
4. **Exceptions** — acknowledge, start work, and complete supported corrective actions. A status-only resolution is intentionally not offered.
5. **Analytics** — request and inspect refresh/reconciliation runs.

The order form reads `/api/v1/products` and `/api/v1/rules/destinations`; shipment creation uses `POST /api/v1/shipments`. The active tab is stored as `cap22.activeTab` in `localStorage`, so a page refresh no longer resets the user to Estimates. The UI continues to use the existing backend API and does not introduce a separate mock data path.

**Important scope boundary:** the current shipment document action records a document reference/metadata; it is not a binary file upload to S3. Carrier event entry is a demo/manual ingestion workflow, not a live authenticated carrier connection. Rates remain simulated.

## Generic shipment operations and customer master (M4.3)

The application now includes a customer master (`/api/v1/customers`) with server-generated UUIDs and customer numbers. Create requests intentionally do not accept IDs. Orders can reference a customer by `customerId`; the legacy `customer_ref` field is retained and existing orders are not rewritten or orphaned. The Customers workspace is available in the console and the order intake form selects an existing active customer.

Migration `V11__customers_and_generic_logistics.sql` is additive. It creates the customer master and nullable order link, plus a logistics-location catalog and ordered shipment-stop table. Existing shipments remain valid and default to `PARCEL`. New shipment metadata supports `PARCEL`, `ROAD`, `AIR`, `OCEAN`, `RAIL`, and `MULTIMODAL`, optional origin/destination addresses, and optional airport/seaport/customs/terminal locations. Domestic parcel shipments do not need port data; international air/ocean and multimodal shipments can record gateway locations and planned stops. Carrier events remain the authoritative record of actual movement; planned stops are not a substitute for carrier tracking.

**Important implementation boundary:** this increment adds the database foundation for logistics locations and shipment stops. The current shipment create API/UI still uses the existing carrier/tracking workflow; full CRUD screens and API operations for location catalogs, address book, stop planning, and stop execution are follow-on work. No live carrier API credentials or production webhook signature verification are included. Customer CRUD currently supports create/list/read/update; deletion is intentionally not exposed to protect order history.


## Generic shipment operations (V11)

Shipments support PARCEL, ROAD, AIR, OCEAN, RAIL and MULTIMODAL transport. Each shipment keeps exact origin and destination address details; optional logistics locations represent warehouses, airports (IATA), seaports (UN/LOCODE), rail terminals and customs facilities. Planned intermediate stops are stored separately from the append-only carrier event timeline. The carrier remains authoritative for actual routing and scan events.

### Logistics API
- `GET/POST /api/v1/logistics/locations` and `PUT /api/v1/logistics/locations/{id}` manage the location catalog. Search with `?q=` and filter with `?type=`.
- `PUT /api/v1/logistics/shipments/{shipmentId}/profile` records transport mode, service level, exact addresses and optional location references.
- `GET/POST /api/v1/logistics/shipments/{shipmentId}/stops` manages planned itinerary stops.
- `PATCH /api/v1/logistics/shipments/{shipmentId}/stops/{stopId}/actual?arrival=...&departure=...` records actual milestone timestamps.

Customer and logistics identifiers are generated by the database/application. Create requests do not accept primary keys. Existing `orders.customer_ref` values are retained; the new nullable `customer_id` link is additive so historical orders are not orphaned.


### Warehouse synchronization behavior

The Warehouse sync action uses PostgreSQL's transactional change outbox. It transfers only committed inserts, updates, and deletes since the previous successful batch; it does not run a full-table export on each request. The worker acknowledges a batch only after its Snowflake load succeeds, and failed batches remain retryable.
