# Rules and calculation semantics

This document is the normative description of how an estimate is produced. The
implementation lives in `RuleResolutionService`, `FxService`, and
`LandedCostCalculator`.

## 1. Rule versions and effective dates

A `rule_versions` row belongs to one destination and carries:

- `version` — monotonically increasing per destination;
- `status` — `DRAFT`, `PUBLISHED`, or `RETIRED`;
- `effective_from` — inclusive instant;
- `effective_to` — exclusive instant, or `NULL` for open-ended;
- de minimis configuration and free-text notes.

Resolution for a destination and as-of instant:

1. Keep only `PUBLISHED` versions where
   `effective_from <= asOf < effective_to` (with `NULL` treated as infinity).
2. Order by `effective_from DESC, version DESC`.
3. Take the first row.

All instants are UTC. The as-of timestamp is the estimate's as-of, **not** the
order creation time, so backdated and forward-dated estimates resolve the rules
that were in force at that instant.

Overlapping published versions are a data-quality problem. The schema does not
forbid them; resolution is deterministic (most recently effective wins) and the
repository exposes an overlap check for a future publish workflow. Until that
workflow exists, seed and migration data must be kept non-overlapping.

## 2. Duty and tax matching

Within the resolved rule version:

- Every line's HS code is matched against `hs_prefix` using `startsWith`.
- The **longest** matching prefix wins; ties are broken lexicographically.
- A duty rule with an empty prefix is the fallback for unmatched lines.
- If no duty rule matches, the estimate fails with `DUTY_RULE_NOT_FOUND` rather
  than silently charging zero.
- Tax rules resolve the same way and additionally specify the tax base
  (`CIF` or `CIF_PLUS_DUTY`).

## 3. De minimis

De minimis is evaluated once per estimate, against the **total** customs value
in the destination currency:

```
deMinimisApplied = threshold != null && totalCustomsValue <= threshold
```

The rule version independently decides whether the threshold waives duty, tax,
or both. The threshold currency must equal the destination currency; otherwise
the estimate fails with `DE_MINIMIS_CURRENCY_MISMATCH`.

Seeded behaviour:

| Destination | Threshold | Waives duty | Waives tax |
| --- | --- | --- | --- |
| US | USD 800 | yes | yes |
| DE | EUR 150 | yes | no |

## 4. FX

- If order currency equals destination currency, the rate is `1.0` with source
  `IDENTITY` and no FX row is stored.
- Otherwise, the most recent `fx_rates` row with
  `base_currency = order currency`, `quote_currency = destination currency`, and
  `as_of <= estimate date` is used.
- The rate, its observation date, and its source are persisted on the estimate.
- No triangulation is performed. A missing direct rate fails with
  `FX_RATE_NOT_FOUND`.

Seeded rates: USD→EUR `0.9259` on 2026-11-10 and `0.9300` on 2026-11-16.

## 5. Calculation order

Let `fx` be the resolved rate. For each line:

1. `rawGoods = unitPrice × quantity × fx`
2. `goodsTotal = round(sum(rawGoods))`
3. `freightTotal = round(orderFreight × fx)`
4. `insuranceTotal = round(orderInsurance × fx)`
5. Allocate `goodsTotal`, `freightTotal`, and `insuranceTotal` across lines in
   proportion to each line's `rawGoods`. Each allocated share is rounded; the
   last line receives `total − sum(previous shares)` so line sums reconcile
   exactly.
6. Per line: `customsValue = round(goods + freight + insurance)`.
7. Per line: `duty = round(customsValue × dutyRate)`, or zero when de minimis
   waives duty.
8. Per line: `taxBase = customsValue` for `CIF`, else
   `customsValue + duty`; `tax = round(taxBase × taxRate)`, or zero when de
   minimis waives tax.
9. `dutyTotal` and `taxTotal` are the sums of the rounded line amounts.
10. `fee = round(flatFee + percentage × customsTotal)`.
11. `total = customsTotal + dutyTotal + taxTotal + fee`.

`round` is `HALF_UP` to 2 decimals (`MoneyMath`). Monetary values are stored as
`numeric(19,4)`; rates as `numeric(9,6)`; FX as `numeric(19,8)`.

## 6. Estimate lifecycle

- Creating an estimate for an order appends a new version.
- Before persisting, every `CURRENT` estimate for the order is marked
  `SUPERSEDED`.
- Recalculation is allowed only from the `CURRENT` estimate; a second attempt on
  a superseded estimate returns `409 ESTIMATE_ALREADY_SUPERSEDED`.
- The new estimate records `supersedes_estimate_id`, its rule version, its FX
  snapshot, its as-of instant, and the full component/line/assumption breakdown.
- `GET /api/v1/estimates/{id}/comparison` returns component deltas and the total
  delta against the immediate predecessor.

Estimates are append-only. There is no update or delete endpoint.

## 7. Worked examples

### US order `ORD-US-1001` (as of 2026-11-10)

- Goods USD 240.00, freight USD 15.00, insurance USD 5.00, CIF USD 260.00.
- USD 260 ≤ USD 800 de minimis → duty and tax waived.
- Fee = 2.50 + 1.5% × 260.00 = USD 6.40.
- **Total USD 266.40.**

### German order `ORD-DE-1002` (as of 2026-11-10, rule v1, FX 0.9259)

- Goods EUR 356.47, freight EUR 23.15, insurance EUR 7.41, CIF EUR 387.03.
- CIF > EUR 150 → de minimis not applied.
- Duty EUR 10.26; import VAT EUR 75.49; fee EUR 9.31.
- **Total EUR 482.09.**

### Recalculation (as of 2026-11-16, rule v2, FX 0.9300)

- Rule v2 raises the electronics duty from 2.0% to 3.5%.
- **Total EUR 490.67**, a delta of EUR 8.58; duty alone rises by EUR 5.49.

## 8. Error codes

| Code | HTTP | Meaning |
| --- | --- | --- |
| `DESTINATION_NOT_FOUND` | 404 | Unknown destination code |
| `ORDER_NOT_FOUND` | 404 | Unknown order |
| `PRODUCT_NOT_FOUND` | 404 | Unknown SKU |
| `ESTIMATE_NOT_FOUND` | 404 | Unknown estimate |
| `ORDER_NUMBER_EXISTS` | 409 | Duplicate order number |
| `ESTIMATE_ALREADY_SUPERSEDED` | 409 | Recalculating a superseded estimate |
| `NO_PREVIOUS_ESTIMATE` | 409 | Comparison requested for v1 |
| `RULE_VERSION_NOT_FOUND` | 422 | No published rule version effective at as-of |
| `DUTY_RULE_NOT_FOUND` | 422 | No duty rule matches an HS code |
| `TAX_RULE_NOT_FOUND` | 422 | No tax rule matches an HS code |
| `FX_RATE_NOT_FOUND` | 422 | No FX rate on or before the estimate date |
| `DE_MINIMIS_CURRENCY_MISMATCH` | 422 | Threshold currency ≠ destination currency |
| `FEE_CURRENCY_MISMATCH` | 422 | Fee currency ≠ destination currency |
| `EMPTY_ORDER` | 422 | Order has no lines |
| `INVALID_FREIGHT` / `INVALID_INSURANCE` / `INVALID_FX_RATE` | 422 | Non-positive or negative inputs |
| `VALIDATION_FAILED` | 400 | Bean-validation failure (field map included) |

## Rule administration API

Rule versions are managed as immutable published snapshots. Operations users create a draft, edit it while it remains a draft, validate it through the publish operation, and publish it for its effective period. A published version is never edited in place; create a new version instead. All rates in this project are simulated and are not legal or customs advice.

### Create a draft

`POST /api/v1/rules/destinations/{destinationCode}/versions`

Example request:

```json
{
  "effectiveFrom": "2027-01-01T00:00:00Z",
  "effectiveTo": "2028-01-01T00:00:00Z",
  "deMinimisAmount": 150.0000,
  "deMinimisCurrency": "EUR",
  "deMinimisWaivesDuty": true,
  "deMinimisWaivesTax": false,
  "notes": "Simulated destination rule update",
  "dutyRates": [
    { "hsPrefix": "8518", "rate": 0.040000 },
    { "hsPrefix": "", "rate": 0.050000 }
  ],
  "taxRates": [
    { "hsPrefix": "", "rate": 0.190000, "base": "CIF_PLUS_DUTY" }
  ],
  "fee": { "flatFee": 3.5000, "percentage": 0.015000, "currency": "EUR" }
}
```

The `X-Actor` header optionally records the operator responsible for the action (defaults to `system`). It is attribution only; authentication/authorization is not yet enabled in this demo.

### Update a draft

`PUT /api/v1/rules/versions/{id}` accepts the same body as draft creation. Published and retired versions return `409 RULE_VERSION_IMMUTABLE`.

### Publish a draft

`POST /api/v1/rules/versions/{id}/publish`

Publishing checks that duty rates, tax rates and a fee schedule exist; effective dates are valid; fee and de-minimis currencies match the destination currency; and the period does not create an ambiguous overlap. A forward-dated open-ended version may supersede exactly one currently effective predecessor: the predecessor is closed at the new version start and an audit event records that boundary change. Finite-period drafts cannot overlap published periods. A destination row is locked during version allocation and publication to serialize concurrent changes.

### Read a version and its audit history

`GET /api/v1/rules/versions/{id}` returns the complete configuration and its audit events. Existing `GET /api/v1/rules/versions?destination=DE` and `GET /api/v1/rules/resolve` endpoints remain available.

### Important behavior

- Version numbers are allocated monotonically per destination.
- Effective periods use half-open intervals: `effectiveFrom` is inclusive and `effectiveTo` is exclusive.
- Drafts do not affect landed-cost calculations. Only published versions are resolved.
- Published rule content is immutable; for a forward open-ended replacement, the previous version’s effective end boundary is closed once at the successor start. Create a later draft for every subsequent change.
- Duty and tax rates are fractions from `0` through `1` (for example, `0.19` means 19%).
- HS-code prefixes contain up to 10 digits; both duty and tax configurations must include the empty-prefix fallback rule.
- Audit events record draft creation, draft updates and publication.
