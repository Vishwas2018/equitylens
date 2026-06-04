import { createHash } from 'crypto';

import { beforeAll, describe, expect, it } from 'vitest';

// Set required env vars before importing the module under test.
beforeAll(() => {
  process.env['AUDIT_HASH_PEPPER'] = 'test-pepper-that-is-long-enough-for-testing';
  process.env['NEXT_PUBLIC_SUPABASE_URL'] = 'https://example.supabase.co';
  process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] = 'test-anon-key';
  process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'test-service-key';
});

describe('canonicalJson', () => {
  it('sorts keys alphabetically at every level', async () => {
    const { canonicalJson } = await import('../../apps/web/server/audit/log');
    const result = canonicalJson({ z: 1, a: 2, m: { z: 3, a: 4 } });
    expect(result).toBe('{"a":2,"m":{"a":4,"z":3},"z":1}');
  });

  it('handles null, string, array', async () => {
    const { canonicalJson } = await import('../../apps/web/server/audit/log');
    expect(canonicalJson(null)).toBe('null');
    expect(canonicalJson('hello')).toBe('"hello"');
    expect(canonicalJson([3, 1, 2])).toBe('[3,1,2]');
  });
});

describe('hashId / hashTenant', () => {
  it('returns a 64-char hex string', async () => {
    const { hashId } = await import('../../apps/web/server/audit/log');
    const h = hashId('00000000-0000-0000-0000-000000000001');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic', async () => {
    const { hashId } = await import('../../apps/web/server/audit/log');
    expect(hashId('same-id')).toBe(hashId('same-id'));
  });

  it('changes with different IDs', async () => {
    const { hashId } = await import('../../apps/web/server/audit/log');
    expect(hashId('id-one')).not.toBe(hashId('id-two'));
  });
});

describe('hash chain computation', () => {
  it('first entry uses prev_hash of 64 zeros', () => {
    const prevHash = '0'.repeat(64);
    const payload = { action: 'create', resource_type: 'user' };
    const canonical = JSON.stringify(Object.fromEntries(Object.entries(payload).sort()));
    const computedHash = createHash('sha256')
      .update(prevHash + canonical)
      .digest('hex');
    expect(computedHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('chained entries link correctly', () => {
    const entries = [
      { action: 'create', resource_type: 'user' },
      { action: 'login', resource_type: 'session' },
      { action: 'create', resource_type: 'organisation' },
    ];

    let prevHash = '0'.repeat(64);
    const chain: { prevHash: string; computedHash: string }[] = [];

    for (const entry of entries) {
      const canonical = JSON.stringify(Object.fromEntries(Object.entries(entry).sort()));
      const computedHash = createHash('sha256')
        .update(prevHash + canonical)
        .digest('hex');
      chain.push({ prevHash, computedHash });
      prevHash = computedHash;
    }

    // Verify: each entry's prevHash must equal the previous entry's computedHash.
    for (let i = 1; i < chain.length; i++) {
      expect(chain[i]!.prevHash).toBe(chain[i - 1]!.computedHash);
    }
  });

  it('detects tampering by recomputing expected hash', () => {
    const tamperDetected = (
      storedComputedHash: string,
      storedPrevHash: string,
      payload: object,
    ): boolean => {
      const canonical = JSON.stringify(Object.fromEntries(Object.entries(payload).sort()));
      const expectedHash = createHash('sha256')
        .update(storedPrevHash + canonical)
        .digest('hex');
      return expectedHash !== storedComputedHash;
    };

    const prevHash = '0'.repeat(64);
    const payload = { action: 'create', resource_type: 'user' };
    const canonical = JSON.stringify(Object.fromEntries(Object.entries(payload).sort()));
    const correctHash = createHash('sha256')
      .update(prevHash + canonical)
      .digest('hex');

    expect(tamperDetected(correctHash, prevHash, payload)).toBe(false);
    expect(tamperDetected('deadbeef' + 'a'.repeat(56), prevHash, payload)).toBe(true);
  });
});

describe('generateInviteToken', () => {
  it('returns a 64-char hex token and matching hash', async () => {
    const { generateInviteToken } = await import('../../apps/web/server/audit/log');
    const { token, tokenHash } = generateInviteToken();
    expect(token).toHaveLength(64);
    expect(tokenHash).toHaveLength(64);
    expect(tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
  });

  it('returns different tokens on each call', async () => {
    const { generateInviteToken } = await import('../../apps/web/server/audit/log');
    expect(generateInviteToken().token).not.toBe(generateInviteToken().token);
  });
});
