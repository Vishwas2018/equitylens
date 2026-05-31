# Day 5 — Engine: Cashflow + Tax Modules (EquityLens)

Read first:

- docs/process/prompts/day-04/03-end-of-day-report.md
- docs/process/registers/{defect-log,deviation-log,technical-debt,daily-progress-log,product-backlog}.md
- docs/process/15-day-plan.md § Day 5
- docs/engine/test-matrix.md § Cashflow (CF-01..CF-12) + § Tax (TX-01..TX-15) + § Cross-validation (XV-01..XV-20)
- docs/engine/tax-rule-versioning.md § 6.1 (FY2026 ruleset example)
- docs/engine/financial-calc-engine.md (rounding §5.2 — HALF_UP, confirmed Day 4)

## Pre-flight (autonomous, no approval needed)

1. Verify day-04-end state: `git tag --list day-04-end`, engine tests green
   on a clean checkout (`pnpm --filter @equitylens/engine test`).
2. Run `pnpm audit:cctv --day 05`. Halt on unexpected red.
3. Save this prompt verbatim to docs/process/prompts/day-05/02-daily-execution-prompt.md.
4. Confirm pre-flight done.

## Primary goal

End of day: CashFlowService (CF-01..CF-12) and TaxService (TX-01..TX-15)
compute correctly against ATO fixtures. The tax ruleset is loaded from
JSON via RulesetAdapter (no hardcoded brackets anywhere). Ruleset version
is stamped into every result, and two different ruleset versions on
identical inputs produce DIFFERENT output_hash (proves ruleset binding).
XV-01..XV-20 cross-validation fixtures green.

## Carry-forward constraints (from Day 4)

- Money is bigint cents end-to-end. No floats in money math.
- Rounding: HALF_UP per financial-calc-engine.md §5.2 (DEV-0015). Tax may
  require a DIFFERENT rounding in specific steps — if tax-rule-versioning.md
  or the ATO method specifies (e.g. truncation/floor for tax withheld, or
  HALF_EVEN), use it AT THAT STEP and log DEV. mulDiv already supports both
  modes; choose per-step, cite the source.
- No Math.random / Date.now / ambient new Date in engine src (lint enforced).
- Determinism contract holds: same input → same output_hash.

## Tasks

### D05-T1 — RulesetAdapter + FY2026 ruleset JSON (no hardcoded brackets)

**Why**: tax correctness is meaningless if brackets are baked into code.
The ruleset must be data, versioned, and resolvable by FY.

Allow-list:

- packages/engine/src/tax/ruleset/types.ts (new — Ruleset, TaxBracket,
  MedicareConfig, RulesetVersion; all rates as basis points or decimal
  strings, all thresholds as Cents)
- packages/engine/src/tax/ruleset/adapter.ts (new — RulesetAdapter:
  resolveByFY(fy, { status: 'published' }) → Ruleset; rejects draft/
  unpublished; throws on missing FY, never silently defaults)
- packages/engine/src/tax/ruleset/data/fy2026.json (new — FY2026 brackets,
  Medicare levy + MLS thresholds, per tax-rule-versioning.md §6.1)
- packages/engine/src/tax/ruleset/index.ts
- packages/engine/test/tax/ruleset/\*.test.ts
- packages/engine/src/tax/ruleset/data/fy2026.schema.json (new — JSON
  schema; adapter validates ruleset against it on load, fails closed)

Spec:

1. Ruleset JSON is the SINGLE source of brackets/thresholds. A grep for
   numeric tax rates in packages/engine/src/\*_/_.ts (excluding ruleset/data
   and tests) must return nothing. Prove this in the checkpoint.
2. Every ruleset has a version + status (published/draft) + effective FY.
   resolveByFY filters to published only.
3. Adapter validates loaded JSON against the schema; malformed ruleset =
   throw at load, not silent partial.
4. RulesetVersion is the stamp used downstream in output_hash.

Checkpoint → checkpoints/D05-T1.txt:

```
pnpm --filter @equitylens/engine test tax/ruleset    # green
# Prove no hardcoded brackets:
grep -rnE "0\.(19|3[0-9]|45)|18[0-9]{3}|45000|135000|190000" \
  packages/engine/src --include=*.ts \
  | grep -v "ruleset/data" | grep -v ".test." || echo "CLEAN: no hardcoded rates"
pnpm --filter @equitylens/engine typecheck
```

Commit: `feat(engine): ruleset adapter + FY2026 tax data, no hardcoded brackets [D05-T1]`

### D05-T2 — CashFlowService (CF-01..CF-12)

**Why**: cashflow feeds taxable income; must be correct before tax sits on it.

Allow-list:

- packages/engine/src/cashflow/service.ts (new)
- packages/engine/src/cashflow/types.ts (new — CashFlowInput, period
  income/expense lines, NetCashFlow)
- packages/engine/src/cashflow/index.ts + src/index.ts export
- packages/engine/test/cashflow/\*.test.ts (CF-01..CF-12 fixtures)
- packages/engine/test/fixtures/cashflow/\*.json

Spec:

1. CashFlowService consumes amortisation output (interest is deductible,
   principal is not — keep them separate, this is the classic error).
2. Rental income, expenses (rates, insurance, management fees, repairs),
   interest deduction — all bigint cents, per-period.
3. CF-01..CF-12 from test-matrix. If any fixture lacks expected values,
   same rule as Day 4: do NOT invent — anchor at least one to a hand-
   derived golden with committed derivation; log DEV for the rest as
   invariant-tested pending CPA review (use the Day 4 CPA date).
4. Output is deterministic; feeds taxable-income calc in T3.

Checkpoint → checkpoints/D05-T2.txt:

```
pnpm --filter @equitylens/engine test cashflow   # CF-01..CF-12 green
pnpm --filter @equitylens/engine test -- --coverage   # cashflow ≥95%
```

Commit: `feat(engine): cashflow service CF-01..CF-12 [D05-T2]`

### D05-T3 — TaxService (TX-01..TX-15) + negative gearing + Medicare + XV-01..XV-20

**Why**: the day's primary deliverable. Income tax, negative gearing
offset, Medicare levy + surcharge, all ruleset-bound and ATO-validated.

Allow-list:

- packages/engine/src/tax/service.ts (new — TaxService.compute(income,
  ruleset, ...))
- packages/engine/src/tax/medicare.ts (new — levy + MLS)
- packages/engine/src/tax/negative-gearing.ts (new — offset against other
  income, subject to ruleset)
- packages/engine/src/tax/index.ts + src/index.ts export
- packages/engine/src/runtime/scenario.ts (extend — stamp ruleset_version
  into result + output_hash)
- packages/engine/test/tax/\*.test.ts (TX-01..TX-15)
- packages/engine/test/cross-validation/\*.test.ts (XV-01..XV-20)
- packages/engine/test/fixtures/tax/_.json + cross-validation/_.json

Spec:

1. TaxService applies brackets from the resolved ruleset only. Marginal
   rate calc, low-income offsets if in ruleset.
2. Negative gearing: net rental loss offsets other income per ruleset
   rules. Test the loss-offset path explicitly (it's the product's whole
   point — a property running at a loss reducing taxable income).
3. Medicare levy + MLS: thresholds + surcharge tiers from ruleset.
   MLS tiers depend on income AND private-health-cover status (input).
4. Ruleset binding proof: run identical inputs through FY2026 and a second
   ruleset version (create a minimal fy2026-variant.json with one changed
   bracket); assert output_hash DIFFERS. This is a Day 5 checkpoint.
5. XV-01..XV-20: cross-validation against ATO-sourced expected values.
   These ARE the external anchor for tax — if the matrix provides expected
   tax figures, assert to the cent. If it provides only inputs, anchor a
   representative subset to ATO's own tax calculator / published tables
   with committed derivation; log DEV for the remainder.
6. Rounding per-step: if ATO method truncates tax to whole dollars at a
   step, do that and cite it (DEV). Don't blanket-apply HALF_UP if the
   ATO method differs.

Checkpoint → checkpoints/D05-T3.txt:

```
pnpm --filter @equitylens/engine test tax            # TX-01..TX-15 green
pnpm --filter @equitylens/engine test cross-validation  # XV-01..XV-20 green
pnpm --filter @equitylens/engine test -- --coverage  # tax module ≥95%
# Ruleset-binding proof: same input, two ruleset versions, different hash
pnpm --filter @equitylens/engine test tax/ruleset-binding.test.ts
pnpm engine:determinism   # still 0 divergence with tax in the path
```

Commit: `feat(engine): tax service + negative gearing + medicare, ruleset-bound, XV-01..XV-20 [D05-T3]`

### D05-T4 — Close out (≤30min, no per-task approval)

- Append Day 5 entry to daily-progress-log.md (honest status)
- Update defect-log / deviation-log (per-step rounding DEVs; any fixture-
  anchoring DEVs with the CPA review date)
- Close any TDs paid; carry forward TD-0009 (audit advisory-lock),
  DEV-0011 (pg_partman, Day 14), DEV-0002 (Node 24 local coverage)
- LOG THE BRANCH-PROTECTION DEFECT if not done in D04-T4: main was
  effectively ungated Days 1-3 (lowercase contexts, app_id null, never
  matched). Cause/impact/fix. (Carried over — flagged but not logged.)
- Generate docs/process/prompts/day-05/03-end-of-day-report.md with Day 6
  pre-conditions
- Tag: git tag -a day-05-end -m "Day 5 complete: cashflow + tax modules, ruleset-bound"
- Push tag

Commit: `chore(process): day 5 closeout — registers, EOD report, tag [D05-T4]`

## Anti-scope

- No CGT, no land tax, no depreciation (Day 6)
- No API endpoints (Day 7), no UI (Day 8+)
- No tax years other than FY2026 (the variant ruleset is a MINIMAL test
  fixture, not a real second FY)
- No external tax libraries — ruleset is data, logic is hand-rolled
- Do NOT hardcode any bracket/threshold in code — ruleset JSON only

## Failure handling

Same as Days 1-4: checkpoint fail → halt + log DEF + propose one fix-
forward. Spec ambiguity → log DEV, propose reading, continue.

Watch-outs:

- Principal vs interest: only interest is deductible. Mixing them corrupts
  taxable income. Keep the amortisation split clean through cashflow.
- Per-step rounding: ATO tax methods may truncate/round differently than
  loan math. Don't assume HALF_UP everywhere — cite the method per step.
- Negative gearing: the loss-offset must reduce OTHER income, with any
  ruleset cap applied. Test a property-at-a-loss case explicitly.
- MLS depends on private-health-cover status — that's an input, not
  derivable. Ensure the input model carries it.
- Ruleset-binding hash: ruleset_version must be IN the canonical payload
  that output_hash covers, or the binding proof fails.

## Commit approval protocol

Same "READY TO COMMIT [DNN-TM]" block as Days 1-4. Wait for approve /
revise <note> / reject <reason> / defer <reason> before each commit.

## Start

Acknowledge by listing:

1. The four Day 5 task IDs
2. One sentence: how ruleset binding is proven (same input, two ruleset
   versions, different output_hash)
3. The per-step rounding question: does tax-rule-versioning.md / ATO method
   specify a rounding that differs from HALF_UP? State what you find.
4. Begin pre-flight, then D05-T1.
