# XV-03 Derivation — $37,000 income, 16% bracket

## Source

ATO Individual Income Tax Rates, FY2026 (1 July 2025 – 30 June 2026).
Published at: https://www.ato.gov.au/rates/individual-income-tax-rates/
Rates applied:
0% on $0 – $18,200
16% on $18,201 – $45,000 (Stage 3 tax cut effective 1 July 2025)

## External anchor type

EXTERNALLY ANCHORED — rate table sourced from ATO; arithmetic independently derived.
NOT from ATO online estimator: that tool includes Low Income Tax Offset (LITO).
At $37,000, LITO reduces liability by up to $700. Pre-LITO value tested here.
DEV-0016 CPA queue: reconcile with ATO estimator output once LITO is implemented.

## Computation

Income: $37,000.00 → 3,700,000 cents

Bracket 1: previousThreshold=0c, threshold=1,820,000c, rateBps=0
taxable = min(3,700,000, 1,820,000) − 0 = 1,820,000c
tax = mulDiv(1,820,000, 0, 10000, HALF_UP) = 0c

Bracket 2: previousThreshold=1,820,000c, threshold=4,500,000c, rateBps=1600
income 3,700,000c > prev 1,820,000c → enter bracket
taxable = min(3,700,000, 4,500,000) − 1,820,000 = 1,880,000c
tax = mulDiv(1,880,000, 1600, 10000, HALF_UP)
= (1,880,000 × 1600 + 5000) / 10000
= (3,008,000,000 + 5000) / 10000
= 3,008,005,000 / 10000
= 300,800c [300,800 × 10000 = 3,008,000,000; remainder 5,000 < 10,000 → truncate]

Bracket 3: previousThreshold=4,500,000c
income 3,700,000c ≤ prev 4,500,000c → STOP

Total tax = 300,800c ($3,008.00)

## Expected value

3,700,000c income → 300,800c tax ($3,008.00)

## Independent check

$37,000 − $18,200 = $18,800 in the 16% bracket.
$18,800 × 0.16 = $3,008.00 ✓ (exact, no fractional cents)

## Test assertion

```typescript
expect(applyMarginalRates(3_700_000n, brackets)).toBe(300_800n);
```

## Rounding note

Product 3,008,000,000 is exactly divisible by 10,000.
HALF_UP and floor/truncation give identical results for this value.
