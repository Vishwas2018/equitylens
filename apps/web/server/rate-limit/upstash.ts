import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export type LimitFn = (ip: string) => Promise<{ success: boolean; reset: number }>;

export interface RateLimitResult {
  allowed: boolean;
  retryAfter: number; // seconds until the window resets (0 if allowed)
}

// Internal singleton — replaced in tests via _setLimitFn.
let _limitFn: LimitFn | null | undefined = undefined;

function getProductionLimitFn(): LimitFn | null {
  const url = process.env['UPSTASH_REDIS_REST_URL'];
  const token = process.env['UPSTASH_REDIS_REST_TOKEN'];
  if (!url || !token) return null; // Upstash not configured — fail-open below
  try {
    const ratelimit = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(10, '60 s'),
      prefix: 'equitylens:signin',
    });
    return (ip) => ratelimit.limit(ip);
  } catch {
    return null;
  }
}

function getLimitFn(): LimitFn | null {
  if (_limitFn === undefined) _limitFn = getProductionLimitFn();
  return _limitFn;
}

export async function checkSignInRateLimit(ip: string): Promise<RateLimitResult> {
  const fn = getLimitFn();
  if (!fn) return { allowed: true, retryAfter: 0 }; // fail-open when Upstash unavailable
  try {
    const { success, reset } = await fn(ip);
    const retryAfter = success ? 0 : Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    return { allowed: success, retryAfter };
  } catch {
    return { allowed: true, retryAfter: 0 }; // fail-open on transient Redis errors
  }
}

// Testing hook — inject a mock limit function; pass null to restore production singleton.
export function _setLimitFn(fn: LimitFn | null): void {
  _limitFn = fn ?? undefined;
}
