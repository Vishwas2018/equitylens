# TX-XV-03 Golden: Medicare Levy — 2% Rate Anchor

## Source

Medicare Levy Act 1986, s.6: "An individual is liable to pay Medicare levy of 2% of
the individual's taxable income…" (the 2% rate is primary legislation, stable for FY2026).

ATO Medicare levy page:
https://www.ato.gov.au/individuals-and-families/medicare-levy (retrieved 2026-05-22)
Note: ATO URL returns HTTP 403 in automated access.

---

## ⚠ DEV-0021: Low-Income Threshold Values Are Unverified

fy2026.json contains:
singleThresholdCents = 2,716,800 ($27,168)
familyThresholdCents = 4,584,000 ($45,840)

Authoritative source: ATO Medicare levy low-income threshold page
https://www.ato.gov.au/individuals-and-families/medicare-levy/how-much-medicare-levy-you-pay
(returns HTTP 403 — direct verification not possible in this session)

Secondary source found (etax.com.au, queried for 2025-26):
Single threshold: $27,222 (vs fy2026.json $27,168 — discrepancy: +$54)
Family threshold: $45,907 (vs fy2026.json $45,840 — discrepancy: +$67)

If the secondary source reflects FY2025 (2024-25) data, the FY2026 threshold would be
higher still. In either interpretation, fy2026.json appears to have a value at or below
the FY2025 level. Thresholds are indexed annually and do not decrease.

Action required: human access to ATO Medicare levy rates page for FY2026. See DEV-0021.

### Impact of threshold error

The engine applies 2% of TOTAL income once income > threshold (no shading-in zone).
If threshold is understated by $54, any income in [$27,168, $27,222) would be charged
2% of total income by EquityLens, whereas the correct rule would be zero levy. Practical
dollar error: up to 2% × $27,221 = $544. Small in absolute terms but a wrong calculation.

---

## TX-XV-03: Medicare levy on $150,000 single → $3,000 (300,000 cents)

This test is designed to be INDEPENDENT of the threshold value, since $150,000 is far
above any plausible threshold ($27,000–$28,000). The test verifies the 2% rate only.

```
Income = $150,000 = 15,000,000 cents

Threshold check: 15,000,000 > 2,716,800 (singleThresholdCents) → levy applies

computeMedicareLevy formula: mulDiv(income, rateBps, 10000, HALF_UP)
  = mulDiv(15,000,000, 200, 10000, HALF_UP)
  = (15,000,000 × 200 + 5000) / 10000
  = (3,000,000,000 + 5000) / 10000
  = 3,000,005,000 / 10000
  = 300,000 cents  ← exact (3,000,000,000 divisible by 10,000)

Levy = 300,000 cents = $3,000
```

### Cross-check

2% of $150,000 = $3,000 ✓

This result holds regardless of the exact threshold, as long as threshold < $150,000.
Whether the threshold is $27,168 or $27,222 or any plausible FY2026 value, the XV test
is correct and independently anchored to the Medicare Levy Act 2% rate.

---

## Tests Affected by Unverified Threshold (not XV anchors)

The following existing tests use the threshold VALUE directly as an input boundary:
TX-11: $27,168 exactly → 0 levy (threshold boundary test)

If the true FY2026 threshold is $27,222, TX-11 should use $27,222 as the boundary input.
TX-11 will pass regardless because it feeds the ruleset's own threshold back as input —
it tests the engine's boundary logic, not the correctness of the threshold value.
This is flagged in DEV-0021 as pending human resolution.

---

## Result

| Test     | Income   | Levy (cents) | Levy ($) | Threshold-independent? |
| -------- | -------- | ------------ | -------- | ---------------------- |
| TX-XV-03 | $150,000 | 300,000      | $3,000   | YES — 2% rate only     |
