import type { Session } from '@equitylens/types';
import { createRemoteJWKSet, jwtVerify } from 'jose';

// HS256 path: Supabase JWT secret as symmetric bytes (used when project is HS256-configured).
function tryGetJwtSecretBytes(): Uint8Array | null {
  const raw = process.env['SUPABASE_JWT_SECRET'];
  if (!raw) return null;
  return Buffer.from(raw, 'base64');
}

// ES256 path: verify against Supabase JWKS (works for both HS256 and ES256, cached for 15 min).
// Initialised lazily so the middleware module can load without the env var present at build time.
let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks(): ReturnType<typeof createRemoteJWKSet> {
  if (!_jwks) {
    const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'];
    if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL not set');
    _jwks = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));
  }
  return _jwks;
}

/**
 * Verifies a Supabase access token.
 *
 * Strategy: try HS256 (symmetric JWT secret) first — zero network cost.
 * If the project uses ES256 (asymmetric, newer Supabase default), fall back
 * to the Supabase JWKS endpoint. The JWKS set is cached by jose for 15 min.
 */
export async function verifySessionToken(token: string): Promise<Session | null> {
  if (!token) return null;

  const extractPayload = (payload: import('jose').JWTPayload): Session | null => {
    if (!payload.sub) return null;
    return {
      userId: payload.sub,
      email: (payload['email'] as string | undefined) ?? '',
      aal: ((payload['aal'] as string | undefined) ?? 'aal1') as Session['aal'],
      expiresAt: payload.exp ?? 0,
    };
  };

  // Try HS256 path first (no network call).
  const secretBytes = tryGetJwtSecretBytes();
  if (secretBytes) {
    try {
      const { payload } = await jwtVerify(token, secretBytes, { algorithms: ['HS256'] });
      return extractPayload(payload);
    } catch {
      // Fall through to JWKS path (project may use ES256).
    }
  }

  // JWKS path — handles ES256 and any future algorithm Supabase adopts.
  try {
    const { payload } = await jwtVerify(token, getJwks());
    return extractPayload(payload);
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
