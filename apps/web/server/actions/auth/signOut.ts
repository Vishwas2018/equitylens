'use server';

import { appendAuditEntry } from '../../audit/log';
import { createActionClient } from '../../auth/actionClient';

export interface SignOutResult {
  error: string | null;
}

export async function signOut(ip?: string, userAgent?: string): Promise<SignOutResult> {
  const supabase = await createActionClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const userId = session?.user?.id;
  const orgId = session?.user?.app_metadata?.['active_org_id'] as string | undefined;

  const { error } = await supabase.auth.signOut();

  await appendAuditEntry({
    action: 'logout',
    resourceType: 'session',
    actorUserId: userId,
    tenantId: orgId,
    ip,
    userAgent,
  });

  return { error: error?.message ?? null };
}
