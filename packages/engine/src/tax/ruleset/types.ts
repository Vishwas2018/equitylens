import type { Cents } from '../../money/cents.js';

/** A tax bracket with pre-computed previousThresholdCents. */
export interface ProcessedBracket {
  readonly previousThresholdCents: Cents;
  readonly thresholdCents: Cents;
  readonly rateBps: number;
}

/** MLS surcharge bracket: if income > thresholdCents, this tier's flat rateBps applies. */
export interface SurchargeBracket {
  readonly thresholdCents: Cents;
  readonly rateBps: number;
}

export interface ProcessedMedicareLevy {
  readonly rateBps: number;
  readonly singleThresholdCents: Cents;
  readonly familyThresholdCents: Cents;
  /** Sorted ascending by thresholdCents. Empty = no MLS. */
  readonly surchargeBrackets: readonly SurchargeBracket[];
}

export interface LandTaxBracket {
  readonly previousThresholdCents: Cents;
  readonly thresholdCents: Cents;
  readonly flatCents: Cents;
  readonly marginalBps: number;
}

export interface VicLandTaxConfig {
  readonly individualBrackets?: readonly LandTaxBracket[];
  readonly trustBrackets?: readonly LandTaxBracket[];
  readonly absenteeSurchargeBps?: number;
  readonly vacantSurchargeBps?: number;
}

/**
 * Processed ruleset — all thresholds are bigint Cents, brackets pre-computed.
 * This is the form the engine uses internally; the adapter produces it from RawRuleset.
 */
export interface Ruleset {
  readonly version: string; // e.g. "FY2026.1"
  readonly financialYear: string; // e.g. "FY2026"
  readonly status: 'draft' | 'staged' | 'published' | 'retired';
  readonly jurisdiction: string;
  readonly effectiveFrom: string;
  readonly effectiveTo: string;
  readonly brackets: readonly ProcessedBracket[];
  readonly medicareLevy: ProcessedMedicareLevy;
  readonly negativeGearingRules: {
    readonly enabled: boolean;
    readonly propertyTypeExclusions: readonly string[];
    readonly quarantineCarryForward: boolean;
  };
  readonly cgt: {
    readonly individualDiscountBps: number;
    readonly smsfDiscountBps: number;
    readonly minimumHoldingDays: number;
  };
  readonly depreciation: {
    readonly div40: {
      readonly defaultMethod: 'prime_cost' | 'diminishing_value';
      readonly secondHandResidentialDisallowed: boolean;
      readonly secondHandRuleAcquisitionFromDate: string;
    };
    readonly div43: {
      readonly defaultLifeYears: number;
      readonly defaultRateBps: number;
      readonly qualifyingConstructionFromDate: string;
    };
  };
  readonly landTax?: { readonly vic?: VicLandTaxConfig };
}

/** The version string stamped into output_hash for ruleset binding. */
export type RulesetVersion = string;

// ── Raw JSON format ─────────────────────────────────────────────────────────

/** Raw bracket as stored in JSON (thresholdCents is a decimal string). */
export interface RawBracket {
  readonly thresholdCents: string;
  readonly rateBps: number;
}

/** Raw land-tax bracket as stored in JSON. */
export interface RawLandTaxBracket {
  readonly previousThresholdCents: string;
  readonly thresholdCents: string;
  readonly flatCents: string;
  readonly marginalBps: number;
}

/** Raw ruleset as it appears in the JSON data files. */
export interface RawRuleset {
  readonly $schema: string;
  readonly version: string;
  readonly status: string;
  readonly jurisdiction: string;
  readonly financialYear: string;
  readonly effectiveFrom: string;
  readonly effectiveTo: string;
  readonly marginalRates: {
    readonly residency: string;
    readonly brackets: readonly RawBracket[];
  };
  readonly medicareLevy: {
    readonly rateBps: number;
    readonly singleThresholdCents: string;
    readonly familyThresholdCents: string;
    readonly surchargeBrackets: readonly RawBracket[];
  };
  readonly negativeGearingRules: {
    readonly enabled: boolean;
    readonly propertyTypeExclusions: readonly string[];
    readonly quarantineCarryForward: boolean;
  };
  readonly cgt: {
    readonly individualDiscountBps: number;
    readonly smsfDiscountBps: number;
    readonly minimumHoldingDays: number;
  };
  readonly depreciation: {
    readonly div40: {
      readonly defaultMethod: string;
      readonly secondHandResidentialDisallowed: boolean;
      readonly secondHandRuleAcquisitionFromDate: string;
    };
    readonly div43: {
      readonly defaultLifeYears: number;
      readonly defaultRateBps: number;
      readonly qualifyingConstructionFromDate: string;
    };
  };
  readonly landTax?: {
    readonly vic?: {
      readonly individualBrackets?: readonly RawLandTaxBracket[];
      readonly trustBrackets?: readonly RawLandTaxBracket[];
      readonly absenteeSurchargeBps?: number;
      readonly vacantSurchargeBps?: number;
    };
  };
}
