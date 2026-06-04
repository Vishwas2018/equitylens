# End-of-Day Report — Day 5

**Date**: 2026-05-22
**Branch**: `feature/d01-bootstrap`
**Prepared by**: Code (Claude Sonnet 4.6)

---

## Summary

Day 5 is complete and clean. All four tasks shipped. The calculation engine now covers the full cashflow + tax stack for FY2026: rent income (CF-01..CF-12), marginal rate brackets (TX-01..TX-10), Medicare levy + MLS (TX-11..TX-14), and negative gearing (TX-15). 281 engine tests pass across 10 test files. 22 ATO cross-validation fixtures (XV-01..XV-21) are anchored to published FY2026 rate tables with committed derivation records. Ruleset binding proven: `runScenario` stamps `ruleset_version` into `output_hash`; a 16% vs 17% bracket change produces a different hash through the full call stack. Per-step HALF_UP rounding confirmed equivalent to ATO floor-to-dollar for all whole-dollar FY2026 inputs. Two deviation dispositions finalised (DEV-0015, DEV-0016); one new deviation opened (DEV-0017). One overdue defect logged and closed (DEF-0002: branch protection context mismatch Days 1-3). No work rolled forward.

---

## Task Outcomes

| Task   | Title                                                                 | Status   | Commits     |
| ------ | --------------------------------------------------------------------- | -------- | ----------- |
| D05-T1 | RulesetAdapter + FY2026 tax data, no hardcoded brackets, RS-01..RS-13 | complete | `85c972c`   |
| D05-T2 | CashFlowService CF-01..CF-12, pro-rata periods, FY aggregation        | complete | `90d1c51`   |
| D05-T3 | TaxService + Medicare + negative gearing + XV cross-validation        | complete | `b32e98a`   |
| D05-T4 | Day 5 closeout — registers, EOD, tag                                  | complete | this commit |

---

## Checkpoint Evidence

### Engine Tests (final state after D05-T3)

```
npx vitest run  (packages/engine)

  ✓ test/money/cents.test.ts                         (28 tests)
  ✓ test/money/canonical.test.ts                     (14 tests)
  ✓ test/amortisation/amortisation.test.ts           (37 tests)
  ✓ test/amortisation/goldens.test.ts                (20 tests)
  ✓ test/determinism/harness.test.ts                  (5 tests)
  ✓ test/cashflow/cashflow.test.ts                   (61 tests)
  ✓ test/tax/ruleset/adapter.test.ts                 (60 tests)
  ✓ test/tax/tax.test.ts                             (29 tests)
  ✓ test/tax/ruleset-binding.test.ts                  (5 tests)
  ✓ test/cross-validation/xv.test.ts                 (22 tests)

  Test Files  10 passed (10)    Tests  281 passed (281)
```

### Coverage (packages/engine)

```
All files          | 99.61% stmts | 95.98% branch | 100% funcs | 99.61% lines
 tax/service.ts    | 100%         | 100%          | 100%       | 100%
 tax/medicare.ts   | 100%         | 100%          | 100%       | 100%
 tax/neg-gearing.ts| 100%         | 100%          | 100%       | 100%
 cashflow/service.ts| 100%        | 95.08%        | 100%       | 100%
Global branch coverage: 95.98% (threshold: 95%) ✅
```

### Code Quality

```
pnpm typecheck    ✅
pnpm lint         ✅
pnpm format:check ✅
```

No hardcoded FY2026 rates in engine TypeScript src:

```
grep -rnE "(0\.(16|30|37|45|02)\b|1600|3700|4500|18200|45000|135000|190000|27168|93000|108000|144000)" \
  packages/engine/src --include="*.ts" | grep -v "ruleset/data" | grep -v "\.test\."
→ Exit 1 (CLEAN) ✅
```

See `checkpoints/D05-T1.txt`, `checkpoints/D05-T2.txt`, `checkpoints/D05-T3.txt`.

---

## Deviations Logged / Resolved

| ID       | Title                                                                            | Severity | Day 5 Disposition                                                                  |
| -------- | -------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------- |
| DEV-0015 | decimal-and-rounding.md absent; HALF_UP from financial-calc-engine.md §5.2       | low      | closed — HALF_UP confirmed for CF+TX; doc creation deferred to Day 6               |
| DEV-0016 | Externally-anchored fixtures pattern (amortisation + XV cross-validation)        | low      | closed — XV derivation .md files committed; invariant-only XVs in CPA queue Day 12 |
| DEV-0017 | HALF_UP per-step vs ATO floor-to-dollar; coincide for FY2026 whole-dollar inputs | low      | opened/accepted; CPA review Day 6                                                  |

---

## Defects

| ID       | Severity | Surface | Title                                                                     | Day 5 Status                                 |
| -------- | -------- | ------- | ------------------------------------------------------------------------- | -------------------------------------------- |
| DEF-0002 | sev2     | ci      | Main branch ungated Days 1-3: protection contexts mismatched, app_id null | opened+closed — fixed Day 4 commit `25ac27e` |

---

## Registers Updated

- **Deviations**: DEV-0015 closed (final), DEV-0016 closed (extended to XV), DEV-0017 opened+accepted.
- **Defects**: DEF-0002 opened+closed (retrospective; fix pre-dated discovery).
- **Backlog**: no new entries.
- **Tech debt**: no new entries.

---

## Technical Notes for Opus

### Cashflow engine (D05-T2)

`packages/engine/src/cashflow/service.ts` — pure TypeScript, no Date API calls.

- `daysInMonth(year, month)` — pure arithmetic, Gregorian calendar. No `new Date()`.
- `grossRentForMonth(weeklyRent, growthBps, horizonYear)` — `weeklyRent × 52 / 12` (HALF_UP). NOT days-based. Constant ratio per month regardless of calendar month.
- `vacancyLossForMonth(gross, vacancyWeeks)` — `gross × vacancyWeeks / 52` (HALF_UP).
- `apportionDeductible(interest, mixedUseBps)` — `interest × bps / 10000` (HALF_UP). Returns `{ deductibleCents, nonDeductibleCents }`.
- `netOperatingCashCents` = `effectiveRent − operatingExpenses − deductibleInterest`. Principal is tracked but NOT subtracted from operating cash (classic error prevented by spec).
- FY aggregation: July(7)–December(12) → `FY(year+1)`; January–June → `FY(year)`.

### Tax engine (D05-T3)

`packages/engine/src/tax/service.ts`:

- `applyMarginalRates(incomeCents, brackets)` — walks `ProcessedBracket[]`, early-exit when `income ≤ bracket.previousThresholdCents`. HALF_UP per bracket contribution.

`packages/engine/src/tax/medicare.ts`:

- `computeMedicareLevy(income, levy, useFamily)` — zero if `income ≤ threshold`; else `income × rateBps / 10000` (HALF_UP). Flat-rate model, no shade-in.
- `computeMLS(income, levy, hasPhc)` — zero if PHC held; ascending scan, last bracket exceeded wins; `income × applicableRateBps / 10000` (HALF_UP).

`packages/engine/src/tax/negative-gearing.ts`:

- `applyNegativeGearing(otherIncome, netRental, rules)` — when disabled: loss quarantined, other income unchanged, optional carry-forward; when enabled: full offset, excess loss → carry-forward if `quarantineCarryForward`.
- `propertyTypeExclusions` accepted but not applied (Day 6+ scope, DEV-T3-01).

### Ruleset binding

`scenario.ts` hashes `{ result, engine_version, ruleset_version }`. Changing `ruleset_version` alone produces a different hash even with identical computation output (RB-01). `fy2026-variant.json` (FY2026.2, 17% second bracket) used in RB-03/RB-05 to prove actual bracket differences propagate through the hash.

### Rounding confirmation (DEV-0017)

For all FY2026 rate schedule values (1600/3000/3700/4500/200/100/125/150 bps) applied to whole-dollar inputs (multiples of 100c): `amount × rateBps mod 10000 = 0` for all rates that are multiples of 100. MLS 125bps gives `100 × 125 mod 10000 = 2500 < 5000` → HALF_UP = floor. No tested value shows a discrepancy. HALF_UP is the safe default; ATO floor-to-dollar on final total is a Day 6 CPA review item.

### XV derivation files

`test/fixtures/cross-validation/`:

- `XV-02-derivation.md` — 0% band ($18,200 → $0)
- `XV-03-derivation.md` — 16% band ($37,000 → $3,008)
- `XV-06-derivation.md` — 30% band ($100,000 → $20,788)
- `XV-09-derivation.md` — 37% band ($150,000 → $36,838)
- `XV-11-derivation.md` — 45% band ($200,000 → $56,138)
- `XV-18-derivation.md` — MLS Tier 1 ($100,000 no PHC → $1,000)
- `XV-21-derivation.md` — negative gearing ($100k wages + −$20k rental → adjusted $80k → $14,788)

---

## Outstanding Human Actions

Carried forward from Days 1–4:

1. **Supabase Dashboard**: configure redirect URLs (`/auth/callback`); verify email confirmation enabled; verify magic link disabled.
2. **Vercel env vars**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `UPSTASH_*`, `AUDIT_HASH_PEPPER`.

---

## Day 6 Pre-Conditions

Day 6 theme: **CGT + VIC Land Tax + Property-Based Tests + Performance Budgets**

Pre-conditions met:

- ✅ Full cashflow pipeline: rent → expenses → interest → NOC (CF-01..CF-12)
- ✅ Full income tax pipeline: brackets → Medicare → MLS → negative gearing
- ✅ Ruleset binding via output_hash (FY2026.1 vs FY2026.2 proven)
- ✅ 281 engine tests; 95.98% branch coverage; determinism 1000-iter zero divergence
- ✅ XV-01..XV-21 externally anchored; derivation .md files committed
- ✅ DEF-0002 closed; no sev1 open

Pre-conditions to verify at Day 6 start:

- ⚠️ **DEV-0017 CPA review**: confirm HALF_UP per-step is acceptable vs ATO floor-to-dollar; create `decimal-and-rounding.md` to formalise the convention.
- ⚠️ **LITO framework**: Day 6 must implement Low Income Tax Offset before XV-03..XV-08 can be fully reconciled against ATO online estimator.
- ⚠️ **propertyTypeExclusions** (DEV-T3-01): negative gearing exclusion matching is not yet wired; accept or scope for Day 6.
- ⚠️ **CGT capital gains discount**: 50% individual discount, 1/3 SMSF discount, ≥366 holding days. Golden fixture derivations required against ATO published examples.
- ⚠️ **VIC land tax**: `VicLandTaxConfig` fully processed from ruleset JSON; 7-bracket calculation with absentee/vacant surcharges. ATO/SRO cross-validation fixtures required.
- ⚠️ **Performance budgets**: establish `≤50ms per scenario` budget for engine; profile amortisation + cashflow + tax pipeline on reference input set.
- ⚠️ **Property-based tests**: generative tests for monotonicity (tax increases with income), consistency (same input → same output), and edge cases (income = 0, threshold boundaries).
