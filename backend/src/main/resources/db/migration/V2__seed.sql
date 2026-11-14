INSERT INTO customers (customer_id, customer_number, name, email, country_code) VALUES
 ('11111111-1111-1111-1111-111111111111','CUS-1001','Acme Imports','ops@acme.example','US'),
 ('22222222-2222-2222-2222-222222222222','CUS-1002','Berlin Retail GmbH','buyers@berlin-retail.example','DE');

INSERT INTO destinations (destination_id, code, name, currency) VALUES
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','US','United States','USD'),
 ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','DE','Germany','EUR');

INSERT INTO products (product_id, sku, name, hs_code, unit_price, currency, country_of_origin) VALUES
 ('33333333-3333-3333-3333-333333333333','SKU-TEE-001','Cotton T-Shirt','610910',12.5000,'USD','IN'),
 ('44444444-4444-4444-4444-444444444444','SKU-MUG-002','Ceramic Mug','691200',8.0000,'USD','CN'),
 ('55555555-5555-5555-5555-555555555555','SKU-BAG-003','Canvas Tote Bag','420222',15.0000,'USD','VN');

INSERT INTO orders (order_id, order_number, customer_id, destination_id, currency, status, created_at) VALUES
 ('66666666-6666-6666-6666-666666666666','ORD-1001','11111111-1111-1111-1111-111111111111','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','USD','CREATED', now() - interval '2 day'),
 ('77777777-7777-7777-7777-777777777777','ORD-1002','22222222-2222-2222-2222-222222222222','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','USD','CONFIRMED', now() - interval '1 day');

INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, currency) VALUES
 ('88888888-8888-8888-8888-888888888881','66666666-6666-6666-6666-666666666666','33333333-3333-3333-3333-333333333333',10,12.5000,'USD'),
 ('88888888-8888-8888-8888-888888888882','66666666-6666-6666-6666-666666666666','44444444-4444-4444-4444-444444444444',5,8.0000,'USD'),
 ('88888888-8888-8888-8888-888888888883','77777777-7777-7777-7777-777777777777','55555555-5555-5555-5555-555555555555',8,15.0000,'USD');

INSERT INTO shipments (shipment_id, order_id, tracking_number, carrier, status, expected_delivery_at, delivered_at) VALUES
 ('99999999-9999-9999-9999-999999999991','66666666-6666-6666-6666-666666666666','TRK-DE-1001','DHL','IN_TRANSIT', now() + interval '5 day', null),
 ('99999999-9999-9999-9999-999999999992','77777777-7777-7777-7777-777777777777','TRK-US-1002','UPS','CREATED', now() + interval '7 day', null);

INSERT INTO shipment_items (shipment_item_id, shipment_id, order_item_id, quantity_shipped) VALUES
 ('12121212-1212-1212-1212-121212121211','99999999-9999-9999-9999-999999999991','88888888-8888-8888-8888-888888888881',10),
 ('12121212-1212-1212-1212-121212121212','99999999-9999-9999-9999-999999999991','88888888-8888-8888-8888-888888888882',5),
 ('12121212-1212-1212-1212-121212121213','99999999-9999-9999-9999-999999999992','88888888-8888-8888-8888-888888888883',8);

INSERT INTO destination_rules (rule_id, destination_id, hs_prefix, duty_rate, tax_rate, handling_fee, fee_currency, effective_from, effective_to, active) VALUES
 ('abababab-abab-abab-abab-abababababab','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','6109',0.120000,0.190000,5.0000,'EUR','2025-01-01',null,true),
 ('acacacac-acac-acac-acac-acacacacacac','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','6912',0.080000,0.190000,5.0000,'EUR','2025-01-01',null,true),
 ('adadadad-adad-adad-adad-adadadadadad','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','4202',0.100000,0.070000,3.0000,'USD','2025-01-01',null,true),
 ('aeaeaeae-aeae-aeae-aeae-aeaeaeaeaeae','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','',0.050000,0.050000,2.0000,'USD','2025-01-01',null,true),
 ('afafafaf-afaf-afaf-afaf-afafafafafaf','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','',0.060000,0.190000,4.0000,'EUR','2025-01-01',null,true);

INSERT INTO exchange_rates (exchange_rate_id, base_currency, target_currency, exchange_rate, effective_date, source) VALUES
 ('cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd','USD','EUR',0.92000000, current_date - 1,'demo'),
 ('cececece-cece-cece-cece-cececececece','USD','USD',1.00000000, current_date - 1,'demo'),
 ('cfcfcfcf-cfcf-cfcf-cfcf-cfcfcfcfcfcf','EUR','USD',1.08695652, current_date - 1,'demo');

INSERT INTO document_types (document_type_id, code, name) VALUES
 ('d1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1','COMMERCIAL_INVOICE','Commercial Invoice'),
 ('d2d2d2d2-d2d2-d2d2-d2d2-d2d2d2d2d2d2','PACKING_LIST','Packing List'),
 ('d3d3d3d3-d3d3-d3d3-d3d3-d3d3d3d3d3d3','CERTIFICATE_OF_ORIGIN','Certificate of Origin');
