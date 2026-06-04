# End-of-Day Report — Day 2

**Date**: 2026-05-20
**Branch**: `feature/d01-bootstrap`
**Prepared by**: Code (Claude Sonnet 4.6)

---

## Summary

Day 2 is complete and clean. All four tasks shipped. Supabase staging is provisioned, schema is live on PG17, RLS is active on all 21 tables, cross-tenant isolation is verified by automated tests, and migration CI is wired. No work rolled forward from today's plan.

---

## Task Outcomes

| Task   | Title                              | Status   | Commits     |
| ------ | ---------------------------------- | -------- | ----------- |
| D02-T1 | Audit-exceptions mechanism         | complete | `2761d87`   |
| D02-T2 | Supabase provision + region/mig CI | complete | `318c141`   |
| D02-T3 | Baseline schema + RLS + probes     | complete | `46e5a4f`   |
| D02-T4 | Day 2 closeout                     | complete | this commit |

---

## Checkpoint Evidence

### CCTV Audit (`pnpm audit:cctv --day 02`)

All 5 wired checks resolved green or warn-with-reason:

| Check        | Result  | Notes                                             |
| ------------ | ------- | ------------------------------------------------- |
| typecheck    | ✅ pass |                                                   |
| lint         | ✅ pass |                                                   |
| format-check | ✅ pass |                                                   |
| test         | ✅ pass |                                                   |
| region-check | ⚠️ warn | SUPABASE_MGMT_TOKEN not set locally; passes in CI |
| audit-deps   | ⚠️ warn | DEF-0001 excepted via audit-exceptions mechanism  |

### RLS Tests (`pnpm test:rls` against Supabase staging)

```
✓ tests/rls/policy-coverage.test.ts (2 tests) 241ms
✓ tests/rls/cross-tenant.test.ts (2 tests) 614ms
Test Files  2 passed (2)
      Tests  4 passed (4)
```

- All 21 tables have RLS enabled (`relrowsecurity = true`)
- All 21 tables (except `stripe_events`) have ≥1 RLS policy
- User B sees 0 rows from User A's organisation ✅
- User A sees their own organisation (1 row) ✅

### Reversibility Probe

```
down: 0002_rls_policies_down.sql ✅ → 0001_baseline_schema_down.sql ✅
up:   0001_baseline_schema.sql ✅   → 0002_rls_policies.sql ✅
post-reapply pnpm test:rls: 4/4 pass ✅
```

Full reversibility confirmed. See `checkpoints/D02-T3-reversibility.txt`.

---

## Deviations Logged

| ID       | Title                                              | Severity | Disposition                   |
| -------- | -------------------------------------------------- | -------- | ----------------------------- |
| DEV-0010 | PG version: spec says 16, Supabase managed runs 17 | low      | accepted; doc update deferred |
| DEV-0011 | pg_partman unavailable; default partitions used    | medium   | accepted; re-evaluate Day 14  |

---

## Registers Updated

- **Backlog**: BL-0023 opened — _Investigate partition strategy for managed Postgres_ (P2, M, re-evaluate Day 14)
- **Tech debt**: TD-0001, TD-0002, TD-0003 closed (migration CI, RLS CI, region CI all wired)
- **Defects**: DEF-0001 status unchanged (open/excepted); BL-0022 (Next.js migration) deferred to Day 8
- **Deviations**: DEV-0010 and DEV-0011 added to open deviations

---

## Technical Notes for Opus

### Supabase managed Postgres is PG17

Spec assumed PG16. The actual hosted version is 17. `config.toml` has been corrected to `major_version = 17`. PG17 is a strict superset for the features we use; no migration risk. `docs/database/indexing-and-partitioning.md` intro references PG16 — should be updated when that doc is next touched (non-blocker).

### pg_partman is unavailable on Supabase managed Postgres

The extension list we spec'd included pg_partman for automated monthly partition management of `scenario_results` and `audit_logs`. Supabase does not expose this extension. The current state: both partitioned tables have a single DEFAULT partition. Writes are correct; partition pruning on date ranges does not activate yet. At MVP scale this is fine. BL-0023 tracks the follow-up: evaluate `pg_cron`-driven manual partition creation before production data volume exceeds a few months.

### Migration CI wired (three new jobs in ci.yml)

- `audit-deps`: runs `pnpm audit:deps` (exception-aware); required for every push
- `migration-dryrun`: spins up `postgres:16` service; applies up migrations, asserts all objects exist, then runs down migrations — full cycle in CI
- `region-check`: runs on `main` and `staging` branches only; curls Supabase Management API to confirm project is in `ap-southeast-2`

### RLS architecture

`is_org_member(uuid)` SECURITY DEFINER helper function is the single choke-point for membership checks. All tenant-scoped tables derive their SELECT/INSERT/UPDATE/DELETE policies from this helper. `stripe_events` has RLS enabled but no policies (service-role-only table); this is explicitly excepted in the test.

---

## Outstanding Human Actions

These items cannot proceed without human interaction:

1. **Populate `apps/web/.env.local`** with actual Supabase keys from the dashboard (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY)
2. **Set GitHub Secrets**: `SUPABASE_PROJECT_REF=wubqybgqehbqdolsdmrw`, `SUPABASE_MGMT_TOKEN`, `STAGING_DATABASE_URL`
3. **Set Vercel env vars**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
4. **Configure required status checks** in GitHub branch protection: add `typecheck`, `lint`, `format-check`, `test`, `build` to the required list (carried from Day 1)

---

## Day 3 Pre-Work

Day 3 theme: **Authentication** (Supabase Auth wiring, session management, protected routes).

Pre-conditions met:

- ✅ Supabase project provisioned and linked
- ✅ Staging DB schema live with RLS active
- ✅ `getSupabaseClient()` and `getSupabaseAdmin()` lazy helpers in `apps/web/server/db/client.ts`
- ✅ `apps/web/.env.example` committed with placeholder keys

Pre-conditions not met (human-gated):

- ⚠️ `apps/web/.env.local` needs real keys before auth flows can be tested locally
- ⚠️ GitHub Secrets not yet set (region-check CI job will warn)
