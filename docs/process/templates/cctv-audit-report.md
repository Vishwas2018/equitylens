# CCTV Audit Report — Day NN

> **Owner**: Claude Code. **When**: Start of day. **Time budget**: 10 minutes (15 hard cap).
> Reports observed state of the repository against yesterday's claims. No edits during this phase; the report is the ground truth Opus uses to plan today.

---

## 0. Header

| Field                  | Value                                          |
| ---------------------- | ---------------------------------------------- |
| Day number             | `NN`                                           |
| Date (Australia/Melbourne) | `YYYY-MM-DD HH:MM AEST/AEDT`               |
| Branch                 | `feature/day-NN-...` or `main`                 |
| HEAD SHA               | `<full SHA>`                                   |
| Last commit author     | `<author>`                                     |
| Last commit timestamp  | `<iso>`                                        |
| Start-of-day tag       | `day-(NN-1)-end` (must exist; absence = drift) |
| Audit script version   | `<sha of scripts/audit-cctv.ts>`               |

If `day-(NN-1)-end` tag is missing, **stop**, surface as drift, and request guidance before proceeding.

---

## 1. Reconciliation Against Yesterday

For each item from yesterday's End-of-Day Report "claimed complete" list:

| Claimed item (task ID) | Expected evidence                | Observed                                       | Match? |
| ---------------------- | -------------------------------- | ---------------------------------------------- | ------ |
| `D06-T1`               | Tests pass, files present        | `<actual>`                                     | ✅/❌    |
| ...                    | ...                              | ...                                            | ...    |

Any ❌ row is automatically a defect entry (DEF-`NNN`). Code appends it to `defect-log.md` before emitting this report.

---

## 2. Automated Check Outcomes

Captured by `pnpm audit:cctv`.

| Check                                    | Command                                  | Result | Notes / failure summary |
| ---------------------------------------- | ---------------------------------------- | ------ | ----------------------- |
| Working tree clean                       | `git status --porcelain`                 | ✅/❌    |                         |
| Type-check                               | `pnpm typecheck`                         | ✅/❌    |                         |
| Lint                                     | `pnpm lint`                              | ✅/❌    |                         |
| Format check                             | `pnpm format:check`                      | ✅/❌    |                         |
| Unit tests (engine)                      | `pnpm --filter @equitylens/engine test`         | ✅/❌    | Coverage `%`            |
| Unit tests (app)                         | `pnpm --filter @equitylens/web test`            | ✅/❌    | Coverage `%`            |
| Engine determinism harness (1000×)       | `pnpm engine:determinism`                | ✅/❌    | Divergences `N`         |
| ATO/SRO fixture canary (subset)          | `pnpm engine:fixtures:canary`            | ✅/❌    |                         |
| Migration list = applied (staging)       | `pnpm db:migrate:status`                 | ✅/❌    | Drift detail            |
| Migration reversibility (ephemeral)      | `pnpm db:migrate:dryrun`                 | ✅/❌    |                         |
| RLS policy coverage                      | `pnpm db:rls:coverage`                   | ✅/❌    | Uncovered tables list   |
| Cross-tenant probe                       | `pnpm test:rls`                          | ✅/❌    |                         |
| Bundle budgets                           | `pnpm bundle:check`                      | ✅/❌    | Over-budget routes      |
| a11y (axe critical)                      | `pnpm test:a11y`                         | ✅/❌    | Critical count          |
| Dependency advisories (≥ high)           | `pnpm audit --audit-level=high`          | ✅/❌    |                         |
| Secret scan                              | `pnpm secrets:scan`                      | ✅/❌    |                         |
| Region check (staging Supabase)          | `pnpm ops:region-check`                  | ✅/❌    | Must be `ap-southeast-2` |
| Disclaimer presence audit                | `pnpm test:disclaimers`                  | ✅/❌    | Missing surfaces        |

Attach raw outputs to `prompts/day-NN/checkpoints/audit-*.txt`.

---

## 3. Diff Summary Since Start-of-Day Yesterday

```text
git diff --stat day-(NN-1)-start..HEAD
```

Paste output. Group files by domain:

| Domain         | Files changed | Net lines |
| -------------- | ------------- | --------- |
| Engine         | `N`           | `+M / -K` |
| Database       | `N`           | `+M / -K` |
| API            | `N`           | `+M / -K` |
| Web (app)      | `N`           | `+M / -K` |
| Process / docs | `N`           | `+M / -K` |
| Tests          | `N`           | `+M / -K` |
| CI / scripts   | `N`           | `+M / -K` |

Flag any changes outside yesterday's allow-list as **unmanaged drift**.

---

## 4. Coverage Delta

| Package         | Today (%) | Yesterday (%) | Δ      | Threshold | Status |
| --------------- | --------- | ------------- | ------ | --------- | ------ |
| `@equitylens/engine`   |           |               |        | ≥ 95      |        |
| `@equitylens/web`      |           |               |        | ≥ 80      |        |
| `@equitylens/exports`  |           |               |        | ≥ 85      |        |

Regressions ≥ 1 percentage point are flagged as defects automatically.

---

## 5. Engine Correctness Signals (Engine Days Only — 4, 5, 6, and any day touching `packages/engine/**`)

| Signal                                   | Value | Notes |
| ---------------------------------------- | ----- | ----- |
| Determinism harness divergences (1000×)  | `N`   | Must be 0 |
| ATO fixture pass rate (XV-01..XV-40)     | `N/40` |     |
| Property-based test runs (each family)   | `N`   | 5000 target |
| Engine p95 (portfolio of 10)             | `ms`  | Budget 50ms |
| Engine p95 (single 30-year forecast)     | `ms`  | Budget 35ms |
| `output_hash` distribution shift vs prior baseline | `Z-score` | Flag > 3σ |

Engine non-engine days may omit this section if `packages/engine/**` has no diff.

---

## 6. Open Issues at Start of Day

Pull straight from registers; counts only.

| Register             | Open | New since yesterday | High-severity open |
| -------------------- | ---- | ------------------- | ------------------ |
| Product backlog      | `N`  | `N`                 | n/a                |
| Defect log           | `N`  | `N`                 | `N`                |
| Deviation log        | `N`  | `N`                 | `N`                |
| Technical debt       | `N`  | `N`                 | `N`                |
| Open ADRs            | `N`  | `N`                 | n/a                |

If any defect or deviation is high-severity and unresolved, today's plan **must** open with it.

---

## 7. Drift & Anomalies

List anything unexpected:

* Commits without the `[DNN-TM]` task ID.
* Files modified outside yesterday's allow-list.
* Tags missing, branches stale, push-protected histories.
* Environment drift (staging schema, Vercel env vars, Supabase region).
* External service health flags (Supabase, Stripe, Anthropic) at start of day.

If empty, write `None observed.` — do not omit the section.

---

## 8. Recommended Focus (Code's Suggestion to Opus)

Brief, mechanical:

1. Carry-over from yesterday: `<items>` or `None`.
2. Today's day-`NN` spine per `/docs/process/15-day-plan.md`: `<one line>`.
3. Risks observed in the audit: `<bullets>`.
4. Suggested ordering: `<task sketch>`.

This is a **suggestion**, not a plan. Opus owns the plan.

---

## 9. Sign-Off

* Code: `audit complete, no edits made, registers untouched except for new defects/drift entries appended`.
* Awaiting Opus's Daily Execution Prompt before any execution work begins.
