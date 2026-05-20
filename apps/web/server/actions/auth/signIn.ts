'use server';

import { appendAuditEntry } from '../../audit/log';
import { createActionClient } from '../../auth/actionClient';

export interface SignInResult {
  error: string | null;
  userId?: string | undefined;
}

export async function signIn(
  email: string,
  password: string,
  ip?: string,
  userAgent?: string,
): Promise<SignInResult> {
  const supabase = createActionClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  await appendAuditEntry({
    action: error ? 'rls_deny' : 'login',
    resourceType: 'session',
    actorUserId: data.user?.id,
    ip,
    userAgent,
  });

  return { error: error?.message ?? null, userId: data.user?.id };
}
