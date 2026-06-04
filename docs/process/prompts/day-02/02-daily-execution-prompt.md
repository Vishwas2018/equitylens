# Day 2 — DB Schema, RLS, and CI Unblock (EquityLens)

Read first:

- docs/process/prompts/day-01/03-end-of-day-report.md
- docs/process/registers/{defect-log,deviation-log,technical-debt,daily-progress-log,product-backlog}.md
- docs/process/15-day-plan.md § Day 2
- docs/database/schema.sql
- docs/database/rls-policies.sql
- docs/architecture/security-and-compliance.md (data residency)

## Pre-flight (autonomous, no approval needed)

1. Run `pnpm audit:cctv --day 02`. This regenerates the morning CCTV report
   reflecting the actual day-01-end state. If the report shows drift or
   unexpected red checks vs the existing draft, halt and surface.
2. Save this prompt verbatim to docs/process/prompts/day-02/02-daily-execution-prompt.md.
3. Confirm pre-flight done.

## Primary goal

End of day: every table from docs/database/schema.sql exists in a Supabase
staging project in ap-southeast-2 with RLS enabled and policies attached;
cross-tenant probe denies; CI audit-deps gate passes via exception list
(DEF-0001 parked until Day 8).

## Tasks (max 3 per ritual rules)

### D02-T1 — Pay off TD-0008: audit-exceptions mechanism + park DEF-0001

**Why**: audit-deps is a required CI check; DEF-0001 (7 Next.js CVEs)
keeps it red. Migration to Next 15 is deferred to Day 8. Mechanism:
known CVEs with explicit `until` deadlines surface as WARN, not FAIL.

Allow-list:

- `.audit-exceptions.json` (new, repo root)
- `scripts/audit-cctv.ts` (add exception filter)
- `scripts/lib/audit-exceptions.ts` (new helper)
- `docs/process/registers/technical-debt.md` (close TD-0008)

Spec:

- Schema: `{ version: 1, exceptions: [{ cve: 'GHSA-...', package: '...',
severity: 'high'|'critical', reason: string, until: 'YYYY-MM-DD' | 'Day NN',
linked_defect: 'DEF-NNNN' }] }`
- Audit script behaviour: for each CVE from `pnpm audit --json`, if it
  appears in exceptions AND `until` is in the future, downgrade to WARN
  (yellow in report); else FAIL (red, exit 1).
- Past-due exceptions FAIL hard with message "exception expired on <date>"
  — no grace period.
- Seed `.audit-exceptions.json` with each of DEF-0001's 7 CVEs,
  `until: "2026-05-27"` (Day 8 calendar date — compute from today + 6 days),
  reason "Next.js 14→15 migration scheduled Day 8 per BL-0022".

Checkpoint → `checkpoints/D02-T1.txt`:

```
pnpm audit:cctv --day 03  # should now exit 0; audit-deps shows WARN with 7 entries
cat .audit-exceptions.json | jq '.exceptions | length'  # 7
node -e "console.log(new Date('2026-05-27') > new Date())"  # true
```

Close TD-0008 in technical-debt.md (move to "Paid Debt" table).

Commit: `feat(process): audit exceptions mechanism, park DEF-0001 until Day 8 [D02-T1]`

### D02-T2 — Supabase project provision + region check CI wired

**Why**: Day 2 spine requires staging DB. Unlocks TD-0001 (migration-dryrun
CI), TD-0003 (region-check CI).

Allow-list:

- `supabase/config.toml` (project link)
- `supabase/migrations/` (empty so far)
- `.github/workflows/ci.yml` (un-stub region-check and migration-dryrun jobs)
- `scripts/lib/checks.ts` (move region-check from SKIPPED to wired)

Human-only sub-step (ask once):

- "Create Supabase project named `equitylens-staging` in region
  `ap-southeast-2` via supabase.com dashboard. Project ref + service-role
  key + anon key + DB password — paste back when ready. I'll store in
  Vercel env vars and GitHub secrets via your guidance."

After human provides:

1. Add Supabase secrets to:
   - GitHub repo secrets: `SUPABASE_PROJECT_REF`, `SUPABASE_MGMT_TOKEN`,
     `STAGING_DATABASE_URL` (postgres connection string)
   - Vercel env (staging): `NEXT_PUBLIC_SUPABASE_URL`,
     `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - Print exact dashboard navigation paths for the human to add manually
     (you cannot set via CLI without tokens that aren't shared).
2. `supabase link --project-ref <ref>` interactive — ask human to run, you
   prep config and verify config.toml afterward.
3. Un-stub the `region-check` job in ci.yml; remove `if: false`. Wire it
   to call `curl` against Supabase Management API and assert region.
4. Un-stub `migration-dryrun` job; wire per docs/operations/ci-cd-pipeline.md
   §4 (postgres service, applies schema + RLS, runs `pnpm db:migrate:dryrun`).
5. Add `db:migrate:dryrun` script: `tsx scripts/db-migrate-dryrun.ts` —
   spins ephemeral pg via docker if available locally; on CI uses the
   service container.

Checkpoint → `checkpoints/D02-T2.txt`:

```
pnpm supabase status      # linked, region ap-southeast-2
pnpm db:migrate:dryrun    # exit 0 against ephemeral or staging
# Push branch and verify CI region-check + migration-dryrun jobs RUN
# (not skipped) and PASS. Capture run URLs.
```

Close TD-0001, TD-0003, TD-0005 in technical-debt.md.

Commit: `feat(db): provision Supabase staging in ap-southeast-2, wire region + migration CI [D02-T2]`

### D02-T3 — Apply schema + RLS + cross-tenant probe

**Why**: end-of-day primary goal. Every table from spec must exist in
staging with policies attached.

Allow-list:

- `supabase/migrations/0001_baseline_schema.sql` (verbatim copy of docs/database/schema.sql)
- `supabase/migrations/0002_rls_policies.sql` (verbatim copy of docs/database/rls-policies.sql)
- `supabase/migrations/0003_policy_coverage.sql` (new — adds the policy_coverage.sql function from spec if not in 0001/0002)
- `tests/rls/cross-tenant.test.ts` (new)
- `tests/rls/policy-coverage.test.ts` (new)
- `apps/web/server/db/client.ts` (new — typed Supabase client)
- `package.json` (add @supabase/supabase-js)
- `apps/web/.env.example`, `apps/web/.env.local` (Supabase vars)
- `.github/workflows/ci.yml` (un-stub policy-coverage check if separate)

Spec:

1. Apply migrations to staging via `pnpm supabase db push` (after human
   confirms — destructive against fresh DB).
2. Cross-tenant test must:
   - Create tenant A and tenant B with one user each
   - For every table in the equitylens schema: assert tenant A's user
     reading tenant B's rows returns 0 rows OR 403/404 (not 200 + other
     tenant data, EVER).
   - Use auto-discovery: `SELECT table_name FROM information_schema.tables
WHERE table_schema = 'equitylens' AND table_type = 'BASE TABLE'` —
     no hardcoded table list.
3. Policy coverage test: runs the function from rls-policies.sql, asserts
   zero uncovered tables.
4. Reversibility test: `up → down → up` against ephemeral pg.

Checkpoint → `checkpoints/D02-T3.txt`:

```
pnpm supabase db push           # migrations applied to staging
pnpm test tests/rls/            # both files green
pnpm db:migrate:dryrun --reverse  # down works
pnpm test tests/rls/             # still green after up→down→up
# Capture: list of equitylens.* tables, policy count, test pass output
```

Commit: `feat(db): apply baseline schema + RLS with cross-tenant probe [D02-T3]`

### D02-T4 — Close out (housekeeping, ≤30min, no approval per task)

This is the daily ritual close-out, not a major deliverable. Combine
into one commit at end of day.

- Append Day 2 entry to daily-progress-log.md (honest status)
- Update defect-log if any failures encountered
- Update deviation-log
- Close TDs paid (TD-0001, TD-0003, TD-0005, TD-0008)
- Generate docs/process/prompts/day-02/03-end-of-day-report.md
- Tag: `git tag -a day-02-end -m "Day 2 complete: Supabase staging + schema + RLS"`
- Push tag

Commit: `chore(process): day 2 closeout — registers, EOD report, tag [D02-T4]`

## Anti-scope

- No Next.js migration (Day 8, BL-0022)
- No auth implementation (Day 3)
- No engine source (Day 4)
- No UI work (Day 8+)
- No seed data beyond what RLS tests need
- Do NOT modify docs/database/schema.sql or docs/database/rls-policies.sql
  — the migrations are verbatim copies; if the spec is wrong, fix the
  spec in a separate commit with explicit reasoning (and log a deviation)

## Failure handling

Same as Day 1: checkpoint fail → halt + log DEF + propose one fix-forward.
Spec ambiguity → log DEV as `interpretation`, propose reading, continue.

## Commit approval protocol

Same "Ready to commit [DNN-TM]" block as Day 1. Wait for `approve` /
`revise <note>` / `reject <reason>` / `defer <reason>` before each commit.

## Start

Acknowledge by listing:

1. The four Day 2 task IDs
2. The required human-driven steps (Supabase project creation + secrets,
   `supabase link` interactive run)
3. Begin pre-flight, then D02-T1.
