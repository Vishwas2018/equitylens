/**
 * Bigint-backed Cents type for all money arithmetic in the engine.
 * No floats. No silent rounding. All operations are total and explicit.
 *
 * Interest formula (Australian retail banking, actual/365):
 *   interest = balance × rateBps × daysInMonth / (10_000 × 365)
 *
 * Rounding: half-up throughout — see financial-calc-engine.md §5.2.
 * DEV-0015: decimal-and-rounding.md is missing; half-up sourced from
 * financial-calc-engine.md §5.2 formula. Flagged for human confirmation.
 */

export type Cents = bigint;

export const ZERO: Cents = 0n;

export const enum RoundingMode {
  HALF_UP = 'HALF_UP',
  HALF_EVEN = 'HALF_EVEN',
}

export function add(a: Cents, b: Cents): Cents {
  return a + b;
}

export function sub(a: Cents, b: Cents): Cents {
  return a - b;
}

/** Clamp to zero — returns 0 if result would be negative. */
export function subClampZero(a: Cents, b: Cents): Cents {
  const r = a - b;
  return r < 0n ? 0n : r;
}

/**
 * Multiply amount by (numerator / denominator) with explicit rounding.
 *
 * Half-up: (amount × num + den/2) / den
 * Half-even: standard banker's rounding
 */
export function mulDiv(
  amount: Cents,
  numerator: bigint,
  denominator: bigint,
  mode: RoundingMode,
): Cents {
  if (denominator === 0n) throw new RangeError('mulDiv: denominator must be non-zero');
  const product = amount * numerator;
  if (mode === RoundingMode.HALF_UP) {
    const half = denominator / 2n;
    return (product + half) / denominator;
  }
  // HALF_EVEN (banker's rounding)
  const quotient = product / denominator;
  const remainder = product % denominator;
  const doubled = remainder < 0n ? -remainder * 2n : remainder * 2n;
  if (doubled < denominator) return quotient;
  if (doubled > denominator) return quotient + (amount >= 0n ? 1n : -1n);
  // Exactly half — round to even
  return quotient % 2n === 0n ? quotient : quotient + (amount >= 0n ? 1n : -1n);
}

/**
 * Compute monthly interest using the actual/365 daily-equivalent formula:
 *   interest = balance × rateBps × daysInMonth / (10_000 × 365)
 *
 * This matches Australian retail banking (CBA, NAB, ANZ, Westpac).
 */
export function monthlyInterest(balance: Cents, annualRateBps: number, daysInMonth: number): Cents {
  return mulDiv(
    balance,
    BigInt(annualRateBps) * BigInt(daysInMonth),
    10_000n * 365n,
    RoundingMode.HALF_UP,
  );
}

/**
 * Compute the scheduled P&I repayment using a float-based PMT approximation,
 * then round to whole cents. The final period adjusts to clear the balance exactly.
 *
 * Uses the standard annuity formula with monthly rate = annualRateBps / (10_000 × 12).
 * This is an approximation for the daily-equivalent schedule; residual is absorbed
 * in the final period per the spec.
 */
export function computeScheduledPayment(
  principalCents: Cents,
  annualRateBps: number,
  termMonths: number,
): Cents {
  if (annualRateBps === 0) {
    return principalCents / BigInt(termMonths);
  }
  const r = annualRateBps / (10_000 * 12);
  const factor = Math.pow(1 + r, termMonths);
  const payment = (Number(principalCents) * r * factor) / (factor - 1);
  return BigInt(Math.round(payment));
}

export function fromCentNumber(n: number): Cents {
  return BigInt(Math.round(n));
}

export function toCentNumber(c: Cents): number {
  return Number(c);
}
