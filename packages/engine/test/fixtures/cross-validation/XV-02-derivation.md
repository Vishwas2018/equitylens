# XV-02 Derivation — $18,200 income, 0% bracket boundary

## Source

ATO Individual Income Tax Rates, FY2026 (1 July 2025 – 30 June 2026).
Published at: https://www.ato.gov.au/rates/individual-income-tax-rates/
Rate: 0% on $0 – $18,200 (tax-free threshold).

## External anchor type

EXTERNALLY ANCHORED — derived from ATO-published rate table (zero-rate bracket).
Not taken from ATO online income tax estimator (which applies LITO; excluded here).

## Computation

Income: $18,200.00 → 1,820,000 cents

Bracket 1: previousThreshold=$0, threshold=$18,200, rateBps=0
taxable = min(1,820,000, 1,820,000) − 0 = 1,820,000c
tax = mulDiv(1,820,000, 0, 10000, HALF_UP) = 0c

Bracket 2: previousThreshold=$18,200 = 1,820,000c
income (1,820,000c) ≤ previousThreshold (1,820,000c) → STOP

Total tax = 0c ($0.00)

## Expected value

1,820,000c income → 0c tax

## Test assertion

```typescript
expect(applyMarginalRates(1_820_000n, brackets)).toBe(0n);
```

## ATO calculator note

ATO online calculator would also show $0 (any LITO offsets only reduce tax further, but
tax is already $0). Result is unambiguous.

## Rounding note

Trivial: 0% rate, no rounding applied.
