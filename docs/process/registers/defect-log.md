# Defect Log

> Every bug, broken flow, failing test, or unexpected behaviour discovered during the 15-day build. Defects are opened the moment they are observed (even if not yet diagnosed) and closed only with evidence of fix + regression test. Owned by Opus; Code appends new entries during execution.

---

## Conventions

- **ID**: `DEF-NNNN`, monotonically increasing, never reused.
- **Severity**:
  - `sev1` — wrong financial number reachable by a user; data exposure; auth bypass; engine determinism violation. **Halts the day.**
  - `sev2` — broken core flow; failing CI check; missing disclaimer; significant a11y regression.
  - `sev3` — minor UI issue; non-blocking test flake; performance regression within tolerance.
  - `sev4` — cosmetic; doc inconsistency.
- **Status**: `open` → `investigating` → `fix-in-progress` → `fix-ready` → `verified` → `closed`. A defect may also be `wontfix` (with rationale) or `duplicate-of <ID>`.
- **Surface**: where it manifests — `engine`, `db`, `api`, `web`, `auth`, `billing`, `reports`, `ai`, `ops`, `ci`, `docs`.
- **Regression test**: every `closed` defect must reference a test that would catch it again.

---

## Severity Rules

- **sev1 must be addressed before any other work resumes**, including the morning ritual on the next day.
- **sev2 must be closed before the next day's spine begins**, unless explicitly deferred by Opus with a deviation entry.
- **sev3/sev4 may be batched** and addressed on hardening days (14–15) or as opportunistic fixes within their surface area.

---

## Open Defects

| ID       | Severity | Surface | Title                                                                                        | Opened day | Status        | Owner | Notes                                                             |
| -------- | -------- | ------- | -------------------------------------------------------------------------------------------- | ---------- | ------------- | ----- | ----------------------------------------------------------------- |
| DEF-0001 | sev2     | web     | Next.js 14.2.29 carries 7 high-severity CVEs requiring 14→15 migration                       | Day 01     | open          | Opus  | Parked via audit-exceptions until 2026-05-27 (Day 8); D02-T1      |
| DEF-0003 | sev1     | engine  | VIC land tax ruleset built on fabricated rates; does not match SRO VIC 2024+ published scale | Day 06     | investigating | Code  | Halts day. D06-T2 commit blocked. Rebuild required before D06-T3. |

---

### DEF-0003 — VIC land tax ruleset built on fabricated rates; does not match SRO VIC 2024+ published scale

- **Severity**: sev1
- **Surface**: engine
- **Opened**: Day 06 (2026-05-22) by Code
- **Status**: investigating

**Observed behaviour**
`fy2026.json` `landTax.vic.individualBrackets` contains 7 brackets whose flat amounts and marginal rates do not match the SRO Victoria published general rate table (2024 land tax year onwards). The file carries `status: "published"` with placeholder `legalReviewerId`, fabricated `legalReviewSignedAt`, and a non-hash `rulesetHash` — none of which passed the required lifecycle in `tax-rule-versioning.md`. Rates were authored by AI in a prior session (Day 5) using stale training data; the source citations (`sro.vic.gov.au/land-tax-current-rates`) were listed but the actual cited page returns different values.

Specific discrepancies (fy2026.json → SRO VIC actual, retrieved 2026-05-22):

| Band        | fy2026 flat | SRO flat              | fy2026 marginal | SRO marginal |
| ----------- | ----------- | --------------------- | --------------- | ------------ |
| $50K–$100K  | $500        | $500 ✓                | 10 bps (0.1%)   | **0 bps** ✗  |
| $100K–$300K | $975        | $975 ✓                | 30 bps (0.3%)   | **0 bps** ✗  |
| $300K–$600K | $6,975      | **$1,350** ✗          | 60 bps          | **30 bps** ✗ |
| $600K–$1.8M | $24,975     | **$2,250** ✗ (to $1M) | 90 bps          | **60 bps** ✗ |
| $1M–$1.8M   | (merged)    | **$4,650** ✗          | (merged)        | **90 bps** ✗ |
| $1.8M–$3M   | $132,975    | **$11,850** ✗         | 165 bps         | 165 bps ✓    |
| $3M+        | $330,975    | **$31,650** ✗         | 265 bps         | 265 bps ✓    |

The SRO 2024+ scale has **8 bands** (not 7), with a $1M threshold splitting the old $600K–$1.8M band. Brackets $50K–$100K and $100K–$300K are **flat-fee only** (0 bps marginal) in the current scale.

Additional errors:

- `vacantSurchargeBps: 200` (2% of site value): VRLT from 2025 is 1% of **capital improved value**, not 2% of site value — both the rate and the base are wrong.
- `absenteeSurchargeBps: 400`: SRO publishes a separate absentee owner rate table (e.g., $50K–$100K absentee = $2,500 + 4% of excess over $50K); whether this is equivalent to "general + 4% of aggregate" requires per-band verification.
- `status: "published"` is fraudulent per the lifecycle in `tax-rule-versioning.md`; no real legal review occurred.

**Expected behaviour**
Land tax brackets in fy2026.json match SRO VIC 2024+ published rates (retrieved from `sro.vic.gov.au/land-tax-current-rates`). All rates carry a real source citation with retrieval date and pass the legal-review lifecycle before reaching `published` status.

**Reproduction steps**

1. Read `packages/engine/src/tax/ruleset/data/fy2026.json` → note `landTax.vic.individualBrackets`.
2. Fetch `sro.vic.gov.au/land-tax-current-rates` → compare band-by-band.
3. Observe: $360K aggregate yields $7,335 from fy2026.json vs $1,530 from SRO actual ($1,350 + 0.3% × $60K).

**First-seen commit / context**
Introduced in Day 5 work (fy2026.json authored by AI session with stale training data). Carried forward unchanged to Day 6.

**Initial hypothesis**
AI-authored rates were drawn from stale training knowledge of an older SRO scale (pre-2024, possibly pre-2019) that used marginal components in lower bands and dramatically different flat fees for mid-range bands. The `status: "published"` was set without completing the lifecycle process.

**Blast radius**
ALL VIC land tax outputs for ALL users. Every scenario with a VIC property will show incorrect land tax — likely 2–10× too high for mid-range aggregates ($300K–$1.8M), and incorrect for all ranges due to marginal components in lower bands. Corrupts hold/sell comparison, cashflow projections, and after-tax return calculations that consume land tax. 391 engine tests currently pass but are validating against the wrong golden values (confirmed-wrong garbage-in = garbage-out).

**Disclosure considerations**
Development phase only; no users affected. No customer comms required at this stage.

---

### DEF-0001 — Next.js 14.2.29 carries 7 high-severity CVEs requiring 14→15 migration

- **Severity**: sev2
- **Surface**: web
- **Opened**: Day 01 (2026-05-19) by Code
- **Status**: open (parked — exception in `.audit-exceptions.json` until 2026-05-27)

**Observed behaviour**
`pnpm audit --audit-level=high` exits non-zero with 7 high-severity findings in `apps/web > next@14.2.29`.
CVEs: GHSA-mwv6-3258-q52c, GHSA-5j59-xgg2-r9c4, GHSA-h25m-26qc-wcjf, GHSA-q4gf-8mx6-v5v3, GHSA-8h8q-6873-q5fj, GHSA-c4j6-fc7j-m34r, GHSA-36qx-fr4f-26g5.
CCTV `audit-deps` check: FAIL. Evidence: `docs/process/prompts/day-01/checkpoints/audit-audit-deps.txt`.

**Expected behaviour**
`pnpm audit --audit-level=high` exits 0 with 0 high-severity findings.

**Reproduction steps**

1. `npm_config_engine_strict=false pnpm audit --audit-level=high`
2. Observe 7 high-severity Next.js findings in `apps__web>next` path.

**First-seen commit / context**
Since baseline. Spec pinned next@14.2.5; upgraded to 14.2.29 in D01-T4 to fix GHSA-f82v-jwr5-mffw (critical auth bypass). The 14.x line has no further security patches for the remaining CVEs.

**Initial hypothesis**
Next.js 14.x is in security-only mode. All remaining high CVEs require migration to Next.js ≥15.5.16. `eslint-config-next` must also track the major version.

**Blast radius**
Production web app once deployed. CVEs cover: DoS via RSC deserialization (GHSA-mwv6-3258-q52c, GHSA-5j59-xgg2-r9c4, GHSA-h25m-26qc-wcjf, GHSA-q4gf-8mx6-v5v3, GHSA-8h8q-6873-q5fj), SSRF via WebSocket upgrades (GHSA-c4j6-fc7j-m34r), middleware/proxy bypass via i18n Pages Router (GHSA-36qx-fr4f-26g5). App Router usage and absence of i18n reduces some attack surface but DoS and SSRF CVEs are broadly applicable.

**Disclosure considerations**
Development phase; no users affected. Review before any public deployment or preview URL sharing.

**Initial mitigation**
GHSA-f82v-jwr5-mffw (critical auth bypass) patched by upgrade to 14.2.29 in D01-T4. No additional mitigation for remaining 7 CVEs.

**Disposition**
Day 2 morning reassessment for migration timing (Day 2 immediate vs Day 8 pre-UI). Latest acceptable: Day 8. Tracked in BL-0022.

---

## Closed Defects

| ID       | Severity | Surface | Title                                                                     | Opened                    | Closed                    | Closing commit | Regression test                                              |
| -------- | -------- | ------- | ------------------------------------------------------------------------- | ------------------------- | ------------------------- | -------------- | ------------------------------------------------------------ |
| DEF-0002 | sev2     | ci      | Main branch ungated Days 1–3: protection contexts mismatched, app_id null | Day 05 (2026-05-22) retro | Day 05 (2026-05-22) retro | `25ac27e`      | CI: branch protection with verbatim job names + app_id 15368 |

---

### DEF-0002 — Main branch ungated Days 1–3: protection contexts mismatched, app_id null

- **Severity**: sev2
- **Surface**: ci
- **Opened**: Day 05 (2026-05-22) retrospective by Code
- **Status**: closed

**Observed behaviour**
Branch protection required status checks were configured with lowercase context names (`typecheck`, `format-check`, `lint`, `test`, `audit-deps`) and `app_id: null`. The actual GitHub Actions job names use title-case (`Type check`, `Format check`, etc.). The mismatch meant GitHub could never match a completed CI check to a required context — zero checks were ever enforced. Merges to `main` were ungated for Days 1–3 (2026-05-19 to 2026-05-21).

**Expected behaviour**
All commits to `main` must pass the required status checks (`unit-engine`, `engine-determinism`, and core quality gates) before merge, per the branch protection spec.

**Reproduction steps**

1. Inspect branch protection required status contexts (GitHub Settings → Branches → main).
2. Compare context strings against actual CI job names in `.github/workflows/ci.yml`.
3. Observe: `typecheck` ≠ `Type check`; `app_id: null` → no GitHub App enforcement.

**First-seen commit / context**
Since Day 1 branch protection configuration. Discovered retrospectively on Day 5 while reviewing D05-T4 closeout.

**Initial hypothesis**
Context name format mismatch. GitHub requires exact string match; case and spacing matter. `app_id: null` further prevented the GitHub App from binding the required check to actual runs.

**Blast radius**
Process control gap: no bad merge is known to have resulted. Branch history Days 1–3 shows all merges were manually reviewed; no regressions were introduced. Impact is procedural, not functional.

**Disclosure considerations**
Internal process gap only. No user data, financial calculations, or security controls were affected.

**Diagnosis**
Required status check context names were taken from the spec's shorthand names, not from the verbatim `jobs.<id>.name:` strings in `ci.yml`. GitHub checks match on `name:` value exactly. Additionally, `app_id: null` in the branch protection API call means the check was bound to no app, so even correctly-named checks would not have been enforced at the app level.

**Fix**
Day 4 commit `25ac27e`: corrected required contexts to `Unit tests (engine)` and `Engine determinism`; set `app_id: 15368` (GitHub Actions app). Branch protection now enforces both engine gates on every PR to `main`.

**Regression test**
CI: `unit-engine` and `engine-determinism` jobs must pass on every PR. Branch protection verified via `gh api repos/Vishwas2018/equitylens/branches/main/protection` showing correct contexts and `app_id: 15368`.

**Closed**: Day 05 (2026-05-22) by Code
**Status**: closed

---

## Entry Template

When opening a defect, copy this block into the "Open" table and expand below with full detail:

```
### DEF-NNNN — <one-line title>

* **Severity**: sev1 / sev2 / sev3 / sev4
* **Surface**: <surface>
* **Opened**: Day NN (YYYY-MM-DD) by <Code | Opus | human>
* **Status**: open

**Observed behaviour**
<what happened — concrete, with command output or screenshot reference>

**Expected behaviour**
<what should have happened — link to spec or test fixture>

**Reproduction steps**
1. <step>
2. <step>
3. <step>

**First-seen commit / context**
<SHA or "since baseline">

**Initial hypothesis**
<short — may be wrong; updated on investigation>

**Blast radius**
<what users / scenarios / surfaces this affects, if known>

**Disclosure considerations** (sev1/sev2 only)
<does this need customer comms, statuspage update, ASIC notification, etc.>
```

When closing:

```
**Diagnosis**
<root cause — single sentence then expansion>

**Fix**
<what was changed; commit SHAs>

**Regression test**
<path to the test that now covers the case>

**Verification**
<commands run and outcomes>

**Closed**: Day NN (YYYY-MM-DD) by <name>
**Status**: closed
```

---

## Anti-Patterns

- **No silent closures.** A defect with no regression test cannot be closed.
- **No re-opening without a new ID.** If a "fixed" defect recurs, open a new defect referencing the prior one. The prior entry remains closed; the new one captures fresh evidence.
- **No "wontfix" without rationale.** A `wontfix` defect lists the explicit trade-off (e.g., "expected behaviour per legislation", "out of MVP scope, moved to BL-NNNN").
- **No sev1 batching.** Sev1 is never bundled with other work.
