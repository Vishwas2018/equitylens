/**
 * D13-T3 JWT decode probe — technique B (BL-0029).
 *
 * Uses the Supabase JS client with a real user JWT issued by Supabase Auth and
 * verified by PostgREST. Queries deliberately omit any app-level user_id filter
 * so that RLS alone enforces cross-tenant isolation.
 *
 * Contrast with cross-tenant.test.ts (technique A: SET LOCAL role in raw postgres)
 * which verifies the DB-layer policy. This probe verifies the full path:
 *   Auth JWT → PostgREST → auth.uid() decode → RLS policy evaluation.
 *
 * Env prereqs (all three required, else entire suite skips):
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 *
 * Tables covered:
 *   - portfolios (dual-path policy: user_id = auth.uid() OR is_org_member)
 *   - report_jobs (simple policy: user_id = auth.uid())
 *
 * Full table coverage is provided by technique A (cross-tenant.test.ts).
 * These two tables are representative of both RLS policy shapes.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'];
const anonKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

const hasAllEnv = !!(supabaseUrl && anonKey && serviceRoleKey);

// Fixed probe row IDs (different namespace from cross-tenant.test.ts fixtures)
const PROBE_ORG_ID = '00000000-0000-0000-0000-000000000011';
const PROBE_PORTFOLIO_ID = '00000000-0000-0000-0000-000000000012';
const PROBE_REPORT_JOB_ID = '00000000-0000-0000-0000-000000000013';

// Probe user emails — unique per run to avoid conflicts with stale auth users
const runId = Date.now().toString(36);
const PROBE_EMAIL_A = `probe-jwt-a-${runId}@probe.equitylens.local`;
const PROBE_EMAIL_B = `probe-jwt-b-${runId}@probe.equitylens.local`;
const PROBE_PASSWORD = 'ProbeJwt@Rls1234!';

describe.skipIf(!hasAllEnv)('JWT decode probe (technique B)', () => {
  let adminClient: SupabaseClient;
  let userAId = '';
  let userBId = '';
  let jwtA = '';
  let jwtB = '';

  function rlsClient(jwt: string): SupabaseClient {
    return createClient(supabaseUrl!, anonKey!, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  beforeAll(async () => {
    adminClient = createClient(supabaseUrl!, serviceRoleKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Remove any stale probe data from previous failed runs
    await adminClient.from('report_jobs').delete().eq('id', PROBE_REPORT_JOB_ID);
    await adminClient.from('user_org_membership').delete().eq('org_id', PROBE_ORG_ID);
    await adminClient.from('organisations').delete().eq('id', PROBE_ORG_ID); // cascades portfolios

    // Create probe auth users
    const { data: dataA, error: errA } = await adminClient.auth.admin.createUser({
      email: PROBE_EMAIL_A,
      password: PROBE_PASSWORD,
      email_confirm: true,
    });
    if (errA || !dataA.user) throw new Error(`createUser A: ${errA?.message ?? 'no user'}`);
    userAId = dataA.user.id;

    const { data: dataB, error: errB } = await adminClient.auth.admin.createUser({
      email: PROBE_EMAIL_B,
      password: PROBE_PASSWORD,
      email_confirm: true,
    });
    if (errB || !dataB.user) throw new Error(`createUser B: ${errB?.message ?? 'no user'}`);
    userBId = dataB.user.id;

    // Sign each user in to get a real Supabase JWT (auth.uid() = their UUID)
    const anonClient = createClient(supabaseUrl!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: sessA, error: signErrA } = await anonClient.auth.signInWithPassword({
      email: PROBE_EMAIL_A,
      password: PROBE_PASSWORD,
    });
    if (signErrA || !sessA.session)
      throw new Error(`signIn A: ${signErrA?.message ?? 'no session'}`);
    jwtA = sessA.session.access_token;

    const { data: sessB, error: signErrB } = await anonClient.auth.signInWithPassword({
      email: PROBE_EMAIL_B,
      password: PROBE_PASSWORD,
    });
    if (signErrB || !sessB.session)
      throw new Error(`signIn B: ${signErrB?.message ?? 'no session'}`);
    jwtB = sessB.session.access_token;

    // Insert probe data for user A via service role (bypasses RLS — setup only)
    await adminClient.from('organisations').insert({
      id: PROBE_ORG_ID,
      name: 'JWT Probe Org A',
      created_by: userAId,
    });

    await adminClient
      .from('user_org_membership')
      .insert({ user_id: userAId, org_id: PROBE_ORG_ID, role: 'owner' });

    await adminClient.from('portfolios').insert({
      id: PROBE_PORTFOLIO_ID,
      org_id: PROBE_ORG_ID,
      user_id: userAId,
      name: 'JWT Probe Portfolio',
    });

    await adminClient.from('report_jobs').insert({
      id: PROBE_REPORT_JOB_ID,
      user_id: userAId,
      template_id: 'portfolio-summary',
      format: 'csv',
      scope: {},
      status: 'queued',
    });
  });

  afterAll(async () => {
    if (!adminClient) return;
    // Data cleanup — org cascade handles portfolios + memberships
    await adminClient.from('report_jobs').delete().eq('id', PROBE_REPORT_JOB_ID);
    await adminClient.from('user_org_membership').delete().eq('org_id', PROBE_ORG_ID);
    await adminClient.from('organisations').delete().eq('id', PROBE_ORG_ID);
    // Auth user cleanup
    if (userAId) await adminClient.auth.admin.deleteUser(userAId);
    if (userBId) await adminClient.auth.admin.deleteUser(userBId);
  });

  // ── portfolios — dual-path policy ─────────────────────────────────────────
  // Policy: user_id = auth.uid() OR is_org_member(org_id, [...])
  // USER_B: not the owner (user_id mismatch) and not an org member → 0 rows

  it('JWT probe: user B cannot read user A portfolio without app-level filter', async () => {
    const { data } = await rlsClient(jwtB)
      .from('portfolios')
      .select('id')
      .eq('id', PROBE_PORTFOLIO_ID);
    expect(data?.length ?? 0, 'RLS must block JWT-B from reading JWT-A portfolio').toBe(0);
  });

  it('JWT probe: user A can read their own portfolio', async () => {
    const { data } = await rlsClient(jwtA)
      .from('portfolios')
      .select('id')
      .eq('id', PROBE_PORTFOLIO_ID);
    expect(data?.length ?? 0, 'RLS must permit JWT-A to read their own portfolio').toBe(1);
  });

  // ── report_jobs — simple user_id policy ───────────────────────────────────
  // Policy: user_id = auth.uid()
  // USER_B: user_id = USER_A_UUID ≠ auth.uid() → 0 rows

  it('JWT probe: user B cannot read user A report_job without app-level filter', async () => {
    const { data } = await rlsClient(jwtB)
      .from('report_jobs')
      .select('id')
      .eq('id', PROBE_REPORT_JOB_ID);
    expect(data?.length ?? 0, 'RLS must block JWT-B from reading JWT-A report_job').toBe(0);
  });

  it('JWT probe: user A can read their own report_job', async () => {
    const { data } = await rlsClient(jwtA)
      .from('report_jobs')
      .select('id')
      .eq('id', PROBE_REPORT_JOB_ID);
    expect(data?.length ?? 0, 'RLS must permit JWT-A to read their own report_job').toBe(1);
  });
});
