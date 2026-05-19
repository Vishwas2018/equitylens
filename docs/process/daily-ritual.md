# Daily Ritual — Operational Procedure

> The exact sequence that runs every day for fifteen days. This document is the runbook; deviation from it is a deviation worth logging. Each step has an owner, an input, an output, and a hard time budget. The ritual exists so that human judgement is spent on the high-value decisions (scope, risk, correctness) and not on remembering what to do next.

---

## 1. Time Budgets

| Phase                        | Owner        | Budget     | Hard cap         |
| ---------------------------- | ------------ | ---------- | ---------------- |
| 1. Repository audit          | Code         | 10 min     | 15 min           |
| 2. Strategic review          | Opus         | 20 min     | 30 min           |
| 3. Execution                 | Code         | 4–6 h      | 7 h              |
| 4. Verification & commit     | Code + human | continuous | end of execution |
| 5. End-of-day reconciliation | Code → Opus  | 15 min     | 25 min           |

Total daily envelope: **~7.5 hours**. If steady-state breaches this for three consecutive days, the 15-day plan is re-scoped, not the day extended.

---

## 2. Step 1 — Repository Audit (Code)

**Owner**: Claude Code in VS Code/terminal.
**Input**: yesterday's commits, current registers, `/docs/process/15-day-plan.md` entry for today.
**Output**: `/docs/process/prompts/day-NN/01-cctv-audit-report.md`.

### 2.1 Procedure

1. `git pull --rebase` and ensure working tree clean.
2. Run the audit script (defined Day 1):
   ```bash
   pnpm audit:cctv
   ```
   which collects:
   - branch + HEAD SHA + last commit author/timestamp
   - `git diff --stat` against the start-of-day tag from yesterday
   - `pnpm typecheck`, `pnpm lint`, `pnpm test --silent` outcomes (no fix mode)
   - package version drift (`pnpm outdated --recursive`)
   - migration list vs applied state on staging
   - RLS policy coverage check output
   - engine determinism harness on the standard 20-scenario fixture
   - coverage report deltas vs yesterday
3. Cross-reference each item against the previous End-of-Day Report's "claimed complete" list.
4. Populate the CCTV Audit Report template (`/docs/process/templates/cctv-audit-report.md`).
5. Commit the report as `chore(process): day-NN cctv audit`.

### 2.2 Rules

- No code edits during this phase.
- No selective omission: if a check fails, the failure is reported. Suppression requires an explicit deviation log entry.
- The report is the source of truth for state-of-repo at start-of-day; Opus reads it instead of guessing.

---

## 3. Step 2 — Strategic Review (Opus)

**Owner**: Claude Opus in chat.
**Input**: CCTV Audit Report, all six registers, today's row in the 15-day plan.
**Output**: `/docs/process/prompts/day-NN/02-daily-execution-prompt.md` (committed by Code on behalf of Opus).

### 3.1 Procedure

1. Read the CCTV report.
2. Reconcile against yesterday's End-of-Day Report: what was claimed complete? Does the repo confirm it?
3. Update registers:
   - Move any "in progress" backlog items to "done" if checkpoints passed.
   - Move any failed checkpoints to defect log.
   - Record any deviations introduced yesterday.
   - Record any tech debt taken on.
   - Draft or finalise ADRs for decisions made yesterday.
4. Decide today's plan:
   - Take the day's row from `15-day-plan.md` as the spine.
   - Adjust based on yesterday's actuals (slip, surplus, blockers).
   - **Never add more than what the day's row specifies** unless yesterday delivered surplus AND adding the item does not push past 3 major deliverables.
5. Produce the Daily Execution Prompt using the template:
   - Today's primary goal.
   - Tasks with IDs (`D07-T1`, `D07-T2`, ...), acceptance criteria, and checkpoint commands.
   - Files allowed to be touched (allow-list).
   - Files forbidden to be touched (deny-list — e.g., `packages/engine/**` is locked unless the day is an engine day).
   - Explicit "what NOT to do" list (anti-scope).
   - Verification checkpoints with exact commands.
   - Definition-of-done for each task.
   - Expected commit message format.
6. Emit the prompt in chat. Code commits it verbatim.

### 3.2 Anti-Patterns Opus Refuses

- Vague tasks ("improve the UI"). Every task must be actionable and verifiable.
- Cross-day bundling ("do days 7 and 8 in parallel"). Days are atomic.
- Implicit scope ("also fix anything you notice"). Anti-scope is part of the prompt.
- Stretch goals smuggled in as "bonus". A bonus is just unscoped work and is forbidden.

---

## 4. Step 3 — Execution (Code)

**Owner**: Claude Code.
**Input**: Daily Execution Prompt.
**Output**: commits referencing task IDs, register appends for any issues discovered.

### 4.1 Procedure

1. Print the prompt to the terminal; tag the start-of-day SHA (`git tag day-NN-start`).
2. For each task in order:
   1. Read the task's allow-list and deny-list. If implementation requires touching a deny-listed path, **stop** and log a deviation; do not proceed without Opus update.
   2. Write the smallest verifiable increment. Prefer red→green→refactor.
   3. Run the task's checkpoint commands. Capture output to `/docs/process/prompts/day-NN/checkpoints/<task-id>.txt`.
   4. If checkpoint passes: stage changes; write a commit message in the required format; request human confirmation before committing.
   5. If checkpoint fails: log a defect; **do not commit**; either fix forward or escalate. No more than one fix-forward attempt before escalating.
3. Between tasks, run `pnpm typecheck && pnpm test --changed` as a sanity sweep.
4. If a task is blocked or out-of-scope work is discovered:
   - Append to `product-backlog.md` (or `defect-log.md` / `technical-debt.md` as appropriate).
   - Do not silently fix in-flight. Surface to Opus.

### 4.2 Commit Message Format

```
<type>(<scope>): <subject>  [DNN-TM]

Body (optional): what changed, why, evidence references.

Refs: DNN-TM
Evidence: docs/process/prompts/day-NN/checkpoints/DNN-TM.txt
```

Where `<type>` is one of `feat|fix|refactor|test|docs|chore|build|ci|perf`, and `[DNN-TM]` is the day-task identifier (e.g., `[D07-T2]`).

### 4.3 Verification Checkpoint Rules

- Every checkpoint is a command, not an opinion. "Looks right" is not a checkpoint.
- The captured output goes under `/docs/process/prompts/day-NN/checkpoints/` and is committed alongside the code.
- A green checkpoint with an unexpected diff in untracked files **still fails**: the working tree must match the intent.
- Performance checkpoints must reference a baseline file under `bench/baselines/`.
- Security checkpoints (RLS probes, PII masking canaries) cannot be skipped — they have no fix-forward path; failure halts.

---

## 5. Step 4 — Validation & Commit (Code + Human)

**Owner**: Claude Code requests; the human approves.
**Input**: staged changes + checkpoint output.
**Output**: a single signed-off commit.

### 5.1 Procedure

1. Code prints a structured "Ready to commit" block:
   - Task ID
   - Files changed (with byte counts and brief description)
   - Tests run and results
   - Checkpoint pass/fail with evidence paths
   - Open risks introduced (if any)
2. Human responds with one of:
   - `approve` → Code commits.
   - `defer <reason>` → Code stashes the change, logs to backlog with reason, does not commit.
   - `revise <instruction>` → Code refines and re-requests.
   - `reject <reason>` → Code reverts the local change, logs as deviation.
3. After commit, Code pushes to the feature branch. The PR remains open until end-of-day.

### 5.2 No-Bypass Rules

- `--no-verify` on commits is forbidden (enforced by pre-commit hook).
- Force-pushes to anything other than the working feature branch are forbidden.
- CI failures cannot be merged around. They are either fixed or the work rolls to the backlog.

---

## 6. Step 5 — End-of-Day Reconciliation

**Owner**: Code emits, Opus updates the daily progress log.
**Input**: today's commits, today's checkpoint outputs, today's register appends.
**Output**: `/docs/process/prompts/day-NN/03-end-of-day-report.md` and an updated `daily-progress-log.md`.

### 6.1 Procedure (Code)

1. Tag the end-of-day SHA: `git tag day-NN-end`.
2. Generate the End-of-Day Report using the template:
   - Tasks attempted, with status (`done` / `partial` / `blocked` / `deferred`).
   - Commits with SHAs and task IDs.
   - Checkpoint outcomes.
   - Defects opened, deviations recorded, tech debt taken on.
   - Honest gaps: anything claimed but not fully verified.
   - Tomorrow's preliminary scope sketch (carried forward from the plan + any rollover).
3. Open the PR for merge (if branch-based) or push (if trunk-based).

### 6.2 Procedure (Opus)

1. Read the End-of-Day Report.
2. Update `daily-progress-log.md` with the canonical day summary.
3. Close or move any backlog items completed today.
4. Confirm or amend ADRs drafted earlier.
5. Confirm that the registers reflect reality: every defect mentioned in the report has an entry, every deviation has an entry, every piece of tech debt has an entry.

### 6.3 Hard Stop

- If end-of-day shows any SEV1 unresolved, the day ends with the SEV1 in the defect log and tomorrow's plan opens with it as the first task.
- If end-of-day shows that no day-defining deliverable landed, the day is recorded as a slip and tomorrow's plan absorbs the rollover. The next day's spine is not abandoned, but its scope is reduced accordingly.

---

## 7. Per-Day Artifact Layout

After day N:

```
docs/process/prompts/day-NN/
  01-cctv-audit-report.md
  02-daily-execution-prompt.md
  03-end-of-day-report.md
  checkpoints/
    DNN-T1.txt
    DNN-T2.txt
    ...
```

This layout is mechanical and committed. `git log -- docs/process/prompts/day-NN/` reconstructs the day exactly.

---

## 8. Cross-Cutting Rules

### 8.1 Never Skip the Audit

A "small change" day is not an excuse to skip the CCTV audit. The audit is the only check that the repo and the registers match reality. Skipping it means the next deviation is invisible until it compounds.

### 8.2 Never Skip Register Updates

Every defect, deviation, tech debt item, or decision goes in writing before the next morning. Memory is not durable; the registers are.

### 8.3 Never Roll Multiple Days Forward

If day 7 slips, day 8's plan absorbs the rollover and day 8's original scope reduces. The 15-day spine accepts at most one rollover per slip; two consecutive slips trigger a plan revision by Opus.

### 8.4 Never Bypass Checkpoints

A failed checkpoint does not get a "I'll fix it tomorrow". It halts the day's plan at that task and rolls forward as a defect. The remaining tasks for the day proceed only if they do not depend on the failed checkpoint.

### 8.5 Human Verification Is Mandatory

The system is two AI roles plus a human approver. The human does not write code; the human approves commits and adjudicates when the two AI roles disagree. There is no autonomous-merge mode.

---

## 9. Worked Example (Day 7)

**07:30** — Code runs `pnpm audit:cctv`. Yesterday claimed all engine fixtures green. Audit confirms. CCTV report committed at 07:42.

**07:45** — Opus reads CCTV. Engine done; today's spine is API contracts. Opus reviews `/architecture/api-contracts.md`, identifies that one endpoint (`PATCH /api/scenarios/:id`) was added during Day 6 wrap-up as a deviation. Opus moves it from deviation log to today's backlog as task D07-T0 (catch-up). Opus drafts the Daily Execution Prompt:

- D07-T0 — implement `PATCH /api/scenarios/:id` per contract, idempotent.
- D07-T1 — implement properties endpoints with cross-tenant probe.
- D07-T2 — implement scenarios endpoints + scenario run path with idempotency.
- D07-T3 — integration test suite for the full flow.

Deny-list: `packages/engine/**`, `supabase/migrations/**`. Anti-scope: do not add `/api/reports/*` (Day 12), do not add AI explanation endpoint (Day 11).

**08:10** — Opus emits prompt. Code commits it.

**08:15** — Code starts D07-T0. Writes the route, the schema, the test. Runs the checkpoint:

```
pnpm test apps/web/server/api/scenarios/patch.test.ts
```

Captures output to `checkpoints/D07-T0.txt`. Requests commit approval.

**08:45** — Human approves. Commit lands: `feat(api): PATCH /api/scenarios/:id idempotent [D07-T0]`.

**09:00–14:00** — D07-T1, D07-T2, D07-T3. Each follows the same pattern. D07-T2's idempotency test fails on the first attempt because the input hash includes a wall-clock timestamp. Code logs a defect (DEF-014), fixes the canonical JSON serialisation, re-runs the checkpoint, requests commit. Fix-forward used (one attempt). Commit lands with the defect referenced and closed.

**14:30** — All tasks done. Code emits End-of-Day Report:

- D07-T0..T3 done.
- DEF-014 opened and closed today.
- No tech debt taken on.
- Tomorrow: web shell + design tokens + auth UX (D08 spine).

**14:45** — Opus updates daily progress log. Day 7 closed.

---

## 10. Failure Recovery

### 10.1 Day Goes Sideways Mid-Execution

- Pause. No further commits.
- Code emits an ad-hoc "Interrupt Report" describing what failed and what state the repo is in.
- Opus reviews; either revises the day's prompt or declares the day's plan unfinished and rolls remainder to tomorrow.
- Human approves the revised plan or the rollover.

### 10.2 Two AI Roles Disagree

- Code surfaces the disagreement with a clear statement: "Opus prompt says X, repo state suggests Y, proposed resolution: Z."
- Human adjudicates.
- Outcome is recorded as either an ADR (if it's a decision with consequences) or a deviation (if it's a one-off).

### 10.3 Repository Drift (Unmanaged Changes)

- If the morning audit finds commits made outside the ritual (a human pushed directly, or a tool committed without the task ID format), Code halts and reports.
- Opus assesses impact and either re-plans the day or records a deviation and proceeds.

---

## Cross-References

- `/docs/process/execution-system.md` — system-level model
- `/docs/process/15-day-plan.md` — day-by-day spine
- `/docs/process/templates/cctv-audit-report.md` — Step 1 template
- `/docs/process/templates/daily-execution-prompt.md` — Step 2 template
- `/docs/process/templates/end-of-day-report.md` — Step 5 template
- `/docs/process/registers/*` — what gets updated during Steps 2 and 5
