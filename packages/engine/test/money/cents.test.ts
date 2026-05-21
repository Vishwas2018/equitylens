import { describe, it, expect } from 'vitest';

import {
  add,
  sub,
  subClampZero,
  mulDiv,
  monthlyInterest,
  computeScheduledPayment,
  RoundingMode,
  ZERO,
} from '../../src/money/cents.js';

describe('add', () => {
  it('adds two positive values', () => {
    expect(add(100n, 200n)).toBe(300n);
  });
  it('handles zero identity', () => {
    expect(add(ZERO, 500n)).toBe(500n);
  });
  it('adds negative values', () => {
    expect(add(-50n, 50n)).toBe(0n);
  });
});

describe('sub', () => {
  it('subtracts', () => {
    expect(sub(300n, 100n)).toBe(200n);
  });
  it('can produce negative', () => {
    expect(sub(100n, 200n)).toBe(-100n);
  });
});

describe('subClampZero', () => {
  it('clamps at zero when result would be negative', () => {
    expect(subClampZero(100n, 200n)).toBe(0n);
  });
  it('returns positive difference when a > b', () => {
    expect(subClampZero(300n, 100n)).toBe(200n);
  });
  it('returns zero when equal', () => {
    expect(subClampZero(100n, 100n)).toBe(0n);
  });
});

describe('mulDiv', () => {
  it('HALF_UP: rounds up when remainder is exactly half', () => {
    // 5 * 1 / 2 = 2.5 → rounds up to 3
    expect(mulDiv(5n, 1n, 2n, RoundingMode.HALF_UP)).toBe(3n);
  });
  it('HALF_UP: rounds down when remainder < half', () => {
    // 10 * 1 / 3 = 3.333 → 3
    expect(mulDiv(10n, 1n, 3n, RoundingMode.HALF_UP)).toBe(3n);
  });
  it('HALF_UP: rounds up when remainder > half', () => {
    // 10 * 2 / 3 = 6.666 → 7
    expect(mulDiv(10n, 2n, 3n, RoundingMode.HALF_UP)).toBe(7n);
  });
  it('HALF_EVEN: rounds to even on exact half (0.5 → 0)', () => {
    // 1 * 1 / 2 = 0.5 → rounds to even = 0
    expect(mulDiv(1n, 1n, 2n, RoundingMode.HALF_EVEN)).toBe(0n);
  });
  it('HALF_EVEN: rounds to even on exact half (1.5 → 2)', () => {
    // 3 * 1 / 2 = 1.5 → rounds to even = 2
    expect(mulDiv(3n, 1n, 2n, RoundingMode.HALF_EVEN)).toBe(2n);
  });
  it('throws on zero denominator', () => {
    expect(() => mulDiv(10n, 1n, 0n, RoundingMode.HALF_UP)).toThrow(RangeError);
  });
  it('identity: num === den', () => {
    expect(mulDiv(500n, 100n, 100n, RoundingMode.HALF_UP)).toBe(500n);
  });
});

describe('monthlyInterest — actual/365 daily-equivalent', () => {
  it('computes interest for 30-day month at 12% p.a.', () => {
    // balance=100000, rate=1200 bps, days=30
    // = 100000 * 1200 * 30 / (10000 * 365) with half-up
    // = 3600000000 / 3650000 = 986.30... → 986
    // With half-up: (3600000000 + 1825000) / 3650000 = 3601825000 / 3650000 = 986 (truncate)
    expect(monthlyInterest(100000n, 1200, 30)).toBe(986n);
  });
  it('computes interest for 31-day month at 12% p.a.', () => {
    // = 100000 * 1200 * 31 / (10000 * 365) with half-up
    // = 3720000000 / 3650000 = 1019.17... → 1019
    // With half-up: (3720000000 + 1825000) / 3650000 = 3721825000 / 3650000 = 1019
    expect(monthlyInterest(100000n, 1200, 31)).toBe(1019n);
  });
  it('31-day/28-day ratio matches calendar (AM-11 daily-equivalent check)', () => {
    const i31 = monthlyInterest(1_000_000n, 600, 31);
    const i28 = monthlyInterest(1_000_000n, 600, 28);
    // Ratio should be approximately 31/28 = 1.107
    const ratio = Number(i31) / Number(i28);
    expect(ratio).toBeCloseTo(31 / 28, 4);
  });
  it('zero balance produces zero interest', () => {
    expect(monthlyInterest(0n, 600, 30)).toBe(0n);
  });
  it('zero rate produces zero interest', () => {
    expect(monthlyInterest(1_000_000n, 0, 30)).toBe(0n);
  });
});

describe('computeScheduledPayment', () => {
  it('returns non-zero for standard P&I loan', () => {
    // $500,000 at 6% for 300 months
    const p = computeScheduledPayment(50_000_000n, 600, 300);
    expect(p).toBeGreaterThan(0n);
    // Approximate: ~$3,221/month = 322100 cents
    expect(p).toBeGreaterThan(300_000n);
    expect(p).toBeLessThan(400_000n);
  });
  it('zero rate divides principal evenly', () => {
    // $120 / 12 months = $10/month
    expect(computeScheduledPayment(1200n, 0, 12)).toBe(100n);
  });
});
