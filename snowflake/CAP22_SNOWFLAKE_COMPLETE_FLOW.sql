/*******************************************************************************
 CAP-22 CDC (S3 JSONL.GZ) -> Snowflake: Complete Implementation Flow
 Target setup (provided): CAP22_DB (RAW, STAGING, MART), CAP22_WH (XSMALL),
                          CAP22_ROLE
 Source files (from cdc-worker):
   s3://<S3_BUCKET>/<S3_PREFIX>/table_name=<table>/dt=YYYY-MM-DD/hour=HH/
        batch_<batchId>_<minEventId>_<maxEventId>.jsonl.gz
 Record format (one JSON object per line, NDJSON):
   { "event_id", "table_name", "operation", "row_id", "payload",
     "changed_at", "txid", "exported_at_utc" }

 HOW TO USE
 - Replace placeholders: <S3_BUCKET>, <S3_PREFIX>, <AWS_ROLE_ARN>
   (and <AWS_KEY_ID>/<AWS_SECRET_KEY> only if you choose key-based auth).
 - Execute sections in order. Some statements require ACCOUNTADMIN (noted).
 - Choose ONE ingest path for ongoing loads: (5A) scheduled COPY/TASK or (5B) Snowpipe.
 - STAGING/MART are provided as a complete baseline; adjust types/business logic as needed.
*******************************************************************************/

--------------------------------------------------------------------------------
-- 0) PLACEHOLDERS / ASSUMPTIONS (edit mentally or via find-replace)
--------------------------------------------------------------------------------
-- <S3_BUCKET>       : your S3 bucket name (e.g. my-cap22-analytics-bucket)
-- <S3_PREFIX>       : prefix used by worker (default cdc/raw), no leading/trailing slash
-- <AWS_ROLE_ARN>    : IAM role Snowflake may assume (storage integration), e.g.
--                     arn:aws:iam::123456789012:role/snowflake-cap22-read-role
-- Objects created:
--   Integration: CAP22_S3_INT
--   File format: CAP22_DB.RAW.FF_CDC_JSONL
--   Stage:       CAP22_DB.RAW.CAP22_CDC_STAGE
--   Raw table:   CAP22_DB.RAW.CDC_EVENTS
--   Pipe(opt):   CAP22_DB.RAW.CDC_EVENTS_PIPE
--   Task(opt):   CAP22_DB.RAW.TASK_LOAD_CDC_EVENTS

--------------------------------------------------------------------------------
-- 1) ROLE / WAREHOUSE / DATABASE / SCHEMA CONTEXT & GRANTS
--    Run as ACCOUNTADMIN (integration and some grants require it).
--------------------------------------------------------------------------------
USE ROLE ACCOUNTADMIN;

-- Ensure core objects exist (idempotent to your stated setup)
CREATE WAREHOUSE IF NOT EXISTS CAP22_WH
    WAREHOUSE_TYPE = STANDARD
    WAREHOUSE_SIZE = XSMALL
    AUTO_SUSPEND = 60
    AUTO_RESUME = TRUE
    INITIALLY_SUSPENDED = TRUE
    COMMENT = 'Warehouse for CAP-22 pipeline';

CREATE DATABASE IF NOT EXISTS CAP22_DB COMMENT = 'CAP-22 analytics';
CREATE SCHEMA IF NOT EXISTS CAP22_DB.RAW     COMMENT = 'Raw CDC landing (events)';
CREATE SCHEMA IF NOT EXISTS CAP22_DB.STAGING COMMENT = 'Parsed, standardized, deduped';
CREATE SCHEMA IF NOT EXISTS CAP22_DB.MART    COMMENT = 'Business-ready analytical models';

CREATE ROLE IF NOT EXISTS CAP22_ROLE COMMENT = 'Least-privilege role for CAP-22 pipeline';

-- Privileges for pipeline role
GRANT USAGE ON WAREHOUSE CAP22_WH TO ROLE CAP22_ROLE;
GRANT USAGE ON DATABASE  CAP22_DB TO ROLE CAP22_ROLE;

GRANT USAGE ON SCHEMA CAP22_DB.RAW     TO ROLE CAP22_ROLE;
GRANT USAGE ON SCHEMA CAP22_DB.STAGING TO ROLE CAP22_ROLE;
GRANT USAGE ON SCHEMA CAP22_DB.MART    TO ROLE CAP22_ROLE;

GRANT CREATE STAGE, CREATE FILE FORMAT, CREATE TABLE, CREATE VIEW, CREATE PIPE, CREATE TASK
  ON SCHEMA CAP22_DB.RAW TO ROLE CAP22_ROLE;
GRANT CREATE TABLE, CREATE VIEW ON SCHEMA CAP22_DB.STAGING TO ROLE CAP22_ROLE;
GRANT CREATE TABLE, CREATE VIEW ON SCHEMA CAP22_DB.MART    TO ROLE CAP22_ROLE;

-- Allow role to run tasks on the warehouse if using TASK option (5A)
GRANT OPERATE ON WAREHOUSE CAP22_WH TO ROLE CAP22_ROLE;
-- To execute tasks owned by CAP22_ROLE you may also need: GRANT EXECUTE TASK ON ACCOUNT TO ROLE CAP22_ROLE; (ACCOUNTADMIN)

-- Optional: grant role to your user
-- GRANT ROLE CAP22_ROLE TO USER <YOUR_SNOWFLAKE_USER>;

USE WAREHOUSE CAP22_WH;
USE DATABASE  CAP22_DB;
USE SCHEMA    RAW;

--------------------------------------------------------------------------------
-- 2) S3 ACCESS: STORAGE INTEGRATION (RECOMMENDED) + IAM TRUST SETUP
--    Requires ACCOUNTADMIN. Prefer integration over long-lived keys.
--------------------------------------------------------------------------------
USE ROLE ACCOUNTADMIN;

-- 2A. Create storage integration (points to allowed bucket/prefix)
CREATE OR REPLACE STORAGE INTEGRATION CAP22_S3_INT
  TYPE = EXTERNAL_STAGE
  STORAGE_PROVIDER = 'S3'
  ENABLED = TRUE
  STORAGE_AWS_ROLE_ARN = '<AWS_ROLE_ARN>'
  STORAGE_ALLOWED_LOCATIONS = ('s3://<S3_BUCKET>/<S3_PREFIX>/')
  COMMENT = 'Read access for CAP-22 CDC files in S3';

-- 2B. Retrieve Snowflake principal to trust in AWS IAM
DESC INTEGRATION CAP22_S3_INT;
/*
  From DESC INTEGRATION output, note:
    - STORAGE_AWS_IAM_USER_ARN
    - STORAGE_AWS_EXTERNAL_ID

  In AWS (IAM > Roles > <your role for Snowflake>):
    1) Trust policy: allow sts:AssumeRole for STORAGE_AWS_IAM_USER_ARN with
       condition StringEquals sts:ExternalId = STORAGE_AWS_EXTERNAL_ID.
    2) Permissions policy: allow at least
         - s3:ListBucket on arn:aws:s3:::<S3_BUCKET> (optionally scoped by prefix condition)
         - s3:GetObject  on arn:aws:s3:::<S3_BUCKET>/<S3_PREFIX>/*
*/

GRANT USAGE ON INTEGRATION CAP22_S3_INT TO ROLE CAP22_ROLE;

--------------------------------------------------------------------------------
-- 3) FILE FORMAT + EXTERNAL STAGE
--    NDJSON (one JSON object per line), gzip-compressed (.jsonl.gz).
--------------------------------------------------------------------------------
USE ROLE ACCOUNTADMIN; -- or CAP22_ROLE after grants
USE DATABASE CAP22_DB;
USE SCHEMA   RAW;

CREATE OR REPLACE FILE FORMAT CAP22_DB.RAW.FF_CDC_JSONL
  TYPE = JSON
  COMPRESSION = AUTO            -- auto-detect gzip
  STRIP_OUTER_ARRAY = FALSE     -- NDJSON, not a single outer array
  COMMENT = 'CDC JSON Lines, gzip-compressed';

-- 3A. Stage using STORAGE INTEGRATION (recommended)
CREATE OR REPLACE STAGE CAP22_DB.RAW.CAP22_CDC_STAGE
  URL = 's3://<S3_BUCKET>/<S3_PREFIX>/'
  STORAGE_INTEGRATION = CAP22_S3_INT
  FILE_FORMAT = CAP22_DB.RAW.FF_CDC_JSONL
  COMMENT = 'External stage for CAP-22 CDC exports';

-- 3B. (ALTERNATIVE) Stage using access keys - NOT recommended for production
--      Use only if you cannot configure a storage integration.
-- CREATE OR REPLACE STAGE CAP22_DB.RAW.CAP22_CDC_STAGE
--   URL = 's3://<S3_BUCKET>/<S3_PREFIX>/'
--   CREDENTIALS = (AWS_KEY_ID = '<AWS_KEY_ID>' AWS_SECRET_KEY = '<AWS_SECRET_KEY>')
--   FILE_FORMAT = CAP22_DB.RAW.FF_CDC_JSONL;

GRANT USAGE ON STAGE       CAP22_DB.RAW.CAP22_CDC_STAGE TO ROLE CAP22_ROLE;
GRANT USAGE ON FILE FORMAT CAP22_DB.RAW.FF_CDC_JSONL   TO ROLE CAP22_ROLE;

-- Verify: list files visible to Snowflake (confirms access, path, and that files exist)
LIST @CAP22_DB.RAW.CAP22_CDC_STAGE;
-- Narrow checks:
-- LIST @CAP22_DB.RAW.CAP22_CDC_STAGE/table_name=orders/;
-- LIST @CAP22_DB.RAW.CAP22_CDC_STAGE/table_name=landed_cost_estimates/;

--------------------------------------------------------------------------------
-- 4) RAW LANDING TABLE + INITIAL (FULL BACKLOG) LOAD
--    RAW stores every CDC event with payload as VARIANT for faithful landing.
--------------------------------------------------------------------------------
USE WAREHOUSE CAP22_WH;
USE DATABASE  CAP22_DB;
USE SCHEMA    RAW;

CREATE TABLE IF NOT EXISTS CAP22_DB.RAW.CDC_EVENTS (
  event_id        NUMBER            COMMENT 'Monotonic outbox event id from source DB',
  table_name      STRING            COMMENT 'Source table name',
  operation       STRING            COMMENT 'INSERT | UPDATE | DELETE',
  row_id          STRING            COMMENT 'Source primary key (best-effort)',
  payload         VARIANT           COMMENT 'Full row JSON (NEW for I/U, OLD for D)',
  changed_at      TIMESTAMP_TZ      COMMENT 'Change timestamp from source',
  txid            NUMBER            COMMENT 'Source transaction id',
  exported_at_utc TIMESTAMP_TZ      COMMENT 'Worker export timestamp',
  source_file     STRING            COMMENT 'S3 file path (METADATA$FILENAME)',
  ingested_at     TIMESTAMP_TZ DEFAULT CURRENT_TIMESTAMP() COMMENT 'Snowflake load time'
)
COMMENT = 'Raw CDC event log landed from S3';

-- Optional but useful for downstream dedupe/perf at scale:
-- ALTER TABLE CAP22_DB.RAW.CDC_EVENTS CLUSTER BY (table_name, event_id);

-- 4A. Initial / ad-hoc COPY (loads files not yet recorded as loaded for this table)
COPY INTO CAP22_DB.RAW.CDC_EVENTS
  (event_id, table_name, operation, row_id, payload, changed_at, txid, exported_at_utc, source_file)
FROM (
  SELECT
    $1:event_id::NUMBER,
    $1:table_name::STRING,
    $1:operation::STRING,
    $1:row_id::STRING,
    $1:payload,
    TO_TIMESTAMP_TZ($1:changed_at::STRING),
    TO_NUMBER($1:txid),
    TO_TIMESTAMP_TZ($1:exported_at_utc::STRING),
    METADATA$FILENAME
  FROM @CAP22_DB.RAW.CAP22_CDC_STAGE
)
FILE_FORMAT = (FORMAT_NAME = 'CAP22_DB.RAW.FF_CDC_JSONL')
ON_ERROR = 'CONTINUE'
-- PATTERN = '.*[.]jsonl[.]gz'  -- optional: only load matching files
;

-- 4B. Load history / validation
SELECT *
FROM TABLE(INFORMATION_SCHEMA.COPY_HISTORY(
  TABLE_NAME => 'CDC_EVENTS',
  START_TIME => DATEADD('day', -7, CURRENT_TIMESTAMP())
))
ORDER BY LAST_LOAD_TIME DESC;

SELECT COUNT(*) AS rows_loaded,
       COUNT(DISTINCT source_file) AS files,
       COUNT(DISTINCT table_name)  AS tables,
       MIN(event_id) AS min_event_id,
       MAX(event_id) AS max_event_id
FROM CAP22_DB.RAW.CDC_EVENTS;

SELECT table_name, operation, COUNT(*) AS cnt
FROM CAP22_DB.RAW.CDC_EVENTS
GROUP BY 1, 2
ORDER BY 1, 2;

SELECT event_id, table_name, operation, row_id, changed_at, source_file
FROM CAP22_DB.RAW.CDC_EVENTS
ORDER BY event_id DESC
LIMIT 20;

--------------------------------------------------------------------------------
-- 5) ONGOING INGEST (choose ONE primary approach)
--------------------------------------------------------------------------------

-- 5A. SCHEDULED COPY via TASK (simple, no S3 event wiring required)
--     Runs the same COPY INTO; Snowflake skips files already loaded.
--     Adjust schedule to your freshness needs (and note warehouse credit usage).
USE ROLE ACCOUNTADMIN; -- or a role with EXECUTE TASK privilege as configured

CREATE OR REPLACE TASK CAP22_DB.RAW.TASK_LOAD_CDC_EVENTS
  WAREHOUSE = CAP22_WH
  SCHEDULE = 'USING CRON */5 * * * * UTC'   -- every 5 minutes; adjust as needed
  COMMENT = 'Periodic COPY of new CDC files from S3 stage into RAW.CDC_EVENTS'
AS
COPY INTO CAP22_DB.RAW.CDC_EVENTS
  (event_id, table_name, operation, row_id, payload, changed_at, txid, exported_at_utc, source_file)
FROM (
  SELECT
    $1:event_id::NUMBER,
    $1:table_name::STRING,
    $1:operation::STRING,
    $1:row_id::STRING,
    $1:payload,
    TO_TIMESTAMP_TZ($1:changed_at::STRING),
    TO_NUMBER($1:txid),
    TO_TIMESTAMP_TZ($1:exported_at_utc::STRING),
    METADATA$FILENAME
  FROM @CAP22_DB.RAW.CAP22_CDC_STAGE
)
FILE_FORMAT = (FORMAT_NAME = 'CAP22_DB.RAW.FF_CDC_JSONL')
ON_ERROR = 'CONTINUE';

-- Enable / manage task
ALTER TASK CAP22_DB.RAW.TASK_LOAD_CDC_EVENTS RESUME;
-- SHOW TASKS IN SCHEMA CAP22_DB.RAW;
-- EXECUTE TASK CAP22_DB.RAW.TASK_LOAD_CDC_EVENTS;  -- manual run
-- ALTER TASK CAP22_DB.RAW.TASK_LOAD_CDC_EVENTS SUSPEND;

-- 5B. SNOWPIPE AUTO-INGEST (event-driven, requires S3 event notifications)
--     Use INSTEAD of (or in addition to, with care) the scheduled task.
--     Do NOT run both on the same target without understanding dedupe/load history.
/*
USE DATABASE CAP22_DB;
USE SCHEMA   RAW;

CREATE OR REPLACE PIPE CAP22_DB.RAW.CDC_EVENTS_PIPE
  AUTO_INGEST = TRUE
  COMMENT = 'Auto-ingest CDC files from S3 into RAW.CDC_EVENTS'
AS
COPY INTO CAP22_DB.RAW.CDC_EVENTS
  (event_id, table_name, operation, row_id, payload, changed_at, txid, exported_at_utc, source_file)
FROM (
  SELECT
    $1:event_id::NUMBER,
    $1:table_name::STRING,
    $1:operation::STRING,
    $1:row_id::STRING,
    $1:payload,
    TO_TIMESTAMP_TZ($1:changed_at::STRING),
    TO_NUMBER($1:txid),
    TO_TIMESTAMP_TZ($1:exported_at_utc::STRING),
    METADATA$FILENAME
  FROM @CAP22_DB.RAW.CAP22_CDC_STAGE
)
FILE_FORMAT = (FORMAT_NAME = 'CAP22_DB.RAW.FF_CDC_JSONL')
ON_ERROR = 'CONTINUE';

SHOW PIPES LIKE 'CDC_EVENTS_PIPE';
-- 1) Configure S3 bucket event notifications to the pipe's notification_channel (ARN/SQS) shown above.
-- 2) Backfill files already in S3 (if needed):
--    ALTER PIPE CAP22_DB.RAW.CDC_EVENTS_PIPE REFRESH;
-- 3) Monitor:
--    SELECT SYSTEM$PIPE_STATUS('CAP22_DB.RAW.CDC_EVENTS_PIPE');
--    SELECT * FROM TABLE(INFORMATION_SCHEMA.COPY_HISTORY(
--      TABLE_NAME=>'CDC_EVENTS', START_TIME=>DATEADD(hour,-24,CURRENT_TIMESTAMP())));
*/

--------------------------------------------------------------------------------
-- 6) STAGING LAYER (parsed, standardized, deduped)
--    - Mutable/current-state entities: latest event per (table_name,row_id) by event_id,
--      exclude DELETE tombstones (rn=1 and operation <> 'DELETE').
--    - Append-only/event entities: retain history (all non-delete events) where useful.
--    - Payload keys match source column names from the Postgres schema.
--    - Dedupe safety: views select distinct/latest by event_id; for hard guarantees at
--      scale, materialize with constraints/merge logic keyed by event_id.
--------------------------------------------------------------------------------
USE DATABASE CAP22_DB;

-- 6.1 Generic helper: latest row per entity (all tables)
CREATE OR REPLACE VIEW CAP22_DB.STAGING.V_CDC_LATEST AS
SELECT *
FROM (
  SELECT
    e.*,
    ROW_NUMBER() OVER (PARTITION BY e.table_name, e.row_id ORDER BY e.event_id DESC) AS rn
  FROM CAP22_DB.RAW.CDC_EVENTS e
  WHERE e.row_id IS NOT NULL
)
WHERE rn = 1;

-- 6.2 Current-state entity views (latest non-deleted)

CREATE OR REPLACE VIEW CAP22_DB.STAGING.CUSTOMERS AS
SELECT
  payload:customer_id::STRING     AS customer_id,
  payload:customer_number::STRING AS customer_number,
  payload:name::STRING            AS name,
  payload:email::STRING           AS email,
  payload:country_code::STRING    AS country_code,
  changed_at                      AS last_changed_at,
  event_id                        AS last_event_id
FROM CAP22_DB.STAGING.V_CDC_LATEST
WHERE table_name = 'customers' AND operation <> 'DELETE';

CREATE OR REPLACE VIEW CAP22_DB.STAGING.DESTINATIONS AS
SELECT
  payload:destination_id::STRING AS destination_id,
  payload:code::STRING           AS code,
  payload:name::STRING           AS name,
  payload:currency::STRING       AS currency,
  changed_at                     AS last_changed_at,
  event_id                       AS last_event_id
FROM CAP22_DB.STAGING.V_CDC_LATEST
WHERE table_name = 'destinations' AND operation <> 'DELETE';

CREATE OR REPLACE VIEW CAP22_DB.STAGING.PRODUCTS AS
SELECT
  payload:product_id::STRING           AS product_id,
  payload:sku::STRING                  AS sku,
  payload:name::STRING                 AS name,
  payload:hs_code::STRING              AS hs_code,
  TRY_TO_DECIMAL(payload:unit_price::STRING, 19, 4) AS unit_price,
  payload:currency::STRING             AS currency,
  payload:country_of_origin::STRING    AS country_of_origin,
  changed_at                           AS last_changed_at,
  event_id                             AS last_event_id
FROM CAP22_DB.STAGING.V_CDC_LATEST
WHERE table_name = 'products' AND operation <> 'DELETE';

CREATE OR REPLACE VIEW CAP22_DB.STAGING.ORDERS AS
SELECT
  payload:order_id::STRING      AS order_id,
  payload:order_number::STRING  AS order_number,
  payload:customer_id::STRING   AS customer_id,
  payload:destination_id::STRING AS destination_id,
  payload:currency::STRING      AS currency,
  payload:status::STRING        AS status,
  TRY_TO_TIMESTAMP_TZ(payload:created_at::STRING) AS created_at,
  changed_at                    AS last_changed_at,
  event_id                      AS last_event_id
FROM CAP22_DB.STAGING.V_CDC_LATEST
WHERE table_name = 'orders' AND operation <> 'DELETE';

CREATE OR REPLACE VIEW CAP22_DB.STAGING.ORDER_ITEMS AS
SELECT
  payload:order_item_id::STRING AS order_item_id,
  payload:order_id::STRING      AS order_id,
  payload:product_id::STRING    AS product_id,
  TRY_TO_NUMBER(payload:quantity::STRING)           AS quantity,
  TRY_TO_DECIMAL(payload:unit_price::STRING, 19, 4) AS unit_price,
  payload:currency::STRING      AS currency,
  changed_at                    AS last_changed_at,
  event_id                      AS last_event_id
FROM CAP22_DB.STAGING.V_CDC_LATEST
WHERE table_name = 'order_items' AND operation <> 'DELETE';

CREATE OR REPLACE VIEW CAP22_DB.STAGING.SHIPMENTS AS
SELECT
  payload:shipment_id::STRING      AS shipment_id,
  payload:order_id::STRING         AS order_id,
  payload:tracking_number::STRING  AS tracking_number,
  payload:carrier::STRING          AS carrier,
  payload:status::STRING           AS status,
  TRY_TO_TIMESTAMP_TZ(payload:expected_delivery_at::STRING) AS expected_delivery_at,
  TRY_TO_TIMESTAMP_TZ(payload:delivered_at::STRING)         AS delivered_at,
  changed_at                       AS last_changed_at,
  event_id                         AS last_event_id
FROM CAP22_DB.STAGING.V_CDC_LATEST
WHERE table_name = 'shipments' AND operation <> 'DELETE';

CREATE OR REPLACE VIEW CAP22_DB.STAGING.SHIPMENT_ITEMS AS
SELECT
  payload:shipment_item_id::STRING AS shipment_item_id,
  payload:shipment_id::STRING      AS shipment_id,
  payload:order_item_id::STRING    AS order_item_id,
  TRY_TO_NUMBER(payload:quantity_shipped::STRING) AS quantity_shipped,
  changed_at                       AS last_changed_at,
  event_id                         AS last_event_id
FROM CAP22_DB.STAGING.V_CDC_LATEST
WHERE table_name = 'shipment_items' AND operation <> 'DELETE';

CREATE OR REPLACE VIEW CAP22_DB.STAGING.DESTINATION_RULES AS
SELECT
  payload:rule_id::STRING         AS rule_id,
  payload:destination_id::STRING  AS destination_id,
  payload:hs_prefix::STRING       AS hs_prefix,
  TRY_TO_DECIMAL(payload:duty_rate::STRING, 9, 6)    AS duty_rate,
  TRY_TO_DECIMAL(payload:tax_rate::STRING, 9, 6)     AS tax_rate,
  TRY_TO_DECIMAL(payload:handling_fee::STRING, 19, 4) AS handling_fee,
  payload:fee_currency::STRING    AS fee_currency,
  TRY_TO_DATE(payload:effective_from::STRING) AS effective_from,
  TRY_TO_DATE(payload:effective_to::STRING)   AS effective_to,
  TRY_TO_BOOLEAN(payload:active::STRING)      AS active,
  changed_at                      AS last_changed_at,
  event_id                        AS last_event_id
FROM CAP22_DB.STAGING.V_CDC_LATEST
WHERE table_name = 'destination_rules' AND operation <> 'DELETE';

CREATE OR REPLACE VIEW CAP22_DB.STAGING.EXCHANGE_RATES AS
SELECT
  payload:exchange_rate_id::STRING AS exchange_rate_id,
  payload:base_currency::STRING    AS base_currency,
  payload:target_currency::STRING  AS target_currency,
  TRY_TO_DECIMAL(payload:exchange_rate::STRING, 19, 8) AS exchange_rate,
  TRY_TO_DATE(payload:effective_date::STRING)          AS effective_date,
  payload:source::STRING           AS source,
  changed_at                       AS last_changed_at,
  event_id                         AS last_event_id
FROM CAP22_DB.STAGING.V_CDC_LATEST
WHERE table_name = 'exchange_rates' AND operation <> 'DELETE';

CREATE OR REPLACE VIEW CAP22_DB.STAGING.DOCUMENT_TYPES AS
SELECT
  payload:document_type_id::STRING AS document_type_id,
  payload:code::STRING             AS code,
  payload:name::STRING             AS name,
  changed_at                       AS last_changed_at,
  event_id                         AS last_event_id
FROM CAP22_DB.STAGING.V_CDC_LATEST
WHERE table_name = 'document_types' AND operation <> 'DELETE';

CREATE OR REPLACE VIEW CAP22_DB.STAGING.SHIPMENT_DOCUMENTS AS
SELECT
  payload:shipment_document_id::STRING AS shipment_document_id,
  payload:shipment_id::STRING          AS shipment_id,
  payload:document_type_id::STRING     AS document_type_id,
  payload:verification_status::STRING  AS verification_status,
  TRY_TO_TIMESTAMP_TZ(payload:received_at::STRING) AS received_at,
  changed_at                           AS last_changed_at,
  event_id                             AS last_event_id
FROM CAP22_DB.STAGING.V_CDC_LATEST
WHERE table_name = 'shipment_documents' AND operation <> 'DELETE';

CREATE OR REPLACE VIEW CAP22_DB.STAGING.EXCEPTIONS AS
SELECT
  payload:exception_id::STRING   AS exception_id,
  payload:shipment_id::STRING    AS shipment_id,
  payload:exception_type::STRING AS exception_type,
  payload:severity::STRING       AS severity,
  payload:status::STRING         AS status,
  payload:summary::STRING        AS summary,
  TRY_TO_TIMESTAMP_TZ(payload:opened_at::STRING)   AS opened_at,
  TRY_TO_TIMESTAMP_TZ(payload:resolved_at::STRING) AS resolved_at,
  changed_at                     AS last_changed_at,
  event_id                       AS last_event_id
FROM CAP22_DB.STAGING.V_CDC_LATEST
WHERE table_name = 'exceptions' AND operation <> 'DELETE';

-- 6.3 Append-only / history-friendly views (retain versions/events; exclude deletes)

CREATE OR REPLACE VIEW CAP22_DB.STAGING.LANDED_COST_ESTIMATES AS
SELECT
  payload:estimate_id::STRING            AS estimate_id,
  payload:shipment_id::STRING            AS shipment_id,
  payload:rule_id::STRING                AS rule_id,
  payload:exchange_rate_id::STRING       AS exchange_rate_id,
  TRY_TO_NUMBER(payload:estimate_version::STRING) AS estimate_version,
  TRY_TO_DECIMAL(payload:product_value::STRING, 19, 4)          AS product_value,
  TRY_TO_DECIMAL(payload:shipping_cost::STRING, 19, 4)          AS shipping_cost,
  TRY_TO_DECIMAL(payload:insurance_cost::STRING, 19, 4)         AS insurance_cost,
  TRY_TO_DECIMAL(payload:duty_amount::STRING, 19, 4)            AS duty_amount,
  TRY_TO_DECIMAL(payload:tax_amount::STRING, 19, 4)             AS tax_amount,
  TRY_TO_DECIMAL(payload:handling_fee_amount::STRING, 19, 4)    AS handling_fee_amount,
  payload:destination_currency::STRING   AS destination_currency,
  TRY_TO_DECIMAL(payload:destination_landed_cost::STRING, 19, 4) AS destination_landed_cost,
  payload:reporting_currency::STRING     AS reporting_currency,
  TRY_TO_DECIMAL(payload:reporting_landed_cost::STRING, 19, 4)   AS reporting_landed_cost,
  payload:rule_snapshot                  AS rule_snapshot,
  payload:fx_snapshot                    AS fx_snapshot,
  payload:calculation_version::STRING    AS calculation_version,
  payload:request_key::STRING            AS request_key,
  payload:previous_estimate_id::STRING   AS previous_estimate_id,
  TRY_TO_DATE(payload:estimate_date::STRING)               AS estimate_date,
  TRY_TO_TIMESTAMP_TZ(payload:estimated_at::STRING)        AS estimated_at,
  changed_at                             AS last_changed_at,
  event_id                               AS last_event_id,
  operation                              AS last_operation
FROM CAP22_DB.RAW.CDC_EVENTS
WHERE table_name = 'landed_cost_estimates' AND operation <> 'DELETE';

CREATE OR REPLACE VIEW CAP22_DB.STAGING.COST_ESTIMATE_COMPONENTS AS
SELECT
  payload:component_id::STRING      AS component_id,
  payload:estimate_id::STRING       AS estimate_id,
  payload:component_code::STRING    AS component_code,
  TRY_TO_DECIMAL(payload:amount::STRING, 19, 4)           AS amount,
  payload:currency_code::STRING     AS currency_code,
  TRY_TO_DECIMAL(payload:calculation_basis::STRING, 19, 4) AS calculation_basis,
  TRY_TO_DECIMAL(payload:applied_rate::STRING, 9, 6)       AS applied_rate,
  changed_at                        AS last_changed_at,
  event_id                          AS last_event_id,
  operation                         AS last_operation
FROM CAP22_DB.RAW.CDC_EVENTS
WHERE table_name = 'cost_estimate_components' AND operation <> 'DELETE';

CREATE OR REPLACE VIEW CAP22_DB.STAGING.CARRIER_EVENTS AS
SELECT
  payload:carrier_event_id::STRING     AS carrier_event_id,
  payload:shipment_id::STRING          AS shipment_id,
  payload:external_event_id::STRING    AS external_event_id,
  payload:raw_event_code::STRING       AS raw_event_code,
  payload:normalized_event_type::STRING AS normalized_event_type,
  TRY_TO_TIMESTAMP_TZ(payload:occurred_at::STRING) AS occurred_at,
  TRY_TO_TIMESTAMP_TZ(payload:received_at::STRING) AS received_at,
  TRY_TO_BOOLEAN(payload:is_duplicate::STRING)     AS is_duplicate,
  TRY_TO_BOOLEAN(payload:is_effective::STRING)     AS is_effective,
  payload:raw_payload                   AS raw_payload,
  changed_at                            AS last_changed_at,
  event_id                              AS last_event_id,
  operation                             AS last_operation
FROM CAP22_DB.RAW.CDC_EVENTS
WHERE table_name = 'carrier_events' AND operation <> 'DELETE';

-- 6.4 (Optional) Staging validation
-- SELECT table_name, COUNT(*) FROM CAP22_DB.RAW.CDC_EVENTS GROUP BY 1;
-- SELECT COUNT(*) FROM CAP22_DB.STAGING.ORDERS;
-- SELECT COUNT(*) FROM CAP22_DB.STAGING.CARRIER_EVENTS;

--------------------------------------------------------------------------------
-- 7) MART LAYER (business-ready for Power BI)
--    Examples below: conformed dimensions/facts and enriched views.
--    Materialize (CREATE TABLE AS / TASK) for performance as data grows.
--------------------------------------------------------------------------------

-- 7.1 Dimensions
CREATE OR REPLACE VIEW CAP22_DB.MART.DIM_CUSTOMERS AS
SELECT
  customer_id, customer_number, name, email, country_code, last_changed_at
FROM CAP22_DB.STAGING.CUSTOMERS;

CREATE OR REPLACE VIEW CAP22_DB.MART.DIM_DESTINATIONS AS
SELECT
  destination_id, code, name, currency, last_changed_at
FROM CAP22_DB.STAGING.DESTINATIONS;

CREATE OR REPLACE VIEW CAP22_DB.MART.DIM_PRODUCTS AS
SELECT
  product_id, sku, name, hs_code, unit_price, currency, country_of_origin, last_changed_at
FROM CAP22_DB.STAGING.PRODUCTS;

CREATE OR REPLACE VIEW CAP22_DB.MART.DIM_DOCUMENT_TYPES AS
SELECT
  document_type_id, code, name, last_changed_at
FROM CAP22_DB.STAGING.DOCUMENT_TYPES;

-- 7.2 Facts / enriched analytical views
CREATE OR REPLACE VIEW CAP22_DB.MART.FCT_ORDER_ITEMS AS
SELECT
  oi.order_item_id,
  oi.order_id,
  o.order_number,
  o.customer_id,
  c.customer_number,
  c.name            AS customer_name,
  o.destination_id,
  d.code            AS destination_code,
  d.name            AS destination_name,
  o.status          AS order_status,
  o.created_at      AS order_created_at,
  oi.product_id,
  p.sku,
  p.name            AS product_name,
  p.hs_code,
  oi.quantity,
  oi.unit_price,
  oi.currency,
  (oi.quantity * oi.unit_price) AS line_total,
  oi.last_changed_at
FROM CAP22_DB.STAGING.ORDER_ITEMS oi
JOIN CAP22_DB.STAGING.ORDERS o       ON o.order_id = oi.order_id
LEFT JOIN CAP22_DB.STAGING.CUSTOMERS c    ON c.customer_id = o.customer_id
LEFT JOIN CAP22_DB.STAGING.DESTINATIONS d ON d.destination_id = o.destination_id
LEFT JOIN CAP22_DB.STAGING.PRODUCTS p     ON p.product_id = oi.product_id;

CREATE OR REPLACE VIEW CAP22_DB.MART.FCT_SHIPMENTS AS
SELECT
  s.shipment_id,
  s.order_id,
  o.order_number,
  o.customer_id,
  c.name            AS customer_name,
  d.code            AS destination_code,
  d.name            AS destination_name,
  s.tracking_number,
  s.carrier,
  s.status          AS shipment_status,
  s.expected_delivery_at,
  s.delivered_at,
  DATEDIFF('day', o.created_at, s.delivered_at) AS delivery_days,
  s.last_changed_at
FROM CAP22_DB.STAGING.SHIPMENTS s
JOIN CAP22_DB.STAGING.ORDERS o       ON o.order_id = s.order_id
LEFT JOIN CAP22_DB.STAGING.CUSTOMERS c    ON c.customer_id = o.customer_id
LEFT JOIN CAP22_DB.STAGING.DESTINATIONS d ON d.destination_id = o.destination_id;

-- Landed cost fact (all estimate versions) with shipment/order context
CREATE OR REPLACE VIEW CAP22_DB.MART.FCT_LANDED_COST_ESTIMATES AS
SELECT
  le.estimate_id,
  le.shipment_id,
  s.tracking_number,
  s.order_id,
  o.order_number,
  o.customer_id,
  c.name AS customer_name,
  d.code AS destination_code,
  le.estimate_version,
  le.product_value,
  le.shipping_cost,
  le.insurance_cost,
  le.duty_amount,
  le.tax_amount,
  le.handling_fee_amount,
  le.destination_currency,
  le.destination_landed_cost,
  le.reporting_currency,
  le.reporting_landed_cost,
  le.calculation_version,
  le.request_key,
  le.previous_estimate_id,
  le.estimate_date,
  le.estimated_at,
  le.last_changed_at
FROM CAP22_DB.STAGING.LANDED_COST_ESTIMATES le
LEFT JOIN CAP22_DB.STAGING.SHIPMENTS s    ON s.shipment_id = le.shipment_id
LEFT JOIN CAP22_DB.STAGING.ORDERS o       ON o.order_id = s.order_id
LEFT JOIN CAP22_DB.STAGING.CUSTOMERS c    ON c.customer_id = o.customer_id
LEFT JOIN CAP22_DB.STAGING.DESTINATIONS d ON d.destination_id = o.destination_id;

-- Latest estimate per shipment (common BI use case)
CREATE OR REPLACE VIEW CAP22_DB.MART.FCT_LANDED_COST_LATEST AS
SELECT *
FROM (
  SELECT f.*, ROW_NUMBER() OVER (PARTITION BY shipment_id ORDER BY estimate_version DESC, event_id DESC) rn
  FROM (
    SELECT le.*, le.event_id
    FROM CAP22_DB.STAGING.LANDED_COST_ESTIMATES le
  ) f
)
WHERE rn = 1;

CREATE OR REPLACE VIEW CAP22_DB.MART.FCT_CARRIER_EVENTS AS
SELECT
  ce.carrier_event_id,
  ce.shipment_id,
  s.tracking_number,
  s.carrier AS shipment_carrier,
  ce.external_event_id,
  ce.raw_event_code,
  ce.normalized_event_type,
  ce.occurred_at,
  ce.received_at,
  ce.is_duplicate,
  ce.is_effective,
  ce.last_changed_at
FROM CAP22_DB.STAGING.CARRIER_EVENTS ce
LEFT JOIN CAP22_DB.STAGING.SHIPMENTS s ON s.shipment_id = ce.shipment_id;

CREATE OR REPLACE VIEW CAP22_DB.MART.FCT_EXCEPTIONS AS
SELECT
  e.exception_id,
  e.shipment_id,
  s.tracking_number,
  o.order_number,
  c.name AS customer_name,
  e.exception_type,
  e.severity,
  e.status,
  e.summary,
  e.opened_at,
  e.resolved_at,
  DATEDIFF('hour', e.opened_at, COALESCE(e.resolved_at, CURRENT_TIMESTAMP())) AS open_hours,
  e.last_changed_at
FROM CAP22_DB.STAGING.EXCEPTIONS e
LEFT JOIN CAP22_DB.STAGING.SHIPMENTS s ON s.shipment_id = e.shipment_id
LEFT JOIN CAP22_DB.STAGING.ORDERS o    ON o.order_id = s.order_id
LEFT JOIN CAP22_DB.STAGING.CUSTOMERS c ON c.customer_id = o.customer_id;

CREATE OR REPLACE VIEW CAP22_DB.MART.FCT_SHIPMENT_DOCUMENTS AS
SELECT
  sd.shipment_document_id,
  sd.shipment_id,
  s.tracking_number,
  sd.document_type_id,
  dt.code AS document_type_code,
  dt.name AS document_type_name,
  sd.verification_status,
  sd.received_at,
  sd.last_changed_at
FROM CAP22_DB.STAGING.SHIPMENT_DOCUMENTS sd
LEFT JOIN CAP22_DB.STAGING.SHIPMENTS s      ON s.shipment_id = sd.shipment_id
LEFT JOIN CAP22_DB.STAGING.DOCUMENT_TYPES dt ON dt.document_type_id = sd.document_type_id;

--------------------------------------------------------------------------------
-- 8) OPERATIONAL CHECKS / DEDUPE & MONITORING NOTES
--------------------------------------------------------------------------------

-- 8.1 Duplicate detection in RAW (at-least-once delivery can produce dup event_ids)
-- SELECT event_id, COUNT(*) c FROM CAP22_DB.RAW.CDC_EVENTS GROUP BY 1 HAVING c > 1;

-- 8.2 Optional: create a deduped RAW view for safety
CREATE OR REPLACE VIEW CAP22_DB.RAW.V_CDC_EVENTS_DEDUPED AS
SELECT *
FROM (
  SELECT e.*, ROW_NUMBER() OVER (PARTITION BY e.event_id ORDER BY e.ingested_at DESC) AS dup_rn
  FROM CAP22_DB.RAW.CDC_EVENTS e
)
WHERE dup_rn = 1;

-- 8.3 Task/pipe/load monitoring
-- SHOW TASKS IN SCHEMA CAP22_DB.RAW;
-- SELECT * FROM TABLE(INFORMATION_SCHEMA.TASK_HISTORY(SCHEDULED_TIME_RANGE_START=>DATEADD('day',-1,CURRENT_TIMESTAMP())));
-- SELECT * FROM TABLE(INFORMATION_SCHEMA.COPY_HISTORY(TABLE_NAME=>'CDC_EVENTS', START_TIME=>DATEADD('day',-1,CURRENT_TIMESTAMP())));
-- SELECT SYSTEM$PIPE_STATUS('CAP22_DB.RAW.CDC_EVENTS_PIPE'); -- if using Snowpipe

-- 8.4 Power BI
-- Connect Power BI to Snowflake (warehouse CAP22_WH, database CAP22_DB) and model from
-- CAP22_DB.MART (preferred) or CAP22_DB.STAGING. Consider materializing large MART views
-- as tables refreshed by TASKs for consistent performance and cost control.

--------------------------------------------------------------------------------
-- END OF FLOW
--------------------------------------------------------------------------------
