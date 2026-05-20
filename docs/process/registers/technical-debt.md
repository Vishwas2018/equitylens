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

| ID      | Category | Severity | Title                                                             | Opened day | Status    | Linked |
| ------- | -------- | -------- | ----------------------------------------------------------------- | ---------- | --------- | ------ |
| TD-0004 | ci       | low      | engine-determinism / ato-fixture-canary CI checks not yet wired   | Day 01     | scheduled | N/A    |
| TD-0005 | ci       | low      | bundle-budgets / a11y / disclaimer-audit CI checks not yet wired  | Day 01     | scheduled | N/A    |
| TD-0006 | ci       | low      | secret-scan CI check not yet wired                                | Day 01     | scheduled | N/A    |
| TD-0007 | ci       | low      | prettier reformat noise mixed with config signal in D01-T3 commit | Day 01     | open      | N/A    |

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

## Paid Debt

| ID      | Category | Title                                                                            | Paid day | Closing commit | Notes                                                                    |
| ------- | -------- | -------------------------------------------------------------------------------- | -------- | -------------- | ------------------------------------------------------------------------ |
| TD-0001 | ci       | migration-status / migration-dryrun CI checks not yet wired                      | Day 01   | D02-T2 commit  | `db:migrate:dryrun` + `db:migrate:lint` scripts; migration-dryrun CI job |
| TD-0002 | ci       | rls-coverage / cross-tenant-probe CI checks not yet wired                        | Day 01   | D02-T3 commit  | `tests/rls/` suite + `pnpm test:rls`; wired in CI Day 3                  |
| TD-0003 | ci       | region-check CI check not yet wired                                              | Day 01   | D02-T2 commit  | `runRegionCheck()` in checks.ts; region-check CI job                     |
| TD-0008 | ci       | audit-deps check has no exception mechanism; long-tail CVEs cause persistent red | Day 02   | D02-T1 commit  | `.audit-exceptions.json` + `audit-exceptions.ts` helper                  |

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
