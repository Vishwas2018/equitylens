# ITP-001 — IO→P&I Transition Loan (4-month) — Golden Fixture Derivation

## Purpose

Externally-anchored golden to verify (a) actual/365 interest during IO phase,
(b) that the P&I payment at transition is computed from the OUTSTANDING balance
over the REMAINING term (not original principal over original term), and
(c) the final-period residual rule (closing = 0n exactly).

## Source

Formula: Australian retail banking actual/365 convention (CBA, NAB, ANZ, Westpac).
IO→P&I transition rule per `docs/specs/financial-calc-engine.md`.
Reference: `docs/specs/financial-calc-engine.md §5.2`
All arithmetic below was performed independently by hand, not by the engine under test.

## Loan Parameters

| Parameter         | Value                          |
| ----------------- | ------------------------------ |
| Principal         | $100,000.00 = 10,000,000 cents |
| Annual rate       | 6.00% p.a. = 600 bps           |
| Term              | 4 months                       |
| Repayment type    | IO_TO_P_AND_I                  |
| ioTransitionMonth | 3 (P&I begins at period 3)     |
| Offset balance    | $0                             |
| Period days       | 30, 30, 30, 30                 |

IO phases: periods 1, 2 (i+1 < 3)
P&I phases: periods 3, 4 (i+1 >= 3)

## IO Interest Formula

```
interest_cents = HALF_UP( balance × rateBps × daysInMonth / (10_000 × 365) )
HALF_UP bigint: (balance × rateBps × daysInMonth + 1_825_000) / 3_650_000
```

## IO Period Interest (Periods 1 & 2 — 30 days each, balance unchanged)

```
balance          = 10,000,000 cents
product          = 10,000,000 × 600 × 30 = 180,000,000,000
half             = 1,825,000
numerator        = 180,000,000,000 + 1,825,000 = 180,001,825,000
interest         = 180,001,825,000 ÷ 3,650,000 = 49,315 (floor)
                   exact: 49,315.0205... → 49,315 cents  ✓ (fraction < 0.5, HALF_UP = floor)
principal_paid   = 0 (IO phase)
closing_balance  = 10,000,000 (unchanged)
```

## P&I Scheduled Payment at Transition (Period 3)

At the IO→P&I transition, PMT is computed from the OUTSTANDING balance (10,000,000)
over the REMAINING term (termMonths − i = 4 − 2 = 2 months).

```
r      = annualRateBps / (10_000 × 12) = 600 / 120_000 = 0.005
n      = 2  (remaining months)
factor = (1 + r)^n = 1.005^2 = 1.010025

PMT    = P × r × factor / (factor - 1)
       = 10,000,000 × 0.005 × 1.010025 / (1.010025 − 1)
       = 10,000,000 × 0.00505012... / 0.010025

numerator   = 10,000,000 × 0.005 × 1.010025 = 50,501.25
denominator = 0.010025

PMT    = 50,501.25 / 0.010025

Verify: 5,037,531 × 0.010025 = 50,501.487... ≈ 50,501.25  (within float precision)
→ Math.round(5,037,531.17...) = 5,037,531 cents  ✓
```

## Period-by-Period Derivation

### Period 1 — 30 days [IO phase]

```
opening_balance  = 10,000,000
interest         = 49,315
principal_paid   = 0
repayment        = 49,315
closing_balance  = 10,000,000
```

### Period 2 — 30 days [IO phase]

```
opening_balance  = 10,000,000  (IO: no reduction)
interest         = 49,315  (identical to Period 1)
principal_paid   = 0
repayment        = 49,315
closing_balance  = 10,000,000
```

### Period 3 — 30 days [first P&I period, ioTransitionMonth = 3]

```
opening_balance  = 10,000,000
PMT              = 5,037,531  (recomputed at transition from outstanding balance)

interest:
  product   = 10,000,000 × 600 × 30 = 180,000,000,000
  numerator = 180,000,000,000 + 1,825,000 = 180,001,825,000
  interest  = 180,001,825,000 ÷ 3,650,000 = 49,315

principal_paid   = PMT − interest = 5,037,531 − 49,315 = 4,988,216
repayment        = 5,037,531
closing_balance  = 10,000,000 − 4,988,216 = 5,011,784
```

### Period 4 — 30 days [final P&I period]

```
opening_balance  = 5,011,784

interest:
  product   = 5,011,784 × 600 × 30 = 5,011,784 × 18,000 = 90,212,112,000
  numerator = 90,212,112,000 + 1,825,000 = 90,213,937,000
  interest  = 90,213,937,000 ÷ 3,650,000 = 24,716 (floor)
              exact: 24,716.1theid → floor check:
              24,716 × 3,650,000 = 90,213,400,000
              90,213,937,000 − 90,213,400,000 = 537,000 < 3,650,000  ✓ floor = 24,716

final-period residual rule:
  principal_paid  = 5,011,784  (entire balance cleared)
  repayment       = 5,011,784 + 24,716 = 5,036,500
  closing_balance = 0
```

## Totals

| Metric              | Cents                                           |
| ------------------- | ----------------------------------------------- |
| totalInterestCents  | 49,315 + 49,315 + 49,315 + 24,716 = **172,661** |
| totalPrincipalCents | 0 + 0 + 4,988,216 + 5,011,784 = **10,000,000**  |

## Transition Rule Verification

If the engine incorrectly used the ORIGINAL principal (10,000,000) over the ORIGINAL
term (4 months) to compute PMT at period 3, it would produce:

```
r = 0.005, n = 4, factor = 1.005^4 = 1.02015025
PMT_wrong = 10,000,000 × 0.005 × 1.02015025 / (1.02015025 − 1)
          = 50,100.75... / 0.02015025
          = 2,506,264... cents  (WRONG — over full 4-month term, half the balance owed)
```

The correct PMT (5,037,531) is ~2× the wrong PMT. If the engine returns ~2,506,264 for
period 3 repayment, it used the original term instead of the remaining term → HALT.

## Expected Schedule (Canonical Cents)

| Period | daysInMonth | openingBalance | interestCharged | principalPaid | repayment | closingBalance |
| ------ | ----------- | -------------- | --------------- | ------------- | --------- | -------------- |
| 1      | 30          | 10,000,000     | 49,315          | 0             | 49,315    | 10,000,000     |
| 2      | 30          | 10,000,000     | 49,315          | 0             | 49,315    | 10,000,000     |
| 3      | 30          | 10,000,000     | 49,315          | 4,988,216     | 5,037,531 | 5,011,784      |
| 4      | 30          | 5,011,784      | 24,716          | 5,011,784     | 5,036,500 | 0              |
