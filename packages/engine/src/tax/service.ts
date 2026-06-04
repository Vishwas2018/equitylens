import { mulDiv, RoundingMode, ZERO } from '../money/cents.js';
import type { Cents } from '../money/cents.js';

import type { ProcessedBracket } from './ruleset/types.js';

/**
 * Computes income tax using marginal rate brackets.
 *
 * Each bracket covers (previousThresholdCents, thresholdCents].
 * Iteration stops as soon as income <= bracket.previousThresholdCents.
 */
export function applyMarginalRates(
  incomeCents: Cents,
  brackets: readonly ProcessedBracket[],
): Cents {
  let tax = ZERO;
  for (const bracket of brackets) {
    if (incomeCents <= bracket.previousThresholdCents) break;
    const taxable =
      incomeCents < bracket.thresholdCents
        ? incomeCents - bracket.previousThresholdCents
        : bracket.thresholdCents - bracket.previousThresholdCents;
    tax += mulDiv(taxable, BigInt(bracket.rateBps), 10000n, RoundingMode.HALF_UP);
  }
  return tax;
}
