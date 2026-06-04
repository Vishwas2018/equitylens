# XV-21 Derivation — Negative gearing: $100k wages + $20k rental loss → adjusted $80k

## Source

ATO Rental Properties guide (NAT 1729), FY2026.
Published at: https://www.ato.gov.au/individuals-and-families/investments-and-assets/rental-properties/negative-gearing
Rule: "If your total rental deductions exceed your total gross rental income, you have a net
rental loss. Generally, you can deduct this loss from your other income (e.g. salary and wages)."

ATO Income Tax Rates FY2026:
Published at: https://www.ato.gov.au/rates/individual-income-tax-rates/
(Applied to adjusted income of $80,000 for bracket tax verification.)

## External anchor type

EXTERNALLY ANCHORED to ATO legislative mechanism (not a calculator result).
The negative gearing offset rule is a statutory definition, not an approximation.
The resulting adjusted income ($80,000) is then bracket-taxed using XV-05 values.
DEV-0016 CPA queue: confirm against ATO estimator once negative-gearing integration
and LITO are implemented (Day 6).

## Computation

Step 1 — Negative gearing adjustment
Other income (wages): $100,000.00 → 10,000,000c
Net rental income: −$20,000.00 → −2,000,000c (rental loss)
negativeGearingRules: { enabled: true, quarantineCarryForward: true }

applyNegativeGearing(10_000_000n, −2_000_000n, rules):
combined = 10,000,000 − 2,000,000 = 8,000,000c (≥ 0)
→ adjustedIncomeCents = 8,000,000c
→ carryForwardLossCents = 0c

Step 2 — Bracket tax on adjusted income $80,000 (8,000,000c)
Bracket 1 (0%): taxable=1,820,000c, tax=0c
Bracket 2 (16%): taxable=4,500,000−1,820,000=2,680,000c
tax = mulDiv(2,680,000, 1600, 10000, HALF_UP) = 428,800c
Bracket 3 (30%): taxable=8,000,000−4,500,000=3,500,000c
tax = mulDiv(3,500,000, 3000, 10000, HALF_UP)
= (3,500,000 × 3000 + 5000) / 10000
= (10,500,000,000 + 5000) / 10000
= 1,050,000c
Bracket 4: income 8,000,000c < prev 13,500,000c → STOP

Total tax = 0 + 428,800 + 1,050,000 = 1,478,800c ($14,788.00)

## Expected value

Wages $100k + net rental −$20k → adjusted income $80k → 1,478,800c tax ($14,788.00)

## Independent check

Same as XV-05 ($80,000 income → 1,478,800c). ✓
ATO: salary $100k, rental loss $20k → taxable income $80k → bracket tax $14,788.
(Actual ATO payable will be lower after LITO; tested value is pre-offset.)

## Test assertion

```typescript
const { adjustedIncomeCents } = applyNegativeGearing(
  10_000_000n,
  -2_000_000n,
  negativeGearingRules,
);
expect(adjustedIncomeCents).toBe(8_000_000n);
expect(applyMarginalRates(adjustedIncomeCents, brackets)).toBe(1_478_800n);
```

## Rounding note

No sub-cent amounts arise. HALF_UP = truncation at these values.
