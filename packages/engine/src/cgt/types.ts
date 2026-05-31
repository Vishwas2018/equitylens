import type { Cents } from '../money/cents.js';

/** Who owns the asset — determines CGT discount eligibility. */
export type EntityType = 'individual' | 'smsf' | 'company' | 'trust';

/**
 * ATO 5-element cost base (s110-25 ITAA 1997).
 *
 * Element 3 (ownership costs) is excluded from the cost base when the
 * property was income-producing and those costs were claimed as deductions.
 * This is the most common CGT cost-base error; see cost-base.ts.
 */
export interface CostBaseElements {
  readonly element1AcquisitionCents: Cents; // purchase price
  readonly element2IncidentalCents: Cents; // stamp duty, legal on acquisition
  readonly element3OwnershipCents: Cents; // interest, rates, insurance (excluded if income-producing)
  readonly element4ImprovementCents: Cents; // capital improvements
  readonly element5TitleCents: Cents; // title preservation costs
}

export interface OwnerInput {
  readonly entityType: EntityType;
  readonly shareBps: number; // ownership share in basis points; all owners must sum to 10_000
}

export interface DisposalInput {
  /** YYYY-MM-DD — injected, never ambient. */
  readonly acquisitionDateISO: string;
  /** YYYY-MM-DD — injected, never ambient. */
  readonly disposalDateISO: string;
  readonly grossProceedsCents: Cents;
  /** Agent fees + legal on disposal; reduce capital proceeds (not cost base). */
  readonly sellingCostsCents: Cents;
  readonly costBase: CostBaseElements;
  /**
   * Div 43 capital works deductions claimed during ownership.
   * Reduces cost base per s110-45 ITAA 1997. Pass 0n if not applicable.
   * Caller supplies the total already-computed amount; engine does not
   * recompute the depreciation schedule (div40/div43 schedules are out of scope).
   */
  readonly div43ClaimedCents: Cents;
  /** If true, element 3 ownership costs are excluded from the cost base. */
  readonly wasIncomeProducing: boolean;
  /** Carry-forward capital losses from prior FY. Applied before CGT discount. */
  readonly priorYearCapitalLossesCents: Cents;
  readonly owners: ReadonlyArray<OwnerInput>;
  /**
   * True for assets acquired before 20 September 1985 (grandfathered; exempt
   * from CGT). When true the engine returns zero taxable gain for all owners.
   */
  readonly isPreCgtAsset: boolean;
}

export interface OwnerCGTResult {
  readonly entityType: EntityType;
  readonly shareBps: number;
  readonly ownerGrossGainCents: Cents;
  readonly ownerLossesAppliedCents: Cents;
  readonly ownerGainAfterLossesCents: Cents;
  readonly ownerDiscountAppliedCents: Cents;
  readonly ownerTaxableGainCents: Cents;
  /** Losses not absorbed by this disposal; carries to next FY. */
  readonly ownerCarryForwardLossCents: Cents;
}

export interface CGTResult {
  readonly daysHeld: number;
  readonly isPreCgtAsset: boolean;
  readonly totalCostBaseCents: Cents;
  readonly netProceedsCents: Cents;
  /** Raw gain (negative = capital loss). */
  readonly grossGainCents: Cents;
  readonly isCapitalLoss: boolean;
  readonly discountEligible: boolean;
  readonly owners: ReadonlyArray<OwnerCGTResult>;
}
