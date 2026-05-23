# LT-04 Golden: Two Holdings, $800,000 Aggregate — Aggregation Effect

## Source

SRO Victoria Land Tax current rates (individual — FY2026):
https://www.sro.vic.gov.au/land-tax-current-rates (retrieved 2026-05-22)
VIC Land Tax Act 2005: tax applies to the total taxable value across all holdings.

## SRO VIC Individual Scale (2024+)

| Band | Taxable value           | Previous threshold | Flat    | Marginal |
| ---- | ----------------------- | ------------------ | ------- | -------- |
| 1    | Under $50,000           | $0                 | $0      | 0 bps    |
| 2    | $50,000 – $100,000      | $50,000            | $500    | 0 bps    |
| 3    | $100,000 – $300,000     | $100,000           | $975    | 0 bps    |
| 4    | $300,000 – $600,000     | $300,000           | $1,350  | 30 bps   |
| 5    | $600,000 – $1,000,000   | $600,000           | $2,250  | 60 bps   |
| 6    | $1,000,000 – $1,800,000 | $1,000,000         | $4,650  | 90 bps   |
| 7    | $1,800,000 – $3,000,000 | $1,800,000         | $11,850 | 165 bps  |
| 8    | Over $3,000,000         | $3,000,000         | $31,650 | 265 bps  |

Bracket selection: strictly-greater-than previous threshold.
At exactly the threshold, the lower bracket applies (e.g., $300,000 stays in Band 3).

## Scenario

Two investment properties. Owner: individual, resident. Both non-PPR, non-vacant.

- Holding A: site value $400,000 = 40,000,000 cents
- Holding B: site value $400,000 = 40,000,000 cents
- Aggregate: $800,000 = 80,000,000 cents

## CORRECT: Aggregate Computation (VIC Land Tax Act 2005)

```
Aggregate = $400,000 + $400,000 = $800,000 = 80,000,000 cents

Bracket selection:
  Is 80,000,000 > 60,000,000 (Band 5 previousThreshold)? YES → Band 5 applies
  Is 80,000,000 > 100,000,000 (Band 6 previousThreshold)? NO → Band 5 confirmed

Band 5 parameters:
  Previous threshold = $600,000 = 60,000,000 cents
  Flat               = $2,250   = 225,000 cents
  Marginal rate      = 60 bps   (0.6%)

Excess = 80,000,000 − 60,000,000 = 20,000,000 cents ($200,000)

Marginal:
  mulDiv(20,000,000, 60, 10,000, HALF_UP)
  = (20,000,000 × 60 + 5,000) / 10,000
  = (1,200,000,000 + 5,000) / 10,000
  = 1,200,005,000 / 10,000
  = 120,000 cents ($1,200)          ← exact (no rounding)

Total land tax = 225,000 + 120,000 = 345,000 cents = $3,450
```

## WRONG: Per-Property Sum (naive, incorrect method)

```
Holding A — $400,000 = 40,000,000 cents (taxed alone):
  Is 40,000,000 > 30,000,000 (Band 4 previousThreshold)? YES → Band 4
  Is 40,000,000 > 60,000,000 (Band 5 previousThreshold)? NO → Band 4 confirmed

  Band 4: previous = 30,000,000 cents, flat = 135,000 cents, marginal = 30 bps
  Excess = 40,000,000 − 30,000,000 = 10,000,000 cents ($100,000)
  Marginal = mulDiv(10,000,000, 30, 10,000) = (300,000,000 + 5,000) / 10,000 = 30,000 cents ($300)
  Tax on A = 135,000 + 30,000 = 165,000 cents ($1,650)

Holding B — identical to A: Tax on B = 165,000 cents ($1,650)

Per-property WRONG total: 165,000 + 165,000 = 330,000 cents ($3,300)
```

## Comparison

| Method               | Tax    | Cents   |
| -------------------- | ------ | ------- |
| Correct (aggregate)  | $3,450 | 345,000 |
| Wrong (per-property) | $3,300 | 330,000 |
| Difference           | +$150  | +15,000 |

Aggregate method yields HIGHER tax ($3,450 > $3,300). The combined $800K value is
assessed in Band 5 (60 bps marginal); individually each $400K is in Band 4 (30 bps).

The marginal rate advantage of aggregation:
Aggregate marginal: 60 bps × $200K = $1,200
Per-property marginal: 30 bps × $100K × 2 = $600
Marginal difference: +$600 for aggregate

Aggregate flat: $2,250 (once)
Per-property flat: $1,350 × 2 = $2,700
Flat saving: −$450 for aggregate

Net: +$600 (marginal) − $450 (flat saving) = +$150 higher for aggregate ✓

The defining VIC rule: aggregate method is always used — tax owed depends on the
TOTAL portfolio value, not on how many properties comprise it.

## SRO Cross-validation Anchors

These single-holding anchors independently verify the scale is correctly encoded
(LT-XV-01..LT-XV-03 in land-tax.test.ts):

| Site value | Expected tax | Derivation                                    |
| ---------- | ------------ | --------------------------------------------- |
| $360,000   | $1,530       | Band 4: $1,350 + 0.3% × $60K = $1,350 + $180  |
| $650,000   | $2,550       | Band 5: $2,250 + 0.6% × $50K = $2,250 + $300  |
| $750,000   | $3,150       | Band 5: $2,250 + 0.6% × $150K = $2,250 + $900 |

## Correction note

This golden replaces the prior derivation ($180K + $180K = $360K → $7,335) which
used fabricated rates. That derivation had Band 4 flat of $6,975 (wrong; correct is
$1,350) and 60 bps marginal in Band 3 (wrong; correct is 0 bps). See DEF-0003.

Scenario changed to $400K + $400K = $800K to demonstrate aggregation direction
(aggregate > per-property) with the correct SRO 2024+ scale.
