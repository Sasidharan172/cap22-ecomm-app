# CAP-22 Power BI semantic model

Connect Power BI to Snowflake and select the `CLEAN` schema. Import or DirectQuery
the `FACT_ORDER`, `FACT_ORDER_LINE`, `FACT_LANDED_COST`, `FACT_SHIPMENT`,
`FACT_SHIPMENT_EVENT`, `FACT_DELIVERY_EXCEPTION`, `FACT_SHIPMENT_DOCUMENT`, `FACT_ESTIMATE_LINE`,
`FACT_ESTIMATE_COMPONENT`, `FACT_ESTIMATE_ASSUMPTION`, `DIM_DESTINATION`,
`DIM_PRODUCT`, `DIM_RULE_VERSION`, and `DIM_FX_RATE` tables.

## Relationships

- `DIM_DESTINATION[DESTINATION_ID]` 1:* `FACT_ORDER[DESTINATION_ID]`
- `FACT_ORDER[ORDER_ID]` 1:* `FACT_ORDER_LINE[ORDER_ID]`
- `FACT_ORDER[ORDER_ID]` 1:* `FACT_LANDED_COST[ORDER_ID]`
- `FACT_ORDER[ORDER_ID]` 1:* `FACT_SHIPMENT[ORDER_ID]`
- `FACT_SHIPMENT[SHIPMENT_ID]` 1:* `FACT_SHIPMENT_EVENT[SHIPMENT_ID]`
- `FACT_SHIPMENT[SHIPMENT_ID]` 1:* `FACT_DELIVERY_EXCEPTION[SHIPMENT_ID]`
- `FACT_SHIPMENT[SHIPMENT_ID]` 1:* `FACT_SHIPMENT_DOCUMENT[SHIPMENT_ID]`
- `FACT_DELIVERY_EXCEPTION[EXCEPTION_ID]` 1:* `FACT_EXCEPTION_ACTION[EXCEPTION_ID]`
- `FACT_DELIVERY_EXCEPTION[EXCEPTION_ID]` 1:* `FACT_EXCEPTION_ACTIVITY[EXCEPTION_ID]`
- `DIM_PRODUCT[PRODUCT_ID]` 1:* `FACT_ORDER_LINE[PRODUCT_ID]`
- `DIM_RULE_VERSION[RULE_VERSION_ID]` 1:* `FACT_LANDED_COST[RULE_VERSION_ID]`
- `FACT_LANDED_COST[ESTIMATE_ID]` 1:* `FACT_ESTIMATE_LINE[ESTIMATE_ID]`
- `FACT_LANDED_COST[ESTIMATE_ID]` 1:* `FACT_ESTIMATE_COMPONENT[ESTIMATE_ID]`
- `FACT_LANDED_COST[ESTIMATE_ID]` 1:* `FACT_ESTIMATE_ASSUMPTION[ESTIMATE_ID]`

Use single-direction filtering from dimensions to facts. Avoid bidirectional
relationships unless a specific report requirement proves they are necessary.

## DAX measures

```dax
Total Orders =
DISTINCTCOUNT(FACT_ORDER[ORDER_ID])

Total Shipments =
DISTINCTCOUNT(FACT_SHIPMENT[SHIPMENT_ID])

Delivered Shipments =
CALCULATE(
    [Total Shipments],
    FACT_SHIPMENT[SHIPMENT_STATUS] = "DELIVERED"
)

On-Time Delivered Shipments =
CALCULATE(
    [Total Shipments],
    FACT_SHIPMENT[DELIVERED_ON_TIME] = TRUE()
)

On-Time Delivery % =
DIVIDE([On-Time Delivered Shipments], [Delivered Shipments], 0)

Average Delivery Hours =
AVERAGE(FACT_SHIPMENT[DELIVERY_HOURS])

Open Exceptions =
CALCULATE(
    COUNTROWS(FACT_DELIVERY_EXCEPTION),
    FACT_DELIVERY_EXCEPTION[EXCEPTION_STATUS] IN {"OPEN", "ACKNOWLEDGED", "IN_PROGRESS"}
)

Average Exception Resolution Hours =
AVERAGE(FACT_DELIVERY_EXCEPTION[RESOLUTION_HOURS])

Total Estimated Landed Cost =
SUM(FACT_LANDED_COST[TOTAL_LANDED_COST])

Average Landed Cost =
AVERAGE(FACT_LANDED_COST[TOTAL_LANDED_COST])

Total Duty =
SUM(FACT_LANDED_COST[DUTY_AMOUNT])

Total Tax =
SUM(FACT_LANDED_COST[TAX_AMOUNT])

Total Brokerage =
SUM(FACT_LANDED_COST[FEE_AMOUNT])

Average Duty Rate =
AVERAGE(FACT_LANDED_COST[EFFECTIVE_DUTY_RATE])

Average Tax Rate =
AVERAGE(FACT_LANDED_COST[EFFECTIVE_TAX_RATE])

Missing Document Exceptions =
CALCULATE(
    COUNTROWS(FACT_DELIVERY_EXCEPTION),
    FACT_DELIVERY_EXCEPTION[EXCEPTION_CODE] = "MISSING_DOCUMENT",
    FACT_DELIVERY_EXCEPTION[EXCEPTION_STATUS] <> "RESOLVED"
)
```

**Currency rule:** Do not sum amounts across different currencies. Put currency and
destination in slicers or create a separate reporting-currency conversion model
before displaying a global total.

## Suggested report pages

1. **Executive Overview:** Total orders, total shipments, on-time delivery %,
   average landed cost, open exceptions; monthly orders and shipments.
2. **Landed Cost Analysis:** Goods/freight/insurance/duty/tax/brokerage breakdown,
   destination comparison, estimate version and rule-change impact.
3. **Delivery Performance:** On-time rate by destination and carrier, average
   delivery hours, shipment status distribution and delay trend.
4. **Customs & Exceptions:** Missing documents, exception severity/status,
   average resolution time, destination and carrier drivers.
5. **Product & Trade Analysis:** HS-code mix, product/destination landed cost,
   duty exposure and country-of-origin analysis.

The views `VW_DELIVERY_PERFORMANCE`, `VW_LANDED_COST_ANALYTICS`,
`VW_EXCEPTION_ANALYTICS`, and `VW_ORDER_OVERVIEW` are ready-made aggregate
sources for simpler visuals.
