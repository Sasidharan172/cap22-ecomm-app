-- CDC outbox: capture INSERT/UPDATE/DELETE changes for downstream export (S3 -> Snowflake).
CREATE TABLE IF NOT EXISTS cdc_outbox (
    event_id        bigserial PRIMARY KEY,
    table_name      text NOT NULL,
    operation       text NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE')),
    row_id          text,
    payload         jsonb NOT NULL,
    changed_at      timestamptz NOT NULL DEFAULT now(),
    txid            bigint NOT NULL DEFAULT txid_current(),
    exported_at     timestamptz,
    export_batch_id text
);

CREATE INDEX IF NOT EXISTS idx_cdc_outbox_pending
    ON cdc_outbox (event_id)
    WHERE exported_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_cdc_outbox_table_changed
    ON cdc_outbox (table_name, changed_at);

CREATE OR REPLACE FUNCTION cdc_capture_change() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    rec jsonb;
    pk_val text;
    pk_col text;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        rec := to_jsonb(OLD);
    ELSE
        rec := to_jsonb(NEW);
    END IF;

    -- best-effort primary key extraction: use first column ending with _id or 'id'
    SELECT a.attname INTO pk_col
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    WHERE i.indrelid = TG_RELID AND i.indisprimary
    ORDER BY a.attnum
    LIMIT 1;

    IF pk_col IS NOT NULL THEN
        pk_val := rec ->> pk_col;
    ELSE
        pk_val := NULL;
    END IF;

    INSERT INTO cdc_outbox (table_name, operation, row_id, payload, changed_at)
    VALUES (TG_TABLE_NAME, TG_OP, pk_val, rec, now());

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

-- Attach triggers to domain tables (order respects dependencies is not required for capture).
DO $$
DECLARE
    t text;
    tables text[] := ARRAY[
        'customers',
        'destinations',
        'products',
        'orders',
        'order_items',
        'shipments',
        'shipment_items',
        'destination_rules',
        'exchange_rates',
        'landed_cost_estimates',
        'cost_estimate_components',
        'carrier_events',
        'document_types',
        'shipment_documents',
        'exceptions'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_cdc_%I ON %I', t, t);
        EXECUTE format(
            'CREATE TRIGGER trg_cdc_%I AFTER INSERT OR UPDATE OR DELETE ON %I
             FOR EACH ROW EXECUTE FUNCTION cdc_capture_change()',
            t, t
        );
    END LOOP;
END $$;
