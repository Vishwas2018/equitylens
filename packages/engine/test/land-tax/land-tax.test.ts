/**
 * VIC Land Tax Engine — LT-01..LT-09 + LT-XV-01..LT-XV-03
 *
 * Goldens anchored to SRO Victoria published rates (FY2026).
 * Source: https://www.sro.vic.gov.au/land-tax-current-rates (retrieved 2026-05-22)
 * Do not adjust expected values to match the engine — investigate the engine.
 *
 * Key fact: VIC land tax applies to AGGREGATE site value across all
 * Victorian holdings (excluding PPR). Two properties at $400K each are
 * taxed as ONE $800K aggregate, not two separate $400K assessments.
 *
 * SRO VIC Individual Scale (2024+):
 *   Band 1: Under $50K        — nil
 *   Band 2: $50K–$100K        — $500 flat, 0% marginal
 *   Band 3: $100K–$300K       — $975 flat, 0% marginal
 *   Band 4: $300K–$600K       — $1,350 flat, 0.3% marginal
 *   Band 5: $600K–$1M         — $2,250 flat, 0.6% marginal
 *   Band 6: $1M–$1.8M         — $4,650 flat, 0.9% marginal
 *   Band 7: $1.8M–$3M         — $11,850 flat, 1.65% marginal
 *   Band 8: Over $3M          — $31,650 flat, 2.65% marginal
 */

import { describe, expect, it } from 'vitest';

import { computeVicLandTax } from '../../src/land-tax/engine.js';
import type { VicLandTaxInput } from '../../src/land-tax/types.js';
import { defaultRulesetAdapter } from '../../src/tax/ruleset/index.js';

const ruleset = defaultRulesetAdapter.resolveByFY('FY2026', { status: 'draft' });

const NO_FLAGS: Pick<VicLandTaxInput, 'isAbsenteeOwner'> = { isAbsenteeOwner: false };

// ── LT-01: Below threshold — $0 tax ──────────────────────────────────────────
// SRO: "Under $50,000: Nil". Site value $49,999 < $50,000 threshold.

describe('LT-01: aggregate below $50,000 threshold — $0 land tax', () => {
  const result = computeVicLandTax(
    {
      holdings: [{ siteValueCents: 4_999_900n, isPPR: false, isVacantResidential: false }],
      ...NO_FLAGS,
    },
    ruleset,
  );

  it('aggregate = 4,999,900 cents', () => expect(result.aggregateSiteValueCents).toBe(4_999_900n));
  it('general land tax = 0', () => expect(result.generalLandTaxCents).toBe(0n));
  it('total = 0', () => expect(result.totalLandTaxCents).toBe(0n));
});

// ── LT-09: Boundary — aggregate at EXACTLY $50,000 uses lower bracket → $0 ──
// Spec LT-09: at the threshold, lower bracket applies (strictly-greater-than rule).

describe('LT-09: at exactly $50,000 threshold — lower bracket ($0)', () => {
  const result = computeVicLandTax(
    {
      holdings: [{ siteValueCents: 5_000_000n, isPPR: false, isVacantResidential: false }],
      ...NO_FLAGS,
    },
    ruleset,
  );

  it('aggregate = 5,000,000 cents ($50,000)', () => {
    expect(result.aggregateSiteValueCents).toBe(5_000_000n);
  });
  it('tax = 0 (at threshold, lower bracket)', () => expect(result.generalLandTaxCents).toBe(0n));
});

// ── LT-02: $1 above threshold — flat fee only ─────────────────────────────────
// At $50,001: enters $50K–$100K bracket. Flat=$500, marginal=0 bps.
// Tax = $500 exactly regardless of excess (flat-fee-only band).

describe('LT-02: $1 above threshold — flat $500 (0% marginal in Band 2)', () => {
  const result = computeVicLandTax(
    {
      holdings: [{ siteValueCents: 5_000_100n, isPPR: false, isVacantResidential: false }], // $50,001
      ...NO_FLAGS,
    },
    ruleset,
  );

  it('enters $50K–$100K bracket', () => expect(result.generalLandTaxCents).toBeGreaterThan(0n));
  it('general land tax = 50,000 cents ($500 flat, 0 bps marginal)', () => {
    expect(result.generalLandTaxCents).toBe(50_000n);
  });
});

// ── LT-03 Golden: Band 3 — flat only ─────────────────────────────────────────
// Source: land-tax-golden-01-single-holding-derivation.md
// Aggregate $200,000: Band 3 ($100K–$300K), flat $975, 0% marginal.
// Total: $975 = 97,500 cents.
// SRO cross-check: $975 flat (no marginal component in Band 3). ✓

describe('LT-03 golden: $200,000 aggregate — Band 3, flat $975 only', () => {
  const result = computeVicLandTax(
    {
      holdings: [{ siteValueCents: 20_000_000n, isPPR: false, isVacantResidential: false }], // $200,000
      ...NO_FLAGS,
    },
    ruleset,
  );

  it('aggregate = 20,000,000 cents', () =>
    expect(result.aggregateSiteValueCents).toBe(20_000_000n));
  it('general land tax = 97,500 cents ($975)', () => {
    expect(result.generalLandTaxCents).toBe(97_500n);
  });
  it('no surcharges', () => {
    expect(result.absenteeSurchargeCents).toBe(0n);
    expect(result.vrltCents).toBe(0n);
  });
  it('total = 97,500', () => expect(result.totalLandTaxCents).toBe(97_500n));
});

// ── LT-04 Golden: Multi-holding aggregation — proves total-not-per-property ──
// Source: land-tax-golden-02-multi-holding-derivation.md
// Holdings: $400,000 + $400,000 = $800,000 aggregate.
//
// Each property individually ($400K = 40,000,000 cents):
//   Band 4 ($300K–$600K): flat $1,350 + 0.3%×$100K = $1,650 each.
//   Per-property (WRONG): $1,650 × 2 = $3,300 = 330,000 cents.
//
// Aggregate ($800K = 80,000,000 cents):
//   Band 5 ($600K–$1M): flat $2,250 + 0.6%×$200K = $3,450 = 345,000 cents.
//
// Aggregate ($3,450) > per-property ($3,300): combining pushes into higher marginal band.

describe('LT-04 golden: two holdings, $800,000 aggregate — proves aggregation', () => {
  const result = computeVicLandTax(
    {
      holdings: [
        { siteValueCents: 40_000_000n, isPPR: false, isVacantResidential: false }, // $400,000
        { siteValueCents: 40_000_000n, isPPR: false, isVacantResidential: false }, // $400,000
      ],
      ...NO_FLAGS,
    },
    ruleset,
  );

  // Per-property calculation (what a wrong implementation would give):
  const wrongA = computeVicLandTax(
    {
      holdings: [{ siteValueCents: 40_000_000n, isPPR: false, isVacantResidential: false }],
      ...NO_FLAGS,
    },
    ruleset,
  );
  const perPropertyWrong = wrongA.generalLandTaxCents * 2n;

  it('aggregate = 80,000,000 cents ($800,000)', () => {
    expect(result.aggregateSiteValueCents).toBe(80_000_000n);
  });
  // Band 5: flat 225,000 + mulDiv(20M, 60, 10000) = 225,000 + 120,000 = 345,000
  it('aggregate tax = 345,000 cents ($3,450)', () => {
    expect(result.generalLandTaxCents).toBe(345_000n);
  });
  // Band 4: flat 135,000 + mulDiv(10M, 30, 10000) = 135,000 + 30,000 = 165,000 each → ×2 = 330,000
  it('per-property wrong = 330,000 cents ($3,300)', () => {
    expect(perPropertyWrong).toBe(330_000n);
  });
  it('aggregate tax ≠ sum of per-property taxes (proves aggregation)', () => {
    expect(result.generalLandTaxCents).not.toBe(perPropertyWrong);
  });
  it('aggregate tax > per-property sum (higher band on combined value)', () => {
    expect(result.generalLandTaxCents).toBeGreaterThan(perPropertyWrong);
  });
});

// ── LT-05: Absentee owner surcharge ──────────────────────────────────────────
// Surcharge = 4% (400 bps) of aggregate site value, on top of general land tax.
// At $200K aggregate: surcharge = 4% × $200K = $8,000 = 800,000 cents.

describe('LT-05: absentee owner surcharge (+4% of aggregate)', () => {
  const nonAbsentee = computeVicLandTax(
    {
      holdings: [{ siteValueCents: 20_000_000n, isPPR: false, isVacantResidential: false }],
      isAbsenteeOwner: false,
    },
    ruleset,
  );
  const absentee = computeVicLandTax(
    {
      holdings: [{ siteValueCents: 20_000_000n, isPPR: false, isVacantResidential: false }],
      isAbsenteeOwner: true,
    },
    ruleset,
  );

  // Aggregate $200,000 = 20,000,000 cents.
  // Absentee surcharge: mulDiv(20,000,000, 400, 10,000) = (8,000,000,000 + 5,000) / 10,000 = 800,000 = $8,000
  it('absentee surcharge = 800,000 cents ($8,000 = 4% of $200,000)', () => {
    expect(absentee.absenteeSurchargeCents).toBe(800_000n);
  });
  it('non-absentee surcharge = 0', () => {
    expect(nonAbsentee.absenteeSurchargeCents).toBe(0n);
  });
  it('general land tax unchanged by absentee status', () => {
    expect(absentee.generalLandTaxCents).toBe(nonAbsentee.generalLandTaxCents);
  });
  it('absentee total = general + surcharge', () => {
    expect(absentee.totalLandTaxCents).toBe(
      absentee.generalLandTaxCents + absentee.absenteeSurchargeCents,
    );
  });
});

// ── LT-06: PPR exemption — excluded from aggregate ───────────────────────────

describe('LT-06: PPR holding excluded from aggregate', () => {
  const withPPR = computeVicLandTax(
    {
      holdings: [
        { siteValueCents: 20_000_000n, isPPR: false, isVacantResidential: false }, // $200,000
        { siteValueCents: 60_000_000n, isPPR: true, isVacantResidential: false }, // $600,000 PPR
      ],
      ...NO_FLAGS,
    },
    ruleset,
  );
  const withoutPPR = computeVicLandTax(
    {
      holdings: [{ siteValueCents: 20_000_000n, isPPR: false, isVacantResidential: false }],
      ...NO_FLAGS,
    },
    ruleset,
  );

  it('aggregate excludes PPR site value', () => {
    expect(withPPR.aggregateSiteValueCents).toBe(20_000_000n); // only non-PPR
  });
  it('tax = same as if PPR not present', () => {
    expect(withPPR.generalLandTaxCents).toBe(withoutPPR.generalLandTaxCents);
  });
  it('PPR does NOT increase tax', () => {
    expect(withPPR.totalLandTaxCents).toBeLessThanOrEqual(
      computeVicLandTax(
        {
          holdings: [
            { siteValueCents: 20_000_000n, isPPR: false, isVacantResidential: false },
            { siteValueCents: 60_000_000n, isPPR: false, isVacantResidential: false }, // same, non-PPR
          ],
          ...NO_FLAGS,
        },
        ruleset,
      ).totalLandTaxCents,
    );
  });
});

// ── LT-07: Vacant Residential Land Tax (VRLT) ────────────────────────────────
// VRLT: 1% (100 bps) of capital improved value per vacant holding (SRO 2025+).
// Engine requires capitalImprovedValueCents on every VRLT-liable holding — throws if absent.
// CIV intentionally set above site value ($250K vs $200K) to prove CIV is used as base,
// not the fallback site value.

describe('LT-07: vacant residential land tax (VRLT +1% of CIV)', () => {
  const result = computeVicLandTax(
    {
      holdings: [
        // CIV $250K > site $200K — proves engine uses CIV, not site value
        {
          siteValueCents: 20_000_000n,
          capitalImprovedValueCents: 25_000_000n,
          isPPR: false,
          isVacantResidential: true,
        },
        { siteValueCents: 10_000_000n, isPPR: false, isVacantResidential: false },
      ],
      ...NO_FLAGS,
    },
    ruleset,
  );

  // VRLT: mulDiv(25,000,000, 100, 10,000) = (2,500,000,000 + 5,000) / 10,000 = 250,000 cents = $2,500
  // If engine had used site value ($200K) instead, result would be 200,000 — proving CIV is used.
  it('VRLT = 250,000 cents ($2,500 = 1% of CIV $250,000, not site value $200,000)', () => {
    expect(result.vrltCents).toBe(250_000n);
  });
  it('general land tax still applies on aggregate ($300K = Band 3 → $975)', () => {
    // Aggregate uses site values: $200K + $100K = $300K = 30M.
    // At exactly 30M, Band 3 applies (strictly-greater-than 10M, not > 30M).
    expect(result.generalLandTaxCents).toBe(97_500n);
  });
  it('total = general + VRLT', () => {
    expect(result.totalLandTaxCents).toBe(result.generalLandTaxCents + result.vrltCents);
  });
});

// ── LT-08: Mid-scale golden — $500,000 aggregate ─────────────────────────────
// $500,000 = 50,000,000 cents: Band 4 ($300K–$600K).
// flat = 135,000; excess = 50M − 30M = 20M; marginal = mulDiv(20M, 30, 10000) = 60,000.
// Total = 135,000 + 60,000 = 195,000 cents = $1,950.
// SRO cross-check: $1,350 + 0.3% × $200,000 = $1,350 + $600 = $1,950 ✓

describe('LT-08: individual brackets — $500,000 aggregate (Band 4, mid-scale)', () => {
  const result = computeVicLandTax(
    {
      holdings: [{ siteValueCents: 50_000_000n, isPPR: false, isVacantResidential: false }], // $500,000
      ...NO_FLAGS,
    },
    ruleset,
  );

  it('aggregate = 50,000,000 cents ($500,000)', () => {
    expect(result.aggregateSiteValueCents).toBe(50_000_000n);
  });
  it('general land tax = 195,000 cents ($1,950)', () => {
    expect(result.generalLandTaxCents).toBe(195_000n);
  });
});

// ── LT-07 extended: Multiple vacant holdings — VRLT summed per-holding ────────

describe('LT-07 extended: two vacant holdings — VRLT summed', () => {
  const result = computeVicLandTax(
    {
      holdings: [
        {
          siteValueCents: 20_000_000n,
          capitalImprovedValueCents: 20_000_000n,
          isPPR: false,
          isVacantResidential: true,
        }, // $200K
        {
          siteValueCents: 10_000_000n,
          capitalImprovedValueCents: 10_000_000n,
          isPPR: false,
          isVacantResidential: true,
        }, // $100K
      ],
      ...NO_FLAGS,
    },
    ruleset,
  );

  // VRLT: 1% × $200K + 1% × $100K = $2,000 + $1,000 = $3,000 = 300,000 cents
  it('VRLT = 300,000 cents ($3,000, summed across two vacant holdings)', () => {
    expect(result.vrltCents).toBe(300_000n);
  });
});

// ── Combined: absentee + VRLT + PPR all applied together ─────────────────────
// Holdings: $500K PPR (excluded), $200K vacant, $100K investment.
// Aggregate (non-PPR): $200K + $100K = $300K = 30,000,000 cents.
//
// General tax at exactly $300K:
//   Is 30M > 10M (Band 3 prev)? YES → Band 3
//   Is 30M > 30M (Band 4 prev)? NO → Band 3 confirmed
//   flat = 97,500; marginal = 0; tax = 97,500 cents = $975
//
// Absentee: mulDiv(30M, 400, 10000) = (12B + 5000)/10000 = 1,200,000 = $12,000
// VRLT ($200K vacant): mulDiv(20M, 100, 10000) = (2B + 5000)/10000 = 200,000 = $2,000
// Total: 97,500 + 1,200,000 + 200,000 = 1,497,500 cents = $14,975

describe('combined: absentee + VRLT + PPR exclusion', () => {
  const result = computeVicLandTax(
    {
      holdings: [
        { siteValueCents: 50_000_000n, isPPR: true, isVacantResidential: false }, // $500K PPR — excluded
        {
          siteValueCents: 20_000_000n,
          capitalImprovedValueCents: 20_000_000n,
          isPPR: false,
          isVacantResidential: true,
        }, // $200K vacant
        { siteValueCents: 10_000_000n, isPPR: false, isVacantResidential: false }, // $100K investment
      ],
      isAbsenteeOwner: true,
    },
    ruleset,
  );

  it('aggregate excludes PPR ($300,000)', () => {
    expect(result.aggregateSiteValueCents).toBe(30_000_000n);
  });
  it('general land tax = 97,500 cents ($975 — Band 3 flat, at exactly $300K)', () => {
    expect(result.generalLandTaxCents).toBe(97_500n);
  });
  it('absentee surcharge = 1,200,000 cents ($12,000)', () => {
    expect(result.absenteeSurchargeCents).toBe(1_200_000n);
  });
  it('VRLT = 200,000 cents ($2,000)', () => {
    expect(result.vrltCents).toBe(200_000n);
  });
  it('total = 1,497,500 cents ($14,975)', () => {
    expect(result.totalLandTaxCents).toBe(1_497_500n);
  });
});

// ── Zero holdings / no VIC config ─────────────────────────────────────────────

describe('zero holdings — all zeros', () => {
  const result = computeVicLandTax({ holdings: [], isAbsenteeOwner: false }, ruleset);
  it('aggregate = 0', () => expect(result.aggregateSiteValueCents).toBe(0n));
  it('total = 0', () => expect(result.totalLandTaxCents).toBe(0n));
});

// ── No VIC land tax config in ruleset — graceful zero result ─────────────────
// Covers the ?? fallback branches and the brackets.length === 0 guard.

describe('ruleset with no VIC land tax config — all zeros', () => {
  const noVicRuleset = { ...ruleset, landTax: undefined } as typeof ruleset;
  const result = computeVicLandTax(
    {
      holdings: [{ siteValueCents: 50_000_000n, isPPR: false, isVacantResidential: true }],
      isAbsenteeOwner: true,
    },
    noVicRuleset,
  );

  it('general land tax = 0 (no brackets)', () => expect(result.generalLandTaxCents).toBe(0n));
  it('absentee surcharge = 0 (no config)', () => expect(result.absenteeSurchargeCents).toBe(0n));
  it('VRLT = 0 (no config)', () => expect(result.vrltCents).toBe(0n));
  it('total = 0', () => expect(result.totalLandTaxCents).toBe(0n));
});

// ── LT-VRLT-throw: absent CIV on VRLT-liable holding must throw ──────────────
// Rationale: CIV ≥ site value always. Substituting site value would silently
// understate VRLT — a wrong tax figure with no signal. Fail loudly instead.

describe('LT-VRLT-throw: absent CIV on VRLT-liable holding throws', () => {
  it('throws when isVacantResidential=true and capitalImprovedValueCents is absent', () => {
    expect(() =>
      computeVicLandTax(
        {
          holdings: [{ siteValueCents: 20_000_000n, isPPR: false, isVacantResidential: true }],
          isAbsenteeOwner: false,
        },
        ruleset,
      ),
    ).toThrow('capitalImprovedValueCents is required');
  });

  it('does NOT throw when isVacantResidential=false and CIV is absent (not VRLT-liable)', () => {
    expect(() =>
      computeVicLandTax(
        {
          holdings: [{ siteValueCents: 20_000_000n, isPPR: false, isVacantResidential: false }],
          isAbsenteeOwner: false,
        },
        ruleset,
      ),
    ).not.toThrow();
  });
});

// ── LT-XV-01..LT-XV-03: SRO cross-validation anchors ─────────────────────────
// These three values are independently derivable from the SRO published rate table
// and verify that the scale is correctly encoded end-to-end.
// Source: https://www.sro.vic.gov.au/land-tax-current-rates (retrieved 2026-05-22)

describe('LT-XV-01: $360,000 → $1,530 (SRO Band 4 anchor)', () => {
  // Band 4: $300K–$600K. flat=$1,350, marginal=0.3%.
  // $1,350 + 0.3% × ($360K − $300K) = $1,350 + 0.3% × $60K = $1,350 + $180 = $1,530
  // In cents: flat=135,000; mulDiv(6M, 30, 10000) = (180M + 5000)/10000 = 18,000; total = 153,000
  const result = computeVicLandTax(
    {
      holdings: [{ siteValueCents: 36_000_000n, isPPR: false, isVacantResidential: false }],
      ...NO_FLAGS,
    },
    ruleset,
  );

  it('aggregate = 36,000,000 cents ($360,000)', () => {
    expect(result.aggregateSiteValueCents).toBe(36_000_000n);
  });
  it('land tax = 153,000 cents ($1,530)', () => {
    expect(result.generalLandTaxCents).toBe(153_000n);
  });
});

describe('LT-XV-02: $650,000 → $2,550 (SRO Band 5 anchor)', () => {
  // Band 5: $600K–$1M. flat=$2,250, marginal=0.6%.
  // $2,250 + 0.6% × ($650K − $600K) = $2,250 + 0.6% × $50K = $2,250 + $300 = $2,550
  // In cents: flat=225,000; mulDiv(5M, 60, 10000) = (300M + 5000)/10000 = 30,000; total = 255,000
  const result = computeVicLandTax(
    {
      holdings: [{ siteValueCents: 65_000_000n, isPPR: false, isVacantResidential: false }],
      ...NO_FLAGS,
    },
    ruleset,
  );

  it('aggregate = 65,000,000 cents ($650,000)', () => {
    expect(result.aggregateSiteValueCents).toBe(65_000_000n);
  });
  it('land tax = 255,000 cents ($2,550)', () => {
    expect(result.generalLandTaxCents).toBe(255_000n);
  });
});

describe('LT-XV-03: $750,000 → $3,150 (SRO Band 5 anchor)', () => {
  // Band 5: $600K–$1M. flat=$2,250, marginal=0.6%.
  // $2,250 + 0.6% × ($750K − $600K) = $2,250 + 0.6% × $150K = $2,250 + $900 = $3,150
  // In cents: flat=225,000; mulDiv(15M, 60, 10000) = (900M + 5000)/10000 = 90,000; total = 315,000
  const result = computeVicLandTax(
    {
      holdings: [{ siteValueCents: 75_000_000n, isPPR: false, isVacantResidential: false }],
      ...NO_FLAGS,
    },
    ruleset,
  );

  it('aggregate = 75,000,000 cents ($750,000)', () => {
    expect(result.aggregateSiteValueCents).toBe(75_000_000n);
  });
  it('land tax = 315,000 cents ($3,150)', () => {
    expect(result.generalLandTaxCents).toBe(315_000n);
  });
});
