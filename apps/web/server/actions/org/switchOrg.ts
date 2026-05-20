'use server';

import { appendAuditEntry } from '../../audit/log';
import { createActionClient } from '../../auth/actionClient';
import { getSupabaseAdmin } from '../../db/client';

export interface SwitchOrgResult {
  error: string | null;
}

export async function switchOrg(
  orgId: string,
  ip?: string,
  userAgent?: string,
): Promise<SwitchOrgResult> {
  const supabase = createActionClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return { error: 'Not authenticated' };

  // Atomic default-switch via SECURITY DEFINER function.
  const { error: rpcErr } = await supabase.rpc('set_active_org', { p_org_id: orgId });

  if (rpcErr) {
    await appendAuditEntry({
      action: 'rls_deny',
      resourceType: 'user_org_membership',
      actorUserId: session.user.id,
      tenantId: orgId,
      ip,
      userAgent,
    });
    return { error: rpcErr.message };
  }

  // Propagate active_org_id into JWT app_metadata so future tokens carry it.
  await getSupabaseAdmin().auth.admin.updateUserById(session.user.id, {
    app_metadata: { active_org_id: orgId },
  });

  await appendAuditEntry({
    action: 'update',
    resourceType: 'user_org_membership',
    actorUserId: session.user.id,
    tenantId: orgId,
    ip,
    userAgent,
  });

  return { error: null };
}
