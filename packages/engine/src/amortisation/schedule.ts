import type { Cents } from '../money/cents.js';
import { monthlyInterest, computeScheduledPayment, ZERO } from '../money/cents.js';

import type { LoanInput, Period, Schedule } from './types.js';

/**
 * Pure amortisation schedule generator.
 *
 * Interest formula: balance × rateBps × daysInMonth / (10_000 × 365), HALF_UP
 * — matches Australian retail banking (CBA, NAB, ANZ, Westpac) actual/365 convention.
 *
 * Final-period residual: the last P&I period sets repayment = opening + interest
 * so closing_balance is exactly 0n. This absorbs any rounding residual accumulated
 * over the schedule.
 *
 * IO→P&I transition: at the first P&I period (ioTransitionMonth), the scheduled
 * payment is (re)computed from the outstanding balance and the remaining term.
 * This amortises the OUTSTANDING balance — not the original principal — over the
 * REMAINING term. Any IO-period rounding is captured here.
 *
 * Negative amortisation guard: if interest ≥ scheduled payment in a P&I period,
 * principal is clamped to 0n (balance does not grow), a warning is emitted, and
 * repayment = interest only for that period.
 *
 * DEV-0015 applies: rounding is HALF_UP per financial-calc-engine.md §5.2.
 */
export function runAmortisation(input: LoanInput): Schedule {
  const { principalCents, termMonths, repaymentType, offsetCents = ZERO, months } = input;

  const horizonMonths = input.horizonMonths ?? termMonths;
  const ioTransitionMonth =
    input.ioTransitionMonth ?? (repaymentType === 'IO' ? termMonths + 1 : 1);

  if (months.length < horizonMonths) {
    throw new RangeError(`months array length ${months.length} < horizonMonths ${horizonMonths}`);
  }

  // Compute initial scheduled payment for pure P&I loans.
  // For IO and IO_TO_P_AND_I the payment is computed at first P&I period.
  let scheduledPayment: Cents = ZERO;
  if (repaymentType === 'P_AND_I') {
    const firstMonth = months[0];
    // c8 ignore next — unreachable: months.length guard above ensures months[0] exists
    if (firstMonth === undefined) throw new RangeError('months array is empty');
    scheduledPayment = computeScheduledPayment(
      principalCents,
      firstMonth.annualRateBps,
      termMonths,
    );
  }

  const periods: Period[] = [];
  let balance: Cents = principalCents;
  let totalInterest: Cents = ZERO;
  let totalPrincipal: Cents = ZERO;

  for (let i = 0; i < horizonMonths; i++) {
    // Post-term: emit zero periods
    if (i >= termMonths || balance === ZERO) {
      periods.push(zeroPeriod(i + 1));
      continue;
    }

    const month = months[i];
    // c8 ignore next — unreachable: months.length guard above ensures months[i] exists within horizonMonths
    if (month === undefined) throw new RangeError(`months[${i}] is undefined`);

    const openingBalance = balance;
    const effectiveBalance: Cents = balance > offsetCents ? balance - offsetCents : ZERO;
    const interest = monthlyInterest(effectiveBalance, month.annualRateBps, month.daysInMonth);
    const warnings: string[] = [];

    // Determine if this is an IO period
    const isIoPeriod =
      repaymentType === 'IO' || (repaymentType === 'IO_TO_P_AND_I' && i + 1 < ioTransitionMonth);

    // At the IO→P&I transition, recompute scheduled payment from outstanding balance
    if (repaymentType === 'IO_TO_P_AND_I' && i + 1 === ioTransitionMonth) {
      const remainingMonths = termMonths - i;
      scheduledPayment = computeScheduledPayment(balance, month.annualRateBps, remainingMonths);
    }

    let principalPaid: Cents;
    let repayment: Cents;

    if (isIoPeriod) {
      principalPaid = ZERO;
      repayment = interest;
    } else if (i === termMonths - 1) {
      // Final P&I period: absorb residual so closing_balance is exactly 0n
      principalPaid = balance;
      repayment = balance + interest;
    } else {
      const candidatePrincipal = scheduledPayment - interest;
      if (candidatePrincipal <= ZERO) {
        // Negative amortisation guard: interest >= scheduled payment
        principalPaid = ZERO;
        repayment = interest;
        warnings.push('negative-amortisation-guard');
      } else {
        principalPaid = candidatePrincipal;
        repayment = scheduledPayment;
      }
    }

    balance = balance - principalPaid;
    totalInterest = totalInterest + interest;
    totalPrincipal = totalPrincipal + principalPaid;

    periods.push({
      periodNumber: i + 1,
      daysInMonth: month.daysInMonth,
      openingBalance,
      interestCharged: interest,
      principalPaid,
      repayment,
      closingBalance: balance,
      warnings,
    });
  }

  return { periods, totalInterestCents: totalInterest, totalPrincipalCents: totalPrincipal };
}

function zeroPeriod(periodNumber: number): Period {
  return {
    periodNumber,
    daysInMonth: 0,
    openingBalance: ZERO,
    interestCharged: ZERO,
    principalPaid: ZERO,
    repayment: ZERO,
    closingBalance: ZERO,
    warnings: [],
  };
}
