/**
 * TX-01..TX-15 — TaxService, Medicare, and Negative Gearing unit tests.
 *
 * All monetary values are bigint cents. Hand-derived goldens are verified
 * against FY2026 brackets from fy2026.json via the defaultRulesetAdapter.
 *
 * FY2026 brackets (processed):
 *   { prev: 0n,          threshold: 1_820_000n,           rateBps: 0    }  // 0%
 *   { prev: 1_820_000n,  threshold: 4_500_000n,           rateBps: 1600 }  // 16%
 *   { prev: 4_500_000n,  threshold: 13_500_000n,          rateBps: 3000 }  // 30%
 *   { prev: 13_500_000n, threshold: 19_000_000n,          rateBps: 3700 }  // 37%
 *   { prev: 19_000_000n, threshold: 9007199254740992n,    rateBps: 4500 }  // 45%
 *
 * Medicare levy FY2026:  rateBps=200, singleThreshold=$27,168, familyThreshold=$45,840
 * MLS tiers: >$93k=1%, >$108k=1.25%, >$144k=1.5%
 */

import { describe, expect, it } from 'vitest';

import { computeMedicareLevy, computeMLS } from '../../src/tax/medicare.js';
import { applyNegativeGearing } from '../../src/tax/negative-gearing.js';
import { defaultRulesetAdapter } from '../../src/tax/ruleset/index.js';
import { applyMarginalRates } from '../../src/tax/service.js';

const fy2026 = defaultRulesetAdapter.resolveByFY('FY2026', { status: 'draft' });
const { brackets } = fy2026;
const { medicareLevy } = fy2026;
const { negativeGearingRules } = fy2026;

// ── TX-01..TX-10: applyMarginalRates ─────────────────────────────────────────

describe('TX-01: zero income', () => {
  it('returns 0 tax for $0', () => {
    expect(applyMarginalRates(0n, brackets)).toBe(0n);
  });
});

describe('TX-02: below tax-free threshold', () => {
  it('$18,199 (1 cent below threshold) → 0 tax', () => {
    expect(applyMarginalRates(1_819_900n, brackets)).toBe(0n);
  });
});

describe('TX-03: at tax-free threshold boundary', () => {
  it('$18,200 exactly → 0 tax (0% bracket applies)', () => {
    expect(applyMarginalRates(1_820_000n, brackets)).toBe(0n);
  });
});

describe('TX-04: $20,000 income', () => {
  // Hand-derived: (2_000_000 - 1_820_000) × 1600 / 10000
  //             = 180_000 × 1600 / 10000
  //             = 28_800_000 / 10000 = 28,800c ($288.00)
  it('returns 28,800c', () => {
    expect(applyMarginalRates(2_000_000n, brackets)).toBe(28_800n);
  });
});

describe('TX-05: $45,000 income (top of 16% bracket)', () => {
  // Hand-derived: (4_500_000 - 1_820_000) × 1600 / 10000
  //             = 2_680_000 × 1600 / 10000 = 428,800c ($4,288)
  it('returns 428,800c', () => {
    expect(applyMarginalRates(4_500_000n, brackets)).toBe(428_800n);
  });
});

describe('TX-06: $50,000 income', () => {
  // Hand-derived: 428,800 + (5_000_000 - 4_500_000) × 3000 / 10000
  //             = 428,800 + 500_000 × 3000 / 10000
  //             = 428,800 + 150,000 = 578,800c ($5,788)
  it('returns 578,800c', () => {
    expect(applyMarginalRates(5_000_000n, brackets)).toBe(578_800n);
  });
});

describe('TX-07: $100,000 income', () => {
  // Hand-derived: 428,800 + (10_000_000 - 4_500_000) × 3000 / 10000
  //             = 428,800 + 5_500_000 × 3000 / 10000
  //             = 428,800 + 1,650,000 = 2,078,800c ($20,788)
  it('returns 2,078,800c', () => {
    expect(applyMarginalRates(10_000_000n, brackets)).toBe(2_078_800n);
  });
});

describe('TX-08: $135,000 income (top of 30% bracket)', () => {
  // DEV: depreciation deductions are Day 6 scope and not included here.
  // Hand-derived: 428,800 + (13_500_000 - 4_500_000) × 3000 / 10000
  //             = 428,800 + 9_000_000 × 3000 / 10000
  //             = 428,800 + 2,700,000 = 3,128,800c ($31,288)
  it('returns 3,128,800c', () => {
    expect(applyMarginalRates(13_500_000n, brackets)).toBe(3_128_800n);
  });
});

describe('TX-09: $190,000 income (top of 37% bracket)', () => {
  // Hand-derived: 3,128,800 + (19_000_000 - 13_500_000) × 3700 / 10000
  //             = 3,128,800 + 5_500_000 × 3700 / 10000
  //             = 3,128,800 + 2,035,000 = 5,163,800c ($51,638)
  it('returns 5,163,800c', () => {
    expect(applyMarginalRates(19_000_000n, brackets)).toBe(5_163_800n);
  });
});

describe('TX-10: $200,000 income (into 45% bracket)', () => {
  // DEV: company/trust/SMSF ownership splits are Day 6 scope.
  // Hand-derived: 5,163,800 + (20_000_000 - 19_000_000) × 4500 / 10000
  //             = 5,163,800 + 1_000_000 × 4500 / 10000
  //             = 5,163,800 + 450,000 = 5,613,800c ($56,138)
  it('returns 5,613,800c', () => {
    expect(applyMarginalRates(20_000_000n, brackets)).toBe(5_613_800n);
  });
});

// ── TX-11..TX-14: Medicare ────────────────────────────────────────────────────

describe('TX-11: Medicare levy — income below single threshold', () => {
  // singleThresholdCents = 2,716,800 ($27,168)
  it('$27,168 exactly → 0 levy', () => {
    expect(computeMedicareLevy(2_716_800n, medicareLevy, false)).toBe(0n);
  });

  it('$10,000 → 0 levy', () => {
    expect(computeMedicareLevy(1_000_000n, medicareLevy, false)).toBe(0n);
  });
});

describe('TX-12: Medicare levy — income above threshold', () => {
  // Hand-derived: 10_000_000 × 200 / 10000 = 200,000c ($2,000)
  it('$100,000 single → 200,000c', () => {
    expect(computeMedicareLevy(10_000_000n, medicareLevy, false)).toBe(200_000n);
  });

  // $40,000: 4_000_000 × 200 / 10000 = 80,000c
  it('$40,000 single → 80,000c', () => {
    expect(computeMedicareLevy(4_000_000n, medicareLevy, false)).toBe(80_000n);
  });

  // $45,840 is family threshold; below that → 0 for family filers
  it('$45,840 family → 0 levy (at family threshold)', () => {
    expect(computeMedicareLevy(4_584_000n, medicareLevy, true)).toBe(0n);
  });

  it('$50,000 family → 100,000c', () => {
    // 5_000_000 × 200 / 10000 = 100,000c
    expect(computeMedicareLevy(5_000_000n, medicareLevy, true)).toBe(100_000n);
  });
});

describe('TX-13: MLS — no private hospital cover', () => {
  // Income $93,000 (9_300_000c): NOT > 9_300_000 → 0
  it('$93,000 exact → 0 (at Tier 1 threshold, not above)', () => {
    expect(computeMLS(9_300_000n, medicareLevy, false)).toBe(0n);
  });

  // Income $100,000 (10_000_000c): > 9_300_000 → rate 100bps
  // mulDiv(10_000_000, 100, 10000) = 100,000c
  it('$100,000 no PHC → 100,000c (Tier 1: 1%)', () => {
    expect(computeMLS(10_000_000n, medicareLevy, false)).toBe(100_000n);
  });

  // Income $110,000 (11_000_000c): > 10_800_000 → rate 125bps
  // mulDiv(11_000_000, 125, 10000) = 137,500c
  it('$110,000 no PHC → 137,500c (Tier 2: 1.25%)', () => {
    expect(computeMLS(11_000_000n, medicareLevy, false)).toBe(137_500n);
  });

  // Income $150,000 (15_000_000c): > 14_400_000 → rate 150bps
  // mulDiv(15_000_000, 150, 10000) = 225,000c
  it('$150,000 no PHC → 225,000c (Tier 3: 1.5%)', () => {
    expect(computeMLS(15_000_000n, medicareLevy, false)).toBe(225_000n);
  });
});

describe('TX-14: MLS — has private hospital cover', () => {
  it('$200,000 with PHC → 0 (MLS not payable)', () => {
    expect(computeMLS(20_000_000n, medicareLevy, true)).toBe(0n);
  });

  it('$100,000 with PHC → 0', () => {
    expect(computeMLS(10_000_000n, medicareLevy, true)).toBe(0n);
  });
});

// ── TX-15: Negative gearing ───────────────────────────────────────────────────

describe('TX-15: applyNegativeGearing', () => {
  it('TX-15a: rental profit adds to other income', () => {
    const r = applyNegativeGearing(12_000_000n, 1_000_000n, negativeGearingRules);
    expect(r.adjustedIncomeCents).toBe(13_000_000n);
    expect(r.carryForwardLossCents).toBe(0n);
  });

  it('TX-15b: enabled — rental loss offsets other income, no carry-forward needed', () => {
    // $120k wages − $20k rental loss = $100k adjusted
    const r = applyNegativeGearing(12_000_000n, -2_000_000n, negativeGearingRules);
    expect(r.adjustedIncomeCents).toBe(10_000_000n);
    expect(r.carryForwardLossCents).toBe(0n);
  });

  it('TX-15c: enabled — loss exceeds other income → carry-forward captures excess', () => {
    // $10k wages − $30k rental loss = -$20k → adjustedIncome=0, carry=$20k
    const r = applyNegativeGearing(1_000_000n, -3_000_000n, negativeGearingRules);
    expect(r.adjustedIncomeCents).toBe(0n);
    expect(r.carryForwardLossCents).toBe(2_000_000n);
  });

  it('TX-15d: disabled — rental loss quarantined, other income unchanged', () => {
    const disabledRules = {
      enabled: false,
      propertyTypeExclusions: [],
      quarantineCarryForward: true,
    };
    const r = applyNegativeGearing(5_000_000n, -2_000_000n, disabledRules);
    expect(r.adjustedIncomeCents).toBe(5_000_000n);
    expect(r.carryForwardLossCents).toBe(2_000_000n);
  });

  it('TX-15e: disabled + no carryForward — loss is simply lost', () => {
    const noCarryRules = {
      enabled: false,
      propertyTypeExclusions: [],
      quarantineCarryForward: false,
    };
    const r = applyNegativeGearing(5_000_000n, -2_000_000n, noCarryRules);
    expect(r.adjustedIncomeCents).toBe(5_000_000n);
    expect(r.carryForwardLossCents).toBe(0n);
  });

  it('TX-15f: enabled + no carryForward — combined loss → adjustedIncome=0, carryForward=0', () => {
    const noCarryRules = {
      enabled: true,
      propertyTypeExclusions: [],
      quarantineCarryForward: false,
    };
    const r = applyNegativeGearing(1_000_000n, -5_000_000n, noCarryRules);
    expect(r.adjustedIncomeCents).toBe(0n);
    expect(r.carryForwardLossCents).toBe(0n);
  });

  it('TX-15g: zero income, zero rental → no tax liability', () => {
    const r = applyNegativeGearing(0n, 0n, negativeGearingRules);
    expect(r.adjustedIncomeCents).toBe(0n);
    expect(r.carryForwardLossCents).toBe(0n);
  });
});
