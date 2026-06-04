# CG-12 Golden: Prior-Year Loss Applied BEFORE Discount (ATO Ordering)

## Source

ATO CGT discount and capital losses:
https://www.ato.gov.au/individuals-and-families/investments-and-assets/capital-gains-tax/cgt-discount
ITAA 1997 s115-100: prior-year capital losses reduce the gain BEFORE the discount is applied.

This is the critical ordering rule. Applying the discount first and THEN subtracting losses
would understate the taxable gain — a common and incorrect approach.

## Scenario

Investment property. Owner: individual, 100%. Income-producing. 366 days held.
Prior-year capital losses carried forward: $30,000.

## Cost Base

| Element                       | Amount       | Included?             |
| ----------------------------- | ------------ | --------------------- |
| Element 1: Acquisition price  | $500,000     | YES                   |
| Element 2: Stamp duty + legal | $20,000      | YES                   |
| Element 3: Holding costs      | —            | NO (income-producing) |
| Element 4: Improvements       | $0           | YES                   |
| Element 5: Title              | $0           | YES                   |
| **Total cost base**           | **$520,000** |                       |

In cents: 52,000,000

## Proceeds

| Item                     | Amount       |
| ------------------------ | ------------ |
| Gross proceeds           | $750,000     |
| Less: selling costs (2%) | ($15,000)    |
| **Net proceeds**         | **$735,000** |

In cents: 73,500,000

## CGT Computation — CORRECT (ATO ordering: losses before discount)

```
Step 1 — Gross gain
  = $735,000 − $520,000 = $215,000 = 21,500,000 cents

Step 2 — Subtract prior-year capital losses (s115-100)
  = $215,000 − $30,000 = $185,000 = 18,500,000 cents

Step 3 — Apply 50% CGT discount to REMAINDER
  Discount = $185,000 × 50% = $92,500

  bigint verification:
    mulDiv(18_500_000n, 5000n, 10_000n, HALF_UP)
    = (18_500_000 × 5000 + 5000) / 10_000
    = (92_500_000_000 + 5000) / 10_000
    = 92_500_005_000 / 10_000       (bigint floor)
    = 9_250_000 cents = $92,500 ✓

Step 4 — Taxable gain
  = $185,000 − $92,500 = $92,500 = 9,250,000 cents
```

## WRONG ordering (discount first, then losses) — for contrast

```
Step 1 — Gross gain: $215,000
Step 2 — Apply 50% discount: $215,000 × 50% = $107,500
Step 3 — Subtract losses: $107,500 − $30,000 = $77,500  ← UNDERSTATED by $15,000
```

The wrong ordering ($77,500) understates the taxable gain vs the correct ATO result ($92,500).

## Result

| Item                           | Correct (ATO) | Wrong (discount-first) |
| ------------------------------ | ------------- | ---------------------- |
| Gross gain                     | $215,000      | $215,000               |
| After losses (before discount) | $185,000      | —                      |
| After discount                 | $92,500       | $107,500               |
| After losses (after discount)  | —             | $77,500                |
| **Taxable gain**               | **$92,500**   | ~~$77,500~~            |

Engine MUST produce $92,500 = 9,250,000 cents.
