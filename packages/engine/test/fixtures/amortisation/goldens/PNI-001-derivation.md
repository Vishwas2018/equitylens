# PNI-001 — Principal-and-Interest Loan (2-month) — Golden Fixture Derivation

## Purpose

Externally-anchored golden to verify actual/365 interest and the P&I amortisation
formula for a short loan. The final-period residual rule (closing = 0n exactly) is
also exercised here.

## Source

Formula: Australian retail banking actual/365 convention (CBA, NAB, ANZ, Westpac).
Scheduled payment formula: standard annuity PMT = P × r × (1+r)^n / ((1+r)^n - 1).
Reference: `docs/specs/financial-calc-engine.md §5.2`
All arithmetic below was performed independently by hand, not by the engine under test.

## Loan Parameters

| Parameter      | Value                        |
| -------------- | ---------------------------- |
| Principal      | $10,000.00 = 1,000,000 cents |
| Annual rate    | 12.00% p.a. = 1,200 bps      |
| Term           | 2 months                     |
| Repayment type | P_AND_I                      |
| Offset balance | $0                           |
| Period days    | 30, 30                       |

## Scheduled Payment (PMT) Derivation

```
r     = annualRateBps / (10_000 × 12) = 1200 / 120_000 = 0.01
n     = 2
factor = (1 + r)^n = 1.01^2 = 1.0201

PMT   = P × r × factor / (factor - 1)
      = 1,000,000 × 0.01 × 1.0201 / (1.0201 - 1)
      = 1,000,000 × 0.010201 / 0.0201
      = 10,201 / 0.0201
      = 507,512.437...
      → Math.round → 507,512 cents  ✓
```

Note: `computeScheduledPayment` uses `Number()` + `Math.round()` (float PMT only,
not financial arithmetic). This introduces at most ±1 cent rounding in the PMT
constant, absorbed by the final-period residual.

## Interest Formula

```
interest_cents = HALF_UP( balance × rateBps × daysInMonth / (10_000 × 365) )
HALF_UP bigint: (balance × rateBps × daysInMonth + 1_825_000) / 3_650_000
```

## Period-by-Period Derivation

### Period 1 — 30 days

```
balance          = 1,000,000 cents
product          = 1,000,000 × 1,200 × 30 = 36,000,000,000
half             = 1,825,000
numerator        = 36,000,000,000 + 1,825,000 = 36,001,825,000
interest         = 36,001,825,000 ÷ 3,650,000 = 9,863 (floor)
                   exact: 9,863.5068... → 9,863 cents  ✓ (fraction < 0.5, HALF_UP = floor)

principal_paid   = PMT − interest = 507,512 − 9,863 = 497,649
repayment        = 507,512
closing_balance  = 1,000,000 − 497,649 = 502,351
```

### Period 2 — 30 days [FINAL PERIOD]

```
balance          = 502,351 cents
product          = 502,351 × 1,200 × 30 = 18,084,636,000
half             = 1,825,000
numerator        = 18,084,636,000 + 1,825,000 = 18,086,461,000
interest         = 18,086,461,000 ÷ 3,650,000 = 4,955 (floor)
                   exact: 4,955.1948... → 4,955 cents  ✓ (fraction < 0.5, HALF_UP = floor)

final-period residual rule:
  principal_paid  = balance = 502,351          (entire balance cleared)
  repayment       = balance + interest = 502,351 + 4,955 = 507,306
  closing_balance = 0
```

## Totals

| Metric              | Cents                             |
| ------------------- | --------------------------------- |
| totalInterestCents  | 9,863 + 4,955 = **14,818**        |
| totalPrincipalCents | 497,649 + 502,351 = **1,000,000** |

## Cross-Check Against Alternative Day-Count (Monthly-Nominal 1/12)

Using monthly-nominal (wrong convention):

- Monthly rate = 0.12/12 = 0.01
- Interest P1 = 1,000,000 × 0.01 = 10,000 cents

Expected difference: nominal=10,000 vs actual/365=9,863 → delta -137 cents ($1.37)

If the engine returns 10,000 for Period 1 interest, it is using the wrong convention → HALT.

## Expected Schedule (Canonical Cents)

| Period | daysInMonth | openingBalance | interestCharged | principalPaid | repayment | closingBalance |
| ------ | ----------- | -------------- | --------------- | ------------- | --------- | -------------- |
| 1      | 30          | 1,000,000      | 9,863           | 497,649       | 507,512   | 502,351        |
| 2      | 30          | 502,351        | 4,955           | 502,351       | 507,306   | 0              |
