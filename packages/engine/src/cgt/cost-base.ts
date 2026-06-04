import type { Cents } from '../money/cents.js';

import type { CostBaseElements } from './types.js';

/**
 * Compute the total cost base from the 5 ATO elements.
 *
 * s110-45 ITAA 1997: when a property is income-producing and element 3
 * (interest, rates, insurance) has been claimed as a deduction, those costs
 * are excluded from the cost base. Including them would inflate the cost base
 * and understate the taxable gain — the most common CGT error for rental
 * properties. Pass `wasIncomeProducing: true` to apply the exclusion.
 *
 * s110-45 also reduces the cost base by Div 43 capital-works deductions
 * claimed during ownership. `div43ClaimedCents` must be the total amount
 * already deducted (engine does not recompute the schedule).
 */
export function computeCostBase(
  elements: CostBaseElements,
  wasIncomeProducing: boolean,
  div43ClaimedCents: Cents,
): Cents {
  const e3 = wasIncomeProducing ? 0n : elements.element3OwnershipCents;
  const raw =
    elements.element1AcquisitionCents +
    elements.element2IncidentalCents +
    e3 +
    elements.element4ImprovementCents +
    elements.element5TitleCents -
    div43ClaimedCents;
  return raw < 0n ? 0n : raw;
}
