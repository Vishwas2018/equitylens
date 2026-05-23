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

| ID      | Title                                                                                  | Priority | Effort | Origin                                             | Status   | Notes                                                                                                                   |
| ------- | -------------------------------------------------------------------------------------- | -------- | ------ | -------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------- |
| BL-0001 | Adviser webhook delivery channel                                                       | P2       | M      | `/reports-exports/scheduling-and-delivery.md` §6.4 | proposed | Post-RC; Professional tier only                                                                                         |
| BL-0002 | XLSX export format                                                                     | P2       | S      | `/reports-exports/export-templates.md` §7          | proposed | After CSV templates stable                                                                                              |
| BL-0003 | Scheduled exports (cron-driven)                                                        | P2       | M      | `/reports-exports/scheduling-and-delivery.md` §7   | proposed | Pro+ tier; requires Day 13 entitlements                                                                                 |
| BL-0004 | Data export full (APP 12) JSON bundle                                                  | P1       | M      | `/architecture/security-and-compliance.md` §APP 12 | proposed | Day 15 walkthrough must exercise                                                                                        |
| BL-0005 | SSO / SAML for Enterprise tier                                                         | P2       | L      | `/product/prd.md`                                  | proposed | Post-RC                                                                                                                 |
| BL-0006 | Multi-factor authentication (TOTP)                                                     | P1       | M      | Security review                                    | proposed | RC nice-to-have if time allows on D15                                                                                   |
| BL-0007 | Magic-link sign-in                                                                     | P2       | S      | `/architecture/system-architecture.md`             | proposed | Disabled by default per D3 spec                                                                                         |
| BL-0008 | Non-Victorian state land tax modules                                                   | P2       | L      | `/engine/test-matrix.md`                           | proposed | Post-RC; VIC only for MVP                                                                                               |
| BL-0009 | Trust / SMSF ownership structure modelling                                             | P1       | L      | Persona research                                   | proposed | Affects CGT discount eligibility logic                                                                                  |
| BL-0010 | Federal land tax forecast (hypothetical)                                               | P2       | M      | Product strategy                                   | proposed | Speculative; gated behind feature flag                                                                                  |
| BL-0011 | Multi-currency support (NZD, USD secondary)                                            | P2       | L      | Product strategy                                   | proposed | Post-RC                                                                                                                 |
| BL-0012 | Free-form AI chat surface                                                              | P2       | M      | `/architecture/ai-integration.md`                  | proposed | Risk: grounding harder; gated behind flag                                                                               |
| BL-0013 | AI-generated explanation in reports                                                    | P2       | M      | Stakeholder request                                | proposed | Must preserve no-AI-calculation rule                                                                                    |
| BL-0014 | Adviser pack PDF (multi-doc bundle)                                                    | P1       | M      | `/reports-exports/export-templates.md` §2.1        | proposed | After core PDFs ship on D12                                                                                             |
| BL-0015 | Bulk property import (CSV)                                                             | P1       | S      | Persona research                                   | proposed | Free + Pro                                                                                                              |
| BL-0016 | OAuth: Google + Microsoft                                                              | P2       | M      | Growth                                             | proposed | Post-RC                                                                                                                 |
| BL-0017 | In-app changelog / "What's New" panel                                                  | P1       | XS     | `/operations/deployment-checklist.md` §8           | proposed | Used by tax ruleset publishes                                                                                           |
| BL-0018 | Data correction banner (per-scenario)                                                  | P1       | S      | `/operations/deployment-checklist.md` §8           | proposed | Component spec exists, not implemented                                                                                  |
| BL-0019 | Statuspage automation from synthetic probes                                            | P2       | S      | `/operations/monitoring-and-observability.md` §2   | proposed | After D14 observability ships                                                                                           |
| BL-0020 | Coupon / discount handling in Stripe                                                   | P2       | M      | `/product/pricing-and-gating.md`                   | proposed | Post-RC                                                                                                                 |
| BL-0021 | Annual billing toggle                                                                  | P2       | S      | `/product/pricing-and-gating.md`                   | proposed | Post-RC                                                                                                                 |
| BL-0022 | Migrate Next.js 14.2.29 → 15.x                                                         | P0       | M      | DEF-0001                                           | proposed | Target Day 2 or Day 8; decide morning Day 2                                                                             |
| BL-0023 | Investigate partition strategy for managed Postgres                                    | P2       | M      | DEV-0011                                           | proposed | pg_cron manual vs declarative; re-evaluate Day 14                                                                       |
| BL-0024 | VIC FY2026 land tax ruleset: tax-advisor + legal sign-off before publishing            | P0       | S      | DEF-0003                                           | proposed | Blocking: fy2026.json must stay `draft` until signed off; no new scenarios until published                              |
| BL-0025 | Surface ruleset status in scenario_results + UI disclaimer + Day 15 deploy gate        | P0       | M      | ADR-0011                                           | proposed | Blocks production: deploy gate must verify all rulesets in use are `published`; UI shows "provisional" banner for draft |
| BL-0026 | Move test-only rulesets (fy2026-variant.json) out of src/tax/ruleset/data/             | P1       | XS     | ADR-0011                                           | proposed | Track B or later; test fixtures must not be enumerable by production resolution                                         |
| BL-0027 | Verify FY2026 Medicare low-income thresholds against ATO; correct fy2026.json if wrong | P1       | XS     | DEV-0021                                           | proposed | Blocks BL-0024 sign-off and BL-0025 deploy gate; fy2026.json MUST NOT reach `published` with an unverified threshold    |

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
