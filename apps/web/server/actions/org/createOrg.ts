'use server';

import { appendAuditEntry } from '../../audit/log';
import { createActionClient } from '../../auth/actionClient';
import { getSupabaseAdmin } from '../../db/client';

export interface CreateOrgResult {
  orgId: string | null;
  error: string | null;
}

export async function createOrg(
  name: string,
  abn?: string,
  ip?: string,
  userAgent?: string,
): Promise<CreateOrgResult> {
  const supabase = createActionClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return { orgId: null, error: 'Not authenticated' };

  const admin = getSupabaseAdmin();

  const { data: org, error: orgErr } = await admin
    .from('organisations')
    .insert({ name, abn: abn ?? null, created_by: session.user.id })
    .select('id')
    .single();

  if (orgErr || !org) {
    await appendAuditEntry({
      action: 'rls_deny',
      resourceType: 'organisation',
      actorUserId: session.user.id,
      ip,
      userAgent,
    });
    return { orgId: null, error: orgErr?.message ?? 'Failed to create org' };
  }

  // Insert owner membership — use admin to bypass RLS on initial membership row.
  await admin.from('user_org_membership').insert({
    user_id: session.user.id,
    org_id: org.id,
    role: 'owner',
    is_default: true,
  });

  await appendAuditEntry({
    action: 'create',
    resourceType: 'organisation',
    actorUserId: session.user.id,
    tenantId: org.id,
    resourceId: org.id,
    ip,
    userAgent,
  });

  return { orgId: org.id, error: null };
}
