# CCTV Audit Report — Day 02

## 0. Header

| Field                      | Value                                              |
| -------------------------- | -------------------------------------------------- |
| Day number                 | `02`                                      |
| Date                       | `2026-05-20T08:08:25.578Z`                                        |
| Branch                     | `feature/d01-bootstrap`                                      |
| HEAD SHA                   | `46e5a4f5c2ca29431e7d9f86ec2861511c8ff8f9`                                         |
| Last commit                | `46e5a4f5c2ca29431e7d9f86ec2861511c8ff8f9 2026-05-20 17:48:00 +1000 Vishwas Joshi: feat(db): apply baseline schema + RLS with cross-tenant probe [D02-T3]`                                     |
| Start-of-day tag           | `day-01-end` ✅ |
| Audit script version       | D01-T4 (full implementation)                       |
| Node version               | `v24.15.0` ⚠ drift from ^20.14.0 |

## 1. Reconciliation Against Yesterday

> Day 02 opening — no prior End-of-Day Report to reconcile against (this is the first audit run).

## 2. Automated Check Outcomes

### Wired checks

| Check                        | Result  | Notes                                              |
| ---------------------------- | ------- | -------------------------------------------------- |
| git-status                   | pass    |  |
| typecheck                    | pass    |  |
| lint                         | pass    |  |
| format-check                 | pass    |  |
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

## 3. Diff Summary Since day-01-end

```
.audit-exceptions.json                             |  61 +++
 .github/workflows/ci.yml                           |  67 ++-
 .gitignore                                         |   5 +-
 .prettierignore                                    |   4 +
 apps/web/.env.example                              |  10 +
 apps/web/package.json                              |   1 +
 apps/web/server/db/client.ts                       |  31 ++
 checkpoints/D02-T1.txt                             |  38 ++
 .../process/prompts/day-02/01-cctv-audit-report.md |  97 ++++
 .../prompts/day-02/02-daily-execution-prompt.md    | 207 +++++++++
 docs/process/prompts/day-02/checkpoints/D02-T2.txt |  47 ++
 .../prompts/day-02/checkpoints/D02-T3-dbpush.txt   |  31 ++
 .../day-02/checkpoints/D02-T3-reversibility.txt    |  31 ++
 .../prompts/day-02/checkpoints/D02-T3-rls.txt      |  26 ++
 docs/process/prompts/day-02/checkpoints/D02-T3.txt |  47 ++
 docs/process/registers/defect-log.md               |   8 +-
 docs/process/registers/technical-debt.md           | 137 +-----
 package.json                                       |   9 +-
 pnpm-lock.yaml                                     | 187 ++++++++
 scripts/audit-cctv.ts                              |  16 +-
 scripts/audit-deps.ts                              |  57 +++
 scripts/db-migrate-dryrun.ts                       | 100 +++++
 scripts/db-migrate-lint.ts                         |  70 +++
 scripts/lib/audit-exceptions.ts                    |  97 ++++
 scripts/lib/checks.ts                              | 116 ++++-
 supabase/config.toml                               |  39 +-
 supabase/migrations/.gitkeep                       |   0
 supabase/migrations/0001_baseline_schema.sql       | 490 +++++++++++++++++++++
 supabase/migrations/0002_rls_policies.sql          | 419 ++++++++++++++++++
 supabase/rollback/0001_baseline_schema_down.sql    |  48 ++
 supabase/rollback/0002_rls_policies_down.sql       |  76 ++++
 tests/rls/cross-tenant.test.ts                     | 118 +++++
 tests/rls/policy-coverage.test.ts                  |  85 ++++
 tests/vitest.config.ts                             |  11 +
 34 files changed, 2633 insertions(+), 153 deletions(-)
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
M docs/process/prompts/day-02/01-cctv-audit-report.md
 M docs/process/registers/daily-progress-log.md
 M docs/process/registers/deviation-log.md
 M docs/process/registers/product-backlog.md
?? docs/process/prompts/day-02/03-end-of-day-report.md
?? docs/process/prompts/day-02/checkpoints/audit-a11y.txt
?? docs/process/prompts/day-02/checkpoints/audit-ato-fixture-canary.txt
?? docs/process/prompts/day-02/checkpoints/audit-audit-deps.txt
?? docs/process/prompts/day-02/checkpoints/audit-bundle-budgets.txt
?? docs/process/prompts/day-02/checkpoints/audit-cross-tenant-probe.txt
?? docs/process/prompts/day-02/checkpoints/audit-disclaimer-audit.txt
?? docs/process/prompts/day-02/checkpoints/audit-engine-determinism.txt
?? docs/process/prompts/day-02/checkpoints/audit-format-check.txt
?? docs/process/prompts/day-02/checkpoints/audit-git-status.txt
?? docs/process/prompts/day-02/checkpoints/audit-lint.txt
?? docs/process/prompts/day-02/checkpoints/audit-migration-dryrun.txt
?? docs/process/prompts/day-02/checkpoints/audit-migration-status.txt
?? docs/process/prompts/day-02/checkpoints/audit-region-check.txt
?? docs/process/prompts/day-02/checkpoints/audit-rls-coverage.txt
?? docs/process/prompts/day-02/checkpoints/audit-secret-scan.txt
?? docs/process/prompts/day-02/checkpoints/audit-test.txt
?? docs/process/prompts/day-02/checkpoints/audit-typecheck.txt
```

## 8. Recommended Focus

1. Carry-over from yesterday: per End-of-Day Report.
2. Today's Day-02 spine per `/docs/process/15-day-plan.md`.
3. Risks from audit: Node version drift on local dev machine (DEV-0002, accepted).
4. Suggested ordering: execute daily prompt tasks in order.

## 9. Sign-Off

- Code: audit complete, no edits made, registers untouched except for new defects/drift entries appended.
- Awaiting Opus's Daily Execution Prompt before any execution work begins.
