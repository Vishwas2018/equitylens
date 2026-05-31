'use server';

import { headers } from 'next/headers';

import { appendAuditEntry } from '../../audit/log';
import { createActionClient } from '../../auth/actionClient';
import { checkSignInRateLimit } from '../../rate-limit/upstash';

export interface SignInResult {
  error: string | null;
  retryAfter?: number | undefined; // seconds; present only when rate-limited
  userId?: string | undefined;
}

export async function signIn(
  email: string,
  password: string,
  userAgent?: string,
): Promise<SignInResult> {
  // Resolve IP from Vercel's X-Forwarded-For header; fall back to loopback for local dev.
  const headerStore = await headers();
  const ip =
    headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headerStore.get('x-real-ip') ??
    '127.0.0.1';

  const { allowed, retryAfter } = await checkSignInRateLimit(ip);
  if (!allowed) {
    await appendAuditEntry({
      action: 'rls_deny',
      resourceType: 'session',
      ip,
      userAgent,
    });
    return { error: 'Too many sign-in attempts. Please try again later.', retryAfter };
  }

  const supabase = await createActionClient();
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
