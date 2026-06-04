import { ZERO } from '../money/cents.js';
import type { Cents } from '../money/cents.js';

export interface NegativeGearingRules {
  readonly enabled: boolean;
  /** When enabled, the list of property types excluded from loss offsets. */
  readonly propertyTypeExclusions: readonly string[];
  /** When true, losses that exceed other income are carried forward (not lost). */
  readonly quarantineCarryForward: boolean;
}

/**
 * Applies negative gearing rules to compute adjusted taxable income.
 *
 * When enabled, rental losses offset other assessable income (wages, business).
 * When disabled, losses are quarantined and only rental profits count.
 * If combined income is negative and quarantineCarryForward is set, the
 * excess loss is returned in carryForwardLossCents for use in future periods.
 *
 * DEV: propertyTypeExclusions matching is Day 6+ scope; treated as empty here.
 */
export function applyNegativeGearing(
  otherIncomeCents: Cents,
  netRentalCents: Cents,
  rules: NegativeGearingRules,
): { adjustedIncomeCents: Cents; carryForwardLossCents: Cents } {
  if (!rules.enabled && netRentalCents < ZERO) {
    return {
      adjustedIncomeCents: otherIncomeCents,
      carryForwardLossCents: rules.quarantineCarryForward ? -netRentalCents : ZERO,
    };
  }
  const combined = otherIncomeCents + netRentalCents;
  if (combined >= ZERO) {
    return { adjustedIncomeCents: combined, carryForwardLossCents: ZERO };
  }
  return {
    adjustedIncomeCents: ZERO,
    carryForwardLossCents: rules.quarantineCarryForward ? -combined : ZERO,
  };
}
