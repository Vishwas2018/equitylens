# Technical Debt Register

> Known shortcuts, suboptimal implementations, and "we'll fix this later" items. Each entry has a cost (what's missing, what's worse-than-ideal), an interest rate (how it gets worse over time), and a payoff plan. Debt is acceptable; **untracked** debt is not. Owned by Opus; Code appends entries when shortcuts are taken during execution.

---

## Conventions

* **ID**: `TD-NNNN`, monotonically increasing.
* **Category**: `engine` / `db` / `api` / `web` / `auth` / `billing` / `reports` / `ai` / `ops` / `ci` / `docs` / `tests`.
* **Severity**: `low` (cosmetic / minor inefficiency) / `medium` (creates friction; bounded) / `high` (will block future work or harm correctness if not addressed).
* **Status**: `open` / `scheduled` (in a future day's plan or backlog) / `paid` (resolved).
* **Interest**: a short note on how the debt compounds — "blocks D11", "doubles refactor cost per new endpoint", "degrades a11y score over time".

---

## Severity Triggers

* **High** debt added in a single day requires an ADR if it lasts beyond that day.
* Any high debt at start of Day 14 forces a Day 14 priority shift to pay it down.
* No release candidate may carry **high** debt at end of Day 15.

---

## Open Debt

| ID       | Category | Severity | Title                                                  | Opened day | Status    | Linked       |
| -------- | -------- | -------- | ------------------------------------------------------ | ---------- | --------- | ------------ |
| _empty_  |          |          |                                                        |            |           |              |

---

## Paid Debt

| ID       | Category | Title                              | Paid day | Closing commit | Notes                |
| -------- | -------- | ---------------------------------- | -------- | -------------- | -------------------- |
| _empty_  |          |                                    |          |                |                      |

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

* **Debt without a payoff plan is not debt; it's a defect.** If you don't know how to fix it, open a defect instead.
* **"Refactor everything" is not a payoff plan.** Plans must be concrete and bounded.
* **No silent debt.** Every shortcut taken to ship today's task gets an entry today, not later. Memory is unreliable.
* **No transferring debt between owners without acknowledgement.** If TD-NNNN was opened on Day 5 and now blocks Day 11, the Day-5 author re-confirms before reassignment.
