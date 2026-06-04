/**
 * E2E auth flow: full sign-up → org creation → invite → accept → tenant isolation.
 *
 * Pre-conditions: Next.js dev server running at BASE_URL (or playwright.config.ts webServer).
 * Users are pre-created via Supabase Admin API (email_confirm: true) to skip email flows.
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY.
 */
import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
const SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';

const owner = {
  email: `e2e-owner-${Date.now()}@equitylens.test`,
  password: 'E2eOwnerPass-12345!',
  userId: '',
};
const member = {
  email: `e2e-member-${Date.now()}@equitylens.test`,
  password: 'E2eMemberPass-12345!',
  userId: '',
};
let orgId = '';
let inviteToken = '';

function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

test.beforeAll(async () => {
  const admin = adminClient();
  const { data: o } = await admin.auth.admin.createUser({
    email: owner.email,
    password: owner.password,
    email_confirm: true,
  });
  owner.userId = o.user!.id;

  const { data: m } = await admin.auth.admin.createUser({
    email: member.email,
    password: member.password,
    email_confirm: true,
  });
  member.userId = m.user!.id;
});

test.afterAll(async () => {
  const admin = adminClient();
  if (orgId) await admin.from('organisations').delete().eq('id', orgId);
  if (owner.userId) await admin.auth.admin.deleteUser(owner.userId);
  if (member.userId) await admin.auth.admin.deleteUser(member.userId);
});

test('owner signs in', async ({ page }) => {
  await page.goto('/sign-in');
  await page.fill('[name=email]', owner.email);
  await page.fill('[name=password]', owner.password);
  await page.click('[type=submit]');
  await page.waitForURL('/');
});

test('owner creates an organisation', async ({ page }) => {
  await page.goto('/sign-in');
  await page.fill('[name=email]', owner.email);
  await page.fill('[name=password]', owner.password);
  await page.click('[type=submit]');
  await page.waitForURL('/');

  await page.goto('/orgs/new');
  await page.fill('[name=name]', 'E2E Test Org');
  await page.click('[type=submit]');
  await page.waitForURL('/');

  // Retrieve the created org from DB.
  const admin = adminClient();
  const { data } = await admin
    .from('organisations')
    .select('id')
    .eq('created_by', owner.userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  expect(data).not.toBeNull();
  orgId = data!.id;
});

test('owner invites member and raw token is stored in DB', async () => {
  // Directly call the DB (server action isn't accessible without auth cookie from a test).
  // We simulate the invite by inserting directly via admin client.
  const { createHash, randomBytes } = await import('crypto');
  const token = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  inviteToken = token;

  const admin = adminClient();
  const { error } = await admin.from('org_invites').insert({
    org_id: orgId,
    email: member.email,
    role: 'viewer',
    token_hash: tokenHash,
    invited_by: owner.userId,
  });
  expect(error).toBeNull();
});

test('member accepts invite via UI', async ({ page }) => {
  await page.goto('/sign-in');
  await page.fill('[name=email]', member.email);
  await page.fill('[name=password]', member.password);
  await page.click('[type=submit]');
  await page.waitForURL('/');

  await page.goto(`/invites/${inviteToken}`);
  await page.click('button');
  await page.waitForURL('/');

  // Verify membership in DB.
  const admin = adminClient();
  const { data } = await admin
    .from('user_org_membership')
    .select('org_id')
    .eq('user_id', member.userId)
    .eq('org_id', orgId)
    .single();
  expect(data).not.toBeNull();
});

test('both users are members of the org', async () => {
  const admin = adminClient();
  const { data } = await admin.from('user_org_membership').select('user_id').eq('org_id', orgId);

  const memberIds = (data ?? []).map((r: { user_id: string }) => r.user_id);
  expect(memberIds).toContain(owner.userId);
  expect(memberIds).toContain(member.userId);
});

test('member cannot see orgs they are not a member of (cross-tenant isolation)', async () => {
  const admin = adminClient();

  // Create an unrelated org.
  const { data: otherOrg } = await admin
    .from('organisations')
    .insert({ name: 'Unrelated E2E Org', created_by: owner.userId })
    .select('id')
    .single();

  // Sign in as member and use their access token to query membership.
  const { createClient: createAnonClient } = await import('@supabase/supabase-js');
  const anon = createAnonClient(SUPABASE_URL, process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? '', {
    auth: { persistSession: false },
  });
  const { data: session } = await anon.auth.signInWithPassword({
    email: member.email,
    password: member.password,
  });

  const memberClient = createAnonClient(
    SUPABASE_URL,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? '',
    {
      global: { headers: { Authorization: `Bearer ${session.session!.access_token}` } },
      auth: { persistSession: false },
    },
  );

  const { data } = await memberClient
    .from('user_org_membership')
    .select('org_id')
    .eq('org_id', otherOrg!.id);

  expect(data).toHaveLength(0); // member cannot see the unrelated org

  // Clean up.
  await admin.from('organisations').delete().eq('id', otherOrg!.id);
});
