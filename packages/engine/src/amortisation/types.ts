import type { Cents } from '../money/cents.js';

export type RepaymentType = 'IO' | 'P_AND_I' | 'IO_TO_P_AND_I';

/** Per-period calendar + rate input. Caller pre-computes rates for variable/fixed loans. */
export interface MonthSpec {
  daysInMonth: number;
  annualRateBps: number;
}

export interface LoanInput {
  principalCents: Cents;
  termMonths: number;
  repaymentType: RepaymentType;
  /**
   * For IO_TO_P_AND_I: the 1-indexed period number at which P&I begins.
   * Periods 1..(ioTransitionMonth-1) are IO; period ioTransitionMonth onward is P&I.
   */
  ioTransitionMonth?: number;
  /** Offset account balance (constant). Defaults to 0. */
  offsetCents?: Cents;
  /**
   * Per-period calendar and rate specs. Must have length >= max(termMonths, horizonMonths).
   * Caller sets each period's rate — handles variable rate shocks and fixed-rate reversions.
   */
  months: MonthSpec[];
  /**
   * Total periods to generate. Must be >= termMonths.
   * Periods beyond termMonths are emitted as zero-balance, zero-payment periods.
   * Defaults to termMonths.
   */
  horizonMonths?: number;
}

export interface Period {
  periodNumber: number;
  daysInMonth: number;
  openingBalance: Cents;
  interestCharged: Cents;
  principalPaid: Cents;
  repayment: Cents;
  closingBalance: Cents;
  /** Non-empty when a guard or warning was triggered in this period. */
  warnings: string[];
}

export interface Schedule {
  periods: Period[];
  totalInterestCents: Cents;
  totalPrincipalCents: Cents;
}
