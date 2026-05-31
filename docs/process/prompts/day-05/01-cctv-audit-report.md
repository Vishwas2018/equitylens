# CCTV Audit Report — Day 05

## 0. Header

| Field                      | Value                                              |
| -------------------------- | -------------------------------------------------- |
| Day number                 | `05`                                      |
| Date                       | `2026-05-21T11:26:29.152Z`                                        |
| Branch                     | `feature/d01-bootstrap`                                      |
| HEAD SHA                   | `568bed12bc332f2cc841eb5b99c63e223b7c45e5`                                         |
| Last commit                | `568bed12bc332f2cc841eb5b99c63e223b7c45e5 2026-05-21 20:27:36 +1000 Vishwas Joshi: chore(process): day 4 closeout — registers, EOD report, tag [D04-T4]`                                     |
| Start-of-day tag           | `day-04-end` ✅ |
| Audit script version       | D01-T4 (full implementation)                       |
| Node version               | `v24.15.0` ⚠ drift from ^20.14.0 |

## 1. Reconciliation Against Yesterday

> Day 05 opening — no prior End-of-Day Report to reconcile against (this is the first audit run).

## 2. Automated Check Outcomes

### Wired checks

| Check                        | Result  | Notes                                              |
| ---------------------------- | ------- | -------------------------------------------------- |
| git-status                   | pass    |  |
| typecheck                    | pass    |  |
| lint                         | pass    |  |
| format-check                 | fail    | WARN  Unsupported engine: wanted: {"node":"^20.14. |
| test                         | pass    |  |
| audit-deps                   | warn    | WARN [excepted until 2026-05-27] GHSA-mwv6-3258-q5 |
| region-check                 | warn    | SUPABASE_MGMT_TOKEN or SUPABASE_PROJECT_REF not se |

### Skipped checks (not yet wired)

| Check                        | Status  | Notes                                              |
| ---------------------------- | ------- | -------------------------------------------------- |
| migration-status             | SKIPPED | wired Day 2 |
| migration-dryrun             | SKIPPED | wired Day 2 |
| rls-coverage                 | SKIPPED | wired Day 2 |
| cross-tenant-probe           | SKIPPED | wired Day 2 |
| engine-determinism           | SKIPPED | wired Day 4 |
| ato-fixture-canary           | SKIPPED | wired Day 4 |
| bundle-budgets               | SKIPPED | wired Day 8 |
| a11y                         | SKIPPED | wired Day 8 |
| disclaimer-audit             | SKIPPED | wired Day 8 |
| secret-scan                  | SKIPPED | wired Day 15 |

## 3. Diff Summary Since day-04-end

```
(no changes)
```

## 4. Coverage Delta

N/A — coverage thresholds not yet wired (Day 4 for engine, Day 8 for app).

## 5. Engine Correctness Signals

N/A — engine days start Day 4.

## 6. Open Issues at Start of Day

Pulled from registers at time of audit.

| Register        | Open | New since yesterday | High-severity open |
| --------------- | ---- | ------------------- | ------------------ |
| Product backlog | TBD  | TBD                 | n/a                |
| Defect log      | TBD  | TBD                 | TBD                |
| Deviation log   | TBD  | TBD                 | TBD                |
| Technical debt  | TBD  | TBD                 | TBD                |
| Open ADRs       | TBD  | TBD                 | n/a                |

## 7. Drift & Anomalies

Working tree has uncommitted changes:
```
?? HOW-TO-RUN.md
?? docs/audit-prompt.md
?? docs/process/prompts/day-04/checkpoints/
?? run-audit.sh
```

## 8. Recommended Focus

1. Carry-over from yesterday: per End-of-Day Report.
2. Today's Day-05 spine per `/docs/process/15-day-plan.md`.
3. Risks from audit: Node version drift on local dev machine (DEV-0002, accepted).
4. Suggested ordering: execute daily prompt tasks in order.

## 9. Sign-Off

- Code: audit complete, no edits made, registers untouched except for new defects/drift entries appended.
- Awaiting Opus's Daily Execution Prompt before any execution work begins.
