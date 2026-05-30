'use server';

import { appendAuditEntry } from '../../audit/log';
import { createActionClient } from '../../auth/actionClient';
import { getSupabaseAdmin } from '../../db/client';

export interface SignUpResult {
  error: string | null;
}

export async function signUp(
  email: string,
  password: string,
  ip?: string,
  userAgent?: string,
): Promise<SignUpResult> {
  // Closed-beta gate: email must be in beta_invites (defence-in-depth;
  // primary control is Supabase Auth public signup being disabled).
  const normalised = email.toLowerCase().trim();
  const { data: invite } = await getSupabaseAdmin()
    .from('beta_invites')
    .select('email')
    .eq('email', normalised)
    .maybeSingle();

  if (!invite) {
    await appendAuditEntry({ action: 'rls_deny', resourceType: 'user', ip, userAgent });
    return { error: 'EquityLens is currently in closed beta. Contact us for an invitation.' };
  }

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
