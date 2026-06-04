/**
 * Rate-limit unit tests for checkSignInRateLimit.
 * Uses dependency injection (_setLimitFn) to avoid mocking @upstash/ratelimit.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LimitFn } from '../../apps/web/server/rate-limit/upstash';

// Set env vars before the module is first imported.
beforeAll(() => {
  process.env['UPSTASH_REDIS_REST_URL'] = 'https://test.upstash.io';
  process.env['UPSTASH_REDIS_REST_TOKEN'] = 'test-token';
});

describe('checkSignInRateLimit', () => {
  let checkSignInRateLimit: (ip: string) => Promise<{ allowed: boolean; retryAfter: number }>;
  let _setLimitFn: (fn: LimitFn | null) => void;
  const mockLimit = vi.fn<Parameters<LimitFn>, ReturnType<LimitFn>>();

  beforeEach(async () => {
    const mod = await import('../../apps/web/server/rate-limit/upstash');
    checkSignInRateLimit = mod.checkSignInRateLimit;
    _setLimitFn = mod._setLimitFn;
    mockLimit.mockReset();
    _setLimitFn(mockLimit);
  });

  afterEach(() => {
    _setLimitFn(null);
  });

  it('allows requests when under the limit', async () => {
    mockLimit.mockResolvedValue({ success: true, reset: Date.now() + 60_000 });
    const result = await checkSignInRateLimit('1.2.3.4');
    expect(result.allowed).toBe(true);
    expect(result.retryAfter).toBe(0);
  });

  it('blocks the request when limit is exceeded', async () => {
    mockLimit.mockResolvedValue({ success: false, reset: Date.now() + 45_000 });
    const result = await checkSignInRateLimit('1.2.3.4');
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
    expect(result.retryAfter).toBeLessThanOrEqual(45);
  });

  it('10 successful calls followed by a blocked 11th', async () => {
    const resetTime = Date.now() + 60_000;
    for (let i = 0; i < 10; i++) {
      mockLimit.mockResolvedValueOnce({ success: true, reset: resetTime });
    }
    mockLimit.mockResolvedValueOnce({ success: false, reset: resetTime });

    for (let i = 0; i < 10; i++) {
      const r = await checkSignInRateLimit('5.6.7.8');
      expect(r.allowed).toBe(true);
    }
    const blocked = await checkSignInRateLimit('5.6.7.8');
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it('passes the caller IP as the limit key', async () => {
    mockLimit.mockResolvedValue({ success: true, reset: Date.now() + 60_000 });
    await checkSignInRateLimit('9.9.9.9');
    expect(mockLimit).toHaveBeenCalledWith('9.9.9.9');
  });

  it('retryAfter is at least 1 second even when reset is imminent', async () => {
    // reset is 500ms away — must still return at least 1 second.
    mockLimit.mockResolvedValue({ success: false, reset: Date.now() + 500 });
    const result = await checkSignInRateLimit('1.1.1.1');
    expect(result.retryAfter).toBeGreaterThanOrEqual(1);
  });
});
