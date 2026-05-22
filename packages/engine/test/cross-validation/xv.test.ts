/**
 * XV-01..XV-21 — Cross-validation against ATO published FY2026 rates.
 *
 * Source: ATO Individual Income Tax Rates FY2026 (1 July 2025 – 30 June 2026)
 * https://www.ato.gov.au/rates/individual-income-tax-rates/ (Stage 3 tax cuts)
 *
 * XV-01..XV-12: EXTERNALLY ANCHORED to ATO-published bracket rates; independently derived.
 *   NOT from ATO online estimator (excludes LITO). Derivation .md files for one per band:
 *   XV-02 (0%), XV-03 (16%), XV-06 (30%), XV-09 (37%), XV-11 (45%) in
 *   test/fixtures/cross-validation/.
 * XV-13..XV-16: EXTERNALLY ANCHORED to ATO Medicare levy rate (2%) and threshold ($27,168).
 * XV-17..XV-20: EXTERNALLY ANCHORED to ATO MLS tier rates and thresholds.
 *   Derivation: test/fixtures/cross-validation/XV-18-derivation.md
 * XV-21: EXTERNALLY ANCHORED to ATO negative gearing mechanism (NAT 1729 rental guide).
 *   Derivation: test/fixtures/cross-validation/XV-21-derivation.md
 *
 * Invariant-only XVs (DEV-0016 CPA sign-off queue — no non-trivial external value):
 *   XV-01 ($0 income → $0, trivially zero)
 *   XV-13 (at Medicare single threshold → $0, boundary invariant)
 *   XV-17 (at MLS Tier 1 threshold → $0, boundary invariant — "not strictly above")
 *   XV-20 (has PHC → $0, statutory exemption invariant)
 *
 * DEV-XV-01: LITO/LMITO offsets are not yet implemented; actual ATO tax payable
 *   for low/middle incomes will be lower than the figures tested here.
 *   See financial-calc-engine.md §tax-offsets — flagged for Day 6 implementation.
 * DEV-XV-02: CGT discount calculations are Day 6 scope; not tested here.
 * DEV-XV-03: Land tax cross-validation is Day 6 scope; SRO VIC rates not tested here.
 * DEV-XV-04: Div40/Div43 depreciation deductions are Day 6 scope.
 */

import { describe, expect, it } from 'vitest';

import { computeMedicareLevy, computeMLS } from '../../src/tax/medicare.js';
import { applyNegativeGearing } from '../../src/tax/negative-gearing.js';
import { defaultRulesetAdapter } from '../../src/tax/ruleset/index.js';
import { applyMarginalRates } from '../../src/tax/service.js';

const fy2026 = defaultRulesetAdapter.resolveByFY('FY2026', { status: 'published' });
const { brackets, medicareLevy, negativeGearingRules } = fy2026;

// ── XV-01..XV-12: Marginal rate bracket cross-validation ─────────────────────
//
// All values derived from ATO FY2026 individual resident rates:
//   0%  on $0       – $18,200
//   16% on $18,201  – $45,000
//   30% on $45,001  – $135,000
//   37% on $135,001 – $190,000
//   45% on $190,001+

describe('XV-01: $0 income → $0 tax', () => {
  it('returns 0c', () => {
    expect(applyMarginalRates(0n, brackets)).toBe(0n);
  });
});

describe('XV-02: $18,200 — top of tax-free threshold', () => {
  // ATO: $0 tax payable at $18,200 (entire income in 0% bracket)
  it('returns 0c', () => {
    expect(applyMarginalRates(1_820_000n, brackets)).toBe(0n);
  });
});

describe('XV-03: $37,000 income', () => {
  // ATO FY2026 bracket calc (no offsets):
  //   16% on ($37,000 − $18,200) = 16% × $18,800 = $3,008
  // Engine: mulDiv(1_880_000, 1600, 10000) = 300,800c
  it('returns 300,800c ($3,008.00)', () => {
    expect(applyMarginalRates(3_700_000n, brackets)).toBe(300_800n);
  });
});

describe('XV-04: $45,000 — top of 16% bracket', () => {
  // ATO: 16% on $26,800 = $4,288
  // Engine: 2_680_000 × 1600 / 10000 = 428,800c
  it('returns 428,800c ($4,288.00)', () => {
    expect(applyMarginalRates(4_500_000n, brackets)).toBe(428_800n);
  });
});

describe('XV-05: $80,000 income', () => {
  // ATO: $4,288 + 30% × ($80,000 − $45,000) = $4,288 + $10,500 = $14,788
  // Engine: 428_800 + 3_500_000 × 3000 / 10000 = 428_800 + 1_050_000 = 1_478_800c
  it('returns 1,478,800c ($14,788.00)', () => {
    expect(applyMarginalRates(8_000_000n, brackets)).toBe(1_478_800n);
  });
});

describe('XV-06: $100,000 income', () => {
  // ATO: $4,288 + 30% × ($100,000 − $45,000) = $4,288 + $16,500 = $20,788
  // Engine: 428_800 + 5_500_000 × 3000 / 10000 = 2_078_800c
  it('returns 2,078,800c ($20,788.00)', () => {
    expect(applyMarginalRates(10_000_000n, brackets)).toBe(2_078_800n);
  });
});

describe('XV-07: $120,000 income', () => {
  // ATO: $4,288 + 30% × ($120,000 − $45,000) = $4,288 + $22,500 = $26,788
  // Engine: 428_800 + 7_500_000 × 3000 / 10000 = 2_678_800c
  it('returns 2,678,800c ($26,788.00)', () => {
    expect(applyMarginalRates(12_000_000n, brackets)).toBe(2_678_800n);
  });
});

describe('XV-08: $135,000 — top of 30% bracket', () => {
  // ATO: $4,288 + 30% × $90,000 = $4,288 + $27,000 = $31,288
  // Engine: 428_800 + 9_000_000 × 3000 / 10000 = 3_128_800c
  it('returns 3,128,800c ($31,288.00)', () => {
    expect(applyMarginalRates(13_500_000n, brackets)).toBe(3_128_800n);
  });
});

describe('XV-09: $150,000 income', () => {
  // ATO: $31,288 + 37% × ($150,000 − $135,000) = $31,288 + $5,550 = $36,838
  // Engine: 3_128_800 + 1_500_000 × 3700 / 10000 = 3_128_800 + 555_000 = 3_683_800c
  it('returns 3,683,800c ($36,838.00)', () => {
    expect(applyMarginalRates(15_000_000n, brackets)).toBe(3_683_800n);
  });
});

describe('XV-10: $190,000 — top of 37% bracket', () => {
  // ATO: $31,288 + 37% × $55,000 = $31,288 + $20,350 = $51,638
  // Engine: 3_128_800 + 5_500_000 × 3700 / 10000 = 5_163_800c
  it('returns 5,163,800c ($51,638.00)', () => {
    expect(applyMarginalRates(19_000_000n, brackets)).toBe(5_163_800n);
  });
});

describe('XV-11: $200,000 income (45% bracket)', () => {
  // ATO: $51,638 + 45% × $10,000 = $51,638 + $4,500 = $56,138
  // Engine: 5_163_800 + 1_000_000 × 4500 / 10000 = 5_613_800c
  it('returns 5,613,800c ($56,138.00)', () => {
    expect(applyMarginalRates(20_000_000n, brackets)).toBe(5_613_800n);
  });
});

describe('XV-12: $250,000 income', () => {
  // ATO: $51,638 + 45% × $60,000 = $51,638 + $27,000 = $78,638
  // Engine: 5_163_800 + 6_000_000 × 4500 / 10000 = 7_863_800c
  it('returns 7,863,800c ($78,638.00)', () => {
    expect(applyMarginalRates(25_000_000n, brackets)).toBe(7_863_800n);
  });
});

// ── XV-13..XV-16: Medicare levy cross-validation ─────────────────────────────
//
// ATO: 2% of taxable income above $27,168 (single). Flat rate — no shade-in modelled.
// Source: https://www.ato.gov.au/individuals-and-families/medicare-and-private-health-insurance/medicare-levy

describe('XV-13: Medicare levy — below single threshold → $0', () => {
  // ATO: no levy payable below $27,168
  it('$27,168 → 0c', () => {
    expect(computeMedicareLevy(2_716_800n, medicareLevy, false)).toBe(0n);
  });
});

describe('XV-14: Medicare levy — $40,000 income', () => {
  // ATO: 2% × $40,000 = $800
  // Engine: 4_000_000 × 200 / 10000 = 80,000c
  it('returns 80,000c ($800.00)', () => {
    expect(computeMedicareLevy(4_000_000n, medicareLevy, false)).toBe(80_000n);
  });
});

describe('XV-15: Medicare levy — $100,000 income', () => {
  // ATO: 2% × $100,000 = $2,000
  // Engine: 10_000_000 × 200 / 10000 = 200,000c
  it('returns 200,000c ($2,000.00)', () => {
    expect(computeMedicareLevy(10_000_000n, medicareLevy, false)).toBe(200_000n);
  });
});

describe('XV-16: Medicare levy — $200,000 income', () => {
  // ATO: 2% × $200,000 = $4,000
  // Engine: 20_000_000 × 200 / 10000 = 400,000c
  it('returns 400,000c ($4,000.00)', () => {
    expect(computeMedicareLevy(20_000_000n, medicareLevy, false)).toBe(400_000n);
  });
});

// ── XV-17..XV-20: Medicare Levy Surcharge cross-validation ───────────────────
//
// ATO MLS tiers FY2026 (no private hospital cover):
//   Tier 1: income > $93,000  → 1.0% of total income
//   Tier 2: income > $108,000 → 1.25% of total income
//   Tier 3: income > $144,000 → 1.5% of total income
// Source: https://www.ato.gov.au/individuals-and-families/medicare-and-private-health-insurance/medicare-levy-surcharge

describe('XV-17: MLS — $93,000 exactly (at threshold, not above)', () => {
  // ATO: $93,000 does NOT exceed the Tier 1 threshold → $0 MLS
  it('returns 0c', () => {
    expect(computeMLS(9_300_000n, medicareLevy, false)).toBe(0n);
  });
});

describe('XV-18: MLS — $100,000 no PHC (Tier 1)', () => {
  // ATO: 1% × $100,000 = $1,000
  // Engine: 10_000_000 × 100 / 10000 = 100,000c
  it('returns 100,000c ($1,000.00)', () => {
    expect(computeMLS(10_000_000n, medicareLevy, false)).toBe(100_000n);
  });
});

describe('XV-19: MLS — $110,000 no PHC (Tier 2)', () => {
  // ATO: 1.25% × $110,000 = $1,375
  // Engine: 11_000_000 × 125 / 10000 = 137,500c
  it('returns 137,500c ($1,375.00)', () => {
    expect(computeMLS(11_000_000n, medicareLevy, false)).toBe(137_500n);
  });
});

describe('XV-20: MLS — $200,000 with PHC → $0', () => {
  // ATO: MLS not applicable when private hospital cover held
  it('returns 0c regardless of income', () => {
    expect(computeMLS(20_000_000n, medicareLevy, true)).toBe(0n);
  });
});

// ── XV-21: Negative gearing cross-validation ──────────────────────────────────
//
// ATO Rental Properties guide (NAT 1729): rental loss offsets other assessable income.
// Source: https://www.ato.gov.au/individuals-and-families/investments-and-assets/rental-properties/negative-gearing
// Derivation: test/fixtures/cross-validation/XV-21-derivation.md

describe('XV-21: negative gearing — $100k wages + $20k rental loss → adjusted $80k → $14,788 tax', () => {
  it('ATO mechanism: rental loss offsets wage income', () => {
    // Step 1: ATO negative gearing → adjusted assessable income
    const { adjustedIncomeCents, carryForwardLossCents } = applyNegativeGearing(
      10_000_000n, // $100,000 wages
      -2_000_000n, // −$20,000 net rental (loss)
      negativeGearingRules,
    );
    expect(adjustedIncomeCents).toBe(8_000_000n); // $80,000 adjusted
    expect(carryForwardLossCents).toBe(0n); // loss fully absorbed
  });

  it('bracket tax on adjusted $80,000 → 1,478,800c ($14,788.00)', () => {
    // Step 2: bracket tax on the adjusted income
    // ATO: 16% × $26,800 + 30% × $35,000 = $4,288 + $10,500 = $14,788
    const { adjustedIncomeCents } = applyNegativeGearing(
      10_000_000n,
      -2_000_000n,
      negativeGearingRules,
    );
    expect(applyMarginalRates(adjustedIncomeCents, brackets)).toBe(1_478_800n);
  });
});
