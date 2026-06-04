# End-of-Day Report — Day 4

**Date**: 2026-05-21
**Branch**: `feature/d01-bootstrap`
**Prepared by**: Code (Claude Sonnet 4.6)

---

## Summary

Day 4 is complete and clean. All four tasks shipped. `packages/engine` is a deterministic, pure-TypeScript skeleton. The amortisation module produces schedules for IO, P&I, and IO→P&I transition loans. 97 engine tests pass across 5 test files. Three externally-anchored golden fixtures independently verify the actual/365 HALF_UP formula to the cent. Coverage is 97.46% branches / 100% functions, enforced in CI by the `unit-engine` job. The `engine-determinism` job runs 1000 iterations and proves zero divergence. Both CI jobs are registered as required status checks on main with `app_id: 15368`. A pre-existing Day 1 CI failure (pnpm version mismatch) and a V8 coverage incompatibility (test-exclude/glob) were diagnosed and fixed. No work rolled forward from today's plan.

---

## Task Outcomes

| Task   | Title                                                            | Status   | Commits                                    |
| ------ | ---------------------------------------------------------------- | -------- | ------------------------------------------ |
| D04-T1 | Engine skeleton + decimal/money core + determinism harness       | complete | `abdb16f`                                  |
| D04-T2 | Amortisation IO/P&I/IO→P&I + externally-anchored golden fixtures | complete | `c1c24d0`                                  |
| D04-T3 | Coverage gate ≥95% + determinism CI jobs                         | complete | `bef7953`, `fecdeb2`, `38cdc8d`, `25ac27e` |
| D04-T4 | Day 4 closeout                                                   | complete | this commit                                |

---

## Checkpoint Evidence

### Engine Tests

```
pnpm --filter @equitylens/engine test (via npx vitest run)

  ✓ test/amortisation/goldens.test.ts       (20 tests)   6ms
  ✓ test/amortisation/amortisation.test.ts  (36 tests)  12ms
  ✓ test/money/cents.test.ts                (22 tests)   6ms
  ✓ test/money/canonical.test.ts            (14 tests)  21ms
  ✓ test/determinism/harness.test.ts         (5 tests) 176ms

  Test Files  5 passed (5)   Tests  97 passed (97)
```

### Coverage (CI — Node 20.14.0)

```
Engine unit + coverage gate: PASS
  lines:       100% (threshold: 95%) ✅
  functions:   100% (threshold: 95%) ✅
  branches:    97.46% (threshold: 95%) ✅
  statements:  100% (threshold: 95%) ✅
```

### Determinism Harness

```
Engine determinism harness: PASS
  1000 iterations, 0 divergence — output_hash identical across all runs
```

### CI Evidence

- **Passing run (PR #1 — engine jobs green)**:
  https://github.com/Vishwas2018/equitylens/actions/runs/26217763088
  - Engine unit + coverage gate PASS: `.../job/77144460874`
  - Engine determinism harness PASS: `.../job/77144460938`
- **Coverage gate proof (bites below 95%)**:
  https://github.com/Vishwas2018/equitylens/actions/runs/26219552723/job/77150666037

### Code Quality

```
pnpm typecheck    ✅
pnpm lint         ✅
pnpm format:check ✅
```

See `checkpoints/D04-T1.txt`, `checkpoints/D04-T2.txt`, `checkpoints/D04-T3.txt`.

---

## Deviations Logged

| ID       | Title                                                                         | Severity | Disposition                                                     |
| -------- | ----------------------------------------------------------------------------- | -------- | --------------------------------------------------------------- |
| DEV-0015 | decimal-and-rounding.md absent; HALF_UP from financial-calc-engine.md §5.2    | low      | accepted; HALF_UP confirmed; create doc when spec stable        |
| DEV-0016 | test-matrix.md lacks pre-computed schedules; goldens added as external anchor | low      | accepted+resolved; IO-001/PNI-001/ITP-001 derivations committed |

---

## Registers Updated

- **Tech debt**: TD-0004 closed — engine-determinism CI job wired as scheduled Day 4. All remaining open: TD-0005 (Day 8), TD-0006 (Day 15), TD-0007 (opportunistic), TD-0009 (pre-Day 12).
- **Deviations**: DEV-0015, DEV-0016 added to open deviations (both accepted).
- **Backlog**: no new entries.
- **Defects**: none.

---

## Technical Notes for Opus

### Engine money primitive

`packages/engine/src/money/cents.ts` — `Cents = bigint`. All money values are unsigned bigint cents. Operations:

- `add(a, b)`, `sub(a, b)`, `subClampZero(a, b)` — no rounding required
- `mulDiv(amount, num, den, mode)` — bigint multiply-then-divide with explicit `RoundingMode.HALF_UP` or `HALF_EVEN`
- `monthlyInterest(balance, rateBps, daysInMonth)` — actual/365: `balance × rateBps × days / (10_000 × 365)` with HALF_UP
- `computeScheduledPayment(principal, rateBps, months)` — PMT formula in bigint: `P × r × (1+r)^n / ((1+r)^n − 1)` where r = rateBps / (10_000 × 12); falls back to `P/n` when rateBps = 0

### Amortisation schedule

`packages/engine/src/amortisation/schedule.ts`:

- Inputs: `LoanInput { principalCents, termMonths, repaymentType, offsetCents?, ioTransitionMonth?, horizonMonths?, months[] }`
- Each `months[i]` provides `{ annualRateBps, daysInMonth }` — rate and calendar are injected, not ambient
- Final P&I period: `repayment = balance + interest` so `closingBalance === 0n` exactly
- IO→P&I transition: PMT recomputed from `outstanding balance × remaining term` — not original principal
- Negative amortisation guard: if `scheduledPayment ≤ interest`, principal is clamped to 0n and a `'negative-amortisation-guard'` warning is emitted

### Golden fixture discrimination

The three golden fixtures prove actual/365 vs monthly-nominal (1/12):

| Fixture                                     | Value (actual/365) | Monthly-nominal wrong value | Delta    |
| ------------------------------------------- | ------------------ | --------------------------- | -------- |
| IO-001 P2 (28 days, $300k, 6%)              | 138,082 cents      | 150,000 cents               | −$119.18 |
| PNI-001 P1 (30 days, $10k, 12%)             | 9,863 cents        | 10,000 cents                | −$1.37   |
| ITP-001 P3 PMT (outstanding $10M, 2 months) | 5,037,531 cents    | ~2,506,264 (wrong term)     | +$25,312 |

A test suite passing with monthly-nominal would fail IO-001 P2 and PNI-001 P1 by the stated deltas.

### Canonical JSON / output_hash

`packages/engine/src/money/canonical.ts`:

- `canonicalJson(value)` — recursive key-sort, bigint serialised as `{"$bigint":"<digits>"}` to survive `JSON.stringify`
- `outputHash(value)` — `sha256(canonicalJson(value))` as hex string
- `runScenario(inputs)` — returns `{ result, output_hash, engine_version, ruleset_version }`; verified 1000× identical hash in determinism harness

### CI fixes

Two pre-existing CI failures discovered and fixed:

1. **pnpm version mismatch** (Day 1 regression): `packageManager: pnpm@9.4.0` vs `version: '10'` in `restore-deps/action.yml`. Fixed: updated `packageManager` to `pnpm@10.30.3`; removed `version: '10'` from action.
2. **test-exclude/glob incompatibility**: global `"glob": ">=10.5.0"` pnpm override forced `test-exclude@6.0.0` to `glob@13`, breaking `promisify(require('glob'))`. Fixed: scoped override `"test-exclude>glob": "^7.2.3"`.

---

## Outstanding Human Actions

Carried forward from Days 1–3 (updated per Day 4 correction in Day 3 EOD):

1. **Supabase Dashboard**: configure redirect URLs (`/auth/callback`); verify email confirmation enabled; verify magic link disabled.
2. **Vercel env vars**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public), `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `UPSTASH_*`, `AUDIT_HASH_PEPPER` (server-side).

Resolved since Day 3: GitHub Secrets (10 entries confirmed) and GitHub branch protection initial required checks (confirmed Day 4 morning pre-flight).

New from Day 4:

- **GitHub branch protection**: two new required checks added — `Engine unit + coverage gate` and `Engine determinism harness` — both bound with `app_id: 15368`. No further human action required for these.

---

## Day 5 Pre-Work

Day 5 theme: **Cashflow + Tax** (negative gearing, rental yield, holding costs, income tax marginal rates).

Pre-conditions met:

- ✅ Engine skeleton with deterministic money primitive and amortisation
- ✅ Coverage ≥ 95% enforced in CI
- ✅ Determinism proven (1000-iter, zero divergence)
- ✅ Golden fixtures IO-001, PNI-001, ITP-001 as external correctness anchors
- ✅ Auth + RLS fully wired from Day 3

Pre-conditions to verify at Day 5 start:

- ⚠️ Confirm `docs/engine/financial-calc-engine.md` tax sections match ATO ruling versions (check tax-rule-versioning.md)
- ⚠️ `decimal-and-rounding.md` still absent — create as part of Day 5 engine work or defer
- ⚠️ Build job on PR #1 failing (pre-existing, separate from engine jobs) — investigate before touching web app code
