# LT-03 Golden: Single Holding $200,000 — VIC Land Tax

## Source

SRO Victoria Land Tax current rates (individual — FY2026):
https://www.sro.vic.gov.au/land-tax-current-rates (retrieved 2026-05-22)

## Scenario

Single investment property. Owner: individual, resident (not absentee). No PPR.
Aggregate site value: $200,000.

## VIC Land Tax Scale — Individual (SRO 2024+, effective from 2024-25 onward)

| Band | Taxable value           | Flat fee | Marginal on excess |
| ---- | ----------------------- | -------- | ------------------ |
| 1    | Under $50,000           | nil      | 0%                 |
| 2    | $50,000 – $100,000      | $500     | 0% (flat fee only) |
| 3    | $100,000 – $300,000     | $975     | 0% (flat fee only) |
| 4    | $300,000 – $600,000     | $1,350   | 0.3%               |
| 5    | $600,000 – $1,000,000   | $2,250   | 0.6%               |
| 6    | $1,000,000 – $1,800,000 | $4,650   | 0.9%               |
| 7    | $1,800,000 – $3,000,000 | $11,850  | 1.65%              |
| 8    | Over $3,000,000         | $31,650  | 2.65%              |

Note: Bands 2 and 3 are flat-fee-only (0% marginal). The flat fee is charged on the
entire amount in the band — not just the excess. This differs from the pre-2024 scale.

## Computation

```
Aggregate site value = $200,000 = 20,000,000 cents

Bracket selection (strictly-greater-than previous threshold):
  Band 3 applies: previousThreshold = $100,000 = 10,000,000 cents
  Condition: 20,000,000 > 10,000,000 ✓ (and 20,000,000 ≤ 30,000,000 so Band 4 does not apply)

Band 3 parameters:
  Previous threshold = $100,000 = 10,000,000 cents
  Flat component     = $975 = 97,500 cents
  Marginal rate      = 0 bps (flat fee only)

Marginal component:
  mulDiv(20,000,000 − 10,000,000, 0, 10,000, HALF_UP) = 0 cents

Total land tax = 97,500 + 0 = 97,500 cents = $975
```

## Cross-check

SRO table (Band 3): $975 flat, 0% marginal.
Tax on any value in $100K–$300K = $975 exactly. $200K → $975 ✓

## Result

| Item          | Value          |
| ------------- | -------------- |
| Aggregate     | $200,000       |
| Band          | 3: $100K–$300K |
| Flat          | $975           |
| Marginal (0%) | $0             |
| **Total**     | **$975**       |
| In cents      | 97,500         |

## Correction note

This golden replaces the prior derivation (Track A / DEF-0003 rebuild) which used
the pre-2024 fabricated scale with wrong rates ($1,275 = 127,500 cents). The prior
scale had 30 bps marginal in Band 3; the correct SRO 2024+ scale has 0 bps (flat only).
