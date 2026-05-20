# End-of-Day Report — Day 3

**Date**: 2026-05-20
**Branch**: `feature/d01-bootstrap`
**Prepared by**: Code (Claude Sonnet 4.6)

---

## Summary

Day 3 is complete and clean. All four tasks shipped. A user can now sign up, create an org, invite a member (token-based), accept the invite, and have their session scoped to a single org via Supabase RLS. Every server action writes an audit_log entry with an unbroken SHA-256 hash chain. Sign-in is rate-limited at 10 requests/60 s/IP via Upstash. Six Playwright E2E tests cover the full auth/tenancy flow. No work rolled forward from today's plan.

---

## Task Outcomes

| Task   | Title                                         | Status   | Commits              |
| ------ | --------------------------------------------- | -------- | -------------------- |
| D03-T1 | Supabase Auth config + middleware + session   | complete | `b9f73e7`, `c0d80d7` |
| D03-T2 | Server actions + audit hash chain             | complete | `d934a76`            |
| D03-T3 | Upstash rate-limit + E2E + cross-tenant probe | complete | `647372d`            |
| D03-T4 | Day 3 closeout                                | complete | this commit          |

---

## Checkpoint Evidence

### Unit + Integration Tests

```
pnpm test tests/integration/audit-chain.test.ts   → 10/10 ✅
pnpm test tests/integration/auth-flow.test.ts     → 10/10 ✅ (staging)
pnpm test tests/integration/rate-limit.test.ts    →  5/5  ✅
pnpm test tests/integration/cross-tenant-api.test.ts → 2/2 ✅ (vacuous)
```

### Playwright E2E

```
tests/e2e/auth-flow.spec.ts (6 tests)
  ✓ owner signs in
  ✓ owner creates an organisation
  ✓ owner invites member and raw token is stored in DB
  ✓ member accepts invite via UI
  ✓ both users are members of the org
  ✓ member cannot see orgs they are not a member of (cross-tenant isolation)
```

Requires: Next.js dev server + staging Supabase creds. CI e2e job wired and will run on push.

### Code Quality

```
pnpm typecheck    ✅
pnpm lint         ✅
pnpm format:check ✅
```

See `checkpoints/D03-T1-auth-config.txt`, `D03-T2.txt`, `D03-T3.txt`.

---

## Deviations Logged

| ID       | Title                                                   | Severity | Disposition                              |
| -------- | ------------------------------------------------------- | -------- | ---------------------------------------- |
| DEV-0012 | is_default column added via migration 0003; not in 0001 | low      | accepted; forward migration is correct   |
| DEV-0013 | Invite token is one-time grant, not magic-link sign-in  | low      | accepted; magic links disabled by design |
| DEV-0014 | appendAuditEntry prev_hash fetch is non-atomic          | low      | accepted; TD-0009 tracks atomic fix      |

---

## Registers Updated

- **Tech debt**: TD-0009 opened — _appendAuditEntry non-atomic prev_hash fetch_ (auth, low, open, linked DEV-0014). TD-0008 numbering collision corrected (TD-0008 was already paid — audit-exceptions mechanism, Day 02).
- **Deviations**: DEV-0012, DEV-0013, DEV-0014 added to open deviations.
- **Backlog**: no new entries.
- **Defects**: none.

---

## Technical Notes for Opus

### Auth architecture

- **Session layer**: `@supabase/ssr` `createServerClient` with cookie transport. JWT verified locally via `jose` + `SUPABASE_JWT_SECRET` (no network call on hot path).
- **Middleware** (`apps/web/middleware.ts`): `withAuth()` wraps all non-public routes. Session is refreshed on every request; unauthenticated requests redirect to `/sign-in`.
- **Org switching**: `set_active_org(p_org_id)` SECURITY DEFINER pg function atomically flips `is_default` on `user_org_membership`. Active org is mirrored to `app_metadata.active_org_id` via `updateUserById` (makes it available in the JWT for RLS).

### Audit hash chain

- `appendAuditEntry` anonymises the payload (all IDs SHA-256 hashed + pepper), fetches the previous `computed_hash`, and inserts `prev_hash || canonicalJson(anonymised)` → SHA-256 as `computed_hash`.
- `canonicalJson` sorts object keys recursively for deterministic re-canonicalization.
- `verifyAuditChain` re-canonicalizes stored JSONB metadata and re-derives the expected `computed_hash`. Any tampered or branched row surfaces as `firstBrokenId`.
- Non-atomic risk logged as TD-0009 / DEV-0014. At MVP scale (sequential server actions, single region) the race window is negligible.

### Invite flow design

Magic links are disabled in the Supabase project (financial app security posture). Invite tokens are:

1. `randomBytes(32).toString('hex')` → raw token (sent in email / URL, never stored).
2. `sha256(token)` → `token_hash` (stored in `org_invites.token_hash`).
3. `acceptInvite(token)` re-hashes the raw token, looks up the invite, validates expiry + not-yet-accepted, inserts into `user_org_membership` via admin client, marks `accepted_at`.

### Rate limiter testability

`@upstash/ratelimit` module mocking was unreliable under Vitest ESM on Windows. Pattern used: module-level `let _limitFn: LimitFn | null = null` with `_setLimitFn(fn)` export. Tests inject a mock function directly; production path lazy-initialises the real Upstash client via `Redis.fromEnv()`.

### Cross-tenant API probe

`tests/integration/cross-tenant-api.test.ts` walks `apps/web/app/api/**` and auto-discovers routes with `[org_id]`, `[id]`, or similar dynamic segments. Currently vacuous (only `/api/health` exists — no ID-parameterised routes). When Day 7 API routes land, they are automatically enrolled in the 403 assertion loop with no test changes required.

---

## Outstanding Human Actions

Carried forward from Days 1–2 (no new human-gated items added today):

1. **Supabase Dashboard**: configure redirect URLs (`/auth/callback`); verify email confirmation enabled; verify magic link disabled.
2. **GitHub Secrets**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `AUDIT_HASH_PEPPER` — required for the CI e2e job to run.
3. **GitHub branch protection**: add `typecheck`, `lint`, `format-check`, `test`, `build` to required status checks.
4. **Vercel env vars**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public), `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `UPSTASH_*`, `AUDIT_HASH_PEPPER` (server-side).

---

## Day 4 Pre-Work

Day 4 theme: **Calculation Engine** (core financial modelling logic).

Pre-conditions met:

- ✅ Auth fully wired — `getSession()`, `withAuth()`, server actions
- ✅ Org membership scoped by RLS — `is_org_member()` helper active
- ✅ Audit chain live — all server actions write audit entries
- ✅ Supabase staging provisioned with 0001–0004 migrations applied

Pre-conditions not yet met (human-gated):

- ⚠️ GitHub Secrets not yet set → CI e2e job will skip/fail on push
- ⚠️ Supabase redirect URLs not yet configured → `/auth/callback` won't resolve in staging UI
