# Day 3 — Auth, Tenancy, Session Model (EquityLens)

Read first:

- docs/process/prompts/day-02/03-end-of-day-report.md
- docs/process/registers/{defect-log,deviation-log,technical-debt,daily-progress-log,product-backlog}.md
- docs/process/15-day-plan.md § Day 3
- docs/database/schema.sql (auth.users, organizations, organization_members, audit_logs)
- docs/database/rls-policies.sql (is_org_member() + how session hydrates org context)
- docs/architecture/security-and-compliance.md § auth, session, rate-limit
- docs/architecture/system-architecture.md § 3 (Auth Flow) + § 3.1 (Session model)

## Pre-flight (autonomous, no approval needed)

1. Verify all five human-driven prerequisites landed:
   - apps/web/.env.local has NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (non-empty, non-placeholder)
   - GitHub secrets present (probe via gh CLI if available; otherwise check by triggering a no-op workflow_dispatch and confirm green)
   - Vercel env vars present (probe via `vercel env ls staging`)
   - UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN in .env.local and Vercel
   - GitHub branch protection: required status checks include typecheck, lint, format-check, test, build (probe via `gh api repos/:owner/:repo/branches/main/protection`)
     If any are missing, halt and surface the specific gap. Do not proceed.
2. Run `pnpm audit:cctv --day 03`. Regenerate morning CCTV report against day-02-end state.
3. Save this prompt verbatim to docs/process/prompts/day-03/02-daily-execution-prompt.md.
4. Confirm pre-flight done.

## Primary goal

End of day: a user can sign up, create an org, invite a member, the
invitee accepts, and the membership is correctly scoped by RLS end-to-end.
Every server action writes an audit_log entry with an unbroken hash
chain and correct tenant_id_hash. Sign-in is rate-limited at 10/min/IP.

## Naming note (carry from Day 2)

Schema uses `organizations` / `organization_members` / `is_org_member()`.
The 15-day plan and earlier docs use "tenant" interchangeably. Use
"organization" in code (matches schema); "tenant" remains valid in
prose for cross-cutting concepts (tenant*id_hash in audit logs, RLS
tenant isolation as a category). If you spot any code-side drift toward
"tenant*\_" identifiers, log DEV and align to "org\_\_".

## Tasks

### D03-T1 — Supabase Auth config + middleware + session hydration

**Why**: foundation. Everything else needs a verified session with
org_id resolved from the active membership.

Allow-list:

- Supabase Dashboard configuration (document the exact settings applied
  in checkpoints/D03-T1-auth-config.txt — you cannot apply via CLI, so
  produce a numbered step list for the human to action in dashboard;
  THEN proceed assuming applied; verify via API probe at end)
- apps/web/middleware.ts (new)
- apps/web/server/auth/session.ts (new — getServerSession, getActiveOrgId)
- apps/web/server/auth/context.ts (new — withUserContext helper that sets
  request.session_user_id for RLS via SET LOCAL)
- apps/web/server/db/client.ts (extend — add getRlsAwareClient(userId))
- apps/web/app/(auth)/layout.tsx (new — minimal shell, no design polish)
- packages/types/src/auth.ts (new — Session, ActiveOrg types)

Spec:

1. Supabase Auth settings (document for human, then verify):
   - Email confirmations: ENABLED
   - Magic link: DISABLED (BL-NNNN for Day 14)
   - OAuth providers: NONE
   - Password policy: min 12 chars, NIST-aligned (no rotation, no
     composition rules)
   - Session JWT: 12h access, 30d refresh (rotation on use)
   - Redirect URLs allowlist: localhost:3000, staging Vercel URL,
     production Vercel URL (read from VERCEL_URL env)
2. Middleware enforces session on all routes except (auth)/\* and public
   marketing. On valid session: resolves active org via
   organization_members.is_default = true (or most recently used —
   define which now; spec says "active membership", interpret as
   default-on-signup, switch-on-explicit-action).
3. withUserContext sets `SET LOCAL request.session_user_id = $1` before
   every RLS-aware query. Service role usage forbidden outside this
   helper (lint rule via eslint-plugin-custom: no @supabase/supabase-js
   service-role import outside server/db/admin/\*).
4. session.ts must verify JWT signature locally (not call Supabase on
   every request — that's a hot-path killer). Use SUPABASE_JWT_SECRET.

Checkpoint → `checkpoints/D03-T1.txt`:

```
# Probe Supabase Auth config via Management API
curl -H "Authorization: Bearer $SUPABASE_MGMT_TOKEN" \
  https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/config/auth \
  | jq '{email_enabled, magic_link_enabled, jwt_exp}'
# Expect: email_enabled=true, magic_link_enabled=false, jwt_exp=43200

pnpm test apps/web/server/auth/session.test.ts  # 4+ tests pass
pnpm typecheck                                   # exit 0
pnpm lint                                        # exit 0
```

Commit: `feat(auth): supabase auth config + session middleware + RLS context [D03-T1]`

### D03-T2 — Server actions + audit_logs hash chain

**Why**: the seven actions are the membership lifecycle. Each must
write an audit_log entry; the chain must be verifiable.

Allow-list:

- apps/web/server/actions/auth/{signUp,signIn,signOut}.ts (new)
- apps/web/server/actions/org/{createOrg,inviteMember,acceptInvite,switchOrg}.ts (new)
- apps/web/server/audit/log.ts (new — appendAuditEntry with hash chain)
- apps/web/server/audit/verify.ts (new — chain verification)
- apps/web/app/(auth)/{sign-up,sign-in}/page.tsx (new — minimal forms,
  zero design)
- apps/web/app/(app)/orgs/{new,switch}/page.tsx (new — minimal)
- apps/web/app/(app)/invites/[token]/page.tsx (new — minimal)
- supabase/migrations/0004_invites_table.sql (if not in 0001 — verify
  first; the schema spec includes it, just confirm)
- tests/integration/auth-flow.test.ts (new)
- tests/integration/audit-chain.test.ts (new)

Spec:

1. Audit log hash chain: each entry stores prev_hash + payload_hash +
   computed_hash. computed_hash = sha256(prev_hash || canonicalJson(payload)).
   First entry has prev_hash = '0' \* 64. Verification walks the chain and
   asserts each computed_hash matches stored hash.
2. Audit payload includes: actor_user_id_hash, tenant_id_hash (using
   hashTenant from observability spec), action, resource_type,
   resource_id, occurred_at (server time, UTC), ip_hash, user_agent_hash.
   NO raw IDs, NO PII in payload. Hashing function: sha256(id || PEPPER)
   where PEPPER is a server-only env var (set AUDIT_HASH_PEPPER in
   staging now via secret).
3. Server actions use Next 14 server actions ("use server"). Every
   action wrapped in withUserContext (except signUp/signIn which bootstrap
   the session) and appendAuditEntry on success AND failure.
4. inviteMember generates a one-time token (32 bytes hex, stored hashed
   in DB), expires in 7d, emails via Supabase Auth's invite flow (the
   only place where magic-link-shaped URLs are allowed — log a DEV if
   this conflicts with the magic-link-disabled stance, propose a
   reading: "magic link as auth method = disabled; invite token as
   one-time membership grant = allowed").
5. switchOrg updates organization_members.is_default for the user (set
   true on the target, false on others) and triggers session refresh
   to put new org_id into JWT custom claims (use Supabase Admin SDK
   updateUserById with app_metadata).

Checkpoint → `checkpoints/D03-T2.txt`:

```
pnpm test tests/integration/auth-flow.test.ts    # 7 tests, one per action
pnpm test tests/integration/audit-chain.test.ts  # chain verifies green
# Run flow manually via curl/script, dump audit_logs, verify chain
psql $STAGING_DATABASE_URL -c "SELECT count(*), bool_and(verified) FROM (SELECT verify_audit_chain()) v"
```

Add new DEFs/DEVs as encountered. Update technical-debt.md if any
shortcuts taken (e.g. UI forms unstyled — that's expected, not debt).

Commit: `feat(auth): membership lifecycle server actions + audit hash chain [D03-T2]`

### D03-T3 — Upstash rate-limit + E2E Playwright + cross-tenant API probe

**Why**: closes Day 3 checkpoints. Without these, "done" is unverifiable.

Allow-list:

- apps/web/server/rate-limit/upstash.ts (new — sliding window 10/min/IP)
- apps/web/server/actions/auth/signIn.ts (extend — wrap in rate limiter)
- tests/e2e/auth-flow.spec.ts (new — Playwright)
- tests/integration/cross-tenant-api.test.ts (new — 403 not 404 probe)
- tests/integration/rate-limit.test.ts (new — 429 after 10 in 60s)
- playwright.config.ts (new if absent, or extend)
- .github/workflows/ci.yml (un-stub e2e job if stubbed; wire Playwright
  against staging URL or local dev server in CI)
- package.json (@upstash/redis, @upstash/ratelimit, @playwright/test)

Spec:

1. Rate limiter: sliding window, 10 requests per 60 seconds per IP
   (X-Forwarded-For header from Vercel; fallback to req.ip for local).
   Returns 429 with Retry-After header on exceed. Applied to signIn
   only (not signUp — different abuse profile, defer).
2. E2E Playwright: sign-up new user → email confirm (use Supabase
   testing helper to auto-confirm in CI: createUser({email_confirm:
   true}) via service role) → create org → invite second user (email
   captured via Mailpit or inbucket if running, else via DB query for
   the invite token) → accept as second user → both users see org in
   list → second user cannot see first user's draft (negative assertion).
3. Cross-tenant API probe: hit /api/orgs/[other_org_id] as a user not
   in that org; assert 403 (never 404, never 200). Repeat for every
   /api/\* route that takes an org_id or resource_id. Auto-discover
   routes via filesystem walk of apps/web/app/api/\*\*.
4. Rate-limit test: 10 requests pass, 11th returns 429, Retry-After
   present, count resets after 60s (use vi.useFakeTimers for the
   window-advance check).

Checkpoint → `checkpoints/D03-T3.txt`:

```
pnpm test tests/integration/rate-limit.test.ts        # green
pnpm test tests/integration/cross-tenant-api.test.ts  # green (all routes 403)
pnpm playwright test tests/e2e/auth-flow.spec.ts      # green
# Push branch, verify CI e2e job RUNS (not skipped) and PASSES.
# Capture CI run URL.
```

Commit: `feat(auth): upstash rate-limit + E2E flow + cross-tenant 403 probe [D03-T3]`

### D03-T4 — Close out (housekeeping, ≤30min, no per-task approval)

- Append Day 3 entry to daily-progress-log.md (honest status)
- Update defect-log if any failures
- Update deviation-log (esp. if invite-token-vs-magic-link DEV logged)
- Close any TDs paid; open new TDs for known shortcuts (unstyled UI is
  expected, not debt — UI is Day 8)
- Re-evaluate DEV-0011 (pg_partman fallback) — still Day 14, no change
- Generate docs/process/prompts/day-03/03-end-of-day-report.md
- Tag: `git tag -a day-03-end -m "Day 3 complete: auth + tenancy + session"`
- Push tag

Commit: `chore(process): day 3 closeout — registers, EOD report, tag [D03-T4]`

## Anti-scope

- No MFA / TOTP (Day 14 — security review track)
- No SSO, no OAuth providers, no magic link
- No password reset UX polish (basic flow OK if Supabase provides it;
  do not build custom UI)
- No design work — forms are <form><input><button> with zero CSS
  beyond default (or single Tailwind class for layout sanity)
- No engine work (Day 4)
- No API contract formalisation beyond what auth needs (Day 7)
- No Stripe / billing (Day 13)
- Do NOT modify docs/database/schema.sql or docs/database/rls-policies.sql

## Failure handling

Same as Day 1 & 2: checkpoint fail → halt + log DEF + propose one
fix-forward. Spec ambiguity → log DEV as `interpretation`, propose
reading, continue.

Particular watch-outs:

- JWT custom claims via app_metadata: Supabase quirk — claims only
  appear in JWT after token refresh, not immediately. If switchOrg
  test fails on this, log DEV and use a session-refresh trigger.
- Supabase rate-limit on auth endpoints: Supabase itself rate-limits
  /token. If E2E hits this, slow the test loop, don't disable our own
  10/min limiter.
- Audit hash chain race: two concurrent appendAuditEntry calls can
  both read the same prev_hash. Serialise via row-lock on a single
  audit_chain_head row OR use a SERIALIZABLE transaction. Pick one,
  test it, log DEV with the chosen approach.

## Commit approval protocol

Same "READY TO COMMIT [DNN-TM]" block as Days 1 & 2. Wait for
`approve` / `revise <note>` / `reject <reason>` / `defer <reason>`
before each commit.

## Start

Acknowledge by listing:

1. The four Day 3 task IDs
2. The five human prerequisites you'll verify in pre-flight (and what
   you'll do if any are missing)
3. The naming decision (organizations in code, tenant in cross-cutting
   prose)
4. Begin pre-flight, then D03-T1.
