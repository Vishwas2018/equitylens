# Process — Read Me First

> The operating system for the 15-day build. Two AI roles (Opus = planning, Code = execution) + one human approver + a daily ritual + six living registers + a 15-day sprint spine. Designed so this build is auditable from `git log` alone.

---

## Quick Map

| Topic                      | Path                                            |
| -------------------------- | ----------------------------------------------- |
| Operating model            | `execution-system.md`                           |
| Day-by-day sprint spine    | `15-day-plan.md`                                |
| Operational procedure      | `daily-ritual.md`                               |
| Code's morning template    | `templates/cctv-audit-report.md`                |
| Opus's daily plan template | `templates/daily-execution-prompt.md`           |
| Code's evening template    | `templates/end-of-day-report.md`                |
| Backlog                    | `registers/product-backlog.md`                  |
| Defects                    | `registers/defect-log.md`                       |
| Deviations                 | `registers/deviation-log.md`                    |
| Daily narrative            | `registers/daily-progress-log.md`               |
| Technical debt             | `registers/technical-debt.md`                   |
| Architecture decisions     | `registers/adr-index.md` + `registers/adr/*.md` |

---

## Roles in One Page

**Opus** plans and audits. Reads CCTV reports, updates registers, emits Daily Execution Prompts, drafts ADRs. Never edits code or runs commands.

**Code** implements. Runs the morning audit, executes the day's prompt verbatim, requests human approval before commits, emits the End-of-Day Report. Never decides scope.

**Human** approves commits and adjudicates when Opus and Code disagree. Does not write code.

When the two AI roles disagree, the disagreement is surfaced explicitly — never silently resolved.

---

## Daily Cycle in One Page

```
Morning
  Code → CCTV Audit Report           (10–15 min)
  Opus → Daily Execution Prompt      (20–30 min)
Day
  Code → executes task-by-task; requests commit approval at each checkpoint (4–6 h)
Evening
  Code → End-of-Day Report           (10 min)
  Opus → updates Daily Progress Log  (10 min)
```

Each day produces three artifacts under `prompts/day-NN/` plus checkpoint outputs under `prompts/day-NN/checkpoints/`. Tags `day-NN-start` and `day-NN-end` bound the day in git.

---

## Non-Negotiables

1. **Accuracy over speed.** A wrong number to a user is the worst outcome.
2. **AI never calculates.** Engine is deterministic TypeScript; AI explains only.
3. **No silent deviation.** Every departure from spec is logged before the next day.
4. **No checkpoint bypass.** A failed checkpoint halts the day at that task.
5. **No `--no-verify`, no force-push to main, no register-skipping.**
6. **One day's plan ≤ 3 major deliverables.** Pressure to add a fourth is a deviation.
7. **Days 14 and 15 (hardening) cannot be sacrificed.**

---

## Bootstrapping the System (Day 0)

Before Day 1 begins:

1. Commit the entire `/docs/process/` tree.
2. Create empty `prompts/` directory.
3. Tag the repo `day-0-end` at the bootstrapping commit so Day 1's audit has a baseline.
4. Confirm CI passes on the empty Day-0 state.
5. Confirm Supabase staging is in `ap-southeast-2`, Vercel project linked, secrets seeded.
6. Open a milestone in GitHub for each of the 15 days.

The first morning of Day 1, Code runs `pnpm audit:cctv` against `day-0-end` and Opus produces the first Daily Execution Prompt from `15-day-plan.md` § Day 1.

---

## What "Done" Means

A day is done only when all of: tasks complete, day-level checkpoints pass, registers updated, End-of-Day Report committed, tags applied, PR opened. A 15-day sprint is done only when Day 15's checkpoints all pass and the deployment checklist in `/operations/deployment-checklist.md` is 100% ticked.

Any earlier stopping point is a slip, not a finish.
