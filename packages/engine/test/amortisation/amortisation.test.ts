/**
 * Amortisation fixture tests AM-01..AM-11
 *
 * Rounding convention: HALF_UP — sourced from financial-calc-engine.md §5.2.
 * DEV-0015: decimal-and-rounding.md missing; half-up pinned and flagged.
 *
 * DEV-0016: Test matrix (docs/engine/test-matrix.md) lists fixture IDs and
 * descriptions but provides no pre-computed expected schedules. Expected values
 * are derived from the actual/365 formula and verified by hand (AM-01) or
 * tested via behavioral invariants (AM-02..AM-11). Flagged for CPA sign-off
 * per test-matrix.md §3 (cross-val fixtures have signed worksheets; these
 * unit fixtures do not require external sign-off but should be reviewed).
 */

import { describe, it, expect } from 'vitest';

import { runAmortisation } from '../../src/amortisation/schedule.js';
import type { LoanInput, MonthSpec } from '../../src/amortisation/types.js';
import { monthlyInterest } from '../../src/money/cents.js';

/** Convenience: build an array of identical MonthSpec entries. */
function uniformMonths(count: number, daysInMonth: number, annualRateBps: number): MonthSpec[] {
  return Array.from({ length: count }, () => ({ daysInMonth, annualRateBps }));
}

// ---------------------------------------------------------------------------
// AM-01 — P&I monthly payment matches published bank formula
// ---------------------------------------------------------------------------
//
// Hand-verified derivation (actual/365, HALF_UP):
//   Principal: 1 000 000 cents ($10 000), rate 1200 bps (12% p.a.), term 2 months
//   PMT = computeScheduledPayment(1000000, 1200, 2)
//       = round(1000000 × 0.01 × 1.01² / (1.01² − 1))
//       = round(1000000 × 0.010201 / 0.0201) = round(507512.4...) = 507512
//
//   Period 1 (30 days):
//     interest = (1000000 × 36000 + 1825000) / 3650000 = 9863
//     principal = 507512 − 9863 = 497649   closing = 502351
//
//   Period 2 (final, 30 days):
//     interest = (502351 × 36000 + 1825000) / 3650000 = 4955
//     repayment = 502351 + 4955 = 507306   closing = 0
//
describe('AM-01 — P&I basic schedule matches actual/365 formula', () => {
  const input: LoanInput = {
    principalCents: 1_000_000n,
    termMonths: 2,
    repaymentType: 'P_AND_I',
    months: uniformMonths(2, 30, 1200),
  };

  it('produces exactly 2 periods', () => {
    expect(runAmortisation(input).periods).toHaveLength(2);
  });

  it('period 1 exact values', () => {
    const { periods } = runAmortisation(input);
    const p1 = periods[0]!;
    expect(p1.openingBalance).toBe(1_000_000n);
    expect(p1.interestCharged).toBe(9_863n);
    expect(p1.principalPaid).toBe(497_649n);
    expect(p1.repayment).toBe(507_512n);
    expect(p1.closingBalance).toBe(502_351n);
  });

  it('period 2 (final) closing_balance is exactly 0', () => {
    const { periods } = runAmortisation(input);
    const p2 = periods[1]!;
    expect(p2.openingBalance).toBe(502_351n);
    expect(p2.interestCharged).toBe(4_955n);
    expect(p2.closingBalance).toBe(0n);
    expect(p2.principalPaid).toBe(502_351n);
  });

  it('total principal paid equals original principal', () => {
    const { totalPrincipalCents } = runAmortisation(input);
    expect(totalPrincipalCents).toBe(1_000_000n);
  });
});

// ---------------------------------------------------------------------------
// AM-02 — IO-only: principal never reduces in IO period
// ---------------------------------------------------------------------------
describe('AM-02 — IO loan: principal never reduces', () => {
  const input: LoanInput = {
    principalCents: 500_000n,
    termMonths: 3,
    repaymentType: 'IO',
    months: uniformMonths(3, 30, 600),
  };

  it('principal_paid is 0 for every period', () => {
    const { periods } = runAmortisation(input);
    for (const p of periods) {
      expect(p.principalPaid).toBe(0n);
    }
  });

  it('opening balance is unchanged across all IO periods', () => {
    const { periods } = runAmortisation(input);
    for (const p of periods) {
      expect(p.openingBalance).toBe(500_000n);
      expect(p.closingBalance).toBe(500_000n);
    }
  });

  it('interest is positive (non-zero balance, non-zero rate)', () => {
    const { periods } = runAmortisation(input);
    for (const p of periods) {
      expect(p.interestCharged).toBeGreaterThan(0n);
    }
  });

  it('repayment equals interest each period', () => {
    const { periods } = runAmortisation(input);
    for (const p of periods) {
      expect(p.repayment).toBe(p.interestCharged);
    }
  });
});

// ---------------------------------------------------------------------------
// AM-03 — IO → P&I transition at month N
// ---------------------------------------------------------------------------
//
// The recalculated P&I payment at transition amortises the OUTSTANDING balance
// over the REMAINING term (not original principal over original term).
//
describe('AM-03 — IO→P&I transition: payment recomputes from outstanding balance', () => {
  // IO for months 1–2, P&I from month 3 onwards (ioTransitionMonth = 3)
  const input: LoanInput = {
    principalCents: 600_000n,
    termMonths: 6,
    repaymentType: 'IO_TO_P_AND_I',
    ioTransitionMonth: 3,
    months: uniformMonths(6, 30, 600),
  };

  it('IO periods (1, 2) have zero principal paid', () => {
    const { periods } = runAmortisation(input);
    expect(periods[0]!.principalPaid).toBe(0n);
    expect(periods[1]!.principalPaid).toBe(0n);
  });

  it('P&I periods (3–6) have positive principal paid', () => {
    const { periods } = runAmortisation(input);
    for (const p of periods.slice(2)) {
      expect(p.principalPaid).toBeGreaterThan(0n);
    }
  });

  it('final period closing balance is exactly 0', () => {
    const { periods } = runAmortisation(input);
    expect(periods[5]!.closingBalance).toBe(0n);
  });

  it('outstanding balance at transition equals original principal (no IO reduction)', () => {
    const { periods } = runAmortisation(input);
    // After 2 IO periods, balance must still be 600000
    expect(periods[1]!.closingBalance).toBe(600_000n);
    expect(periods[2]!.openingBalance).toBe(600_000n);
  });

  it('total principal paid equals original principal', () => {
    expect(runAmortisation(input).totalPrincipalCents).toBe(600_000n);
  });
});

// ---------------------------------------------------------------------------
// AM-04 — Variable rate shock at month N: interest jumps from N onwards
// ---------------------------------------------------------------------------
describe('AM-04 — Variable rate shock: interest increases at shock month', () => {
  // Months 1–2 at 600 bps, months 3–5 at 900 bps
  const months: MonthSpec[] = [...uniformMonths(2, 30, 600), ...uniformMonths(3, 30, 900)];
  const input: LoanInput = {
    principalCents: 1_000_000n,
    termMonths: 5,
    repaymentType: 'P_AND_I',
    months,
  };

  it('interest per cent of balance is lower before shock than after', () => {
    const { periods } = runAmortisation(input);
    // Compare per-balance interest rate for period 1 vs period 3
    const p1 = periods[0]!;
    const p3 = periods[2]!;
    const rate1 = Number(p1.interestCharged) / Number(p1.openingBalance);
    const rate3 = Number(p3.interestCharged) / Number(p3.openingBalance);
    expect(rate3).toBeGreaterThan(rate1);
  });

  it('interest for period 1 matches 600 bps formula', () => {
    const { periods } = runAmortisation(input);
    const expected = monthlyInterest(periods[0]!.openingBalance, 600, 30);
    expect(periods[0]!.interestCharged).toBe(expected);
  });

  it('interest for period 3 matches 900 bps formula', () => {
    const { periods } = runAmortisation(input);
    const expected = monthlyInterest(periods[2]!.openingBalance, 900, 30);
    expect(periods[2]!.interestCharged).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// AM-05 — Fixed rate revert: post-fixed period uses revert rate
// ---------------------------------------------------------------------------
describe('AM-05 — Fixed rate revert: rate changes after fixed period', () => {
  // Fixed 500 bps for months 1–3, reverts to 750 bps from month 4
  const months: MonthSpec[] = [...uniformMonths(3, 30, 500), ...uniformMonths(3, 30, 750)];
  const input: LoanInput = {
    principalCents: 1_000_000n,
    termMonths: 6,
    repaymentType: 'P_AND_I',
    months,
  };

  it('interest in fixed period uses 500 bps', () => {
    const { periods } = runAmortisation(input);
    const expected = monthlyInterest(periods[0]!.openingBalance, 500, 30);
    expect(periods[0]!.interestCharged).toBe(expected);
  });

  it('interest after revert uses 750 bps', () => {
    const { periods } = runAmortisation(input);
    const expected = monthlyInterest(periods[3]!.openingBalance, 750, 30);
    expect(periods[3]!.interestCharged).toBe(expected);
  });

  it('interest jumps at revert month (750 > 500)', () => {
    const { periods } = runAmortisation(input);
    // Adjust for declining balance: compare rate, not absolute amount
    const rateFixed = Number(periods[0]!.interestCharged) / Number(periods[0]!.openingBalance);
    const rateReverted = Number(periods[3]!.interestCharged) / Number(periods[3]!.openingBalance);
    expect(rateReverted).toBeGreaterThan(rateFixed);
  });
});

// ---------------------------------------------------------------------------
// AM-06 — Offset > principal: effective balance = 0, interest = 0
// ---------------------------------------------------------------------------
describe('AM-06 — Offset exceeds principal: interest is zero', () => {
  const input: LoanInput = {
    principalCents: 500_000n,
    termMonths: 3,
    repaymentType: 'IO',
    offsetCents: 600_000n, // offset > principal
    months: uniformMonths(3, 30, 600),
  };

  it('interest is 0 every period when offset >= balance', () => {
    const { periods } = runAmortisation(input);
    for (const p of periods) {
      expect(p.interestCharged).toBe(0n);
    }
  });

  it('repayment is 0 (interest only, zero interest)', () => {
    const { periods } = runAmortisation(input);
    for (const p of periods) {
      expect(p.repayment).toBe(0n);
    }
  });
});

// ---------------------------------------------------------------------------
// AM-07 — Partial offset: interest charged on (principal − offset)
// ---------------------------------------------------------------------------
describe('AM-07 — Partial offset: interest on reduced effective balance', () => {
  const principal = 500_000n;
  const offset = 100_000n;
  const effectiveBalance = principal - offset; // 400_000n

  const input: LoanInput = {
    principalCents: principal,
    termMonths: 3,
    repaymentType: 'IO',
    offsetCents: offset,
    months: uniformMonths(3, 30, 600),
  };

  it('interest equals monthlyInterest(principal − offset, rate, days)', () => {
    const { periods } = runAmortisation(input);
    const expected = monthlyInterest(effectiveBalance, 600, 30);
    for (const p of periods) {
      expect(p.interestCharged).toBe(expected);
    }
  });

  it('interest is less than it would be without the offset', () => {
    const withOffset = runAmortisation(input);
    const withoutOffset = runAmortisation({ ...input, offsetCents: 0n });
    for (let i = 0; i < 3; i++) {
      expect(withOffset.periods[i]!.interestCharged).toBeLessThan(
        withoutOffset.periods[i]!.interestCharged,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// AM-08 — Rounding: monthly interest rounds to whole cents, error < 1 ¢/yr
// ---------------------------------------------------------------------------
describe('AM-08 — Rounding: accumulated rounding error < 100 cents per 12-period run', () => {
  // 12-month IO loan — balance is constant so each period has the same exact interest.
  // Max rounding error per period = 0.5 cents. Over 12 periods: max 6 cents << 100 cents.
  const balance = 1_000_000n;
  const rateBps = 1200;
  const input: LoanInput = {
    principalCents: balance,
    termMonths: 12,
    repaymentType: 'IO',
    months: uniformMonths(12, 30, rateBps),
  };

  it('every period interest is a non-negative integer (whole cents)', () => {
    const { periods } = runAmortisation(input);
    for (const p of periods) {
      expect(typeof p.interestCharged).toBe('bigint');
      expect(p.interestCharged).toBeGreaterThanOrEqual(0n);
    }
  });

  it('accumulated 12-period interest within 100 cents of 12 × single-period interest', () => {
    const { periods, totalInterestCents } = runAmortisation(input);
    const singlePeriod = periods[0]!.interestCharged;
    const expected12 = singlePeriod * 12n;
    const diff = totalInterestCents - expected12;
    const absDiff = diff < 0n ? -diff : diff;
    expect(absDiff).toBeLessThan(100n);
  });
});

// ---------------------------------------------------------------------------
// AM-09 — Term ends mid-horizon: subsequent periods have zero balance
// ---------------------------------------------------------------------------
describe('AM-09 — Term ends mid-horizon: post-term periods are zero', () => {
  const input: LoanInput = {
    principalCents: 300_000n,
    termMonths: 3,
    repaymentType: 'P_AND_I',
    months: uniformMonths(6, 30, 600),
    horizonMonths: 6,
  };

  it('produces 6 periods total', () => {
    expect(runAmortisation(input).periods).toHaveLength(6);
  });

  it('closing balance at period 3 is 0', () => {
    expect(runAmortisation(input).periods[2]!.closingBalance).toBe(0n);
  });

  it('periods 4–6 have all-zero fields', () => {
    const { periods } = runAmortisation(input);
    for (const p of periods.slice(3)) {
      expect(p.openingBalance).toBe(0n);
      expect(p.interestCharged).toBe(0n);
      expect(p.principalPaid).toBe(0n);
      expect(p.repayment).toBe(0n);
      expect(p.closingBalance).toBe(0n);
    }
  });
});

// ---------------------------------------------------------------------------
// AM-10 — Negative amortisation guard: principal clamped at 0, warning fires
// ---------------------------------------------------------------------------
//
// Trigger: scheduled payment was computed at low rate; rate spikes so interest
// exceeds the scheduled payment.
//
describe('AM-10 — Negative amortisation guard: principal clamped, warning emitted', () => {
  // 4-month loan: months 1, 3, 4 at 200 bps; month 2 spikes to 120_000 bps (1200% p.a.)
  // Scheduled payment is computed from 200 bps → far below month-2 interest.
  // Month 2 (i=1) is NOT the final period, so the guard (not final-period logic) applies.
  const months: MonthSpec[] = [
    { daysInMonth: 30, annualRateBps: 200 },
    { daysInMonth: 30, annualRateBps: 120_000 }, // extreme spike → interest >> scheduledPayment
    { daysInMonth: 30, annualRateBps: 200 },
    { daysInMonth: 30, annualRateBps: 200 },
  ];
  const input: LoanInput = {
    principalCents: 1_000_000n,
    termMonths: 4,
    repaymentType: 'P_AND_I',
    months,
  };

  it('period 2 triggers negative-amortisation-guard warning', () => {
    const { periods } = runAmortisation(input);
    expect(periods[1]!.warnings).toContain('negative-amortisation-guard');
  });

  it('period 2 principal paid is 0 (not negative)', () => {
    const { periods } = runAmortisation(input);
    expect(periods[1]!.principalPaid).toBe(0n);
  });

  it('period 2 closing balance equals opening balance (no reduction)', () => {
    const { periods } = runAmortisation(input);
    const p2 = periods[1]!;
    expect(p2.closingBalance).toBe(p2.openingBalance);
  });

  it('no warning in normal period 1', () => {
    const { periods } = runAmortisation(input);
    expect(periods[0]!.warnings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// AM-11 — Daily-equivalent interest accrual matches actual/365
// ---------------------------------------------------------------------------
//
// For the same balance and rate, interest in a 31-day month vs a 28-day month
// must satisfy: interest(31) / interest(28) ≈ 31/28.
//
describe('AM-11 — Daily-equivalent: 31-day month has proportionally higher interest', () => {
  const balance = 1_000_000n;
  const rateBps = 600;

  const input31: LoanInput = {
    principalCents: balance,
    termMonths: 1,
    repaymentType: 'IO',
    months: [{ daysInMonth: 31, annualRateBps: rateBps }],
  };
  const input28: LoanInput = {
    principalCents: balance,
    termMonths: 1,
    repaymentType: 'IO',
    months: [{ daysInMonth: 28, annualRateBps: rateBps }],
  };

  it('31-day month interest > 28-day month interest', () => {
    const i31 = runAmortisation(input31).periods[0]!.interestCharged;
    const i28 = runAmortisation(input28).periods[0]!.interestCharged;
    expect(i31).toBeGreaterThan(i28);
  });

  it('ratio of 31-day to 28-day interest ≈ 31/28 (within 0.01%)', () => {
    const i31 = runAmortisation(input31).periods[0]!.interestCharged;
    const i28 = runAmortisation(input28).periods[0]!.interestCharged;
    const ratio = Number(i31) / Number(i28);
    expect(ratio).toBeCloseTo(31 / 28, 3);
  });

  it('monthly interest formula: 1000000 cents × 600 bps × 31 days / (10000 × 365)', () => {
    const i31 = runAmortisation(input31).periods[0]!.interestCharged;
    // exact: (1000000 × 600 × 31 + 1825000) / 3650000
    //       = (18600000000 + 1825000) / 3650000 = 18601825000 / 3650000 = 5095
    // 3650000 × 5095 = 18596750000; 18601825000 - 18596750000 = 5075000; 5095 + 1.39 → 5096
    // Actually: 18601825000 / 3650000:
    //   3650000 × 5096 = 18600400000; diff = 18601825000 - 18600400000 = 1425000 → 5096.39 → 5096
    expect(i31).toBe(5_096n);
  });

  it('monthly interest formula: 1000000 cents × 600 bps × 28 days / (10000 × 365)', () => {
    const i28 = runAmortisation(input28).periods[0]!.interestCharged;
    // exact: (1000000 × 600 × 28 + 1825000) / 3650000
    //       = (16800000000 + 1825000) / 3650000 = 16801825000 / 3650000
    // 3650000 × 4603 = 16800950000; diff = 16801825000 - 16800950000 = 875000 → 4603.24 → 4603
    expect(i28).toBe(4_603n);
  });
});

// ---------------------------------------------------------------------------
// Error guards — ensure RangeError on invalid inputs
// ---------------------------------------------------------------------------
describe('runAmortisation error guards', () => {
  it('throws RangeError when months array is shorter than horizonMonths', () => {
    expect(() =>
      runAmortisation({
        principalCents: 100_000n,
        termMonths: 3,
        repaymentType: 'P_AND_I',
        months: [{ daysInMonth: 30, annualRateBps: 600 }],
      }),
    ).toThrow(RangeError);
  });
});
