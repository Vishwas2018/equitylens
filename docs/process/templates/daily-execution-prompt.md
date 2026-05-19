# Daily Execution Prompt — Day NN

> **Owner**: Claude Opus. **When**: After the CCTV Audit Report is committed. **Audience**: Claude Code.
> The single authoritative plan for the day. Code executes this verbatim. Anything not in this prompt is out of scope; any out-of-scope work is a deviation.

---

## 0. Header

| Field                | Value                                          |
| -------------------- | ---------------------------------------------- |
| Day number           | `NN`                                           |
| Date                 | `YYYY-MM-DD`                                   |
| CCTV report ref      | `prompts/day-NN/01-cctv-audit-report.md`       |
| Plan spine ref       | `15-day-plan.md` § Day NN                      |
| Carry-over from D-(NN-1) | `<items or None>`                          |
| Open SEV1 defects    | `<DEF-IDs or None>` (must be tackled first)   |
| Engine days flag     | Yes / No (locks `packages/engine/**` if No)    |

---

## 1. Primary Goal

One sentence. Verifiable by end of day.

> Example: "End of day: a user can create a property, create a scenario, run it, and persist a reproducible scenario result via the API; cross-tenant probes deny."

---

## 2. Today's Tasks

Tasks are ordered. Code executes top-to-bottom. Each task is atomic, independently verifiable, and has a checkpoint.

### Task DNN-T1 — `<short verb-led title>`

* **Why**: 1–2 sentences connecting the task to the day's goal.
* **Allow-list (paths writable in this task)**:
  * `apps/web/server/api/scenarios/**`
  * `apps/web/server/api/properties/**`
* **Deny-list (must not modify)**:
  * `packages/engine/**`
  * `supabase/migrations/**`
  * `docs/database/**`
* **Spec refs**: `/architecture/api-contracts.md` § N, `/database/types.ts` lines …
* **Acceptance criteria**:
  1. Endpoint validates input with Zod schema `<name>`.
  2. Endpoint enforces RLS by relying on the user's JWT, no service-role escalation.
  3. Idempotency by `<key>`; duplicate POST returns the existing resource.
  4. `audit_logs` row written with action `<name>`.
* **Checkpoint commands** (must run and pass):
  ```bash
  pnpm test apps/web/server/api/scenarios/__tests__/*.test.ts
  pnpm test apps/web/server/api/properties/__tests__/*.test.ts
  pnpm test tests/rls/scenarios.test.ts
  pnpm test tests/contracts/scenarios.contract.test.ts
  ```
* **Evidence file**: `prompts/day-NN/checkpoints/DNN-T1.txt`
* **Definition of done**: All commands pass, evidence captured, change committed with `[DNN-T1]` in subject.

### Task DNN-T2 — `<title>`

(same structure)

### Task DNN-T3 — `<title>`

(same structure)

> **Maximum**: 3 major tasks per day. Sub-bullets within a task are fine; new top-level tasks are scope creep and refused.

---

## 3. What NOT to Do (Anti-Scope)

Explicit. Anything listed here is a deviation if attempted.

* Do **not** add `/api/reports/*` (Day 12).
* Do **not** wire the AI explanation endpoint (Day 11).
* Do **not** modify `packages/engine/**` (engine is frozen until Day 11 explanation work, which only reads outputs).
* Do **not** introduce new migrations; today's plan does not require schema changes.
* Do **not** add new third-party dependencies without an ADR.
* Do **not** silently fix unrelated defects you notice — log them to `defect-log.md` instead.
* Do **not** rename existing public types or exported symbols.
* Do **not** disable, mark `.skip`, or weaken any failing test. If a test is wrong, fix the test in a separate commit with explicit reasoning in the commit body.

---

## 4. Files To Touch (Summary)

A consolidated allow-list across all tasks. The pre-commit hook enforces this list.

```
apps/web/server/api/scenarios/**
apps/web/server/api/properties/**
apps/web/server/api/_lib/**
apps/web/__tests__/**
tests/rls/scenarios.test.ts
tests/contracts/scenarios.contract.test.ts
tests/contracts/properties.contract.test.ts
docs/process/prompts/day-NN/**
docs/process/registers/*.md  (append-only entries during execution)
```

Anything else requires Opus update before edit.

---

## 5. Verification Checkpoints (Day-Level)

These run after all tasks complete. Day is not done until they pass.

| Checkpoint                                       | Command                              | Pass criterion              |
| ------------------------------------------------ | ------------------------------------ | --------------------------- |
| Full unit suite                                  | `pnpm test`                          | All green                   |
| Type-check                                       | `pnpm typecheck`                     | Zero errors                 |
| Lint                                             | `pnpm lint`                          | Zero errors                 |
| Coverage thresholds                              | `pnpm coverage:check`                | Engine ≥ 95%, app ≥ 80%     |
| Contract tests                                   | `pnpm test:contracts`                | All endpoints match `/architecture/api-contracts.md` |
| Cross-tenant probe                               | `pnpm test:rls`                      | Every table denies          |
| Audit log presence (today's actions)             | `pnpm test:audit-log-presence`       | Each write action present   |
| Idempotency invariant                            | `pnpm test:idempotency`              | Same input → same resource id |
| Determinism (if engine-touching day)             | `pnpm engine:determinism`            | Zero divergences            |
| Disclaimer presence (if UI-touching day)         | `pnpm test:disclaimers`              | Every financial surface covered |

Evidence for each goes to `prompts/day-NN/checkpoints/`.

---

## 6. Risk Watch

Specific risks Opus identified from the CCTV report and the day's scope. Code escalates if any materialise.

* `<risk>` — mitigation: `<plan>` — surfacing trigger: `<condition>`.
* `<risk>` — ...

If "None", write it explicitly.

---

## 7. Register Updates Expected

Code is expected to append entries to these registers during execution:

* `defect-log.md` — any test failures encountered.
* `deviation-log.md` — any out-of-scope change Code believes is necessary.
* `technical-debt.md` — any shortcut taken that should be revisited.
* `product-backlog.md` — any discovered missing capability beyond today.

Opus owns the canonical structure; Code adds rows with status `proposed`.

---

## 8. Commit Discipline

* Every commit subject must include the `[DNN-TM]` tag.
* Commits without the tag fail the pre-commit hook.
* Commit message body includes the evidence file path.
* One logical change per commit. No "WIP" commits to a feature branch that will be merged.
* No `--no-verify`. No force-push to anything other than the working branch's own head, and only with `--force-with-lease`.

---

## 9. End-of-Day Definition

The day is done when **all** of:

1. All 3 task checkpoints pass.
2. Day-level checkpoints (§5) pass.
3. Registers reflect every defect, deviation, and tech-debt item from today.
4. End-of-Day Report drafted at `prompts/day-NN/03-end-of-day-report.md`.
5. `git tag day-NN-end` applied to the final commit.
6. PR open (or pushed branch ready) for human approval.

If any of these is missing, the day is not done; the gap rolls forward and Opus revises tomorrow's plan to absorb it.

---

## 10. Special Instructions (Today Only)

Any one-off context Opus wants to communicate. Examples:

* "Yesterday's engine determinism harness was flaky on Node 20.11 — verify Node version is 20.14 before running."
* "Staging Supabase region check failed yesterday; do not attempt remote migrations until Ops confirms region."
* "DEF-014 was fixed in a hot patch overnight; verify by running the regression test before starting T1."

If "None", write it explicitly.

---

## 11. Sign-Off

* Opus: prompt finalised at `<timestamp>`, plan reviewed against 15-day spine and registers.
* Code: will execute exactly this prompt; any deviation logged with rationale before action.
* Human: approves commits per `/docs/process/daily-ritual.md` §5.
