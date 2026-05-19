# End-of-Day Report — Day NN

> **Owner**: Claude Code. **When**: After all tasks attempted and day-level checkpoints run. **Audience**: Claude Opus + human approver.
> Honest summary of what landed, what didn't, and what's now known about the system. Read in conjunction with the Daily Execution Prompt and the commit log between `day-NN-start` and `day-NN-end`.

---

## 0. Header

| Field                | Value                                          |
| -------------------- | ---------------------------------------------- |
| Day number           | `NN`                                           |
| Date                 | `YYYY-MM-DD`                                   |
| Start tag            | `day-NN-start` @ `<SHA>`                       |
| End tag              | `day-NN-end` @ `<SHA>`                         |
| Total commits today  | `N`                                            |
| Net diff             | `+M / -K` across `F` files                     |
| Day status           | `clean` / `partial-slip` / `slip` / `halted`   |

Status definitions:
* `clean` — primary goal achieved, all checkpoints passed.
* `partial-slip` — primary goal achieved; one or more secondary tasks rolled.
* `slip` — primary goal not achieved; rollover required.
* `halted` — day stopped early by failed checkpoint or external block.

---

## 1. Task Outcomes

| Task ID  | Title                 | Status                              | Evidence                                       | Commit(s)         |
| -------- | --------------------- | ----------------------------------- | ---------------------------------------------- | ----------------- |
| DNN-T1   | `<title>`             | done / partial / blocked / deferred | `checkpoints/DNN-T1.txt`                       | `<SHA1>, <SHA2>`  |
| DNN-T2   | `<title>`             | done / partial / blocked / deferred | `checkpoints/DNN-T2.txt`                       | `<SHA>`           |
| DNN-T3   | `<title>`             | done / partial / blocked / deferred | `checkpoints/DNN-T3.txt`                       | `<SHA>`           |

For each task **not** `done`, the next section explains why.

---

## 2. Incomplete or Failed Tasks

For each non-`done` task:

### DNN-Tx — `<title>` — `<status>`

* **What was attempted**: 2–3 sentences.
* **What blocked completion**: concrete description (failing test, missing dep, ambiguous spec, etc.).
* **What state the code is in now**: e.g., "Reverted; working tree clean", "Behind feature flag `EXPLAIN_V2_BETA`, off by default", "Branch pushed but not merged".
* **Defect / deviation reference**: e.g., DEF-018.
* **Recommended disposition**: e.g., "Roll to day NN+1 as first task", "De-scope from Day NN entirely; move to product backlog", "Requires Opus decision".

---

## 3. Day-Level Checkpoint Results

| Checkpoint                          | Command                       | Result | Evidence                         |
| ----------------------------------- | ----------------------------- | ------ | -------------------------------- |
| Full unit suite                     | `pnpm test`                   | ✅/❌    | `checkpoints/day-tests.txt`      |
| Type-check                          | `pnpm typecheck`              | ✅/❌    | `checkpoints/day-tc.txt`         |
| Lint                                | `pnpm lint`                   | ✅/❌    | `checkpoints/day-lint.txt`       |
| Coverage                            | `pnpm coverage:check`         | ✅/❌    | engine `%` / app `%`             |
| Contract tests                      | `pnpm test:contracts`         | ✅/❌    |                                  |
| Cross-tenant probe                  | `pnpm test:rls`               | ✅/❌    |                                  |
| Determinism (if applicable)         | `pnpm engine:determinism`     | ✅/❌    | divergences `N`                  |
| Disclaimer presence (if applicable) | `pnpm test:disclaimers`       | ✅/❌    | missing surfaces                 |

Any ❌ here downgrades day status to `halted` unless an explicit deferred-fix is recorded and approved.

---

## 4. Registers Updated Today

Counts (with IDs):

| Register          | Opened             | Closed         | Carrying open |
| ----------------- | ------------------ | -------------- | ------------- |
| Backlog           | `BL-NNN`           | `BL-NNN`       | `N`           |
| Defects           | `DEF-NNN, DEF-NNN` | `DEF-NNN`      | `N` (sev1 `N`) |
| Deviations        | `DEV-NNN`          | `DEV-NNN`      | `N`           |
| Technical debt    | `TD-NNN`           | `TD-NNN`       | `N`           |
| ADRs              | `ADR-NNNN proposed` | `ADR-NNNN accepted` | `N` open  |

If "None" in any cell, write it explicitly.

---

## 5. Honest Gaps

Things that look done but warrant follow-up. This section's purpose is to prevent next-day surprises.

* Test was added but its assertion is weaker than ideal (logged as TD-`NNN`).
* Migration applied to staging but not yet documented in `/docs/database/schema.sql` (action: tomorrow's first task or roll back).
* UI passes axe but visual contrast on the dark-mode `--state-warning` token is borderline; manual eye-check pending.
* Performance is within budget but degraded vs yesterday; baseline updated, but root cause not investigated.

If "None", write it explicitly.

---

## 6. Anti-Scope Audit

Was any work attempted that was on the day's deny-list? If yes:

* What was attempted, why, and who authorised continuation (or whether it was reverted).
* DEV-`NNN` reference.

If "None", write it explicitly.

---

## 7. Performance & Correctness Signals

Only if relevant to today's work; otherwise mark "N/A".

| Signal                                        | Today  | Baseline | Δ      | Within budget? |
| --------------------------------------------- | ------ | -------- | ------ | -------------- |
| Engine p95 (portfolio of 10)                  | `ms`   | `ms`     |        |                |
| Engine p95 (single 30-year forecast)          | `ms`   | `ms`     |        |                |
| API p95 (`/api/scenarios/run`)                | `ms`   | `ms`     |        |                |
| `output_hash` distribution shift              | `Zσ`   | n/a      | n/a    |                |
| Bundle size — portfolio route                 | `KB`   | `KB`     |        |                |
| AI explanation grounding pass rate (sample 20) | `%`   | n/a      |        |                |

---

## 8. Drift Discovered

External or unmanaged changes detected during the day (e.g., dependency advisory mid-day, Supabase advisory, Stripe webhook signature rotation).

* Source, time, action taken, lingering risk.

If "None", write it explicitly.

---

## 9. Tomorrow's Preliminary Scope

Sketch only — Opus will finalise tomorrow morning after the next CCTV report.

* Rollover from today: `<items>` or "None".
* Day NN+1 spine per `/docs/process/15-day-plan.md`: `<one line>`.
* Known risks heading into tomorrow: `<bullets>`.
* Pre-work that would help: `<optional bullets>` (e.g., "Ops needs to confirm Supabase region before any migration work").

---

## 10. Sign-Off

* Code: report is accurate to the best of automated and observational checks; commits tagged; PR opened.
* Human approver: `<initials> @ <timestamp>` — approves or requests revision.
* Opus (overnight): updates `daily-progress-log.md` and closes the day in the canonical record.
