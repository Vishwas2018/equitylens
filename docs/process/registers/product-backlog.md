# Product Backlog

> Living register of capabilities identified but not yet built. Owned by Opus; Code may append entries with status `proposed`. Items move out of this register when they enter a Daily Execution Prompt as a task (status → `in_plan`) or are accepted into a future day's spine. Items that won't be built before the 15-day RC are explicitly marked `post-RC`.

---

## Conventions

- **ID**: `BL-NNNN`, monotonically increasing, never reused.
- **Priority**: `P0` (release-blocking) / `P1` (RC nice-to-have) / `P2` (post-RC).
- **Status**: `proposed` → `triaged` → `in_plan` → `done` / `dropped`.
- **Origin**: free text — which document, day, or defect surfaced the need.
- **Effort**: T-shirt size — `XS` (<2h) / `S` (~half-day) / `M` (~day) / `L` (>1 day, must be split).
- No item enters `in_plan` without an effort estimate.
- `dropped` items remain in the file forever (audit trail); they are not deleted.

---

## Open

| ID      | Title                                                                                                      | Priority | Effort | Origin                                             | Status   | Notes                                                                                                                                                                        |
| ------- | ---------------------------------------------------------------------------------------------------------- | -------- | ------ | -------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BL-0001 | Adviser webhook delivery channel                                                                           | P2       | M      | `/reports-exports/scheduling-and-delivery.md` §6.4 | proposed | Post-RC; Professional tier only                                                                                                                                              |
| BL-0002 | XLSX export format                                                                                         | P2       | S      | `/reports-exports/export-templates.md` §7          | proposed | After CSV templates stable                                                                                                                                                   |
| BL-0003 | Scheduled exports (cron-driven)                                                                            | P2       | M      | `/reports-exports/scheduling-and-delivery.md` §7   | proposed | Pro+ tier; requires Day 13 entitlements                                                                                                                                      |
| BL-0004 | Data export full (APP 12) JSON bundle                                                                      | P1       | M      | `/architecture/security-and-compliance.md` §APP 12 | proposed | Day 15 walkthrough must exercise                                                                                                                                             |
| BL-0005 | SSO / SAML for Enterprise tier                                                                             | P2       | L      | `/product/prd.md`                                  | proposed | Post-RC                                                                                                                                                                      |
| BL-0006 | Multi-factor authentication (TOTP)                                                                         | P1       | M      | Security review                                    | proposed | RC nice-to-have if time allows on D15                                                                                                                                        |
| BL-0007 | Magic-link sign-in                                                                                         | P2       | S      | `/architecture/system-architecture.md`             | proposed | Disabled by default per D3 spec                                                                                                                                              |
| BL-0008 | Non-Victorian state land tax modules                                                                       | P2       | L      | `/engine/test-matrix.md`                           | proposed | Post-RC; VIC only for MVP                                                                                                                                                    |
| BL-0009 | Trust / SMSF ownership structure modelling                                                                 | P1       | L      | Persona research                                   | proposed | Affects CGT discount eligibility logic                                                                                                                                       |
| BL-0010 | Federal land tax forecast (hypothetical)                                                                   | P2       | M      | Product strategy                                   | proposed | Speculative; gated behind feature flag                                                                                                                                       |
| BL-0011 | Multi-currency support (NZD, USD secondary)                                                                | P2       | L      | Product strategy                                   | proposed | Post-RC                                                                                                                                                                      |
| BL-0012 | Free-form AI chat surface                                                                                  | P2       | M      | `/architecture/ai-integration.md`                  | proposed | Risk: grounding harder; gated behind flag                                                                                                                                    |
| BL-0013 | AI-generated explanation in reports                                                                        | P2       | M      | Stakeholder request                                | proposed | Must preserve no-AI-calculation rule                                                                                                                                         |
| BL-0014 | Adviser pack PDF (multi-doc bundle)                                                                        | P1       | M      | `/reports-exports/export-templates.md` §2.1        | proposed | After core PDFs ship on D12                                                                                                                                                  |
| BL-0015 | Bulk property import (CSV)                                                                                 | P1       | S      | Persona research                                   | proposed | Free + Pro                                                                                                                                                                   |
| BL-0016 | OAuth: Google + Microsoft                                                                                  | P2       | M      | Growth                                             | proposed | Post-RC                                                                                                                                                                      |
| BL-0017 | In-app changelog / "What's New" panel                                                                      | P1       | XS     | `/operations/deployment-checklist.md` §8           | proposed | Used by tax ruleset publishes                                                                                                                                                |
| BL-0018 | Data correction banner (per-scenario)                                                                      | P1       | S      | `/operations/deployment-checklist.md` §8           | proposed | Component spec exists, not implemented                                                                                                                                       |
| BL-0019 | Statuspage automation from synthetic probes                                                                | P2       | S      | `/operations/monitoring-and-observability.md` §2   | proposed | After D14 observability ships                                                                                                                                                |
| BL-0020 | Coupon / discount handling in Stripe                                                                       | P2       | M      | `/product/pricing-and-gating.md`                   | proposed | Post-RC                                                                                                                                                                      |
| BL-0021 | Annual billing toggle                                                                                      | P2       | S      | `/product/pricing-and-gating.md`                   | proposed | Post-RC                                                                                                                                                                      |
| BL-0022 | Migrate Next.js 14.2.29 → 15.x                                                                             | P0       | M      | DEF-0001                                           | proposed | Target Day 2 or Day 8; decide morning Day 2                                                                                                                                  |
| BL-0023 | Investigate partition strategy for managed Postgres                                                        | P2       | M      | DEV-0011                                           | proposed | pg_cron manual vs declarative; re-evaluate Day 14                                                                                                                            |
| BL-0024 | VIC FY2026 land tax ruleset: tax-advisor + legal sign-off before publishing                                | P0       | S      | DEF-0003                                           | proposed | Blocking: fy2026.json must stay `draft` until signed off; no new scenarios until published                                                                                   |
| BL-0025 | Surface ruleset status in scenario_results + UI disclaimer + Day 15 deploy gate                            | P0       | M      | ADR-0011                                           | proposed | Blocks production: deploy gate must verify all rulesets in use are `published`; UI shows "provisional" banner for draft                                                      |
| BL-0026 | Move test-only rulesets (fy2026-variant.json) out of src/tax/ruleset/data/                                 | P1       | XS     | ADR-0011                                           | proposed | Track B or later; test fixtures must not be enumerable by production resolution                                                                                              |
| BL-0027 | Verify FY2026 Medicare low-income thresholds against ATO; correct fy2026.json if wrong                     | P1       | XS     | DEV-0021                                           | proposed | Blocks BL-0024 sign-off and BL-0025 deploy gate; fy2026.json MUST NOT reach `published` with an unverified threshold                                                         |
| BL-0028 | Add CG-XV tests anchored to ≥2 ATO worked examples; gate CGT publish on verified dollar-amount cross-check | P1       | XS     | DEV-0022                                           | proposed | Blocks BL-0024 sign-off and BL-0025 deploy gate; CGT ruleset MUST NOT reach `published` without ATO dollar-amount cross-check or documented human verification               |
| BL-0029 | Postgres RLS isolation integration tests — cross-tenant JWT probe against real Supabase                    | P0       | S      | D08-T4 (app-layer scoping only)                    | proposed | **LAUNCH BLOCKER.** App-layer `user_id`/`org_id` filters are the only tested tenancy net until this lands. Every D9–D12 route rides on untested-in-depth RLS. Target Day 13. |
| BL-0030 | OpenAI fallback in AI gateway — structural stub, never functionally exercised                              | P1       | S      | D11-T3 (Q1=A decision)                             | proposed | Fallback path exists in code but has never been run against real OpenAI API; unknown whether it produces a valid, grounded explanation. Functionally test before RC.         |

---

### BL-0030 — OpenAI fallback in AI gateway: structural stub, never functionally exercised

- **Priority**: P1
- **Effort**: S (2–4h)
- **Status**: proposed
- **Origin**: D11-T3 — Q1=A decision accepted structural-only fallback; fallback branch exists in `gateway.ts` but calls no real OpenAI endpoint in tests

**Description**

`server/ai/gateway.ts` contains a structural OpenAI fallback path (reached when Anthropic returns a non-retryable error). This path has never been invoked against a real OpenAI endpoint; all gateway tests mock the Anthropic client. Before RC:

1. Provision an OpenAI key in the staging environment
2. Write at least one integration test that forces the Anthropic client to fail and verifies the fallback produces a grounded, schema-valid explanation
3. Confirm the `fallback_used = true` flag is written to `ai_interactions`

**Why this matters**: If the fallback fires in production and is broken, the user sees an unhandled error instead of the 'explanation unavailable' suppression path.

**Acceptance criteria**

- [ ] Fallback path exercised against real OpenAI (staging)
- [ ] `fallback_used = true` in `ai_interactions` on fallback path
- [ ] Grounding gate still applies on fallback response
- [ ] No regression in existing unit tests

**Linked records**: D11-T3 | BL-0029

---

### BL-0029 — Postgres RLS isolation integration tests

- **Priority**: P0 — **LAUNCH BLOCKER**
- **Effort**: S (2–4h)
- **Status**: proposed
- **Origin**: D08-T4 — contract tests use app-layer `user_id`/`org_id` query filters and mocked Supabase; real cross-tenant JWT isolation has never been exercised against a live Supabase instance

**Description**
The D08-T4 contract tests prove that the application code always passes the correct `user_id`/`org_id` filter to the query. They do NOT prove that Supabase's Row-Level Security policies actually block a JWT belonging to User A from reading User B's rows when the application-layer filter is absent or wrong.

Until this item lands, a query bug (wrong `.eq()` field, typo in column name, or a future route that omits the filter) would silently leak cross-tenant data. App-layer filtering is a defence-in-depth measure; RLS is the authoritative enforcement layer.

Every route added in Days 9–12 rides on untested-in-depth RLS until Day 13.

**What is required**

1. A real Supabase project (staging env) with test data seeded for two users in two different orgs.
2. An integration test suite (`apps/web/__tests__/rls-isolation.integration.test.ts`) that:
   - Mints a Supabase JWT for User A and User B via the service-role key
   - Uses each JWT in a `getRlsAwareClient()` call
   - Asserts that User A's client cannot read, update, or delete User B's rows in: `portfolios`, `properties`, `scenarios`, `scenario_results`, `loans`, `income_records`, `expense_records`
   - Asserts the materialised view `portfolio_summary` is similarly isolated

**Acceptance criteria**

- Integration tests pass in CI against the staging Supabase project
- CI job is gated (not `continue-on-error`) — a cross-tenant read causes the job to fail
- Every table that has a `user_id` or `org_id` column and an RLS policy is covered
- DEV-0023 (Next.js migration, Day 13) can share the same staging environment

**Blocking note**
This item MUST land on Day 13 before any Day 14/15 hardening. It gates the production deploy checklist (`/operations/deployment-checklist.md`).

**Linked records**: D08-T4 | BL-0025 | ADR-0011

---

### BL-0028 — Add CG-XV tests anchored to ≥2 ATO worked examples

- **Priority**: P1
- **Effort**: XS (<2h)
- **Status**: proposed
- **Origin**: DEV-0022 (ATO CGT pages return HTTP 403 in automated access)

**Description**
The CGT engine's golden derivations (cgt-golden-01/02/03) are anchored to ITAA 1997 legislation (s115-25, s115-100, s110-45). The rates and ordering rules are verified from primary legislation. However, the expected dollar values in CG-01/CG-03/CG-12 goldens are computed from self-constructed scenarios — the ATO has not published those specific dollar figures.

The accepted bar (same as TX-XV and LT-XV) requires ≥2 independent ATO worked examples where the ATO (or an ATO-equivalent authoritative source) publishes a specific input scenario with a specific dollar output, and the engine is tested to reproduce that exact output.

ATO CGT example pages return HTTP 403 in automated access. Human access is required.

**Action required**
Access any of:

- ATO CGT Guide (NAT 4151 or current equivalent) — has specific worked examples in chapters on discount calculation and joint ownership
- ATO individual tax return instructions CGT supplement (published annually)
- ATO online CGT calculator — run ≥2 scenarios and note the outputs

For each ATO example: record the input parameters (acquisition date, disposal date, cost base elements, selling costs, prior losses, entity type) and the ATO-published taxable gain. Add `CG-XV-01` and `CG-XV-02` test cases in `packages/engine/test/cgt/cgt.test.ts` with the ATO-sourced expected values and a citation (URL + retrieval date) in `packages/engine/test/fixtures/cgt/`.

**Acceptance criteria**

- ≥2 `CG-XV` test cases present in `cgt.test.ts`, each citing an ATO source with retrieval date
- Expected values come from ATO-published output, not self-computed
- Golden derivation `.md` files reference the ATO source URL and show the ATO's dollar figure alongside the engine's bigint derivation
- DEV-0022 closed
- Full suite GREEN

**Blocking note**
The CGT ruleset MUST NOT reach `published` without either:
(a) CG-XV tests passing against ATO-published dollar amounts, OR
(b) A documented human verification (reviewer name + date + ATO source cited) attesting the engine output matches the ATO's published figures for ≥2 scenarios.

**Linked records**: DEV-0022 | BL-0024 | BL-0025

---

### BL-0027 — Verify FY2026 Medicare low-income thresholds against ATO

- **Priority**: P1
- **Effort**: XS (<2h)
- **Status**: proposed
- **Origin**: DEV-0021 (unverified threshold; ATO returned 403 in automated access)

**Description**
`fy2026.json` `singleThresholdCents` ($27,168) and `familyThresholdCents` ($45,840) are
not verified against the ATO-published Medicare levy low-income reduction thresholds for
FY2026 (2025-26). A secondary source (etax.com.au) shows $27,222/$45,907 — a $54/$67
discrepancy. The thresholds are indexed upward annually; $27,168 may be a prior-year value.

This item blocks BL-0024 (tax-advisor + legal sign-off) and BL-0025 (Day 15 deploy gate).
The fy2026.json ruleset MUST NOT reach `published` with an unverified Medicare threshold.

**ATO page to check**:
https://www.ato.gov.au/individuals-and-families/medicare-levy/how-much-medicare-levy-you-pay

**Acceptance criteria**

- ATO FY2026 (2025-26) single threshold confirmed to the dollar
- ATO FY2026 family threshold confirmed to the dollar
- fy2026.json updated if values differ from current $27,168/$45,840
- TX-11 (`$27,168 exactly → 0`) updated to use confirmed threshold as input
- Source citation in fy2026.json updated with confirmed retrieval date
- DEV-0021 closed

**Linked records**: DEV-0021 | BL-0024 | BL-0025

---

### BL-0023 — Investigate partition strategy for managed Postgres

- **Priority**: P2
- **Effort**: M (~1 day)
- **Status**: proposed
- **Origin**: DEV-0011 (pg_partman unavailable on Supabase managed Postgres PG17)

**Description**
`scenario_results` and `audit_logs` are range-partitioned tables. pg_partman (the originally specified automation layer) is unavailable on Supabase managed Postgres. Both tables currently have a single DEFAULT partition. Investigate and implement a sustainable partition strategy for the managed environment — either `pg_cron`-driven manual monthly partition creation or acceptance of single-partition operation with explicit monitoring.

**Acceptance criteria**

- Chosen strategy documented and implemented before data volume exceeds 3 months of production load
- Monthly partitions exist (or strategy explicitly accepted with query-plan evidence)
- Query on `scenario_results WHERE created_at BETWEEN ...` uses partition pruning (EXPLAIN shows partition filter)
- No data loss during partition migration from DEFAULT to date-ranged partitions

**Linked records**: DEV-0011

---

### BL-0022 — Migrate Next.js 14.2.29 → 15.x

- **Priority**: P0
- **Effort**: M (~1 day)
- **Status**: proposed
- **Origin**: DEF-0001 (7 high-severity CVEs in next@14.2.29)

**Description**
Upgrade `apps/web` from Next.js 14.2.29 to the latest Next.js 15.x release (≥15.5.16) to eliminate all high-severity CVEs identified in DEF-0001. Migration involves: App Router API compatibility review, React 19 peer dependency, `eslint-config-next` version bump, potential breaking changes in caching behaviour and async request APIs.

**Acceptance criteria**

- `pnpm audit --audit-level=high` exits 0 with no Next.js findings
- All existing typecheck, lint, and test checks pass
- Health endpoint (`/api/health`) returns 200
- No regressions in App Router pages

**Decision gate**
Morning of Day 2: decide whether to execute immediately (Day 2 scope) or defer to Day 8 (pre-UI feature work begins). P0 means it cannot slip past Day 8.

---

### BL-0025 — Surface ruleset status in scenario_results + UI disclaimer + Day 15 deploy gate

- **Priority**: P0
- **Effort**: M (~1 day)
- **Status**: proposed
- **Origin**: ADR-0011 (pre-release phase controls), DEV-0019

**Description**
Three connected controls that make draft-in-build safe and production-safe:

1. **scenario_results schema** — add a `ruleset_status` column (type: `text`, check in `('draft','staged','published','retired')`). The engine's `runScenario` function currently stamps `ruleset_version`; it must also stamp `ruleset_status` from `Ruleset.status`. Every scenario computed against a draft ruleset is permanently marked as such.

2. **UI disclaimer** — any scenario result where `ruleset_status !== 'published'` must render a visible "provisional — draft tax rules apply, rates subject to change" banner. This prevents users from treating draft-computed figures as legally final.

3. **Day 15 deployment gate** — a pre-deploy check (CI step or migration guard) that queries the DB and asserts: for every `financialYear` referenced in production, at least one `published` ruleset row exists. The gate must not pass if only `draft` rulesets are present, regardless of `ALLOW_DRAFT_RULESETS`. This is the structural enforcement that ADR-0011 §Pre-release Phase describes.

**Acceptance criteria**

- `scenario_results.ruleset_status` column present and non-null on every row
- UI renders disclaimer when `ruleset_status !== 'published'` (screenshot in PR)
- `pnpm run deploy-gate` (or equivalent CI step) fails when only draft rulesets exist
- `pnpm run deploy-gate` passes when at least one published ruleset exists per FY
- Existing test suite remains GREEN

**Linked records**: ADR-0011, BL-0024, DEV-0019

---

### BL-0026 — Move test-only rulesets out of src/tax/ruleset/data/

- **Priority**: P1
- **Effort**: XS (<2h)
- **Status**: proposed
- **Origin**: ADR-0011, DEV-0019

**Description**
`fy2026-variant.json` exists solely as a determinism test fixture (RB-03: proves that different `rateBps` produce different `output_hash`). It lives in `src/tax/ruleset/data/`, the same directory that `defaultRulesetAdapter` enumerates. In production, the resolver must never see test-only variants.

Move `fy2026-variant.json` to `packages/engine/test/fixtures/rulesets/` (or equivalent). Update `ruleset-binding.test.ts` to import from the new path. The provenance guard test already excludes `*.schema.json`; update it to also exclude a `test-fixtures/` prefix if the new path is under the data dir, or simply remove the file from the data dir.

**Acceptance criteria**

- `src/tax/ruleset/data/` contains only production-candidate rulesets
- `fy2026-variant.json` importable by its test file from the new location
- Provenance guard test still passes (covers only `src/tax/ruleset/data/`)
- Full suite GREEN

**Linked records**: ADR-0011

---

## In Plan (Currently in a Daily Execution Prompt)

| ID      | Title | Day | Task ID | Status |
| ------- | ----- | --- | ------- | ------ |
| _empty_ |       |     |         |        |

---

## Done

| ID      | Title | Day completed | Closing commit | Evidence path |
| ------- | ----- | ------------- | -------------- | ------------- |
| _empty_ |       |               |                |               |

---

## Dropped

| ID      | Title | Reason | Decided by | Date |
| ------- | ----- | ------ | ---------- | ---- |
| _empty_ |       |        |            |      |

---

## Triage Notes

- P0 items must enter `in_plan` no later than Day 13. Any P0 still in `proposed` on Day 13 morning forces a 15-day plan revision.
- P1 items are evaluated on Day 14 for D15 inclusion.
- P2 items are reviewed once at the end of the 15-day cycle; none enter the spine.
