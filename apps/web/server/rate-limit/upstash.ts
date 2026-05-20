import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export type LimitFn = (ip: string) => Promise<{ success: boolean; reset: number }>;

export interface RateLimitResult {
  allowed: boolean;
  retryAfter: number; // seconds until the window resets (0 if allowed)
}

// Internal singleton — replaced in tests via _setLimitFn.
let _limitFn: LimitFn | null = null;

function getProductionLimitFn(): LimitFn {
  const ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(10, '60 s'),
    prefix: 'equitylens:signin',
  });
  return (ip) => ratelimit.limit(ip);
}

function getLimitFn(): LimitFn {
  if (!_limitFn) _limitFn = getProductionLimitFn();
  return _limitFn;
}

export async function checkSignInRateLimit(ip: string): Promise<RateLimitResult> {
  const { success, reset } = await getLimitFn()(ip);
  const retryAfter = success ? 0 : Math.max(1, Math.ceil((reset - Date.now()) / 1000));
  return { allowed: success, retryAfter };
}

// Testing hook — inject a mock limit function; pass null to restore production singleton.
export function _setLimitFn(fn: LimitFn | null): void {
  _limitFn = fn;
}
