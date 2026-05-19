# Daily Progress Log

> Canonical day-by-day record of what was actually built, what slipped, and what was learned. Owned by Opus; written at end-of-day after reading Code's End-of-Day Report. This is the document that, in 90 days, lets anyone reconstruct what happened and why.

---

## Format

One section per day. Days are recorded in chronological order. Once written, a day's entry is not retroactively edited; corrections are appended as a sub-section dated when made.

---

## Day Template

```
## Day NN — YYYY-MM-DD — <theme from 15-day-plan.md>

**Day status**: clean / partial-slip / slip / halted

**Primary goal**
<one line — same as the Daily Execution Prompt's goal>

**Achieved**
* <task ID> — <title> — <one-line summary> — commits `<SHA1>, <SHA2>`
* <task ID> — ...

**Not achieved (rolled forward)**
* <task ID> — <reason> — disposition `<roll to day NN+1 | drop to backlog BL-NNNN>`

**Registers touched**
* Backlog: opened `<IDs>`, closed `<IDs>`
* Defects: opened `<IDs>` (sev1: `<count>`, sev2: `<count>`), closed `<IDs>`
* Deviations: `<IDs>` with dispositions
* Tech debt: `<IDs>`
* ADRs: `<IDs>` with state

**Checkpoints**
* Day-level: all passed / `<which failed and why>`
* Coverage: engine `%`, app `%`
* Perf signals: `<if applicable>`

**Notable decisions**
<short bullets — anything future-readers should know>

**Surprises / lessons**
<short bullets — what was harder/easier than expected, what to do differently>

**Carried forward to Day NN+1**
<rollover items, risks, pre-work>

**Evidence**
* CCTV report: `prompts/day-NN/01-cctv-audit-report.md`
* Daily prompt: `prompts/day-NN/02-daily-execution-prompt.md`
* End-of-day report: `prompts/day-NN/03-end-of-day-report.md`
* Start/end tags: `day-NN-start` @ `<SHA>` → `day-NN-end` @ `<SHA>`
```

---

## Log Entries

(empty until Day 1 runs)

---

## Conventions

* The log is the **canonical** narrative; the registers are the **canonical** state. They must agree. Discrepancies are surfaced and fixed before the next day starts.
* **Honesty over flattery.** A slip is recorded as a slip. The system improves only if the log is accurate.
* **No retro-edits.** If a day's entry was wrong, append a `### Correction — YYYY-MM-DD` sub-section with the correction and the source of error. The original text stays.
* **Brevity is fine.** Three lines per section is plenty for a clean day. Days with incidents get more detail.

---

## End-of-Sprint Summary (filled after Day 15)

```
## Sprint Summary — Day 1 through Day 15

* Days clean: `N`
* Days partial-slip: `N`
* Days slip: `N`
* Days halted: `N`

* P0 items shipped: `N / N planned`
* P1 items shipped: `N / N planned`
* Open defects at RC: sev1 `N` (must be 0), sev2 `N`, sev3 `N`, sev4 `N`
* Open deviations at RC: `N` (with dispositions)
* Open tech debt at RC: `N`
* ADRs accepted: `N`

* Key risks accepted into RC: <bullets>
* Items deferred post-RC: BL-`<IDs>`

* Overall: ready for production deploy? yes / no
* If no: what's blocking, owner, ETA.
```
