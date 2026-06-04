/**
 * Externally-anchored golden fixtures for the amortisation engine.
 *
 * Each fixture's expected values were derived independently by hand (see
 * test/fixtures/amortisation/goldens/<id>-derivation.md) using the
 * Australian retail banking actual/365 formula, NOT by running the engine.
 *
 * A wrong day-count convention (e.g. monthly-nominal 1/12) will produce
 * different cent values and FAIL these tests. Do not adjust expected values
 * to match the engine — investigate the engine instead.
 */

import { describe, expect, it } from 'vitest';

import { runAmortisation } from '../../src/amortisation/index.js';

// ---------------------------------------------------------------------------
// IO-001 — Interest-Only, 3-month, 6% p.a., days [31, 28, 31]
// Source: IO-001-derivation.md
// ---------------------------------------------------------------------------
describe('IO-001 golden: Interest-Only, actual/365, variable days', () => {
  const schedule = runAmortisation({
    principalCents: 30_000_000n,
    termMonths: 3,
    repaymentType: 'IO',
    months: [
      { daysInMonth: 31, annualRateBps: 600 },
      { daysInMonth: 28, annualRateBps: 600 },
      { daysInMonth: 31, annualRateBps: 600 },
    ],
  });

  it('P1: 31-day interest = 152,877 cents', () => {
    expect(schedule.periods[0]!.interestCharged).toBe(152_877n);
  });

  it('P1: principal = 0, closing = 30,000,000', () => {
    expect(schedule.periods[0]!.principalPaid).toBe(0n);
    expect(schedule.periods[0]!.closingBalance).toBe(30_000_000n);
  });

  it('P2: 28-day interest = 138,082 cents (not 150,000 — monthly-nominal would be wrong)', () => {
    expect(schedule.periods[1]!.interestCharged).toBe(138_082n);
  });

  it('P2: principal = 0, closing = 30,000,000', () => {
    expect(schedule.periods[1]!.principalPaid).toBe(0n);
    expect(schedule.periods[1]!.closingBalance).toBe(30_000_000n);
  });

  it('P3: 31-day interest = 152,877 cents (same as P1)', () => {
    expect(schedule.periods[2]!.interestCharged).toBe(152_877n);
  });

  it('P3: principal = 0, closing = 30,000,000', () => {
    expect(schedule.periods[2]!.principalPaid).toBe(0n);
    expect(schedule.periods[2]!.closingBalance).toBe(30_000_000n);
  });

  it('totals: interest = 443,836 cents, principal = 0', () => {
    expect(schedule.totalInterestCents).toBe(443_836n);
    expect(schedule.totalPrincipalCents).toBe(0n);
  });
});

// ---------------------------------------------------------------------------
// PNI-001 — Principal-and-Interest, 2-month, 12% p.a., 30-day months
// Source: PNI-001-derivation.md
// ---------------------------------------------------------------------------
describe('PNI-001 golden: P&I, actual/365, final-period residual clears to 0', () => {
  const schedule = runAmortisation({
    principalCents: 1_000_000n,
    termMonths: 2,
    repaymentType: 'P_AND_I',
    months: [
      { daysInMonth: 30, annualRateBps: 1200 },
      { daysInMonth: 30, annualRateBps: 1200 },
    ],
  });

  it('PMT-derived: P1 interest = 9,863 cents (not 10,000 — monthly-nominal would be wrong)', () => {
    expect(schedule.periods[0]!.interestCharged).toBe(9_863n);
  });

  it('P1: principal = 497,649, repayment = 507,512, closing = 502,351', () => {
    expect(schedule.periods[0]!.principalPaid).toBe(497_649n);
    expect(schedule.periods[0]!.repayment).toBe(507_512n);
    expect(schedule.periods[0]!.closingBalance).toBe(502_351n);
  });

  it('P2 (final): interest = 4,955, principal = 502,351 (entire balance)', () => {
    expect(schedule.periods[1]!.interestCharged).toBe(4_955n);
    expect(schedule.periods[1]!.principalPaid).toBe(502_351n);
  });

  it('P2 (final): repayment = 507,306, closing = 0 (residual absorbed)', () => {
    expect(schedule.periods[1]!.repayment).toBe(507_306n);
    expect(schedule.periods[1]!.closingBalance).toBe(0n);
  });

  it('totals: interest = 14,818 cents, principal = 1,000,000 cents', () => {
    expect(schedule.totalInterestCents).toBe(14_818n);
    expect(schedule.totalPrincipalCents).toBe(1_000_000n);
  });
});

// ---------------------------------------------------------------------------
// ITP-001 — IO→P&I transition, 4-month, 6% p.a., ioTransitionMonth=3
// Source: ITP-001-derivation.md
// ---------------------------------------------------------------------------
describe('ITP-001 golden: IO→P&I transition, PMT computed from outstanding balance × remaining term', () => {
  const schedule = runAmortisation({
    principalCents: 10_000_000n,
    termMonths: 4,
    repaymentType: 'IO_TO_P_AND_I',
    ioTransitionMonth: 3,
    months: [
      { daysInMonth: 30, annualRateBps: 600 },
      { daysInMonth: 30, annualRateBps: 600 },
      { daysInMonth: 30, annualRateBps: 600 },
      { daysInMonth: 30, annualRateBps: 600 },
    ],
  });

  it('P1 (IO): interest = 49,315, principal = 0, closing = 10,000,000', () => {
    expect(schedule.periods[0]!.interestCharged).toBe(49_315n);
    expect(schedule.periods[0]!.principalPaid).toBe(0n);
    expect(schedule.periods[0]!.closingBalance).toBe(10_000_000n);
  });

  it('P2 (IO): interest = 49,315, principal = 0, closing = 10,000,000', () => {
    expect(schedule.periods[1]!.interestCharged).toBe(49_315n);
    expect(schedule.periods[1]!.principalPaid).toBe(0n);
    expect(schedule.periods[1]!.closingBalance).toBe(10_000_000n);
  });

  it('P3 (first P&I): interest = 49,315 (balance unchanged from IO)', () => {
    expect(schedule.periods[2]!.interestCharged).toBe(49_315n);
  });

  it('P3 (first P&I): PMT = 5,037,531 from outstanding 10,000,000 over 2 remaining months', () => {
    // Wrong PMT would be ~2,506,264 if engine used original term (4 months) instead of remaining (2)
    expect(schedule.periods[2]!.repayment).toBe(5_037_531n);
  });

  it('P3 (first P&I): principal = 4,988,216, closing = 5,011,784', () => {
    expect(schedule.periods[2]!.principalPaid).toBe(4_988_216n);
    expect(schedule.periods[2]!.closingBalance).toBe(5_011_784n);
  });

  it('P4 (final P&I): interest = 24,716', () => {
    expect(schedule.periods[3]!.interestCharged).toBe(24_716n);
  });

  it('P4 (final P&I): principal = 5,011,784, repayment = 5,036,500, closing = 0', () => {
    expect(schedule.periods[3]!.principalPaid).toBe(5_011_784n);
    expect(schedule.periods[3]!.repayment).toBe(5_036_500n);
    expect(schedule.periods[3]!.closingBalance).toBe(0n);
  });

  it('totals: interest = 172,661 cents, principal = 10,000,000 cents', () => {
    expect(schedule.totalInterestCents).toBe(172_661n);
    expect(schedule.totalPrincipalCents).toBe(10_000_000n);
  });
});
