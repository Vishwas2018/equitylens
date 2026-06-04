# Day 6 — Engine: CGT + Victorian Land Tax + Property Tests (EquityLens)

Read first:

- docs/process/prompts/day-05/03-end-of-day-report.md
- docs/process/registers/{defect-log,deviation-log,technical-debt,daily-progress-log,product-backlog}.md
- docs/process/15-day-plan.md § Day 6
- docs/engine/test-matrix.md § CGT (CG-01..CG-12) + § Land Tax (LT-01..LT-09)
  - § property-based + § Cross-validation (XV-21..XV-40)
- docs/engine/tax-rule-versioning.md (CGT discount, VIC land tax in ruleset)
- docs/engine/financial-calc-engine.md § rounding (HALF_UP, DEV-0015)

## Pre-flight (autonomous, no approval needed)

1. Verify day-05-end: tag exists, `pnpm --filter @equitylens/engine test` green
   on clean checkout. Confirm DEV-0017 is open (it gets resolved today).
2. Run `pnpm audit:cctv --day 06`. Halt on unexpected red.
3. Save this prompt verbatim to docs/process/prompts/day-06/02-daily-execution-prompt.md.
4. Confirm pre-flight done.

## Primary goal

End of day: the engine is end-to-end. CGTEngine (CG-01..CG-12) models
disposal, cost-base elements, 50% discount eligibility, prior-year losses.
LandTaxEngine (LT-01..LT-09) computes VIC site-value aggregation, PPR
exemption, absentee surcharge, VRLT. Property-based test families run
5,000 iterations each with zero divergence. XV-21..XV-40 green. Perf:
10-property portfolio ≤ 50ms p95.

## Carry-forward constraints

- bigint cents end-to-end, no floats. HALF_UP (DEV-0015); CGT/land-tax
  may have step-specific rounding — cite per step, log DEV if differs.
- No Math.random / Date.now / ambient new Date in engine src (lint enforced).
  NOTE: property-based tests MAY use seeded randomness, but the seed must
  be fixed/injected and logged so failures reproduce. Put generators in
  test/**, never in src/**.
- All brackets/rates/thresholds from ruleset JSON, never hardcoded.
- Determinism contract holds with CGT + land tax in the path.

## Tasks

### D06-T1 — CGTEngine (CG-01..CG-12)

**Why**: disposal modelling is the back half of the investment lifecycle;
CGT discount + cost base must be ATO-correct.

Allow-list:

- packages/engine/src/cgt/types.ts (new — DisposalInput, CostBaseElements
  (1-5 per ATO: acquisition, incidental, ownership, capital-improvement,
  title), CGTResult)
- packages/engine/src/cgt/cost-base.ts (new — 5-element cost base; element
  3 (ownership costs) excluded if property was income-producing — the
  classic CGT trap)
- packages/engine/src/cgt/engine.ts (new — gross gain, 50% discount if
  held >12 months AND individual/trust (not company), prior-year capital
  loss application BEFORE discount (ATO ordering — losses reduce gross
  gain, then discount applies to the net))
- packages/engine/src/cgt/index.ts + src/index.ts export
- packages/engine/src/tax/ruleset/data/fy2026.json (extend — CGT discount
  rate + eligibility if not present; DO NOT hardcode the 50% in engine)
- packages/engine/test/cgt/\*.test.ts (CG-01..CG-12)
- packages/engine/test/fixtures/cgt/\*.json + goldens with derivation .md

Spec:

1. Cost base: 5 elements, bigint cents. Element 3 (holding costs:
   interest, rates, insurance) is NOT included in cost base if the
   property was income-producing and those costs were deductible —
   only available for non-income-producing periods. Get this right;
   it's the most common CGT error.
2. Discount ordering (ATO): gross gain → subtract current+carried capital
   losses → apply 50% discount to the REMAINING gain. NOT discount-then-
   subtract-losses. Test this ordering explicitly.
3. Discount eligibility: held ≥12 months (use injected acquisition/disposal
   dates via input, not Clock ambient) AND entity type eligible. Discount
   rate from ruleset.
4. ≥3 externally-anchored goldens (held<12mo no discount; held>12mo with
   discount; gain-with-prior-loss showing correct ordering) — derivation
   from ATO CGT guidance, committed.

Checkpoint → checkpoints/D06-T1.txt:

```
pnpm --filter @equitylens/engine test cgt    # CG-01..CG-12 green
pnpm --filter @equitylens/engine test -- --coverage   # cgt ≥95%
# Prove discount rate is ruleset-sourced, not hardcoded:
grep -rnE "0\.5|5000\b|\* 5 / 10|/ 2\b" packages/engine/src/cgt --include=*.ts \
  | grep -v ".test." || echo "CLEAN: no hardcoded discount"
```

Commit: `feat(engine): CGT engine — cost base, 50% discount, loss ordering, CG-01..CG-12 [D06-T1]`

### D06-T2 — LandTaxEngine VIC (LT-01..LT-09)

**Why**: VIC-specific; site-value aggregation + surcharges are where
multi-property portfolios get taxed.

Allow-list:

- packages/engine/src/land-tax/types.ts (new — VIC: LandHolding (site
  value), PPRStatus, AbsenteeStatus, VacancyStatus for VRLT)
- packages/engine/src/land-tax/engine.ts (new — aggregate site values
  across holdings, apply VIC general land tax scale from ruleset, PPR
  exemption, absentee owner surcharge, VRLT (Vacant Residential Land Tax))
- packages/engine/src/land-tax/index.ts + src/index.ts export
- packages/engine/src/tax/ruleset/data/fy2026.json (extend — VIC land tax
  brackets + surcharge rates + VRLT, if not already present from D05-T1)
- packages/engine/test/land-tax/\*.test.ts (LT-01..LT-09)
- packages/engine/test/fixtures/land-tax/\*.json + goldens

Spec:

1. Land tax is on AGGREGATE site value across all VIC holdings for an
   owner (not per-property) — aggregation is the whole point. Then the
   marginal scale applies to the total.
2. PPR (principal place of residence) exemption: excluded from the
   aggregate.
3. Absentee owner surcharge: additional % on top, from ruleset.
4. VRLT: applies to vacant residential land; rate + vacancy rule from
   ruleset.
5. VIC scale + surcharges from ruleset JSON only. Verify against SRO VIC
   published rates — ≥2 goldens (single holding; multi-holding aggregate
   showing the aggregation effect) with derivation from SRO VIC tables.
6. All site values + thresholds bigint cents.

Checkpoint → checkpoints/D06-T2.txt:

```
pnpm --filter @equitylens/engine test land-tax   # LT-01..LT-09 green
pnpm --filter @equitylens/engine test -- --coverage   # land-tax ≥95%
# Multi-holding aggregation golden proves total-not-per-property
```

Commit: `feat(engine): VIC land tax — aggregation, PPR, absentee, VRLT, LT-01..LT-09 [D06-T2]`

### D06-T3 — Property-based tests + XV-21..XV-40 + perf budgets

**Why**: closes the engine track. Property tests catch what fixtures
miss; perf budget must be proven, not assumed.

Allow-list:

- packages/engine/test/property/\*.test.ts (property-based families)
- packages/engine/test/cross-validation/xv-21-40.test.ts (XV-21..XV-40)
- packages/engine/test/perf/portfolio.bench.ts (perf harness)
- packages/engine/test/fixtures/cross-validation/\*.json + derivations
- package.json (fast-check or equivalent property-test lib; engine:bench
  script)
- .github/workflows/ci.yml (wire property-test + bench jobs if they should
  gate; bench records baseline, fails on regression beyond budget)

Spec:

1. Property-based families (use fast-check, SEEDED — log the seed):
   - Amortisation: closing balance never negative; sum(principal) =
     original principal (±residual); monotonic balance decline for P&I.
   - Tax: monotonic (higher income → tax non-decreasing); tax ≤ income;
     ruleset-bound (different ruleset → may differ).
   - CGT: discount ≤ gross gain; losses reduce gain before discount.
   - Land tax: aggregate ≥ any single-holding tax; PPR exclusion never
     increases tax.
     Each family: 5,000 iterations, zero divergence. Seed fixed + logged so
     any failure reproduces exactly.
2. XV-21..XV-40: cross-validation incl. CGT + land tax. Anchor a
   representative subset to ATO/SRO published values with committed
   derivation; invariant-only ones → DEV-0016 CPA queue.
3. Resolve DEV-0017: if LITO/LMITO now in scope, implement + reconcile the
   deferred XV-03..XV-08 against ATO estimator. If still deferred, state
   why and re-date the CPA review.
4. Perf: 10-property portfolio full scenario (amort+cashflow+tax+cgt+
   land-tax) ≤ 50ms p95 over N runs. Record baseline to a committed file.
   CI bench fails if p95 exceeds budget.

Checkpoint → checkpoints/D06-T3.txt:

```
pnpm --filter @equitylens/engine test property   # all families, 0 divergence, seed logged
pnpm --filter @equitylens/engine test cross-validation  # XV-21..XV-40 green
pnpm engine:bench   # p95 ≤ 50ms, baseline recorded
pnpm engine:determinism   # full pipeline, 0 divergence
pnpm --filter @equitylens/engine test -- --coverage   # whole engine ≥95%
# Capture: seed value, p95 number, full-engine coverage summary
```

Commit: `test(engine): property-based families + XV-21..XV-40 + perf budget [D06-T3]`

### D06-T4 — Close out (≤30min, no per-task approval)

- Append Day 6 entry to daily-progress-log.md (honest status)
- Resolve DEV-0017 (LITO/rounding CPA item) — state outcome
- Update DEV-0016 CPA queue (CGT/land-tax invariant-only fixtures added)
- Close TDs paid; carry TD-0009 (audit advisory-lock), DEV-0011
  (pg_partman, Day 14), DEV-0002 (Node 24 local coverage)
- Generate docs/process/prompts/day-06/03-end-of-day-report.md with Day 7
  pre-conditions (API contracts: properties, scenarios, results)
- Note: engine track COMPLETE — flag any engine items deferred to backlog
- Tag: git tag -a day-06-end -m "Day 6 complete: CGT + VIC land tax + property tests + perf — engine track done"
- Push tag

Commit: `chore(process): day 6 closeout — registers, EOD report, tag [D06-T4]`

## Anti-scope

- No API endpoints (Day 7), no UI (Day 8+)
- No states other than VIC for land tax (other states are backlog)
- No depreciation beyond what CGT cost base needs (div40/div43 schedules
  were flagged Day 5 — confirm scope: if full depreciation schedules are
  out, the CGT cost base uses the already-computed deductible totals)
- No external tax/math libraries except the property-test lib (test-only)
- Do NOT hardcode CGT discount, land-tax scale, or surcharge rates — ruleset

## Failure handling

Same as Days 1-5: checkpoint fail → halt + log DEF + propose one fix-forward.
Spec ambiguity → log DEV, propose reading, continue.

Watch-outs:

- CGT cost-base element 3: holding costs excluded if income-producing +
  deducted. Including them inflates cost base and understates gain — wrong
  tax. Anchor the golden specifically on a property that WAS income-producing.
- CGT loss-then-discount ordering: losses reduce gross gain BEFORE the 50%
  discount. Reversing it understates tax. Test explicitly.
- Land tax aggregation: tax on TOTAL site value, not sum of per-property
  taxes. Per-property would massively understate (the scale is marginal).
- Property-test seed: MUST be fixed + logged. An unseeded failure that
  can't reproduce is useless. Put generators in test/, not src/ (lint).
- Perf bench variance: p95 over enough runs (≥100) to be stable; warm the
  JIT first or the first-run outlier blows the budget.
- div40/div43: confirm whether depreciation schedules are in scope today.
  If out, CGT cost base must use deductible totals already computed, not
  recompute depreciation.

## Commit approval protocol

Same "READY TO COMMIT [DNN-TM]" block. Wait for approve / revise <note> /
reject <reason> / defer <reason> before each commit.

## Start

Acknowledge by listing:

1. The four Day 6 task IDs
2. The CGT discount ordering in one sentence (losses before discount)
3. Whether div40/div43 depreciation is in scope today or deferred (state
   what test-matrix.md / the plan says)
4. The property-test seed strategy (fixed + logged, generators in test/)
5. Begin pre-flight, then D06-T1.
