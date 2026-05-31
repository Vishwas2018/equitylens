# CG-03 Golden: Hold 366 Days, Individual — 50% CGT Discount

## Source

ATO CGT discount: https://www.ato.gov.au/individuals-and-families/investments-and-assets/capital-gains-tax/cgt-discount
ITAA 1997 s115-25 (minimum holding period), s115-100 (discount percentage).
Ruleset FY2026.1: `cgt.individualDiscountBps = 5000`, `cgt.minimumHoldingDays = 366`.

## Scenario

Residential investment property. Owner: individual, 100%. Income-producing (rental).
Acquired 1 January 2023, disposed 2 January 2024.

Days held:

- 2023-01-01 to 2024-01-01 = 365 days (2023 is not a leap year)
- 2023-01-01 to 2024-01-02 = 366 days ✓

366 ≥ 366 → CGT discount APPLIES.

## Cost Base Calculation (s110-25)

| Element                          | Amount       | Included?                        |
| -------------------------------- | ------------ | -------------------------------- |
| Element 1: Acquisition price     | $400,000     | YES                              |
| Element 2: Stamp duty + legal    | $20,000      | YES                              |
| Element 3: Interest, rates, ins. | $15,000      | NO (income-producing, s110-45)   |
| Element 4: Capital improvement   | $10,000      | YES (exterior repaint — capital) |
| Element 5: Title costs           | $0           | YES                              |
| **Total cost base**              | **$430,000** |                                  |

In cents: 43,000,000

## Proceeds

| Item                               | Amount       |
| ---------------------------------- | ------------ |
| Gross proceeds                     | $600,000     |
| Less: selling costs (2% agent fee) | ($12,000)    |
| **Net proceeds**                   | **$588,000** |

In cents: 58,800,000

## CGT Computation

```
Step 1 — Gross gain
  = net proceeds − cost base
  = $588,000 − $430,000
  = $158,000 = 15,800,000 cents

Step 2 — Prior-year capital losses
  = $0 (none)

Step 3 — Gain after losses
  = $158,000 − $0 = $158,000

Step 4 — Apply 50% CGT discount (individual, ≥366 days)
  Discount = $158,000 × 5000/10000 = $79,000

  bigint verification:
    mulDiv(15_800_000n, 5000n, 10_000n, HALF_UP)
    = (15_800_000 × 5000 + 5000) / 10_000
    = (79_000_000_000 + 5000) / 10_000
    = 79_000_005_000 / 10_000       (bigint floor)
    = 7_900_000 cents ✓

Step 5 — Taxable gain
  = $158,000 − $79,000 = $79,000 = 7,900,000 cents
```

## Result

| Item             | Value       |
| ---------------- | ----------- |
| Cost base        | $430,000    |
| Gross gain       | $158,000    |
| Discount (50%)   | ($79,000)   |
| **Taxable gain** | **$79,000** |
