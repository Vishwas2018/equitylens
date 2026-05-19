# 15-Day Sprint Plan

> The day-by-day spine of the build. Each day declares a single primary goal, 2–4 deliverables, explicit verification checkpoints, and a list of items that are explicitly **out of scope**. Days are designed so that the system is in a verifiably correct state at end-of-day, every day. A day that cannot reach its checkpoints rolls remaining work into the next day's plan; the system never accepts "we'll fix it later" as a transition.

---

## Overview

| Day | Theme                                             | Track       |
| --- | ------------------------------------------------- | ----------- |
| 01  | Repository bootstrap & toolchain                  | Foundation  |
| 02  | Database schema & RLS in staging                  | Foundation  |
| 03  | Auth, tenancy, session model                      | Foundation  |
| 04  | Engine: amortisation + decimal arithmetic         | Engine      |
| 05  | Engine: cashflow + tax modules                    | Engine      |
| 06  | Engine: CGT + Victorian land tax + property tests | Engine      |
| 07  | API contracts: properties, scenarios, results     | Backend     |
| 08  | Web shell, design tokens, auth UX                 | Frontend    |
| 09  | Portfolio overview + property detail dashboards   | Frontend    |
| 10  | Scenario Lab UI + scenario execution wiring       | Frontend    |
| 11  | AI gateway, PII masking, explanation surface      | Integration |
| 12  | Reports & exports (PDF/CSV) + worker queue        | Integration |
| 13  | Stripe billing, entitlements, dunning             | Integration |
| 14  | Observability, alerts, synthetics, perf pass      | Hardening   |
| 15  | Security review, a11y audit, staging soak, RC     | Hardening   |

Tracks: **Foundation** (1–3) → **Engine** (4–6) → **Backend** (7) → **Frontend** (8–10) → **Integration** (11–13) → **Hardening** (14–15).

---

## Day 1 — Repository Bootstrap & Toolchain

**Primary goal**: a green CI pipeline against an empty but correctly-structured monorepo.

**Deliverables**

1. pnpm + Turborepo monorepo with `apps/web`, `packages/engine`, `packages/types`, `packages/design-tokens`, `supabase/`.
2. Node 20.14, pnpm 9.4 pinned via `engines`; `.nvmrc`, `.tool-versions`.
3. TypeScript strict mode across all packages; shared `tsconfig.base.json`.
4. ESLint + Prettier + commitlint + Husky pre-commit (lint/typecheck on changed files).
5. GitHub Actions CI workflow per `/operations/ci-cd-pipeline.md` §4 (lint, typecheck, unit-engine, unit-app, build — others stubbed and skipped with TODO comments referencing day numbers).
6. Initial Vercel project linked; preview deploy works for an empty Next.js 14 app.
7. CODEOWNERS file with `@equitylens/eng-finance` on `packages/engine/**`.

**Checkpoints**

- `pnpm install` clean on a fresh clone.
- `pnpm lint && pnpm typecheck && pnpm build` exit 0.
- CI passes on a PR that adds a no-op change.
- Vercel preview URL responds 200 on `/`.
- CODEOWNERS enforced (test by tagging an unrelated reviewer on a `packages/engine` change).

**Out of scope**: any production logic, database, RLS, engine math, UI design.

**Risks to log**: Vercel + Supabase region misconfiguration (must be `ap-southeast-2`).

---

## Day 2 — Database Schema & RLS in Staging

**Primary goal**: every table from `/database/schema.sql` exists in staging Supabase with RLS enabled and policies attached; cross-tenant probe denies.

**Deliverables**

1. Supabase staging project provisioned in `ap-southeast-2` (verified by `region-check` job).
2. `supabase/migrations/0001_baseline.sql` applies `/database/schema.sql` verbatim.
3. `supabase/migrations/0002_rls.sql` applies `/database/rls-policies.sql`.
4. `policy_coverage.sql` returns zero uncovered tables.
5. `tests/rls/cross-tenant.test.ts` confirms tenant A cannot read tenant B for every table.
6. `pnpm db:migrate:lint` passes (no destructive patterns).
7. Reversibility test: `up → down → up` clean.

**Checkpoints**

- All migrations apply on a fresh staging DB.
- `SELECT count(*) FROM equitylens.<every_table>` succeeds for service role, denies for anon.
- Cross-tenant test suite green.
- Audit log hash chain initialised and verifiable.

**Out of scope**: seeded data beyond the minimum needed for RLS tests; engine integration; API endpoints.

---

## Day 3 — Auth, Tenancy, Session Model

**Primary goal**: a user can sign up, create a tenant, invite a member, and the membership is correctly scoped by RLS end-to-end.

**Deliverables**

1. Supabase Auth configured (email + password; magic link disabled until Day 14).
2. `apps/web/middleware.ts` enforces session, hydrates `tenant_id` from the active membership.
3. Server actions: `signUp`, `signIn`, `signOut`, `createTenant`, `inviteMember`, `acceptInvite`, `switchTenant`.
4. `audit_logs` writes for each of the above actions.
5. Integration tests covering the sign-up → tenant-create → invite → accept flow.
6. Rate limiting on auth endpoints via Upstash Redis (10 / min / IP for sign-in).

**Checkpoints**

- End-to-end Playwright test passes for the full flow.
- Audit log entries appear with correct `tenant_id_hash` and chain unbroken.
- Cross-tenant API probe returns 403 not 404 (information leakage check).
- Rate limiter returns 429 after threshold.

**Out of scope**: SSO, magic link, MFA, OAuth providers.

---

## Day 4 — Engine: Amortisation + Decimal Arithmetic

**Primary goal**: the deterministic engine skeleton exists; the amortisation module produces ATO-replicable schedules for IO, P&I, and IO→P&I transitions.

**Deliverables**

1. `packages/engine` with strict TS, no external math libs beyond a decimal helper (bigint cents end-to-end).
2. `Amortisation` module covering AM-01..AM-11 from `/engine/test-matrix.md`.
3. Determinism harness: `runScenario(inputs)` twice produces identical `output_hash`.
4. Coverage ≥ 95% on the module.
5. ESLint rule: no `Math.random`, no `Date.now()` inside `packages/engine/src/**`.

**Checkpoints**

- All AM-01..AM-11 fixtures green.
- `pnpm engine:determinism` runs 1000 iterations with zero divergence.
- Lint rule blocks a test commit that introduces `Date.now()`.
- Coverage threshold enforced by CI.

**Out of scope**: cashflow, tax, CGT, land tax.

---

## Day 5 — Engine: Cashflow + Tax Modules

**Primary goal**: cashflow and income tax calculations are correct against ATO fixtures; tax ruleset is loaded from JSON (no hardcoded brackets).

**Deliverables**

1. `CashFlowService` covering CF-01..CF-12.
2. `TaxService` covering TX-01..TX-15 using the FY2026 ruleset (`/engine/tax-rule-versioning.md` §6.1 example).
3. `RulesetAdapter` resolves rulesets by FY with state filter `published`.
4. Negative gearing handling with offset against other income (subject to ruleset).
5. Medicare Levy + Medicare Levy Surcharge logic.
6. ATO cross-validation fixtures XV-01..XV-20 green.

**Checkpoints**

- All TX fixtures pass.
- Ruleset version is stamped into every result.
- Two different ruleset versions on identical inputs produce **different** `output_hash` values (proves ruleset binding).

**Out of scope**: CGT, land tax, depreciation schedule edge cases.

---

## Day 6 — Engine: CGT + Victorian Land Tax + Property Tests

**Primary goal**: end-to-end engine — disposal modelling, CGT discount, Victorian land tax aggregation. Property-based tests pass.

**Deliverables**

1. `CGTEngine` covering CG-01..CG-12 (50% discount eligibility, cost-base elements, prior-year losses).
2. `LandTaxEngine` covering LT-01..LT-09 for Victoria (site value aggregation, PPR, absentee surcharge, VRLT).
3. Property-based test families from `/engine/test-matrix.md` §property-based (5,000 iterations each).
4. Remaining ATO/SRO fixtures XV-21..XV-40 green.
5. Engine perf budgets met: portfolio of 10 properties ≤ 50 ms p95.

**Checkpoints**

- All XV-01..XV-40 fixtures green.
- 5,000-iteration property-based tests run zero divergences.
- Bench harness reports within budgets; results recorded to a baseline.

**Out of scope**: federal land tax, non-VIC state-specific rules (post-MVP).

---

## Day 7 — API Contracts: Properties, Scenarios, Results

**Primary goal**: the contracts in `/architecture/api-contracts.md` are implemented for the property + scenario + result surface; engine runs are persisted with hash-pinned versions.

**Deliverables**

1. Server endpoints (App Router route handlers): `POST/GET/PATCH /api/properties`, `POST /api/scenarios`, `POST /api/scenarios/:id/run`, `GET /api/scenarios/:id`, `GET /api/scenario-results/:id`.
2. Zod schemas at the boundary; structured 400 responses on validation failure.
3. Scenario run path: idempotency by `input_hash`; persists `scenario_results` with `engine_version`, `ruleset_version`, `input_hash`, `output_hash`.
4. RLS enforced; every endpoint has a cross-tenant probe.
5. Integration tests covering the create-property → create-scenario → run → fetch result flow.

**Checkpoints**

- All endpoints pass contract tests.
- Identical inputs return the same persisted `scenario_result_id` (idempotency).
- RLS probes return 403/404 per the disclosure rules in `/architecture/security-and-compliance.md`.
- `audit_logs` entries written for all writes.

**Out of scope**: AI explanation endpoint, reports, billing, scheduling.

---

## Day 8 — Web Shell, Design Tokens, Auth UX

**Primary goal**: the shell from `/ui-ux/dashboard-layouts.md` exists; users can sign up, sign in, accept invitations, and see an empty portfolio.

**Deliverables**

1. `@equitylens/design-tokens` package with OKLCH tokens from `/ui-ux/design-system.md`.
2. shadcn/ui set up with token overrides; Inter Variable with `tnum` enabled.
3. App shell: top nav, tenant switcher, side nav, account menu, dark mode toggle.
4. Auth screens: sign-up, sign-in, invite-acceptance, tenant-create.
5. Empty-state portfolio page with primary CTA "Add a property".
6. `<FinancialDisclaimer />` component, used on every financial surface (currently the empty portfolio is the only one).

**Checkpoints**

- Lighthouse mobile a11y ≥ 98 on all auth + shell routes.
- axe critical violations = 0.
- Dark mode meets WCAG 2.2 AA+ contrast on all token pairs.
- Bundle ≤ budget per route.

**Out of scope**: data viz components, scenario UI, reports UI.

---

## Day 9 — Portfolio Overview + Property Detail

**Primary goal**: the canonical investor surfaces render real data — portfolio aggregates and a single property's deep view.

**Deliverables**

1. `/portfolio` route: KPI tiles, property table, 10-year equity forecast chart with companion table.
2. `/properties/[id]` route: header, 30-year cashflow forecast, equity forecast, assumptions panel.
3. Recharts wrapper `<Chart>` with `isAnimationActive=false`, palette assignment per `/ui-ux/data-viz-guidelines.md`.
4. `<Money>` component using bigint cents → `Intl.NumberFormat('en-AU')` with `tnum`.
5. Empty / loading / error states.
6. Server components fetch from API endpoints from Day 7.

**Checkpoints**

- p95 portfolio render ≤ 1.5 s on slow 3G profile.
- Every chart has a companion data table for a11y.
- Disclaimer present above the fold on every financial surface.
- Cross-tenant probe at the page level returns 404 (no UI hint of existence).

**Out of scope**: scenario editing, reports, AI panel.

---

## Day 10 — Scenario Lab UI + Execution Wiring

**Primary goal**: a user can create, edit, and run a scenario; results render with the same components from Day 9.

**Deliverables**

1. `/scenarios` index and `/scenarios/[id]` editor + result viewer.
2. Scenario form: assumption controls (rent growth, capital growth, interest rate, vacancy, holding period, disposal year).
3. "Run scenario" CTA invokes `POST /api/scenarios/:id/run`; UI handles idempotent re-runs gracefully.
4. Scenario comparison view (up to 4 scenarios side-by-side, per `/ui-ux/dashboard-layouts.md`).
5. Scenario immutability surfaced: results are pinned to engine + ruleset versions; UI shows the versions explicitly.

**Checkpoints**

- End-to-end Playwright: create property → create scenario → run → see results.
- Re-running with identical inputs produces the same `scenario_result_id`.
- UI surfaces the engine/ruleset version on every result.
- All numbers in the UI match the engine's persisted JSON exactly.

**Out of scope**: AI explanations, reports, sharing.

---

## Day 11 — AI Gateway, PII Masking, Explanation Surface

**Primary goal**: AI explanations work end-to-end with the masking gateway, audit logging, and grounding checks. The AI never produces calculations.

**Deliverables**

1. AI gateway service (server-only) per `/architecture/ai-integration.md`: PII masking, prompt assembly, provider call, response validation.
2. Provider: Anthropic primary, OpenAI fallback; structured output schema.
3. PII masking: emails, AU mobiles, TFNs, addresses, card patterns — all 24 canary inputs pass.
4. Explanation surface on `/scenarios/[id]`: "Explain this result" button, structured output rendered in `<AIExplanation />` with the "AI-generated — not financial advice" badge.
5. `ai_interactions` row written for every call with masked prompt + response + grounding-diff result.
6. Grounding check: parses numeric claims in the explanation and compares against engine outputs; any mismatch > 1% raises `ai_explanation_diff_versus_engine_total`.

**Checkpoints**

- 24 canary inputs sanitised or refused.
- Grounding check passes on the standard 20-scenario fixture set.
- AI surface refuses to render without the badge.
- No raw PII appears in any provider request (verified by capturing outbound bodies in test).

**Out of scope**: free-form AI chat, AI-generated reports.

---

## Day 12 — Reports & Exports + Worker Queue

**Primary goal**: PDF and CSV exports for the three priority templates (`portfolio-summary`, `cashflow-annual`, `cgt-disposal`) generated by background workers, delivered via presigned URLs.

**Deliverables**

1. `exports.fast` and `exports.bulk` queues on Upstash; Edge Function worker implementation.
2. `portfolio-summary` PDF v1.3.0, `cashflow-annual` CSV v1.2.0, `cgt-disposal` PDF + CSV.
3. Disclaimer + identification header on every artifact (renderer refuses without).
4. Idempotency by `(scenario_result_id, template_slug, template_version, purpose, tenant_id)`.
5. PDF golden tests; CSV round-trip tests.
6. `/reports` inbox UI listing reports with status.

**Checkpoints**

- Generate report → status transitions queued → running → succeeded → delivered.
- Presigned URL downloads the correct artifact; expires after 7 days.
- Duplicate submission returns the same `report_id`.
- `output_hash` stable across two consecutive renders of identical inputs.

**Out of scope**: scheduled exports, adviser webhook, XLSX format.

---

## Day 13 — Stripe Billing, Entitlements, Dunning

**Primary goal**: subscription lifecycle works end-to-end; entitlements gate features per `/product/pricing-and-gating.md`.

**Deliverables**

1. Stripe products + prices reconciled with the entitlements table.
2. Checkout flow: tier selection → Stripe Checkout → return → entitlement active.
3. Webhook handler with `stripe_events` idempotency table.
4. `useEntitlement(feature)` hook + server-side `requireEntitlement(...)` guard.
5. Tier-gated surfaces: scenario count limit, scheduled exports (Pro+), adviser pack (Professional).
6. Dunning state machine: `past_due` → `grace` → `restricted` → `cancelled` with email + in-app comms.

**Checkpoints**

- Stripe test-mode checkout completes; subscription row created.
- Webhook replay test passes for all four critical events.
- Free-tier user blocked from running a 6th scenario this month (Free cap).
- Past-due user enters grace within 24h of failed payment; restricted at day 7.

**Out of scope**: annual billing toggles, coupons, partner discounts.

---

## Day 14 — Observability, Alerts, Synthetics, Performance Pass

**Primary goal**: every signal from `/operations/monitoring-and-observability.md` is wired; SLOs are measurable; perf budgets met.

**Deliverables**

1. OTel SDK in app + workers + engine span surface.
2. Honeycomb / Grafana Cloud dashboards published from `ops/grafana/`.
3. Sentry sourcemaps uploaded on every deploy; release-tagged.
4. Checkly synthetic probes from Sydney + Melbourne PoPs.
5. PagerDuty escalation policy + Grafana OnCall alert rules for SEV1/SEV2.
6. Performance pass: bundle budgets enforced, engine perf re-benched, slow query review.
7. Domain-specific correctness metrics: `engine_output_hash_distribution`, `tax_ruleset_in_use`, `ato_fixture_canary_pass_total`, `disclaimer_render_missing_total`.

**Checkpoints**

- Synthetic probes green for 30 min continuous.
- A forced 5xx triggers PagerDuty within 5 min.
- Correctness metrics populated; no zero-cardinality dashboards.
- Lighthouse mobile Performance ≥ 92 on every primary route.
- Engine perf within budgets on production-shaped fixtures.

**Out of scope**: anomaly detection, ML-based forecasting of telemetry.

---

## Day 15 — Security Review, A11y Audit, Staging Soak, Release Candidate

**Primary goal**: a release candidate is approved against the deployment checklist; staging soak completes cleanly.

**Deliverables**

1. Threat model walk-through against `/architecture/security-and-compliance.md`; any gaps logged.
2. Full deployment checklist (`/operations/deployment-checklist.md`) ticked for the RC.
3. Independent a11y audit (axe + manual screen-reader pass on primary surfaces).
4. Secret rotation rehearsal: rotate one staging secret without downtime.
5. APP 12 (data export) and APP 11 (erasure) workflows exercised end-to-end on a synthetic tenant.
6. Staging soak: ≥ 30 min synthetic probes green; no SEV1/SEV2 in 24h.
7. Release notes drafted; ADRs for any decisions made during 1–14 finalised.

**Checkpoints**

- Deployment checklist 100% ticked.
- a11y violations critical = 0; serious ≤ 2 with owners.
- APP 12 export delivered, downloaded, expired correctly.
- APP 11 erasure: user data removed from primary stores; audit logs retained pseudonymised.
- Staging soak signoff in `#deploys`.

**Out of scope**: production deploy itself (separate window with two approvers per `/operations/deployment-checklist.md` §4).

---

## Daily Inputs & Outputs Summary

For each day:

| Phase   | Input                                               | Output                                                           |
| ------- | --------------------------------------------------- | ---------------------------------------------------------------- |
| Morning | Previous day's End-of-Day Report, current registers | **CCTV Audit Report** (Code) → **Daily Execution Prompt** (Opus) |
| Day     | Daily Execution Prompt                              | Commits with task IDs, register appends                          |
| Evening | Commits + test outputs                              | **End-of-Day Report** (Code) → updated daily progress log (Opus) |

All three artifacts per day are committed to `/docs/process/prompts/day-NN/` so the build is auditable from `git log` alone.

---

## Schedule Discipline Rules

1. **No day starts without the prior End-of-Day Report and updated registers.**
2. **No day's plan exceeds 3 major deliverables.** Pressure to add a fourth is a deviation.
3. **A failed checkpoint halts the day.** It does not roll silently to the next day.
4. **Engine days (4–6) cannot be compressed.** Financial correctness is the floor.
5. **Hardening days (14–15) cannot be sacrificed.** A 13-day build that ships without 14–15 is not a release; it is a demo.
6. **If a day overruns by more than 50%, the plan is wrong, not the implementer.** Opus revises the remaining plan; the team does not work nights.

---

## Cross-References

- `/docs/process/execution-system.md` — role boundaries and ritual
- `/docs/process/daily-ritual.md` — operational procedure
- `/docs/process/templates/cctv-audit-report.md` — morning audit template
- `/docs/process/templates/daily-execution-prompt.md` — daily plan template
- `/docs/process/templates/end-of-day-report.md` — evening report template
- `/docs/process/registers/*` — the six living registers
- `/operations/ci-cd-pipeline.md` — checks enforced from Day 1
- `/operations/deployment-checklist.md` — Day 15 gates
- `/engine/test-matrix.md` — fixtures referenced on Days 4–6
