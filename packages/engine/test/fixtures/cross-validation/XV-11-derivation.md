# XV-11 Derivation — $200,000 income, 45% bracket

## Source

ATO Individual Income Tax Rates, FY2026 (1 July 2025 – 30 June 2026).
Published at: https://www.ato.gov.au/rates/individual-income-tax-rates/
Rates applied:
0% on $0 – $18,200
16% on $18,201 – $45,000
30% on $45,001 – $135,000
37% on $135,001 – $190,000
45% on $190,001+

## External anchor type

EXTERNALLY ANCHORED — rate table sourced from ATO; arithmetic independently derived.
No LITO applies at $200,000 income. ATO estimator expected to agree.
DEV-0016 CPA queue: confirm with ATO estimator at $200k once offset framework live.

## Computation

Income: $200,000.00 → 20,000,000 cents

Bracket 1 (0%): 0c
Bracket 2 (16%): 428,800c (derived in XV-03-derivation.md)
Bracket 3 (30%): 2,700,000c (derived in XV-09-derivation.md)
Bracket 4 (37%):
taxable = 19,000,000 − 13,500,000 = 5,500,000c
tax = mulDiv(5,500,000, 3700, 10000, HALF_UP)
= (5,500,000 × 3700 + 5000) / 10000
= (20,350,000,000 + 5000) / 10000
= 2,035,000c

Bracket 5 (45%): previousThreshold=19,000,000c
income 20,000,000c > prev 19,000,000c → enter bracket
taxable = 20,000,000 − 19,000,000 = 1,000,000c
tax = mulDiv(1,000,000, 4500, 10000, HALF_UP)
= (1,000,000 × 4500 + 5000) / 10000
= (4,500,000,000 + 5000) / 10000
= 450,000c

Accumulation:
0 + 428,800 + 2,700,000 + 2,035,000 + 450,000 = 5,613,800c ($56,138.00)

## Expected value

20,000,000c income → 5,613,800c tax ($56,138.00)

## Independent check

16% × $26,800 = $4,288.00
30% × $90,000 = $27,000.00
37% × $55,000 = $20,350.00
45% × $10,000 = $4,500.00
Total = $4,288 + $27,000 + $20,350 + $4,500 = $56,138.00 ✓

## Test assertion

```typescript
expect(applyMarginalRates(20_000_000n, brackets)).toBe(5_613_800n);
```

## Rounding note

All products exactly divisible by 10,000. HALF_UP = truncation.
