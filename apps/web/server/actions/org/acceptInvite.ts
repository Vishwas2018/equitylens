'use server';

import { createHash } from 'crypto';

import { appendAuditEntry } from '../../audit/log';
import { createActionClient } from '../../auth/actionClient';
import { getSupabaseAdmin } from '../../db/client';

export interface AcceptInviteResult {
  orgId: string | null;
  error: string | null;
}

export async function acceptInvite(
  token: string,
  ip?: string,
  userAgent?: string,
): Promise<AcceptInviteResult> {
  const supabase = await createActionClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return { orgId: null, error: 'Not authenticated' };

  const tokenHash = createHash('sha256').update(token).digest('hex');
  const admin = getSupabaseAdmin();

  const { data: invite } = await admin
    .from('org_invites')
    .select('id,org_id,email,role,expires_at,accepted_at')
    .eq('token_hash', tokenHash)
    .single();

  if (!invite || invite.accepted_at || new Date(invite.expires_at) < new Date()) {
    await appendAuditEntry({
      action: 'rls_deny',
      resourceType: 'user_org_membership',
      actorUserId: session.user.id,
      ip,
      userAgent,
    });
    return { orgId: null, error: 'Invalid or expired invite' };
  }

  // Create membership.
  const { error: memberErr } = await admin.from('user_org_membership').insert({
    user_id: session.user.id,
    org_id: invite.org_id,
    role: invite.role,
    is_default: false,
  });

  if (memberErr) {
    await appendAuditEntry({
      action: 'rls_deny',
      resourceType: 'user_org_membership',
      actorUserId: session.user.id,
      tenantId: invite.org_id,
      ip,
      userAgent,
    });
    return { orgId: null, error: memberErr.message };
  }

  // Mark invite consumed.
  await admin
    .from('org_invites')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invite.id);

  await appendAuditEntry({
    action: 'create',
    resourceType: 'user_org_membership',
    actorUserId: session.user.id,
    tenantId: invite.org_id,
    resourceId: invite.org_id,
    ip,
    userAgent,
  });

  return { orgId: invite.org_id, error: null };
}
