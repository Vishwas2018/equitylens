# CG-01 Golden: Hold 183 Days — No CGT Discount

## Source

ATO CGT discount eligibility: https://www.ato.gov.au/individuals-and-families/investments-and-assets/capital-gains-tax/cgt-discount
ITAA 1997 s115-25: asset must be held for MORE than 12 months to qualify for the discount.

## Scenario

Residential investment property purchased 1 July 2024, sold 31 December 2024.
Owner: individual, 100%.
Property was income-producing (rental), therefore element 3 ownership costs are
excluded from the cost base per s110-45.

## Cost Base Calculation (s110-25)

| Element                          | Amount       | Included?                      |
| -------------------------------- | ------------ | ------------------------------ |
| Element 1: Acquisition price     | $400,000     | YES                            |
| Element 2: Stamp duty + legal    | $20,000      | YES                            |
| Element 3: Interest, rates, ins. | $15,000      | NO (income-producing, s110-45) |
| Element 4: Capital improvements  | $0           | YES                            |
| Element 5: Title costs           | $0           | YES                            |
| **Total cost base**              | **$420,000** |                                |

In cents: 42,000,000

## Proceeds

| Item                        | Amount       |
| --------------------------- | ------------ |
| Gross proceeds              | $500,000     |
| Less: selling costs (agent) | ($10,000)    |
| **Net proceeds**            | **$490,000** |

In cents: 49,000,000

## CGT Computation

```
Gross gain = net proceeds − cost base
           = $490,000 − $420,000
           = $70,000 = 7,000,000 cents
```

## Discount Eligibility

```
Acquisition:  2024-07-01
Disposal:     2024-12-31
Days held:    183 days
Minimum days: 366 (ruleset: fy2026.cgt.minimumHoldingDays)
Eligible:     NO (183 < 366)
```

## Result

```
Taxable gain = $70,000 = 7,000,000 cents (no discount applied)
```

## Cross-check

ATO online CGT calculator would show full $70,000 as taxable since the asset
was held under 12 months. No discount at all.
