# XV-18 Derivation — MLS Tier 1, $100,000 income, no private hospital cover

## Source

ATO Medicare Levy Surcharge, FY2026.
Published at: https://www.ato.gov.au/individuals-and-families/medicare-and-private-health-insurance/medicare-levy-surcharge/medicare-levy-surcharge-income-thresholds-and-rates
Tier 1 threshold: >$93,000 single; rate: 1.0% of total income.

## External anchor type

EXTERNALLY ANCHORED — threshold and rate sourced from ATO; arithmetic independently derived.
MLS applies to total income (not income above threshold), so no bracket math required.
DEV-0016 CPA queue: confirm MLS definition of "income for MLS purposes" vs taxable income
(ATO uses "income for surcharge purposes" which includes reportable fringe benefits etc.).
Engine currently uses raw assessable income as a proxy; Day 6 refinement required.

## Computation

Income: $100,000.00 → 10,000,000 cents
Private hospital cover: NO

MLS tier check (ascending threshold scan):
Tier 1 bracket: thresholdCents=9,300,000 ($93,000)
10,000,000c > 9,300,000c → applicableRateBps = 100 (1.0%)

Tier 2 bracket: thresholdCents=10,800,000 ($108,000)
10,000,000c ≤ 10,800,000c → do not update rate

Tier 3 bracket: thresholdCents=14,400,000 ($144,000)
10,000,000c ≤ 14,400,000c → do not update rate

Final applicableRateBps = 100

MLS = mulDiv(10,000,000, 100, 10000, HALF_UP)
= (10,000,000 × 100 + 5000) / 10000
= (1,000,000,000 + 5000) / 10000
= 100,000c ($1,000.00)

## Expected value

10,000,000c income, no PHC → 100,000c MLS ($1,000.00)

## Independent check

$100,000 × 1.0% = $1,000.00 ✓

## Test assertion

```typescript
expect(computeMLS(10_000_000n, medicareLevy, false)).toBe(100_000n);
```

## Rounding note

Product 1,000,000,000 is exactly divisible by 10,000. HALF_UP = truncation.
