# Assumption register

Every estimate persists the assumptions that applied to it, so a reviewer can
challenge a number without reading the source. The canonical definitions live in
`AssumptionRegister`; this document adds rationale and production notes.

| Code | Assumption | Why it exists | Production note |
| --- | --- | --- | --- |
| A-01 | Customs value is CIF: goods + international freight + cargo insurance. | CIF is a common customs valuation basis and makes freight/insurance treatment explicit. | Destination-specific valuation (for example FOB-based markets) needs a rule-version attribute, not a code change. |
| A-02 | Freight and insurance are allocated to lines by goods value; the rounding residual is assigned to the last line. | Duties are line-level, but freight and insurance arrive order-level. Value-proportional allocation is auditable and the residual guarantees line totals reconcile. | Weight- or volume-based allocation can be added as a rule-version policy. |
| A-03 | Duty and tax rates are selected by the longest matching HS prefix within the resolved rule version. | HS codes are hierarchical; specific rules must beat generic ones deterministically. | A full tariff schedule needs chapter/heading granularity and validity windows per rate. |
| A-04 | The import tax base is configured per rule version as `CIF` or `CIF_PLUS_DUTY`. | VAT/GST bases differ by destination. | Add more bases only with an explicit enum and migration. |
| A-05 | The most recent FX observation on or before the estimate date is used and persisted with the estimate. | Historical estimates must be reproducible after rates change. | Production should record the source timestamp and provider, and alert on stale rates. |
| A-06 | Each component is rounded HALF_UP to 2 decimals; the total is the sum of rounded components. | Prevents hidden sub-cent drift and makes the displayed total exactly reproducible. | Zero-decimal currencies (JPY) and cash-rounding markets need per-currency rounding metadata. |
| A-07 | De minimis is evaluated once against the total customs value and can waive duty, tax, or both per rule version. | Mirrors how thresholds are usually applied at consignment level. | Some regimes apply thresholds per line or per importer; model that explicitly if required. |
| A-08 | Brokerage/handling is a flat fee plus a percentage of customs value, per rule version. | Captures the common flat + ad valorem carrier/broker charge. | Real contracts may have minimums, caps, and per-line fees. |
| A-09 | Duty and tax rates are simulated; the estimate is not legal, tax, or customs advice. | The demo must never be mistaken for a filing tool. | Replace with licensed tariff data and legal review before production use. |
| A-10 | The rule version is resolved at the estimate as-of timestamp, not at order creation. | Backdated and forward-dated estimates must use the rules in force at that time. | Publishing workflows should prevent overlapping versions; the schema includes an overlap-check query for this. |
| A-11 | The estimate is expressed in the destination currency using the persisted FX snapshot. | Operations and customers compare landed cost in the import country's currency. | Add order-currency presentation as a derived view, not a second source of truth. |
| A-12 | Only configured duty, import tax, and brokerage are modelled; destination sales tax and anti-dumping duties are out of scope. | Keeps the demo's scope honest. | Add explicit component types rather than overloading duty. |

## Worked rounding example

German order `ORD-DE-1002`, as of 2026-11-10, USD→EUR rate `0.9259`:

| Step | Value |
| --- | --- |
| Goods (USD 385.00 × 0.9259) | EUR 356.47 |
| Freight (USD 25.00 × 0.9259) | EUR 23.15 |
| Insurance (USD 8.00 × 0.9259) | EUR 7.41 |
| CIF customs value | EUR 387.03 |
| Duty (2.0% electronics + 12.0% apparel, line-level) | EUR 10.26 |
| Import VAT (19% of CIF + duty, line-level) | EUR 75.49 |
| Brokerage (EUR 3.50 + 1.5% of CIF) | EUR 9.31 |
| Total | EUR 482.09 |

The total is `387.03 + 10.26 + 75.49 + 9.31`, not a separately rounded sum of
unrounded intermediates.

## Allocation residual

For the same order, line goods values are EUR 333.32 (3 × headphones) and
EUR 23.15 (1 × t-shirt). Freight is allocated proportionally and the final line
absorbs the residual:

| Line | Goods | Freight | Insurance | CIF |
| --- | --- | --- | --- | --- |
| P-1001 ×3 | 333.32 | 21.65 | 6.93 | 361.90 |
| P-1002 ×1 | 23.15 | 1.50 | 0.48 | 25.13 |
| **Total** | **356.47** | **23.15** | **7.41** | **387.03** |

Line-level values are returned by the API and persisted with each estimate.

## Changing an assumption

1. Update `AssumptionRegister` and this document together.
2. If the change affects money, add or update a golden-number test.
3. If the change is destination-specific, put it on the rule version rather than
   branching on a destination code in code.
