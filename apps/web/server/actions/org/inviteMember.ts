'use server';

// DEV-0013: inviteMember generates a one-time token delivered out-of-band (or
// via Supabase transactional email in a later task). The spec prohibits magic
// link as a sign-in method; this invite token is a one-time membership grant
// only — distinct from magic-link sign-in. Interpretation: disable = sign-in
// magic links; invite token = allowed. Logged as DEV-0013, severity: low.

import type { OrgRole } from '@equitylens/types';

import { appendAuditEntry, generateInviteToken } from '../../audit/log';
import { createActionClient } from '../../auth/actionClient';
import { getSupabaseAdmin } from '../../db/client';

export interface InviteMemberResult {
  token: string | null; // raw token returned for testing; production sends via email
  error: string | null;
}

export async function inviteMember(
  orgId: string,
  email: string,
  role: OrgRole = 'viewer',
  ip?: string,
  userAgent?: string,
): Promise<InviteMemberResult> {
  const supabase = createActionClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return { token: null, error: 'Not authenticated' };

  const admin = getSupabaseAdmin();

  // Verify the caller is an owner or admin of the org.
  const { data: membership } = await admin
    .from('user_org_membership')
    .select('role')
    .eq('user_id', session.user.id)
    .eq('org_id', orgId)
    .single();

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    await appendAuditEntry({
      action: 'rls_deny',
      resourceType: 'org_invite',
      actorUserId: session.user.id,
      tenantId: orgId,
      ip,
      userAgent,
    });
    return { token: null, error: 'Insufficient permissions' };
  }

  const { token, tokenHash } = generateInviteToken();

  const { error: insertErr } = await admin.from('org_invites').insert({
    org_id: orgId,
    email,
    role,
    token_hash: tokenHash,
    invited_by: session.user.id,
  });

  if (insertErr) {
    await appendAuditEntry({
      action: 'rls_deny',
      resourceType: 'org_invite',
      actorUserId: session.user.id,
      tenantId: orgId,
      ip,
      userAgent,
    });
    return { token: null, error: insertErr.message };
  }

  await appendAuditEntry({
    action: 'create',
    resourceType: 'org_invite',
    actorUserId: session.user.id,
    tenantId: orgId,
    ip,
    userAgent,
  });

  return { token, error: null };
}
