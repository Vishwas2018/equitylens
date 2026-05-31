import type { Cents } from '../money/cents.js';

export interface LandHolding {
  readonly siteValueCents: Cents;
  /**
   * Capital improved value used as the VRLT base (SRO 2025+: VRLT is 1% of CIV).
   * When absent, VRLT falls back to siteValueCents.
   */
  readonly capitalImprovedValueCents?: Cents;
  /** If true, excluded from the taxable aggregate (PPR exemption). */
  readonly isPPR: boolean;
  /**
   * If true, subject to VRLT (Vacant Residential Land Tax) surcharge.
   * VRLT is assessed per-holding, separate from the general land tax scale.
   */
  readonly isVacantResidential: boolean;
}

export interface VicLandTaxInput {
  readonly holdings: ReadonlyArray<LandHolding>;
  /**
   * If true, the absentee owner surcharge is applied to the total
   * taxable site value (aggregate, excluding PPR).
   */
  readonly isAbsenteeOwner: boolean;
}

export interface VicLandTaxResult {
  /** Sum of all non-PPR holding site values. */
  readonly aggregateSiteValueCents: Cents;
  /** Tax from the general VIC land tax scale on the aggregate. */
  readonly generalLandTaxCents: Cents;
  /** Absentee owner surcharge (absenteeSurchargeBps × aggregate). 0 if not absentee. */
  readonly absenteeSurchargeCents: Cents;
  /** Vacant Residential Land Tax: vacantSurchargeBps × capital improved value (or site value if CIV absent), summed per vacant holding. */
  readonly vrltCents: Cents;
  readonly totalLandTaxCents: Cents;
}
