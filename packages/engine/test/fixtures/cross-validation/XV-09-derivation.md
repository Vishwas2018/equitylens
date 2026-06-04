# XV-09 Derivation — $150,000 income, 37% bracket

## Source

ATO Individual Income Tax Rates, FY2026 (1 July 2025 – 30 June 2026).
Published at: https://www.ato.gov.au/rates/individual-income-tax-rates/
Rates applied:
0% on $0 – $18,200
16% on $18,201 – $45,000
30% on $45,001 – $135,000
37% on $135,001 – $190,000 (Stage 3 tax cut — same rate as prior law)

## External anchor type

EXTERNALLY ANCHORED — rate table sourced from ATO; arithmetic independently derived.
NOT from ATO online estimator. No LITO at $150,000 (above phaseout range).
DEV-0016 CPA queue: confirm with ATO estimator at $150k once offset framework live.

## Computation

Income: $150,000.00 → 15,000,000 cents

Bracket 1 (0%):
taxable = 1,820,000c; tax = 0c

Bracket 2 (16%):
taxable = 4,500,000 − 1,820,000 = 2,680,000c
tax = mulDiv(2,680,000, 1600, 10000, HALF_UP) = 428,800c

Bracket 3 (30%):
taxable = 13,500,000 − 4,500,000 = 9,000,000c
tax = mulDiv(9,000,000, 3000, 10000, HALF_UP)
= (9,000,000 × 3000 + 5000) / 10000
= (27,000,000,000 + 5000) / 10000
= 2,700,000c

Bracket 4 (37%): previousThreshold=13,500,000c, threshold=19,000,000c
income 15,000,000c > prev 13,500,000c → enter bracket
taxable = min(15,000,000, 19,000,000) − 13,500,000 = 1,500,000c
tax = mulDiv(1,500,000, 3700, 10000, HALF_UP)
= (1,500,000 × 3700 + 5000) / 10000
= (5,550,000,000 + 5000) / 10000
= 5,550,005,000 / 10000
= 555,000c [555,000 × 10000 = 5,550,000,000; remainder 5,000 < 10,000 → truncate]

Bracket 5: previousThreshold=19,000,000c
income 15,000,000c < prev → STOP

Accumulation:
0 + 428,800 + 2,700,000 + 555,000 = 3,683,800c ($36,838.00)

## Expected value

15,000,000c income → 3,683,800c tax ($36,838.00)

## Independent check

16% × $26,800 = $4,288.00
30% × $90,000 = $27,000.00
37% × $15,000 = $5,550.00
Total = $4,288 + $27,000 + $5,550 = $36,838.00 ✓

## Test assertion

```typescript
expect(applyMarginalRates(15_000_000n, brackets)).toBe(3_683_800n);
```

## Rounding note

Product 5,550,000,000 is exactly divisible by 10,000 (5,550,000,000 / 10,000 = 555,000 exactly).
HALF_UP = truncation here.
