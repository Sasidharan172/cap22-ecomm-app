CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE customers (
    customer_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_number varchar(40) NOT NULL UNIQUE,
    name varchar(160) NOT NULL,
    email varchar(160),
    country_code varchar(2) NOT NULL
);

CREATE TABLE destinations (
    destination_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(2) NOT NULL UNIQUE,
    name varchar(100) NOT NULL,
    currency varchar(3) NOT NULL
);

CREATE TABLE products (
    product_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sku varchar(40) NOT NULL UNIQUE,
    name varchar(200) NOT NULL,
    hs_code varchar(10) NOT NULL,
    unit_price numeric(19,4) NOT NULL,
    currency varchar(3) NOT NULL,
    country_of_origin varchar(2) NOT NULL
);

CREATE TABLE orders (
    order_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number varchar(40) NOT NULL UNIQUE,
    customer_id uuid NOT NULL REFERENCES customers(customer_id),
    destination_id uuid NOT NULL REFERENCES destinations(destination_id),
    currency varchar(3) NOT NULL,
    status varchar(30) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
    order_item_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES products(product_id),
    quantity integer NOT NULL CHECK (quantity > 0),
    unit_price numeric(19,4) NOT NULL,
    currency varchar(3) NOT NULL
);

CREATE TABLE shipments (
    shipment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES orders(order_id),
    tracking_number varchar(80) NOT NULL,
    carrier varchar(60) NOT NULL,
    status varchar(30) NOT NULL,
    expected_delivery_at timestamptz,
    delivered_at timestamptz
);

CREATE TABLE shipment_items (
    shipment_item_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id uuid NOT NULL REFERENCES shipments(shipment_id) ON DELETE CASCADE,
    order_item_id uuid NOT NULL REFERENCES order_items(order_item_id),
    quantity_shipped integer NOT NULL CHECK (quantity_shipped > 0),
    UNIQUE (shipment_id, order_item_id)
);

CREATE TABLE destination_rules (
    rule_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    destination_id uuid NOT NULL REFERENCES destinations(destination_id),
    hs_prefix varchar(10) NOT NULL DEFAULT '',
    duty_rate numeric(9,6) NOT NULL DEFAULT 0,
    tax_rate numeric(9,6) NOT NULL DEFAULT 0,
    handling_fee numeric(19,4) NOT NULL DEFAULT 0,
    fee_currency varchar(3) NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    active boolean NOT NULL DEFAULT true
);

CREATE TABLE exchange_rates (
    exchange_rate_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    base_currency varchar(3) NOT NULL,
    target_currency varchar(3) NOT NULL,
    exchange_rate numeric(19,8) NOT NULL CHECK (exchange_rate > 0),
    effective_date date NOT NULL,
    source varchar(60) NOT NULL
);

CREATE TABLE landed_cost_estimates (
    estimate_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id uuid NOT NULL REFERENCES shipments(shipment_id),
    rule_id uuid REFERENCES destination_rules(rule_id),
    exchange_rate_id uuid REFERENCES exchange_rates(exchange_rate_id),
    estimate_version integer NOT NULL,
    product_value numeric(19,4) NOT NULL DEFAULT 0,
    shipping_cost numeric(19,4) NOT NULL DEFAULT 0,
    insurance_cost numeric(19,4) NOT NULL DEFAULT 0,
    duty_amount numeric(19,4) NOT NULL DEFAULT 0,
    tax_amount numeric(19,4) NOT NULL DEFAULT 0,
    handling_fee_amount numeric(19,4) NOT NULL DEFAULT 0,
    destination_currency varchar(3) NOT NULL,
    destination_landed_cost numeric(19,4) NOT NULL DEFAULT 0,
    reporting_currency varchar(3) NOT NULL,
    reporting_landed_cost numeric(19,4) NOT NULL DEFAULT 0,
    rule_snapshot jsonb,
    fx_snapshot jsonb,
    calculation_version varchar(40) NOT NULL DEFAULT 'v1',
    request_key varchar(120),
    previous_estimate_id uuid REFERENCES landed_cost_estimates(estimate_id),
    estimate_date date NOT NULL,
    estimated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cost_estimate_components (
    component_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    estimate_id uuid NOT NULL REFERENCES landed_cost_estimates(estimate_id) ON DELETE CASCADE,
    component_code varchar(40) NOT NULL,
    amount numeric(19,4) NOT NULL,
    currency_code varchar(3) NOT NULL,
    calculation_basis numeric(19,4),
    applied_rate numeric(9,6)
);

CREATE TABLE carrier_events (
    carrier_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id uuid NOT NULL REFERENCES shipments(shipment_id) ON DELETE CASCADE,
    external_event_id varchar(80),
    raw_event_code varchar(60) NOT NULL,
    normalized_event_type varchar(40) NOT NULL,
    occurred_at timestamptz NOT NULL,
    received_at timestamptz NOT NULL DEFAULT now(),
    is_duplicate boolean NOT NULL DEFAULT false,
    is_effective boolean NOT NULL DEFAULT false,
    raw_payload jsonb
);

CREATE TABLE document_types (
    document_type_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(40) NOT NULL UNIQUE,
    name varchar(120) NOT NULL
);

CREATE TABLE shipment_documents (
    shipment_document_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id uuid NOT NULL REFERENCES shipments(shipment_id) ON DELETE CASCADE,
    document_type_id uuid NOT NULL REFERENCES document_types(document_type_id),
    verification_status varchar(20) NOT NULL DEFAULT 'PENDING',
    received_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (shipment_id, document_type_id)
);

CREATE TABLE exceptions (
    exception_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id uuid NOT NULL REFERENCES shipments(shipment_id) ON DELETE CASCADE,
    exception_type varchar(40) NOT NULL,
    severity varchar(10) NOT NULL,
    status varchar(20) NOT NULL,
    summary varchar(240) NOT NULL,
    opened_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz
);

CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_destination ON orders(destination_id);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_shipments_order ON shipments(order_id);
CREATE INDEX idx_shipment_items_shipment ON shipment_items(shipment_id);
CREATE INDEX idx_rules_destination ON destination_rules(destination_id, active, effective_from);
CREATE INDEX idx_exchange_rates_pair ON exchange_rates(base_currency, target_currency, effective_date DESC);
CREATE INDEX idx_estimates_shipment ON landed_cost_estimates(shipment_id, estimate_version DESC);
CREATE INDEX idx_components_estimate ON cost_estimate_components(estimate_id);
CREATE INDEX idx_carrier_events_shipment ON carrier_events(shipment_id, occurred_at DESC);
CREATE INDEX idx_shipment_docs_shipment ON shipment_documents(shipment_id);
CREATE INDEX idx_exceptions_shipment ON exceptions(shipment_id, opened_at DESC);
