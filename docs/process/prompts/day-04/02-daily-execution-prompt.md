# Day 4 — Engine: Amortisation + Decimal Arithmetic (EquityLens)

Read first:

- docs/process/prompts/day-03/03-end-of-day-report.md
- docs/process/registers/{defect-log,deviation-log,technical-debt,daily-progress-log,product-backlog}.md
- docs/process/15-day-plan.md § Day 4
- docs/engine/test-matrix.md § Amortisation (AM-01..AM-11)
- docs/engine/decimal-and-rounding.md (or wherever the money/rounding spec lives)
- docs/architecture/system-architecture.md § Calc Engine (determinism contract)

## Pre-flight (autonomous, no approval needed)

1. Verify Day 3 prerequisites still green (these are now resolved, NOT
   carried-forward — if the EOD report still says "carried forward from
   Days 1-2", that line is stale; correct it):
   - `gh secret list` → 10 entries, includes NEXT_PUBLIC_SUPABASE_ANON_KEY
   - branch protection on main has required checks [typecheck, lint,
     format-check, test, build]
2. Run `pnpm audit:cctv --day 04`. Regenerate morning CCTV against
   day-03-end state. Halt on unexpected red.
3. Save this prompt verbatim to docs/process/prompts/day-04/02-daily-execution-prompt.md.
4. Confirm pre-flight done.

## Primary goal

End of day: `packages/engine` is a deterministic, pure-TS skeleton.
The Amortisation module produces ATO-replicable schedules for IO, P&I,
and IO→P&I transition loans. All AM-01..AM-11 fixtures green. Determinism
proven over 1000 iterations with zero divergence. Coverage ≥ 95%.

## Determinism contract (read before writing any code)

The engine is the system's source of financial truth. Non-negotiables:

- **Money is bigint cents end-to-end.** No floats anywhere in money math.
  No `number` for currency. A decimal helper may exist for ratio/rate
  intermediate steps but final money values resolve to bigint cents.
- **No `Math.random`, no `Date.now()`, no `new Date()` without an
  injected clock, no locale-dependent formatting** inside
  packages/engine/src/\*\*. All time/entropy is injected via inputs.
- **Same input → same output_hash, always.** output_hash =
  sha256(canonicalJson(result)). Canonical JSON = sorted keys, bigint
  serialised as string with explicit marker (e.g. {"$cents":"123456"}),
  no float coercion.
- Rounding is explicit and per the spec (half-even / banker's vs
  half-up — use whatever decimal-and-rounding.md mandates; if it's
  silent, log DEV and default to half-even, the ATO convention for most
  contexts, and flag for human confirmation).

## Tasks

### D04-T1 — Engine skeleton + decimal/money core + determinism harness

**Why**: everything downstream (cashflow, tax, CGT) sits on this. Get
the money primitive and determinism guarantees right before any
amortisation logic.

Allow-list:

- packages/engine/src/money/cents.ts (new — bigint cents type + ops:
  add, sub, mul-by-rate, div, round; all total/explicit)
- packages/engine/src/money/decimal.ts (new — if rate math needs a
  decimal intermediate; document why bigint alone is insufficient)
- packages/engine/src/money/canonical.ts (new — canonicalJson +
  output_hash)
- packages/engine/src/runtime/clock.ts (new — injected Clock interface;
  no ambient time)
- packages/engine/src/runtime/scenario.ts (new — runScenario(inputs)
  skeleton returning { result, output_hash, engine_version,
  ruleset_version })
- packages/engine/src/index.ts (public exports)
- packages/engine/package.json (engine_version pinned; no runtime deps
  beyond what's justified)
- packages/engine/vitest.config.ts
- packages/engine/test/money/\*.test.ts
- packages/engine/test/determinism/harness.test.ts
- eslint config: custom rule banning Math.random / Date.now / new Date
  in packages/engine/src/\*\* (eslint-plugin-local or no-restricted-syntax)
- .github/workflows/ci.yml (wire engine coverage threshold ≥95%; un-stub
  unit-engine job if still stubbed from Day 1)

Spec:

1. cents.ts: opaque bigint-backed Cents. Operations return Cents.
   Multiplication by a rate takes a Rate (decimal/bps) and an explicit
   RoundingMode; never silently rounds. Division likewise.
2. canonical.ts: deterministic serialisation. Test that two structurally
   equal results with different key insertion order produce identical hash.
3. clock.ts: Clock interface { now(): EpochMillis }. A FixedClock for
   tests. Engine code receives Clock via inputs, never imports a global.
4. ESLint rule: adding `Date.now()` to any engine src file fails lint.
   Prove it (see checkpoint).
5. Determinism harness: runScenario on a fixture input, 1000×, assert
   all 1000 output_hash identical.

Checkpoint → `checkpoints/D04-T1.txt`:

```
pnpm --filter @equitylens/engine typecheck       # 0 errors
pnpm --filter @equitylens/engine test            # money + canonical green
pnpm engine:determinism                          # 1000 iters, 0 divergence
# Prove lint rule: create a temp file with Date.now() in engine/src,
# run eslint, assert it FAILS, delete temp file, assert clean again.
echo 'export const x = Date.now();' > packages/engine/src/__lintprobe.ts
pnpm --filter @equitylens/engine lint; echo "exit: $?"   # expect non-zero
rm packages/engine/src/__lintprobe.ts
pnpm --filter @equitylens/engine lint; echo "exit: $?"   # expect 0
```

Commit: `feat(engine): bigint-cents money core + determinism harness + entropy lint [D04-T1]`

### D04-T2 — Amortisation module (IO, P&I, IO→P&I) AM-01..AM-11

**Why**: the day's primary deliverable. Every fixture must be ATO-replicable.

Allow-list:

- packages/engine/src/amortisation/schedule.ts (new — core amortisation)
- packages/engine/src/amortisation/types.ts (new — LoanInput, Period,
  Schedule, RepaymentType = 'IO' | 'P_AND_I')
- packages/engine/src/amortisation/index.ts
- packages/engine/test/amortisation/\*.test.ts (AM-01..AM-11 fixtures)
- packages/engine/test/fixtures/amortisation/\*.json (fixture inputs +
  expected schedules — sourced from docs/engine/test-matrix.md; if the
  matrix gives inputs but not full expected schedules, compute them by
  hand-verifiable method and document the derivation in a comment;
  DO NOT invent expected values — log DEV if the matrix is incomplete)

Spec:

1. Support three loan shapes:
   - IO: interest-only for the whole term (or specified IO period).
   - P&I: principal + interest, fixed repayment, declining interest.
   - IO→P&I: IO for N periods, then transitions to P&I amortising the
     full principal over the remaining term.
2. All money in bigint cents. Interest accrual uses the rate convention
   in decimal-and-rounding.md (likely daily-accrual or monthly nominal;
   match the spec exactly — log DEV if ambiguous and state your reading).
3. Each period emits: opening_balance, interest_charged,
   principal_paid, repayment, closing_balance — all Cents. Schedule
   closing_balance of final period MUST be exactly 0 for P&I (the
   final-payment residual is absorbed into the last repayment; document
   how).
4. Fixtures AM-01..AM-11: run each, assert the full schedule matches
   expected period-by-period (not just totals). A single-cent drift is
   a failure.
5. The whole schedule is pure: runAmortisation(input) is referentially
   transparent, no Clock needed unless the spec dates accrual to
   calendar (if so, Clock/dates come via input).

Checkpoint → `checkpoints/D04-T2.txt`:

```
pnpm --filter @equitylens/engine test amortisation   # AM-01..AM-11 green
pnpm --filter @equitylens/engine test -- --coverage   # module ≥ 95%
# Capture: per-fixture pass line + coverage summary for amortisation/**
```

Commit: `feat(engine): amortisation IO/P&I/transition schedules, AM-01..AM-11 [D04-T2]`

### D04-T3 — Coverage enforcement in CI + determinism CI job

**Why**: Day 4 checkpoints require CI to ENFORCE the thresholds, not
just local runs. A green local run that CI doesn't gate is unverified.

Allow-list:

- .github/workflows/ci.yml (engine coverage gate ≥95%; determinism job
  runs engine:determinism on every PR touching packages/engine/\*\*)
- packages/engine/package.json (scripts: engine:determinism, coverage)
- vitest coverage config (thresholds: lines/functions/branches/statements
  ≥95% for packages/engine/src/\*\*; fail under)
- turbo.json (if engine tasks need pipeline wiring)

Spec:

1. CI `unit-engine` job: runs engine tests with coverage, fails if any
   metric < 95% on engine src.
2. CI `engine-determinism` job: runs the 1000-iteration harness; fails
   on any divergence. Triggered on PRs touching packages/engine/\*\*.
3. Both jobs must be added to branch protection required checks —
   produce the `gh api` command for the human to run (you set up the
   workflow; human flips the branch-protection requirement, OR you run
   the gh api PUT if gh is authenticated — check `gh auth status` first).

Checkpoint → `checkpoints/D04-T3.txt`:

```
# Push branch; verify in CI:
#  - unit-engine RUNS and PASSES with coverage gate active
#  - engine-determinism RUNS and PASSES
# Capture both CI run URLs.
# Prove the gate bites: temporarily drop a test to push coverage <95%
# on a throwaway commit, confirm CI FAILS, revert. (Document, don't push
# the broken commit to main.)
```

Commit: `ci(engine): enforce ≥95% coverage + determinism gate on engine PRs [D04-T3]`

### D04-T4 — Close out (housekeeping, ≤30min, no per-task approval)

- Append Day 4 entry to daily-progress-log.md (honest status)
- Update defect-log / deviation-log (esp. rounding-convention DEV if
  decimal-and-rounding.md was ambiguous; fixture-derivation DEV if the
  test matrix lacked full expected schedules)
- Close any TDs paid; carry TD-0009 (audit advisory-lock) status forward
- Re-confirm DEV-0011 (pg_partman) still Day 14 — no engine impact
- Correct the stale "carried forward from Days 1-2" line in Day 3 EOD if
  not already fixed
- Generate docs/process/prompts/day-04/03-end-of-day-report.md with
  Day 5 pre-conditions
- Tag: `git tag -a day-04-end -m "Day 4 complete: engine skeleton + amortisation"`
- Push tag

Commit: `chore(process): day 4 closeout — registers, EOD report, tag [D04-T4]`

## Anti-scope

- No cashflow (Day 5)
- No tax / negative gearing / Medicare (Day 5)
- No CGT, no land tax (Day 6)
- No API endpoints (Day 7), no UI (Day 8+)
- No depreciation schedules
- No external math/decimal libraries unless decimal.ts justifies one
  with a logged DEV (prefer hand-rolled bigint-cents)
- Do NOT touch packages/engine to add ruleset/tax logic — skeleton only
  must support it later, not implement it now

## Failure handling

Same as Days 1–3: checkpoint fail → halt + log DEF + propose one
fix-forward. Spec ambiguity → log DEV as `interpretation`, propose
reading, continue.

Particular watch-outs:

- Rounding convention: if decimal-and-rounding.md doesn't pin half-even
  vs half-up, this WILL cause single-cent fixture drift later. Log DEV,
  pick half-even, flag for human confirmation BEFORE building all 11
  fixtures (a wrong convention means redoing them).
- IO→P&I transition: the recalculated P&I repayment at transition must
  amortise the OUTSTANDING balance over the REMAINING term, not the
  original principal over the original term. Easy to get wrong.
- Final-period residual: P&I schedules rarely divide evenly; the last
  repayment absorbs the rounding residual so closing_balance hits
  exactly 0. Decide the rule (adjust final repayment) and track it.
- bigint serialisation in canonical JSON: JSON.stringify can't handle
  bigint natively. The canonical serialiser must intercept. Test this
  explicitly or output_hash will throw at runtime.

## Commit approval protocol

Same "READY TO COMMIT [DNN-TM]" block as Days 1–3. Wait for
`approve` / `revise <note>` / `reject <reason>` / `defer <reason>`
before each commit.

## Start

Acknowledge by listing:

1. The four Day 4 task IDs
2. The determinism contract in one sentence (prove you read it)
3. The rounding convention you'll use and whether the spec pinned it or
   you're defaulting + flagging
4. Begin pre-flight, then D04-T1.
