# Deviation Log

> Every departure from the canonical specification (the `/docs/**` tree, the 15-day plan, or the day's execution prompt). Deviations are not failures; they are honest acknowledgements that reality diverged from plan. They are recorded so that the divergence is traceable and either accepted (with rationale) or remediated.

---

## What Counts as a Deviation

- Scope change mid-day (added or removed work).
- Architecture choice that differs from `/architecture/**` documents.
- Spec interpretation where two readings were possible and one was chosen.
- Out-of-scope file modified to unblock an in-scope task.
- Skipped checkpoint with explicit approval.
- Technology / library / pattern introduced that was not in the original plan.
- Order-of-day changed (a task pulled forward from a later day, or pushed back).

---

## What Does NOT Count

- A failing test that gets fixed within the day — that's a defect.
- A planned refactor — that's just work.
- A pivot decided by Opus at morning ritual — that's a re-plan, captured in the new Daily Execution Prompt.
- A purely cosmetic edit to fix typos — too small to track.

---

## Conventions

- **ID**: `DEV-NNNN`, monotonically increasing.
- **Type**: `scope` / `architecture` / `interpretation` / `out-of-scope-edit` / `checkpoint-skip` / `tech-choice` / `reorder`.
- **Disposition**: `accepted` (deviation kept; spec updated to match) / `remediated` (rolled back to spec) / `pending` (under review).
- **Severity**: `low` / `medium` / `high` — `high` requires an ADR.

---

## Open Deviations

| ID      | Day | Type | Title | Severity | Disposition | Owner |
| ------- | --- | ---- | ----- | -------- | ----------- | ----- |
| _empty_ |     |      |       |          |             |       |

---

## Closed Deviations

| ID      | Day | Type | Title | Disposition | Linked ADR / spec change |
| ------- | --- | ---- | ----- | ----------- | ------------------------ |
| _empty_ |     |      |       |             |                          |

---

## Entry Template

```
### DEV-NNNN — <one-line title>

* **Day**: NN
* **Type**: scope / architecture / interpretation / out-of-scope-edit / checkpoint-skip / tech-choice / reorder
* **Severity**: low / medium / high
* **Opened by**: <Code | Opus | human>
* **Status**: pending

**What was the spec / plan?**
<verbatim or paraphrase, with file + section reference>

**What actually happened (or is proposed)?**
<concrete description>

**Why?**
<rationale — must answer the "why not stick to spec" question>

**Impact**
<users / surfaces / future work affected>

**Options considered**
1. <option> — pros / cons
2. <option> — pros / cons

**Recommendation**
<which option and why>

**Disposition** (filled in once decided)
* accepted — spec to be updated: `<which file / section>`, owner: `<who>`, by: `<day>`
* remediated — work reverted in commit `<SHA>`; spec stands
* pending — awaiting decision by `<who>`, expected by `<day>`

**Linked records**
* ADR: `<ADR-NNNN or N/A>`
* Defect: `<DEF-NNNN or N/A>`
* Backlog: `<BL-NNNN or N/A>`
* Tech debt: `<TD-NNNN or N/A>`
```

---

## Rules

- **No silent deviation.** A change that materially differs from spec must have a `DEV-NNNN` entry by end-of-day, even if accepted.
- **High-severity deviations require an ADR** within the same day. The ADR captures the long-term decision; the deviation captures the moment it was made.
- **Acceptance updates the spec.** A deviation that is accepted is not just a footnote; the corresponding `/docs/**` file is updated so that the spec and the code agree going forward.
- **Remediation is fast.** A deviation marked `remediated` must show a revert/fix commit within the same day or be re-classed as `accepted`.
- **Pending deviations age out.** Any deviation `pending` for more than two days is escalated; the day's plan opens with the resolution as task T1.
