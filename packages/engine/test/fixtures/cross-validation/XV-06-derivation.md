# XV-06 Derivation — $100,000 income, 30% bracket

## Source

ATO Individual Income Tax Rates, FY2026 (1 July 2025 – 30 June 2026).
Published at: https://www.ato.gov.au/rates/individual-income-tax-rates/
Rates applied:
0% on $0 – $18,200
16% on $18,201 – $45,000
30% on $45,001 – $135,000 (Stage 3 tax cut effective 1 July 2025)

## External anchor type

EXTERNALLY ANCHORED — rate table sourced from ATO; arithmetic independently derived.
NOT from ATO online estimator: includes Low Income Tax Offset (LITO, max $700) and
potentially Low and Middle Income Tax Offset (LMITO — expired FY2023). Pre-offset value.
At $100,000, no LITO applies (income exceeds phaseout). ATO estimator would agree
on raw bracket tax = $20,788 before offsets, though LITO has zero effect here.
DEV-0016 CPA queue: confirm with ATO estimator at $100k once offset framework live.

## Computation

Income: $100,000.00 → 10,000,000 cents

Bracket 1: previousThreshold=0c, threshold=1,820,000c, rateBps=0
taxable = 1,820,000c
tax = 0c

Bracket 2: previousThreshold=1,820,000c, threshold=4,500,000c, rateBps=1600
taxable = 4,500,000 − 1,820,000 = 2,680,000c
tax = mulDiv(2,680,000, 1600, 10000, HALF_UP)
= (2,680,000 × 1600 + 5000) / 10000
= (4,288,000,000 + 5000) / 10000
= 428,800c

Bracket 3: previousThreshold=4,500,000c, threshold=13,500,000c, rateBps=3000
income 10,000,000c > prev 4,500,000c → enter bracket
taxable = min(10,000,000, 13,500,000) − 4,500,000 = 5,500,000c
tax = mulDiv(5,500,000, 3000, 10000, HALF_UP)
= (5,500,000 × 3000 + 5000) / 10000
= (16,500,000,000 + 5000) / 10000
= 1,650,000c

Bracket 4: previousThreshold=13,500,000c
income 10,000,000c < prev 13,500,000c → STOP

Accumulation:
Bracket 1: 0c
Bracket 2: 428,800c
Bracket 3: 1,650,000c
Total: 2,078,800c ($20,788.00)

## Expected value

10,000,000c income → 2,078,800c tax ($20,788.00)

## Independent check

16% × ($45,000 − $18,200) = 16% × $26,800 = $4,288.00
30% × ($100,000 − $45,000) = 30% × $55,000 = $16,500.00
Total = $4,288.00 + $16,500.00 = $20,788.00 ✓

## Test assertion

```typescript
expect(applyMarginalRates(10_000_000n, brackets)).toBe(2_078_800n);
```

## Rounding note

All products exactly divisible by 10,000. HALF_UP = truncation for these values.
