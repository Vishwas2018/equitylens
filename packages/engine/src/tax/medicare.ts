import { mulDiv, RoundingMode, ZERO } from '../money/cents.js';
import type { Cents } from '../money/cents.js';

import type { ProcessedMedicareLevy } from './ruleset/types.js';

/**
 * Computes the Medicare levy.
 *
 * Zero below the relevant threshold; otherwise rateBps% of total income.
 * useFamily=true uses familyThresholdCents (e.g. for married filers).
 */
export function computeMedicareLevy(
  incomeCents: Cents,
  levy: ProcessedMedicareLevy,
  useFamily: boolean,
): Cents {
  const threshold = useFamily ? levy.familyThresholdCents : levy.singleThresholdCents;
  if (incomeCents <= threshold) return ZERO;
  return mulDiv(incomeCents, BigInt(levy.rateBps), 10000n, RoundingMode.HALF_UP);
}

/**
 * Computes the Medicare Levy Surcharge (MLS).
 *
 * Returns zero when hasPrivateHospitalCover is true.
 * Otherwise applies the highest surchargeBracket rate whose threshold income exceeds.
 */
export function computeMLS(
  incomeCents: Cents,
  levy: ProcessedMedicareLevy,
  hasPrivateHospitalCover: boolean,
): Cents {
  if (hasPrivateHospitalCover) return ZERO;
  let applicableRateBps = 0;
  for (const bracket of levy.surchargeBrackets) {
    if (incomeCents > bracket.thresholdCents) {
      applicableRateBps = bracket.rateBps;
    }
  }
  if (applicableRateBps === 0) return ZERO;
  return mulDiv(incomeCents, BigInt(applicableRateBps), 10000n, RoundingMode.HALF_UP);
}
