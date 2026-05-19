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

| ID      | Category | Severity | Title                                                                            | Opened day | Status | Linked   |
| ------- | -------- | -------- | -------------------------------------------------------------------------------- | ---------- | ------ | -------- |
| TD-0008 | ci       | medium   | audit-deps check has no exception mechanism; long-tail CVEs cause persistent red | Day 01     | open   | DEF-0001 |

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
