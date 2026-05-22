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

| ID       | Severity | Surface | Title                                                                  | Opened day | Status | Owner | Notes                                                        |
| -------- | -------- | ------- | ---------------------------------------------------------------------- | ---------- | ------ | ----- | ------------------------------------------------------------ |
| DEF-0001 | sev2     | web     | Next.js 14.2.29 carries 7 high-severity CVEs requiring 14→15 migration | Day 01     | open   | Opus  | Parked via audit-exceptions until 2026-05-27 (Day 8); D02-T1 |

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
