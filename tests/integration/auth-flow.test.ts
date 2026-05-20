/**
 * Integration tests for the membership lifecycle.
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to run against staging.
 * Tests skip automatically when credentials are absent (safe for local dev without .env).
 */
import { createHash } from 'crypto';

import { afterAll, describe, expect, it } from 'vitest';

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL'];
const SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'];
const ANON_KEY = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

const skip = !SUPABASE_URL || !SERVICE_KEY || !ANON_KEY;

// Lazily import to avoid crashing when env vars are absent.
async function getAdmin() {
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(SUPABASE_URL!, SERVICE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getAnon(accessToken?: string) {
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(SUPABASE_URL!, ANON_KEY!, {
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const testEmail1 = `ci-owner-${Date.now()}@equitylens.test`;
const testEmail2 = `ci-member-${Date.now()}@equitylens.test`;
const testPassword = 'Test-Password-12345!';

let ownerAccessToken = '';
let memberAccessToken = '';
let ownerUserId = '';
let memberUserId = '';
let orgId = '';
let inviteToken = '';

describe.skipIf(skip)('auth lifecycle — signUp', () => {
  it('creates owner user via admin API', async () => {
    const admin = await getAdmin();
    const { data, error } = await admin.auth.admin.createUser({
      email: testEmail1,
      password: testPassword,
      email_confirm: true,
    });
    expect(error).toBeNull();
    ownerUserId = data.user!.id;
  });

  it('creates member user via admin API', async () => {
    const admin = await getAdmin();
    const { data, error } = await admin.auth.admin.createUser({
      email: testEmail2,
      password: testPassword,
      email_confirm: true,
    });
    expect(error).toBeNull();
    memberUserId = data.user!.id;
  });
});

describe.skipIf(skip)('auth lifecycle — signIn', () => {
  it('owner can sign in and get access token', async () => {
    const client = await getAnon();
    const { data, error } = await client.auth.signInWithPassword({
      email: testEmail1,
      password: testPassword,
    });
    expect(error).toBeNull();
    ownerAccessToken = data.session!.access_token;
  });

  it('member can sign in and get access token', async () => {
    const client = await getAnon();
    const { data, error } = await client.auth.signInWithPassword({
      email: testEmail2,
      password: testPassword,
    });
    expect(error).toBeNull();
    memberAccessToken = data.session!.access_token;
  });
});

describe.skipIf(skip)('auth lifecycle — createOrg', () => {
  it('owner can create an organisation', async () => {
    const admin = await getAdmin();
    const { data: org, error: orgErr } = await admin
      .from('organisations')
      .insert({ name: 'CI Test Org', created_by: ownerUserId })
      .select('id')
      .single();
    expect(orgErr).toBeNull();
    orgId = org!.id;

    const { error: memErr } = await admin.from('user_org_membership').insert({
      user_id: ownerUserId,
      org_id: orgId,
      role: 'owner',
      is_default: true,
    });
    expect(memErr).toBeNull();
  });
});

describe.skipIf(skip)('auth lifecycle — inviteMember', () => {
  it('owner can create an invite token', async () => {
    const admin = await getAdmin();
    const token = 'a'.repeat(64); // deterministic for test
    const tokenHash = createHash('sha256').update(token).digest('hex');
    inviteToken = token;

    const { error } = await admin.from('org_invites').insert({
      org_id: orgId,
      email: testEmail2,
      role: 'viewer',
      token_hash: tokenHash,
      invited_by: ownerUserId,
    });
    expect(error).toBeNull();
  });
});

describe.skipIf(skip)('auth lifecycle — acceptInvite', () => {
  it('member can accept invite and get membership', async () => {
    const admin = await getAdmin();
    const tokenHash = createHash('sha256').update(inviteToken).digest('hex');

    const { data: invite } = await admin
      .from('org_invites')
      .select('id,org_id,role')
      .eq('token_hash', tokenHash)
      .single();
    expect(invite).not.toBeNull();

    const { error: memErr } = await admin.from('user_org_membership').insert({
      user_id: memberUserId,
      org_id: invite!.org_id,
      role: invite!.role,
      is_default: false,
    });
    expect(memErr).toBeNull();

    await admin
      .from('org_invites')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invite!.id);
  });

  it('member is now visible in org membership', async () => {
    const admin = await getAdmin();
    const { data, error } = await admin
      .from('user_org_membership')
      .select('user_id,role')
      .eq('org_id', orgId);
    expect(error).toBeNull();
    const memberIds = (data ?? []).map((r: { user_id: string }) => r.user_id);
    expect(memberIds).toContain(memberUserId);
    expect(memberIds).toContain(ownerUserId);
  });
});

describe.skipIf(skip)('auth lifecycle — switchOrg', () => {
  it('member can switch active org via RPC', async () => {
    const client = await getAnon(memberAccessToken);
    const { error } = await client.rpc('set_active_org', { p_org_id: orgId });
    expect(error).toBeNull();

    const admin = await getAdmin();
    const { data } = await admin
      .from('user_org_membership')
      .select('is_default')
      .eq('user_id', memberUserId)
      .eq('org_id', orgId)
      .single();
    expect(data?.is_default).toBe(true);
  });
});

describe.skipIf(skip)('auth lifecycle — cross-tenant isolation', () => {
  it('member cannot read another org they are not in', async () => {
    const admin = await getAdmin();
    const { data: otherOrg } = await admin
      .from('organisations')
      .insert({ name: 'Other CI Org', created_by: ownerUserId })
      .select('id')
      .single();

    const memberClient = await getAnon(memberAccessToken);
    const { data } = await memberClient
      .from('user_org_membership')
      .select('org_id')
      .eq('org_id', otherOrg!.id);
    expect(data).toHaveLength(0);
  });
});

afterAll(async () => {
  if (skip) return;
  const admin = await getAdmin();
  // Clean up test users and orgs.
  if (orgId) await admin.from('organisations').delete().eq('id', orgId);
  if (ownerUserId) await admin.auth.admin.deleteUser(ownerUserId);
  if (memberUserId) await admin.auth.admin.deleteUser(memberUserId);
});
