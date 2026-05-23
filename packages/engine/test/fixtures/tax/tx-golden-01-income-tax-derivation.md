# TX-XV-01 + TX-XV-02 Golden: Income Tax — Stage 3 Brackets

## Source

Treasury Laws Amendment (Cost of Living Tax Cuts) Act 2024 (No. 1, 2024),
effective from 1 July 2024 (FY2025 onwards, including FY2026).

ATO individual income tax rates page:
https://www.ato.gov.au/rates/individual-income-tax-rates/ (retrieved 2026-05-22)
Note: ATO URL returns HTTP 403 in automated access. The Treasury Laws Amendment Act
2024 is the primary legislative authority. User-confirmed correct on 2026-05-22.

## FY2026 Resident Individual Brackets (Stage 3)

| Band | Income range        | Rate | Cumulative tax at upper bound |
| ---- | ------------------- | ---- | ----------------------------- |
| 1    | $0 – $18,200        | 0%   | $0                            |
| 2    | $18,201 – $45,000   | 16%  | $4,288                        |
| 3    | $45,001 – $135,000  | 30%  | $31,288                       |
| 4    | $135,001 – $190,000 | 37%  | $51,638                       |
| 5    | Over $190,000       | 45%  | —                             |

Engine representation (ProcessedBracket, cents):

| prev       | threshold        | rateBps |
| ---------- | ---------------- | ------- |
| 0          | 1,820,000        | 0       |
| 1,820,000  | 4,500,000        | 1600    |
| 4,500,000  | 13,500,000       | 3000    |
| 13,500,000 | 19,000,000       | 3700    |
| 19,000,000 | 9007199254740992 | 4500    |

applyMarginalRates formula per bracket:
taxable = min(income, threshold) - previousThreshold
bracket_tax = mulDiv(taxable, rateBps, 10_000, HALF_UP)
HALF_UP: (taxable × rateBps + 5000) / 10000 (bigint, truncates)

---

## TX-XV-01: $120,000 income → $26,788 (2,678,800 cents)

Income = $120,000 = 12,000,000 cents. Falls in Band 3.

```
Band 1 (prev=0, threshold=1,820,000, rate=0):
  12,000,000 > 0 → not skipped
  taxable = 1,820,000 − 0 = 1,820,000 (income ≥ threshold)
  mulDiv(1,820,000, 0, 10000) = 0 cents

Band 2 (prev=1,820,000, threshold=4,500,000, rate=1600 bps):
  12,000,000 > 1,820,000 → not skipped
  taxable = 4,500,000 − 1,820,000 = 2,680,000 (income ≥ threshold)
  mulDiv(2,680,000, 1600, 10000, HALF_UP):
    = (2,680,000 × 1600 + 5000) / 10000
    = (4,288,000,000 + 5000) / 10000
    = 4,288,005,000 / 10000
    = 428,800 cents  ← exact (4,288,000,000 divisible by 10,000)

Band 3 (prev=4,500,000, threshold=13,500,000, rate=3000 bps):
  12,000,000 > 4,500,000 → not skipped
  taxable = 12,000,000 − 4,500,000 = 7,500,000 (income < threshold)
  mulDiv(7,500,000, 3000, 10000, HALF_UP):
    = (7,500,000 × 3000 + 5000) / 10000
    = (22,500,000,000 + 5000) / 10000
    = 22,500,005,000 / 10000
    = 2,250,000 cents  ← exact

Band 4 (prev=13,500,000, threshold=19,000,000, rate=3700 bps):
  12,000,000 ≤ 13,500,000 → BREAK

Total = 0 + 428,800 + 2,250,000 = 2,678,800 cents = $26,788
```

### Cross-check

ATO published example (band-by-band):
0% on $0–$18,200 = $0
16% on $18,201–$45,000 = 16% × $26,800 = $4,288
30% on $45,001–$120,000 = 30% × $75,000 = $22,500
Total = $4,288 + $22,500 = $26,788 ✓

---

## TX-XV-02: $180,000 income → $47,938 (4,793,800 cents)

Income = $180,000 = 18,000,000 cents. Falls in Band 4.

```
Band 1: taxable = 1,820,000; tax = 0 cents

Band 2 (prev=1,820,000, threshold=4,500,000, rate=1600 bps):
  taxable = 4,500,000 − 1,820,000 = 2,680,000
  tax = 428,800 cents  (same as TX-XV-01)

Band 3 (prev=4,500,000, threshold=13,500,000, rate=3000 bps):
  18,000,000 ≥ 13,500,000 → income ≥ threshold
  taxable = 13,500,000 − 4,500,000 = 9,000,000 (full band)
  mulDiv(9,000,000, 3000, 10000, HALF_UP):
    = (9,000,000 × 3000 + 5000) / 10000
    = (27,000,000,000 + 5000) / 10000
    = 27,000,005,000 / 10000
    = 2,700,000 cents  ← exact

Band 4 (prev=13,500,000, threshold=19,000,000, rate=3700 bps):
  18,000,000 > 13,500,000 → not skipped
  18,000,000 < 19,000,000 → income < threshold
  taxable = 18,000,000 − 13,500,000 = 4,500,000
  mulDiv(4,500,000, 3700, 10000, HALF_UP):
    = (4,500,000 × 3700 + 5000) / 10000
    = (16,650,000,000 + 5000) / 10000
    = 16,650,005,000 / 10000
    = 1,665,000 cents  ← exact

Band 5 (prev=19,000,000, ...):
  18,000,000 ≤ 19,000,000 → BREAK

Total = 0 + 428,800 + 2,700,000 + 1,665,000 = 4,793,800 cents = $47,938
```

### Cross-check

0% on $0–$18,200 = $0
16% on $18,201–$45,000 = $4,288
30% on $45,001–$135,000 = 30% × $90,000 = $27,000
37% on $135,001–$180,000 = 37% × $45,000 = $16,650
Total = $4,288 + $27,000 + $16,650 = $47,938 ✓

---

## Results

| Test     | Income   | Tax (cents) | Tax ($) | Band coverage |
| -------- | -------- | ----------- | ------- | ------------- |
| TX-XV-01 | $120,000 | 2,678,800   | $26,788 | Bands 1–3     |
| TX-XV-02 | $180,000 | 4,793,800   | $47,938 | Bands 1–4     |

Together these two anchors exercise Bands 2, 3, and 4, covering 16%, 30%, and 37%
marginal rates. Band 5 (45%) is covered by existing TX-10 ($200,000).
