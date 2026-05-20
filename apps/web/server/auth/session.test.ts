import { SignJWT } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { verifySessionToken } from './session';

const TEST_SECRET_RAW = 'equitylens-test-secret-that-is-at-least-32-bytes-long!!';
const TEST_SECRET_B64 = Buffer.from(TEST_SECRET_RAW).toString('base64');
// jose accepts Uint8Array directly for HS256; Buffer IS a Uint8Array.
const signingKey = Buffer.from(TEST_SECRET_RAW);

const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';

async function mintToken(
  overrides: { sub?: string; exp?: number; email?: string; aal?: string } = {},
): Promise<string> {
  const exp = overrides.exp ?? Math.floor(Date.now() / 1000) + 3600;
  return new SignJWT({ email: overrides.email ?? 'test@example.com', aal: overrides.aal ?? 'aal1' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(overrides.sub ?? TEST_USER_ID)
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(signingKey);
}

describe('verifySessionToken', () => {
  const origSecret = process.env['SUPABASE_JWT_SECRET'];

  beforeAll(() => {
    process.env['SUPABASE_JWT_SECRET'] = TEST_SECRET_B64;
  });

  afterAll(() => {
    process.env['SUPABASE_JWT_SECRET'] = origSecret;
  });

  it('returns a Session for a valid token', async () => {
    const token = await mintToken();
    const session = await verifySessionToken(token);
    expect(session).not.toBeNull();
    expect(session?.userId).toBe(TEST_USER_ID);
    expect(session?.email).toBe('test@example.com');
    expect(session?.aal).toBe('aal1');
    expect(session?.expiresAt).toBeGreaterThan(Date.now() / 1000);
  });

  it('returns null for an expired token', async () => {
    const token = await mintToken({ exp: Math.floor(Date.now() / 1000) - 60 });
    const session = await verifySessionToken(token);
    expect(session).toBeNull();
  });

  it('returns null for a token signed with a different secret', async () => {
    const wrongKey = Buffer.from('totally-different-secret-also-long-enough!!');
    const token = await new SignJWT({ email: 'x@y.com', aal: 'aal1' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(TEST_USER_ID)
      .setExpirationTime('1h')
      .sign(wrongKey);
    const session = await verifySessionToken(token);
    expect(session).toBeNull();
  });

  it('returns null for a malformed token string', async () => {
    const session = await verifySessionToken('not.a.valid.jwt');
    expect(session).toBeNull();
  });

  it('returns null for an empty string', async () => {
    const session = await verifySessionToken('');
    expect(session).toBeNull();
  });
});
