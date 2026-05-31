import { mulDiv, RoundingMode } from '../money/cents.js';
import type { LandTaxBracket, Ruleset } from '../tax/ruleset/types.js';

import type { VicLandTaxInput, VicLandTaxResult } from './types.js';

/**
 * Apply the VIC marginal land tax scale to an aggregate site value.
 *
 * Bracket selection: strictly-greater-than previous threshold.
 * At exactly the threshold boundary (e.g., aggregate = $50,000), the lower bracket
 * applies — per-spec LT-09. Values must exceed the bracket's previous threshold
 * to enter that bracket.
 *
 * Formula per bracket: flat + mulDiv(aggregate − prevThreshold, marginalBps, 10_000).
 */
function applyVicScale(aggregateCents: bigint, brackets: ReadonlyArray<LandTaxBracket>): bigint {
  if (brackets.length === 0) return 0n;

  // Start with the first bracket (prevThreshold = 0, marginal = 0, flat = 0).
  // Advance to the next bracket only when aggregate STRICTLY exceeds its prevThreshold.
  let bracket = brackets[0]!;
  for (const b of brackets) {
    if (aggregateCents > b.previousThresholdCents) bracket = b;
  }

  return (
    bracket.flatCents +
    mulDiv(
      aggregateCents - bracket.previousThresholdCents,
      BigInt(bracket.marginalBps),
      10_000n,
      RoundingMode.HALF_UP,
    )
  );
}

/**
 * Compute VIC land tax for an owner's portfolio.
 *
 * VIC land tax is levied on the AGGREGATE site value across all taxable
 * Victorian holdings — not the sum of per-property taxes. Aggregation is
 * the defining feature: two properties each at $200,000 are taxed as a
 * single $400,000 holding, not as two separate $200,000 holdings.
 *
 * Key rules applied:
 *  - PPR exemption: holdings with isPPR=true are excluded from the aggregate.
 *  - Absentee owner surcharge: applied to the aggregate (not per-holding).
 *  - VRLT: per-holding surcharge on each vacant residential property's site value.
 *
 * @param input   Portfolio and owner flags.
 * @param ruleset FY ruleset supplying VIC brackets and surcharge rates.
 */
export function computeVicLandTax(input: VicLandTaxInput, ruleset: Ruleset): VicLandTaxResult {
  const vic = ruleset.landTax?.vic;
  const brackets: ReadonlyArray<LandTaxBracket> = vic?.individualBrackets ?? [];
  const absenteeSurchargeBps = vic?.absenteeSurchargeBps ?? 0;
  const vacantSurchargeBps = vic?.vacantSurchargeBps ?? 0;

  let aggregateSiteValueCents = 0n;
  let vrltCents = 0n;

  for (const h of input.holdings) {
    if (!h.isPPR) {
      aggregateSiteValueCents += h.siteValueCents;
    }
    if (h.isVacantResidential && vacantSurchargeBps > 0) {
      if (h.capitalImprovedValueCents == null) {
        // SRO 2025+: VRLT base is capital improved value, which is always ≥ site value.
        // Substituting site value would silently understate VRLT — a wrong tax figure with no signal.
        throw new Error(
          'VicLandTax: capitalImprovedValueCents is required for VRLT-liable holdings ' +
            '(isVacantResidential=true). SRO 2025+ assesses VRLT on capital improved value; ' +
            'omitting it would silently understate VRLT. Provide the CIV or mark the holding non-vacant.',
        );
      }
      vrltCents += mulDiv(
        h.capitalImprovedValueCents,
        BigInt(vacantSurchargeBps),
        10_000n,
        RoundingMode.HALF_UP,
      );
    }
  }

  const generalLandTaxCents = applyVicScale(aggregateSiteValueCents, brackets);

  const absenteeSurchargeCents =
    input.isAbsenteeOwner && absenteeSurchargeBps > 0
      ? mulDiv(aggregateSiteValueCents, BigInt(absenteeSurchargeBps), 10_000n, RoundingMode.HALF_UP)
      : 0n;

  return {
    aggregateSiteValueCents,
    generalLandTaxCents,
    absenteeSurchargeCents,
    vrltCents,
    totalLandTaxCents: generalLandTaxCents + absenteeSurchargeCents + vrltCents,
  };
}
