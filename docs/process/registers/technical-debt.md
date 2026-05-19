# Technical Debt Register

> Known shortcuts, suboptimal implementations, and "we'll fix this later" items. Each entry has a cost (what's missing, what's worse-than-ideal), an interest rate (how it gets worse over time), and a payoff plan. Debt is acceptable; **untracked** debt is not. Owned by Opus; Code appends entries when shortcuts are taken during execution.

---

## Conventions

- **ID**: `TD-NNNN`, monotonically increasing.
- **Category**: `engine` / `db` / `api` / `web` / `auth` / `billing` / `reports` / `ai` / `ops` / `ci` / `docs` / `tests`.
- **Severity**: `low` (cosmetic / minor inefficiency) / `medium` (creates friction; bounded) / `high` (will block future work or harm correctness if not addressed).
- **Status**: `open` / `scheduled` (in a future day's plan or backlog) / `paid` (resolved).
- **Interest**: a short note on how the debt compounds — "blocks D11", "doubles refactor cost per new endpoint", "degrades a11y score over time".

---

## Severity Triggers

- **High** debt added in a single day requires an ADR if it lasts beyond that day.
- Any high debt at start of Day 14 forces a Day 14 priority shift to pay it down.
- No release candidate may carry **high** debt at end of Day 15.

---

## Open Debt

| ID      | Category | Severity | Title                                                                            | Opened day | Status    | Linked   |
| ------- | -------- | -------- | -------------------------------------------------------------------------------- | ---------- | --------- | -------- |
| TD-0001 | ci       | low      | migration-status / migration-dryrun CI checks not yet wired                      | Day 01     | scheduled | N/A      |
| TD-0002 | ci       | low      | rls-coverage / cross-tenant-probe CI checks not yet wired                        | Day 01     | scheduled | N/A      |
| TD-0003 | ci       | low      | region-check CI check not yet wired                                              | Day 01     | scheduled | N/A      |
| TD-0004 | ci       | low      | engine-determinism / ato-fixture-canary CI checks not yet wired                  | Day 01     | scheduled | N/A      |
| TD-0005 | ci       | low      | bundle-budgets / a11y / disclaimer-audit CI checks not yet wired                 | Day 01     | scheduled | N/A      |
| TD-0006 | ci       | low      | secret-scan CI check not yet wired                                               | Day 01     | scheduled | N/A      |
| TD-0007 | ci       | low      | prettier reformat noise mixed with config signal in D01-T3 commit                | Day 01     | open      | N/A      |
| TD-0008 | ci       | medium   | audit-deps check has no exception mechanism; long-tail CVEs cause persistent red | Day 01     | open      | DEF-0001 |

---

### TD-0001 — migration-status / migration-dryrun CI checks not yet wired

- **Category**: ci
- **Severity**: low
- **Opened**: Day 01
- **Status**: scheduled (wired Day 2)
- **Linked**: N/A

**What's the debt?**
`migration-status` and `migration-dryrun` CCTV checks are registered as `skipped` with `wiredDay: 2`. No CI job enforces them yet.

**Why was it taken on?**
Database migrations don't exist on Day 1; wiring the check before the schema exists would always fail.

**Cost right now**
CCTV reports show these as SKIPPED. Migration regressions would not be caught in CI.

**Interest**: Blocks database work if not wired by Day 2; any migration pushed without dry-run validation is a rollback risk.

**Trigger to repay**: Day 2 (first migration shipped).

**Payoff plan**: Add `pnpm migrate:status` and `pnpm migrate:dryrun` scripts in Day 2; update `runWiredChecks()` to remove the `skipped()` entries and replace with live commands.

**Estimate**: XS

---

### TD-0002 — rls-coverage / cross-tenant-probe CI checks not yet wired

- **Category**: ci
- **Severity**: low
- **Opened**: Day 01
- **Status**: scheduled (wired Day 2)
- **Linked**: N/A

**What's the debt?**
`rls-coverage` and `cross-tenant-probe` CCTV checks registered as skipped. No RLS policies exist yet.

**Why was it taken on?**
RLS policies are a Day 2+ deliverable; they don't exist at repo bootstrap.

**Cost right now**
Tenant-data isolation not verified in CI.

**Interest**: Any RLS regression after Day 2 would be invisible in CI until wired.

**Trigger to repay**: Day 2 (first RLS policy shipped).

**Payoff plan**: Wire commands in `runWiredChecks()` when Supabase schema and RLS policies exist.

**Estimate**: XS

---

### TD-0003 — region-check CI check not yet wired

- **Category**: ci
- **Severity**: low
- **Opened**: Day 01
- **Status**: scheduled (wired Day 2)
- **Linked**: N/A

**What's the debt?**
`region-check` CCTV check skipped. No Supabase project linked yet.

**Why was it taken on?**
Supabase project not created until Day 2.

**Cost right now**
No verification that Supabase is pinned to `ap-southeast-2` (ADR-0003).

**Interest**: If Supabase is provisioned in the wrong region, data sovereignty compliance (Privacy Act) is violated.

**Trigger to repay**: Day 2 (Supabase project creation).

**Payoff plan**: Add `supabase status | grep region` check; assert `ap-southeast-2`.

**Estimate**: XS

---

### TD-0004 — engine-determinism / ato-fixture-canary CI checks not yet wired

- **Category**: ci
- **Severity**: low
- **Opened**: Day 01
- **Status**: scheduled (wired Day 4)
- **Linked**: N/A

**What's the debt?**
`engine-determinism` and `ato-fixture-canary` CCTV checks skipped. No engine logic exists yet.

**Why was it taken on?**
Engine calculation code doesn't exist until Day 4+.

**Cost right now**
No determinism guarantee in CI.

**Interest**: Engine correctness is a core product guarantee (ADR-0002, ADR-0004). Without these checks, a non-deterministic result could ship undetected.

**Trigger to repay**: Day 4 (first engine function shipped).

**Payoff plan**: Wire commands in `runWiredChecks()` alongside engine test harness.

**Estimate**: S

---

### TD-0005 — bundle-budgets / a11y / disclaimer-audit CI checks not yet wired

- **Category**: ci
- **Severity**: low
- **Opened**: Day 01
- **Status**: scheduled (wired Day 8)
- **Linked**: N/A

**What's the debt?**
`bundle-budgets`, `a11y`, and `disclaimer-audit` CCTV checks skipped.

**Why was it taken on?**
No UI components exist yet; bundle and a11y checks require a rendered app.

**Cost right now**
No automated checks for bundle size regressions, a11y violations, or missing disclaimers.

**Interest**: Disclaimer omissions are a compliance risk (ASIC/AFCA); a11y regressions are legal risk (Disability Discrimination Act). Both compound as UI grows.

**Trigger to repay**: Day 8 (UI feature work begins).

**Payoff plan**: Wire commands in `runWiredChecks()`; add `@axe-core/playwright` and Next.js bundle analyser.

**Estimate**: S

---

### TD-0006 — secret-scan CI check not yet wired

- **Category**: ci
- **Severity**: low
- **Opened**: Day 01
- **Status**: scheduled (wired Day 15)
- **Linked**: N/A

**What's the debt?**
`secret-scan` CCTV check skipped. No scanning for accidentally committed secrets.

**Why was it taken on?**
No secrets have been committed yet; wiring a scanner requires selecting a tool (trufflehog, gitleaks, etc.).

**Cost right now**
A future accidental commit of a secret (API key, Supabase service role key) would not be caught by CI.

**Interest**: Each day without scanning is a day a secret could be committed and pushed to the remote.

**Trigger to repay**: Day 15 hardening (latest); sooner is better.

**Payoff plan**: Add `gitleaks detect --no-git` or `trufflehog git` step to CI and CCTV.

**Estimate**: XS

---

### TD-0007 — prettier reformat noise mixed with config signal in D01-T3 commit

- **Category**: ci
- **Severity**: low
- **Opened**: Day 01
- **Status**: open
- **Linked**: N/A

**What's the debt?**
Running `pnpm format` during D01-T3 (Prettier config introduction) reformatted 40+ existing docs files. The reformatting changes are bundled in the same commit as the Prettier config. Future `git blame` and `git log` will attribute docs edits to D01-T3 rather than original authors.

**Why was it taken on?**
First-time Prettier run over existing files was unavoidable; staged separately would still show in the same PR.

**Cost right now**
Minor: `git log` noise on docs files.

**Interest**: Each future Prettier config change will produce the same noise pattern, making signal/noise worse over time.

**Trigger to repay**: Next time Prettier config changes — ship config change in a standalone commit, then run `pnpm format` in a follow-up "format: apply prettier config" commit.

**Payoff plan**: Document convention in CLAUDE.md or contributing guide: "Prettier config changes ship in their own commit; the format sweep follows immediately."

**Estimate**: XS (convention doc only)

---

### TD-0008 — audit-deps check has no exception mechanism; long-tail CVEs cause persistent red

- **Category**: ci
- **Severity**: medium
- **Opened**: Day 01
- **Status**: open
- **Linked**: DEF-0001

**What's the debt?**
The `audit-deps` wired check runs `pnpm audit --audit-level=high` with no way to acknowledge known, time-boxed CVEs. Any accepted or temporarily deferred vulnerability causes every CCTV report to show a red `audit-deps` until the underlying package is upgraded. There is no distinction between "new unknown CVE" and "known CVE being tracked in DEF-NNNN with a fix deadline".

**Why was it taken on?**
Simple implementation was the right call for Day 1. A full exception mechanism adds complexity that isn't justified until there's at least one case requiring it — which DEF-0001 now provides.

**Cost right now**
Every CCTV report from Day 1 onward shows `audit-deps: fail` due to DEF-0001, making it harder to spot new CVEs in the noise. The audit script exits 1 even when all other checks are green.

**Interest** (how it compounds)
If additional CVEs appear in transitive dependencies before DEF-0001 is closed, the noise increases. The CI pipeline (D01-T5) will also show a persistent red on the audit-deps job.

**Trigger to repay**
Implement when DEF-0001 is resolved (Next.js 15 migration) OR if a second CVE is deferred, whichever comes first. Latest: Day 14 hardening.

**Payoff plan**
Add `.audit-exceptions.json` at repo root with schema `[{ "id": "GHSA-xxx", "until": "Day NN", "reason": "tracked in DEF-NNNN" }]`. Update `scripts/lib/checks.ts` `runWiredChecks()` to parse the exceptions file and: surface matching CVEs as WARN (not FAIL) until their `until` date, fail on any CVE not in the exceptions list or past its deadline.

**Estimate**
XS (2–3h including tests)

---

## Paid Debt

| ID      | Category | Title | Paid day | Closing commit | Notes |
| ------- | -------- | ----- | -------- | -------------- | ----- |
| _empty_ |          |       |          |                |       |

---

## Entry Template

```
### TD-NNNN — <one-line title>

* **Category**: <category>
* **Severity**: low / medium / high
* **Opened**: Day NN
* **Status**: open
* **Linked**: DEV-NNNN / DEF-NNNN / BL-NNNN / ADR-NNNN (as applicable)

**What's the debt?**
<concrete description of the shortcut taken or the suboptimal state>

**Why was it taken on?**
<the trade-off — usually "to unblock task X on day Y"; honest reasoning>

**Cost right now**
<what's worse than ideal today — friction, perf, correctness margin, etc.>

**Interest** (how it compounds)
<how the cost grows over time or with future work>

**Trigger to repay**
<concrete event that makes this urgent — e.g., "before Day 12 reports ship", "when scenarios exceed 10/user", "if a second persona ships">

**Payoff plan**
<what "paid" looks like — files to touch, tests to add, doc updates>

**Estimate**
<T-shirt size: XS / S / M / L>
```

---

## Anti-Patterns

- **Debt without a payoff plan is not debt; it's a defect.** If you don't know how to fix it, open a defect instead.
- **"Refactor everything" is not a payoff plan.** Plans must be concrete and bounded.
- **No silent debt.** Every shortcut taken to ship today's task gets an entry today, not later. Memory is unreliable.
- **No transferring debt between owners without acknowledgement.** If TD-NNNN was opened on Day 5 and now blocks Day 11, the Day-5 author re-confirms before reassignment.
