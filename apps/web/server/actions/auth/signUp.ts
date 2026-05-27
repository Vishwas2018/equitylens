'use server';

import { appendAuditEntry } from '../../audit/log';
import { createActionClient } from '../../auth/actionClient';

export interface SignUpResult {
  error: string | null;
}

export async function signUp(
  email: string,
  password: string,
  ip?: string,
  userAgent?: string,
): Promise<SignUpResult> {
  const supabase = await createActionClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  await appendAuditEntry({
    action: error ? 'rls_deny' : 'create',
    resourceType: 'user',
    actorUserId: data.user?.id,
    ip,
    userAgent,
  });

  return { error: error?.message ?? null };
}
