# IO-001 — Interest-Only Loan (3-month) — Golden Fixture Derivation

## Purpose

Externally-anchored golden to verify the engine's day-count convention (actual/365)
for a pure Interest-Only loan. A wrong convention (e.g., monthly-nominal 1/12) would
produce different cent values — this fixture will catch it.

## Source

Formula: Australian retail banking actual/365 convention (CBA, NAB, ANZ, Westpac).
Interest per period = balance × annualRate × daysInMonth / 365.
Reference: `docs/specs/financial-calc-engine.md §5.2`
All arithmetic below was performed independently by hand, not by the engine under test.

## Loan Parameters

| Parameter      | Value                                   |
| -------------- | --------------------------------------- |
| Principal      | $300,000.00 = 30,000,000 cents          |
| Annual rate    | 6.00% p.a. = 600 bps                    |
| Term           | 3 months (IO — principal never reduces) |
| Repayment type | IO                                      |
| Offset balance | $0                                      |
| Period days    | 31, 28, 31                              |

## Formula

```
interest_cents = HALF_UP( balance_cents × rateBps × daysInMonth / (10_000 × 365) )
```

HALF_UP via bigint:

```
(balance × rateBps × daysInMonth + floor(10_000 × 365 / 2)) / (10_000 × 365)
= (balance × rateBps × daysInMonth + 1_825_000) / 3_650_000   [bigint floor]
```

## Period-by-Period Derivation

### Period 1 — 31 days

```
balance          = 30,000,000 cents
product          = 30,000,000 × 600 × 31 = 558,000,000,000
half             = 1,825,000
numerator        = 558,000,000,000 + 1,825,000 = 558,001,825,000
interest         = 558,001,825,000 ÷ 3,650,000 = 152,877 (floor)
                   exact: 152,877.2123... → 152,877 cents  ✓ (fraction < 0.5, HALF_UP = floor)
principal_paid   = 0 (IO)
repayment        = 152,877
closing_balance  = 30,000,000
```

### Period 2 — 28 days

```
balance          = 30,000,000 cents
product          = 30,000,000 × 600 × 28 = 504,000,000,000
half             = 1,825,000
numerator        = 504,000,000,000 + 1,825,000 = 504,001,825,000
interest         = 504,001,825,000 ÷ 3,650,000 = 138,082 (floor)
                   exact: 138,082.1918... → 138,082 cents  ✓ (fraction < 0.5, HALF_UP = floor)
principal_paid   = 0 (IO)
repayment        = 138,082
closing_balance  = 30,000,000
```

### Period 3 — 31 days

```
balance          = 30,000,000 cents  (same as P1 — IO, no reduction)
interest         = 152,877 (identical to Period 1)
principal_paid   = 0 (IO)
repayment        = 152,877
closing_balance  = 30,000,000
```

## Totals

| Metric              | Cents                                     |
| ------------------- | ----------------------------------------- |
| totalInterestCents  | 152,877 + 138,082 + 152,877 = **443,836** |
| totalPrincipalCents | **0**                                     |

## Cross-Check Against Alternative Day-Count (Monthly-Nominal 1/12)

Using monthly-nominal (wrong convention):

- Monthly rate = 0.06/12 = 0.005
- Interest per period = 30,000,000 × 0.005 = 150,000 cents regardless of actual days

Expected differences vs actual/365:

- P1 (31 days): nominal=150,000 vs actual=152,877 → delta +2,877 cents ($28.77)
- P2 (28 days): nominal=150,000 vs actual=138,082 → delta -11,918 cents ($119.18)

If the engine produces 150,000 for any period, it is using the wrong convention → HALT.

## Expected Schedule (Canonical Cents)

| Period | daysInMonth | openingBalance | interestCharged | principalPaid | repayment | closingBalance |
| ------ | ----------- | -------------- | --------------- | ------------- | --------- | -------------- |
| 1      | 31          | 30,000,000     | 152,877         | 0             | 152,877   | 30,000,000     |
| 2      | 28          | 30,000,000     | 138,082         | 0             | 138,082   | 30,000,000     |
| 3      | 31          | 30,000,000     | 152,877         | 0             | 152,877   | 30,000,000     |
