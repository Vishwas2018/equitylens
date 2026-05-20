import type { Session } from '@equitylens/types';
import { jwtVerify } from 'jose';

function getJwtSecretBytes(): Uint8Array {
  const raw = process.env['SUPABASE_JWT_SECRET'];
  if (!raw) throw new Error('SUPABASE_JWT_SECRET not set');
  // Supabase stores the JWT secret as base64; decode to raw bytes for HS256 verification.
  return Buffer.from(raw, 'base64');
}

/**
 * Verifies a Supabase access token locally using SUPABASE_JWT_SECRET.
 * No network call — safe to call on every request in middleware.
 */
export async function verifySessionToken(token: string): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getJwtSecretBytes());
    if (!payload.sub) return null;
    return {
      userId: payload.sub,
      email: (payload['email'] as string | undefined) ?? '',
      aal: ((payload['aal'] as string | undefined) ?? 'aal1') as Session['aal'],
      expiresAt: payload.exp ?? 0,
    };
  } catch {
    return null;
  }
}

/**
 * Resolves the user's active org from user_org_membership.
 * Uses the user's own access token (RLS-enforced — sees only own rows).
 */
export async function getActiveOrgId(userId: string, accessToken: string): Promise<string | null> {
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false },
    },
  );
  const { data } = await client
    .from('user_org_membership')
    .select('org_id')
    .eq('user_id', userId)
    .eq('is_default', true)
    .single();
  return (data as { org_id: string } | null)?.org_id ?? null;
}
