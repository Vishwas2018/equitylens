/**
 * CGT Engine — CG-01..CG-12
 *
 * Goldens are independently derived from ATO CGT guidance (see derivation docs).
 * Do not adjust expected values to match the engine — investigate the engine.
 *
 * Sources:
 *   ATO Individual tax rates FY2026 — https://www.ato.gov.au/rates/individual-income-tax-rates/
 *   ATO CGT discount — https://www.ato.gov.au/individuals-and-families/investments-and-assets/capital-gains-tax/cgt-discount
 *   ITAA 1997 s104-10 (CGT event A1), s110-25 (cost base), s110-45, s115-100
 */

import { describe, expect, it } from 'vitest';

import { computeCGT } from '../../src/cgt/engine.js';
import type { DisposalInput } from '../../src/cgt/types.js';
import { defaultRulesetAdapter } from '../../src/tax/ruleset/index.js';
import { applyMarginalRates } from '../../src/tax/service.js';

const ruleset = defaultRulesetAdapter.resolveByFY('FY2026', { status: 'draft' });

// ── Shared base input ──────────────────────────────────────────────────────────

const BASE_COST_BASE = {
  element1AcquisitionCents: 40_000_000n, // $400,000
  element2IncidentalCents: 2_000_000n, // $20,000 stamp duty + conveyancing
  element3OwnershipCents: 1_500_000n, // $15,000 (excluded when income-producing)
  element4ImprovementCents: 0n,
  element5TitleCents: 0n,
};

const SINGLE_INDIVIDUAL: DisposalInput['owners'] = [{ entityType: 'individual', shareBps: 10_000 }];

// ── CG-01 Golden: Hold < 12 months — no discount ──────────────────────────────
// Source: cgt-golden-01-no-discount-derivation.md
// Acquisition: 2024-07-01, Disposal: 2024-12-31 (183 days)
// Cost base: $420,000 (element3 excluded, wasIncomeProducing=true)
// Net proceeds: $490,000 − $10,000 selling = $490,000 net
// Gross gain: $490,000 − $420,000 = $70,000 = 7,000,000 cents
// No discount (183 < 366).

describe('CG-01 golden: hold 183 days, individual — no discount', () => {
  const result = computeCGT(
    {
      acquisitionDateISO: '2024-07-01',
      disposalDateISO: '2024-12-31',
      grossProceedsCents: 50_000_000n, // $500,000
      sellingCostsCents: 1_000_000n, // $10,000
      costBase: BASE_COST_BASE,
      div43ClaimedCents: 0n,
      wasIncomeProducing: true,
      priorYearCapitalLossesCents: 0n,
      owners: SINGLE_INDIVIDUAL,
      isPreCgtAsset: false,
    },
    ruleset,
  );

  it('daysHeld = 183', () => expect(result.daysHeld).toBe(183));
  it('discountEligible = false', () => expect(result.discountEligible).toBe(false));
  it('cost base = 42,000,000 (element3 excluded)', () =>
    expect(result.totalCostBaseCents).toBe(42_000_000n));
  it('net proceeds = 49,000,000', () => expect(result.netProceedsCents).toBe(49_000_000n));
  it('gross gain = 7,000,000', () => expect(result.grossGainCents).toBe(7_000_000n));
  it('isCapitalLoss = false', () => expect(result.isCapitalLoss).toBe(false));
  it('taxable gain = 7,000,000 (full, no discount)', () => {
    expect(result.owners[0]!.ownerTaxableGainCents).toBe(7_000_000n);
  });
  it('discount applied = 0', () => expect(result.owners[0]!.ownerDiscountAppliedCents).toBe(0n));
  it('carry-forward = 0', () => expect(result.owners[0]!.ownerCarryForwardLossCents).toBe(0n));
});

// ── CG-02: Hold exactly 365 days — no discount (boundary) ────────────────────
// s115-25: must be held MORE than 12 months. 365 days = exactly 12 months
// (in a non-leap-year year) — does NOT qualify.
// minimumHoldingDays in ruleset = 366; daysHeld 365 < 366 → no discount.

describe('CG-02: hold exactly 365 days — no discount (s115-25 boundary)', () => {
  const result = computeCGT(
    {
      acquisitionDateISO: '2023-01-01',
      disposalDateISO: '2024-01-01', // 365 days (2023 is not a leap year)
      grossProceedsCents: 50_000_000n,
      sellingCostsCents: 1_000_000n,
      costBase: BASE_COST_BASE,
      div43ClaimedCents: 0n,
      wasIncomeProducing: true,
      priorYearCapitalLossesCents: 0n,
      owners: SINGLE_INDIVIDUAL,
      isPreCgtAsset: false,
    },
    ruleset,
  );

  it('daysHeld = 365', () => expect(result.daysHeld).toBe(365));
  it('discountEligible = false (365 < 366)', () => expect(result.discountEligible).toBe(false));
  it('taxable gain = gross gain (no discount)', () => {
    expect(result.owners[0]!.ownerTaxableGainCents).toBe(result.owners[0]!.ownerGrossGainCents);
  });
  it('discount applied = 0', () => expect(result.owners[0]!.ownerDiscountAppliedCents).toBe(0n));
});

// ── CG-03 Golden: Hold 366 days, individual — 50% discount ───────────────────
// Source: cgt-golden-02-discount-derivation.md
// Acquisition: 2023-01-01, Disposal: 2024-01-02 (366 days)
// Cost base: $400,000 + $20,000 + $10,000 improvement = $430,000 = 43,000,000 cents
// Net proceeds: $600,000 − $12,000 = $588,000 = 58,800,000 cents
// Gross gain: 58,800,000 − 43,000,000 = 15,800,000 cents = $158,000
// Discount: 15,800,000 × 5000 / 10000 = 7,900,000 cents = $79,000
// Taxable gain: 7,900,000 cents = $79,000

describe('CG-03 golden: hold 366 days, individual — 50% discount', () => {
  const result = computeCGT(
    {
      acquisitionDateISO: '2023-01-01',
      disposalDateISO: '2024-01-02',
      grossProceedsCents: 60_000_000n, // $600,000
      sellingCostsCents: 1_200_000n, // $12,000
      costBase: {
        element1AcquisitionCents: 40_000_000n, // $400,000
        element2IncidentalCents: 2_000_000n, // $20,000
        element3OwnershipCents: 1_500_000n, // excluded (income-producing)
        element4ImprovementCents: 1_000_000n, // $10,000 capital improvement
        element5TitleCents: 0n,
      },
      div43ClaimedCents: 0n,
      wasIncomeProducing: true,
      priorYearCapitalLossesCents: 0n,
      owners: SINGLE_INDIVIDUAL,
      isPreCgtAsset: false,
    },
    ruleset,
  );

  it('daysHeld = 366', () => expect(result.daysHeld).toBe(366));
  it('discountEligible = true', () => expect(result.discountEligible).toBe(true));
  it('cost base = 43,000,000 (e1+e2+e4, e3 excluded)', () => {
    expect(result.totalCostBaseCents).toBe(43_000_000n);
  });
  it('gross gain = 15,800,000', () => expect(result.grossGainCents).toBe(15_800_000n));
  it('discount = 7,900,000 (50% of gain)', () => {
    expect(result.owners[0]!.ownerDiscountAppliedCents).toBe(7_900_000n);
  });
  it('taxable gain = 7,900,000', () => {
    expect(result.owners[0]!.ownerTaxableGainCents).toBe(7_900_000n);
  });
  it('carry-forward = 0', () => expect(result.owners[0]!.ownerCarryForwardLossCents).toBe(0n));
});

// ── CG-04: SMSF — 33.33% discount ────────────────────────────────────────────

describe('CG-04: hold 366 days, SMSF — 33.33% (3333 bps) discount', () => {
  // Gain: 10,000,000 cents. Discount: mulDiv(10000000, 3333, 10000) HALF_UP
  // = (10000000 * 3333 + 5000) / 10000 = (33330000000 + 5000) / 10000 = 33330005000 / 10000 = 3333000
  // taxable = 10000000 - 3333000 = 6667000
  const result = computeCGT(
    {
      acquisitionDateISO: '2023-01-01',
      disposalDateISO: '2024-01-02',
      grossProceedsCents: 52_000_000n,
      sellingCostsCents: 2_000_000n,
      costBase: {
        ...BASE_COST_BASE,
        element3OwnershipCents: 0n,
      },
      div43ClaimedCents: 0n,
      wasIncomeProducing: false,
      priorYearCapitalLossesCents: 0n,
      owners: [{ entityType: 'smsf', shareBps: 10_000 }],
      isPreCgtAsset: false,
    },
    ruleset,
  );

  const owner = result.owners[0]!;
  it('SMSF discount applied (3333 bps)', () => {
    const expectedDiscount = (owner.ownerGrossGainCents * 3333n + 5000n) / 10_000n;
    expect(owner.ownerDiscountAppliedCents).toBe(expectedDiscount);
  });
  it('taxable < gross (discount applied)', () => {
    expect(owner.ownerTaxableGainCents).toBeLessThan(owner.ownerGrossGainCents);
  });
  it('discount < 50% of gross (SMSF rate < individual)', () => {
    const halfGross = owner.ownerGrossGainCents / 2n;
    expect(owner.ownerDiscountAppliedCents).toBeLessThan(halfGross);
  });
});

// ── CG-05: Company — 0% discount ─────────────────────────────────────────────

describe('CG-05: hold 366 days, company — 0% discount', () => {
  const result = computeCGT(
    {
      acquisitionDateISO: '2023-01-01',
      disposalDateISO: '2024-01-02',
      grossProceedsCents: 50_000_000n,
      sellingCostsCents: 1_000_000n,
      costBase: BASE_COST_BASE,
      div43ClaimedCents: 0n,
      wasIncomeProducing: true,
      priorYearCapitalLossesCents: 0n,
      owners: [{ entityType: 'company', shareBps: 10_000 }],
      isPreCgtAsset: false,
    },
    ruleset,
  );

  it('discountEligible = true (days ok)', () => expect(result.discountEligible).toBe(true));
  it('discount applied = 0 (company not eligible)', () => {
    expect(result.owners[0]!.ownerDiscountAppliedCents).toBe(0n);
  });
  it('taxable = gross gain (no discount)', () => {
    expect(result.owners[0]!.ownerTaxableGainCents).toBe(result.owners[0]!.ownerGrossGainCents);
  });
});

// ── CG-06: Div 43 claimed reduces cost base ──────────────────────────────────
// s110-45: capital works deductions reduce the cost base.
// Without div43: cost base = $420,000. With $10,000 div43: $410,000.
// This increases the taxable gain by $10,000.

describe('CG-06: Div 43 claimed reduces cost base (s110-45)', () => {
  const withoutDiv43 = computeCGT(
    {
      acquisitionDateISO: '2024-07-01',
      disposalDateISO: '2024-12-31',
      grossProceedsCents: 50_000_000n,
      sellingCostsCents: 1_000_000n,
      costBase: BASE_COST_BASE,
      div43ClaimedCents: 0n,
      wasIncomeProducing: true,
      priorYearCapitalLossesCents: 0n,
      owners: SINGLE_INDIVIDUAL,
      isPreCgtAsset: false,
    },
    ruleset,
  );
  const withDiv43 = computeCGT(
    {
      acquisitionDateISO: '2024-07-01',
      disposalDateISO: '2024-12-31',
      grossProceedsCents: 50_000_000n,
      sellingCostsCents: 1_000_000n,
      costBase: BASE_COST_BASE,
      div43ClaimedCents: 1_000_000n, // $10,000 Div 43 claimed
      wasIncomeProducing: true,
      priorYearCapitalLossesCents: 0n,
      owners: SINGLE_INDIVIDUAL,
      isPreCgtAsset: false,
    },
    ruleset,
  );

  it('cost base reduced by div43 amount', () => {
    expect(withDiv43.totalCostBaseCents).toBe(withoutDiv43.totalCostBaseCents - 1_000_000n);
  });
  it('taxable gain increased by div43 amount (no discount)', () => {
    expect(withDiv43.owners[0]!.ownerTaxableGainCents).toBe(
      withoutDiv43.owners[0]!.ownerTaxableGainCents + 1_000_000n,
    );
  });
});

// ── CG-07: Capital improvement increases cost base ───────────────────────────

describe('CG-07: capital improvement (element4) increases cost base', () => {
  const withImprovement = computeCGT(
    {
      acquisitionDateISO: '2024-07-01',
      disposalDateISO: '2024-12-31',
      grossProceedsCents: 50_000_000n,
      sellingCostsCents: 1_000_000n,
      costBase: {
        ...BASE_COST_BASE,
        element4ImprovementCents: 500_000n, // $5,000 new hot water system
      },
      div43ClaimedCents: 0n,
      wasIncomeProducing: true,
      priorYearCapitalLossesCents: 0n,
      owners: SINGLE_INDIVIDUAL,
      isPreCgtAsset: false,
    },
    ruleset,
  );
  const withoutImprovement = computeCGT(
    {
      acquisitionDateISO: '2024-07-01',
      disposalDateISO: '2024-12-31',
      grossProceedsCents: 50_000_000n,
      sellingCostsCents: 1_000_000n,
      costBase: BASE_COST_BASE,
      div43ClaimedCents: 0n,
      wasIncomeProducing: true,
      priorYearCapitalLossesCents: 0n,
      owners: SINGLE_INDIVIDUAL,
      isPreCgtAsset: false,
    },
    ruleset,
  );

  it('cost base increased by improvement amount', () => {
    expect(withImprovement.totalCostBaseCents).toBe(
      withoutImprovement.totalCostBaseCents + 500_000n,
    );
  });
  it('taxable gain decreased by improvement amount', () => {
    expect(withImprovement.owners[0]!.ownerTaxableGainCents).toBe(
      withoutImprovement.owners[0]!.ownerTaxableGainCents - 500_000n,
    );
  });
});

// ── CG-08: Selling costs reduce net proceeds ─────────────────────────────────

describe('CG-08: selling costs reduce net proceeds and gain', () => {
  const noSellingCosts = computeCGT(
    {
      acquisitionDateISO: '2024-07-01',
      disposalDateISO: '2024-12-31',
      grossProceedsCents: 50_000_000n,
      sellingCostsCents: 0n,
      costBase: BASE_COST_BASE,
      div43ClaimedCents: 0n,
      wasIncomeProducing: true,
      priorYearCapitalLossesCents: 0n,
      owners: SINGLE_INDIVIDUAL,
      isPreCgtAsset: false,
    },
    ruleset,
  );
  const withSellingCosts = computeCGT(
    {
      acquisitionDateISO: '2024-07-01',
      disposalDateISO: '2024-12-31',
      grossProceedsCents: 50_000_000n,
      sellingCostsCents: 1_000_000n, // $10,000 agent + legal
      costBase: BASE_COST_BASE,
      div43ClaimedCents: 0n,
      wasIncomeProducing: true,
      priorYearCapitalLossesCents: 0n,
      owners: SINGLE_INDIVIDUAL,
      isPreCgtAsset: false,
    },
    ruleset,
  );

  it('net proceeds reduced by selling costs', () => {
    expect(withSellingCosts.netProceedsCents).toBe(noSellingCosts.netProceedsCents - 1_000_000n);
  });
  it('taxable gain reduced by selling costs', () => {
    expect(withSellingCosts.owners[0]!.ownerTaxableGainCents).toBe(
      noSellingCosts.owners[0]!.ownerTaxableGainCents - 1_000_000n,
    );
  });
});

// ── CG-09: Joint ownership 50/50 — gain halved ───────────────────────────────

describe('CG-09: joint ownership 50/50 — gain split per ownership', () => {
  const result = computeCGT(
    {
      acquisitionDateISO: '2024-07-01',
      disposalDateISO: '2024-12-31',
      grossProceedsCents: 50_000_000n,
      sellingCostsCents: 1_000_000n,
      costBase: BASE_COST_BASE,
      div43ClaimedCents: 0n,
      wasIncomeProducing: true,
      priorYearCapitalLossesCents: 0n,
      owners: [
        { entityType: 'individual', shareBps: 5_000 }, // 50%
        { entityType: 'individual', shareBps: 5_000 }, // 50%
      ],
      isPreCgtAsset: false,
    },
    ruleset,
  );

  const totalGross = result.grossGainCents;
  const ownerA = result.owners[0]!;
  const ownerB = result.owners[1]!;

  it('two owners in result', () => expect(result.owners).toHaveLength(2));
  it("each owner's gross = ~half total", () => {
    expect(ownerA.ownerGrossGainCents + ownerB.ownerGrossGainCents).toBe(totalGross);
  });
  it('owner A and B gains are equal', () => {
    expect(ownerA.ownerGrossGainCents).toBe(ownerB.ownerGrossGainCents);
  });
  it('individual taxable (no discount, short hold) = gross share', () => {
    expect(ownerA.ownerTaxableGainCents).toBe(ownerA.ownerGrossGainCents);
  });
});

// ── CG-10: Different marginal rates — per-owner tax differs from blended ─────
// Demonstrates that splitting gain and taxing separately ≠ applying a single rate.

describe('CG-10: joint owners with different marginal rates — tax differs from blended', () => {
  const result = computeCGT(
    {
      acquisitionDateISO: '2023-01-01',
      disposalDateISO: '2024-01-02', // 366 days → discount eligible
      grossProceedsCents: 70_000_000n, // $700,000
      sellingCostsCents: 1_400_000n, // $14,000
      costBase: {
        element1AcquisitionCents: 50_000_000n,
        element2IncidentalCents: 2_000_000n,
        element3OwnershipCents: 0n,
        element4ImprovementCents: 0n,
        element5TitleCents: 0n,
      },
      div43ClaimedCents: 0n,
      wasIncomeProducing: true,
      priorYearCapitalLossesCents: 0n,
      owners: [
        { entityType: 'individual', shareBps: 5_000 }, // owner A: 50%
        { entityType: 'individual', shareBps: 5_000 }, // owner B: 50%
      ],
      isPreCgtAsset: false,
    },
    ruleset,
  );

  // After 50% discount each owner's taxable gain is half of half of total gain
  const ownerA = result.owners[0]!;
  const ownerB = result.owners[1]!;
  const totalTaxableGain = ownerA.ownerTaxableGainCents + ownerB.ownerTaxableGainCents;

  // Owner A has high other income ($180,000 salary → in 45% bracket for this gain)
  // Owner B has low other income ($40,000 salary → in 30% bracket for this gain)
  const otherIncomeA = 18_000_000n; // $180,000
  const otherIncomeB = 4_000_000n; // $40,000

  const taxA =
    applyMarginalRates(otherIncomeA + ownerA.ownerTaxableGainCents, ruleset.brackets) -
    applyMarginalRates(otherIncomeA, ruleset.brackets);

  const taxB =
    applyMarginalRates(otherIncomeB + ownerB.ownerTaxableGainCents, ruleset.brackets) -
    applyMarginalRates(otherIncomeB, ruleset.brackets);

  // Average blended rate applied to full total gain
  const blendedTax = applyMarginalRates(totalTaxableGain, ruleset.brackets);

  it('CGT gives each owner their gain share', () => {
    expect(ownerA.ownerGrossGainCents).toBe(ownerB.ownerGrossGainCents);
  });
  it('per-owner total tax differs from blended-rate tax', () => {
    expect(taxA + taxB).not.toBe(blendedTax);
  });
  it('high-income owner pays more marginal tax on gain', () => {
    expect(taxA).toBeGreaterThan(taxB);
  });
});

// ── CG-11: Pre-CGT asset — exempt ────────────────────────────────────────────

describe('CG-11: pre-1985 acquisition (isPreCgtAsset=true) — CGT exempt', () => {
  const result = computeCGT(
    {
      acquisitionDateISO: '1984-01-01', // before 20 Sep 1985 grandfathering date
      disposalDateISO: '2024-12-31',
      grossProceedsCents: 100_000_000n,
      sellingCostsCents: 2_000_000n,
      costBase: BASE_COST_BASE,
      div43ClaimedCents: 0n,
      wasIncomeProducing: false,
      priorYearCapitalLossesCents: 0n,
      owners: SINGLE_INDIVIDUAL,
      isPreCgtAsset: true, // grandfathered
    },
    ruleset,
  );

  it('isPreCgtAsset = true', () => expect(result.isPreCgtAsset).toBe(true));
  it('grossGainCents = 0 (exempt)', () => expect(result.grossGainCents).toBe(0n));
  it('isCapitalLoss = false', () => expect(result.isCapitalLoss).toBe(false));
  it('taxableGain = 0 for all owners', () => {
    for (const o of result.owners) {
      expect(o.ownerTaxableGainCents).toBe(0n);
    }
  });
  it('carryForwardLoss = 0 (not a loss event)', () => {
    expect(result.owners[0]!.ownerCarryForwardLossCents).toBe(0n);
  });
});

// ── CG-12: Capital loss — carry-forward, NOT against ordinary income ──────────
// s104-10 ITAA 1997: capital losses may only be applied against capital gains.

describe('CG-12: disposal at a loss — carry-forward, not against ordinary income', () => {
  const result = computeCGT(
    {
      acquisitionDateISO: '2023-01-01',
      disposalDateISO: '2024-01-02',
      grossProceedsCents: 38_000_000n, // $380,000 — below cost base
      sellingCostsCents: 760_000n, // $7,600
      costBase: BASE_COST_BASE,
      div43ClaimedCents: 0n,
      wasIncomeProducing: true,
      priorYearCapitalLossesCents: 0n,
      owners: SINGLE_INDIVIDUAL,
      isPreCgtAsset: false,
    },
    ruleset,
  );
  // net proceeds = 38,000,000 - 760,000 = 37,240,000
  // cost base = 42,000,000 (e1+e2, e3 excluded)
  // gross gain = 37,240,000 - 42,000,000 = -4,760,000 (loss)

  it('isCapitalLoss = true', () => expect(result.isCapitalLoss).toBe(true));
  it('grossGainCents is negative', () => expect(result.grossGainCents).toBeLessThan(0n));
  it('taxableGain = 0 (loss not applied to ordinary income)', () => {
    expect(result.owners[0]!.ownerTaxableGainCents).toBe(0n);
  });
  it('carryForwardLoss = |loss| (4,760,000 cents)', () => {
    expect(result.owners[0]!.ownerCarryForwardLossCents).toBe(4_760_000n);
  });
});

// ── CG-12 extended: Loss-then-discount ordering ───────────────────────────────
// Source: cgt-golden-03-loss-then-discount-derivation.md
// Acquisition: 2022-01-01, Disposal: 2023-01-02 (366 days)
// Cost base: $520,000. Net proceeds: $735,000. Gross gain: $215,000.
// Prior losses: $30,000. Owner: individual.
// ATO ordering: $215,000 − $30,000 = $185,000 → 50% discount → $92,500 taxable.
// Wrong ordering: discount first → $107,500 → less losses → $77,500 (understates tax).

describe('CG-12 golden: prior-year loss applied BEFORE discount (ATO ordering)', () => {
  const result = computeCGT(
    {
      acquisitionDateISO: '2022-01-01',
      disposalDateISO: '2023-01-02',
      grossProceedsCents: 75_000_000n, // $750,000
      sellingCostsCents: 1_500_000n, // $15,000
      costBase: {
        element1AcquisitionCents: 50_000_000n, // $500,000
        element2IncidentalCents: 2_000_000n, // $20,000
        element3OwnershipCents: 0n,
        element4ImprovementCents: 0n,
        element5TitleCents: 0n,
      },
      div43ClaimedCents: 0n,
      wasIncomeProducing: true,
      priorYearCapitalLossesCents: 3_000_000n, // $30,000
      owners: SINGLE_INDIVIDUAL,
      isPreCgtAsset: false,
    },
    ruleset,
  );

  // gross gain = 75,000,000 - 1,500,000 - 52,000,000 = 21,500,000 = $215,000
  // after losses: 21,500,000 - 3,000,000 = 18,500,000 = $185,000
  // 50% discount: 18,500,000 × 5000 / 10000 = 9,250,000 = $92,500
  // taxable: 9,250,000

  const owner = result.owners[0]!;
  it('daysHeld = 366', () => expect(result.daysHeld).toBe(366));
  it('discountEligible = true', () => expect(result.discountEligible).toBe(true));
  it('gross gain = 21,500,000 ($215,000)', () => expect(result.grossGainCents).toBe(21_500_000n));
  it('losses applied = 3,000,000 ($30,000)', () => {
    expect(owner.ownerLossesAppliedCents).toBe(3_000_000n);
  });
  it('gain after losses = 18,500,000 ($185,000)', () => {
    expect(owner.ownerGainAfterLossesCents).toBe(18_500_000n);
  });
  it('discount applied = 9,250,000 (50% of $185,000)', () => {
    expect(owner.ownerDiscountAppliedCents).toBe(9_250_000n);
  });
  it('taxable gain = 9,250,000 ($92,500) — correct ATO ordering', () => {
    expect(owner.ownerTaxableGainCents).toBe(9_250_000n);
  });
  it('taxable ≠ 7,750,000 (wrong: discount-then-loss would give $77,500)', () => {
    expect(owner.ownerTaxableGainCents).not.toBe(7_750_000n);
  });
  it('carry-forward = 0 (losses fully absorbed)', () => {
    expect(owner.ownerCarryForwardLossCents).toBe(0n);
  });
});

// ── Trust entity — same discount rate as individual (5000 bps) ───────────────

describe('trust entity: same CGT discount rate as individual', () => {
  const result = computeCGT(
    {
      acquisitionDateISO: '2023-01-01',
      disposalDateISO: '2024-01-02',
      grossProceedsCents: 50_000_000n,
      sellingCostsCents: 1_000_000n,
      costBase: BASE_COST_BASE,
      div43ClaimedCents: 0n,
      wasIncomeProducing: true,
      priorYearCapitalLossesCents: 0n,
      owners: [{ entityType: 'trust', shareBps: 10_000 }],
      isPreCgtAsset: false,
    },
    ruleset,
  );
  const individual = computeCGT(
    {
      acquisitionDateISO: '2023-01-01',
      disposalDateISO: '2024-01-02',
      grossProceedsCents: 50_000_000n,
      sellingCostsCents: 1_000_000n,
      costBase: BASE_COST_BASE,
      div43ClaimedCents: 0n,
      wasIncomeProducing: true,
      priorYearCapitalLossesCents: 0n,
      owners: SINGLE_INDIVIDUAL,
      isPreCgtAsset: false,
    },
    ruleset,
  );

  it('trust discount = individual discount (same rate per ruleset)', () => {
    expect(result.owners[0]!.ownerDiscountAppliedCents).toBe(
      individual.owners[0]!.ownerDiscountAppliedCents,
    );
  });
  it('trust taxable = individual taxable', () => {
    expect(result.owners[0]!.ownerTaxableGainCents).toBe(
      individual.owners[0]!.ownerTaxableGainCents,
    );
  });
});

// ── Div43 > cost base: clamped to 0 (cost base cannot go negative) ───────────

describe('div43ClaimedCents > cost base: cost base clamped to 0', () => {
  const result = computeCGT(
    {
      acquisitionDateISO: '2024-07-01',
      disposalDateISO: '2024-12-31',
      grossProceedsCents: 50_000_000n,
      sellingCostsCents: 0n,
      costBase: {
        element1AcquisitionCents: 1_000_000n,
        element2IncidentalCents: 0n,
        element3OwnershipCents: 0n,
        element4ImprovementCents: 0n,
        element5TitleCents: 0n,
      },
      div43ClaimedCents: 5_000_000n, // exceeds cost base
      wasIncomeProducing: true,
      priorYearCapitalLossesCents: 0n,
      owners: SINGLE_INDIVIDUAL,
      isPreCgtAsset: false,
    },
    ruleset,
  );

  it('cost base clamped to 0 when div43 exceeds elements', () => {
    expect(result.totalCostBaseCents).toBe(0n);
  });
  it('gross gain = full net proceeds when cost base = 0', () => {
    expect(result.grossGainCents).toBe(result.netProceedsCents);
  });
});

// ── Capital loss with pre-existing prior losses ───────────────────────────────

describe('capital loss + prior-year losses both carry forward', () => {
  const result = computeCGT(
    {
      acquisitionDateISO: '2024-07-01',
      disposalDateISO: '2024-12-31',
      grossProceedsCents: 35_000_000n,
      sellingCostsCents: 0n,
      costBase: BASE_COST_BASE,
      div43ClaimedCents: 0n,
      wasIncomeProducing: true,
      priorYearCapitalLossesCents: 1_000_000n, // $10,000 prior losses
      owners: SINGLE_INDIVIDUAL,
      isPreCgtAsset: false,
    },
    ruleset,
  );
  // cost base = 42,000,000; proceeds = 35,000,000 → loss = 7,000,000
  // carry forward = 7,000,000 (disposal loss) + 1,000,000 (prior) = 8,000,000

  it('isCapitalLoss = true', () => expect(result.isCapitalLoss).toBe(true));
  it('carryForwardLoss includes both disposal loss and prior losses', () => {
    expect(result.owners[0]!.ownerCarryForwardLossCents).toBe(8_000_000n);
  });
});

// ── Prior losses exceed gain: excess carries forward ─────────────────────────
// Tests the branch at engine.ts lines 101-104 where losses > ownerGrossGain.

describe('prior-year losses exceed gain — excess carries forward', () => {
  const result = computeCGT(
    {
      acquisitionDateISO: '2024-07-01',
      disposalDateISO: '2024-12-31',
      grossProceedsCents: 44_000_000n, // $440,000
      sellingCostsCents: 0n,
      costBase: BASE_COST_BASE, // cost base = 42,000,000
      div43ClaimedCents: 0n,
      wasIncomeProducing: true,
      // Prior losses $50,000 > gain $20,000 — losses exceed the gain
      priorYearCapitalLossesCents: 5_000_000n,
      owners: SINGLE_INDIVIDUAL,
      isPreCgtAsset: false,
    },
    ruleset,
  );
  // gross gain = 44,000,000 - 0 - 42,000,000 = 2,000,000 cents = $20,000
  // prior losses = 5,000,000. losses (5M) > gain (2M)
  // lossesApplied = 2,000,000 (capped at gain)
  // gainAfterLosses = 0
  // carryForwardLoss = 5,000,000 - 2,000,000 = 3,000,000 ($30,000)

  const owner = result.owners[0]!;
  it('isCapitalLoss = false (disposal itself is a gain)', () => {
    expect(result.isCapitalLoss).toBe(false);
  });
  it('losses applied = full gross gain (capped)', () => {
    expect(owner.ownerLossesAppliedCents).toBe(2_000_000n);
  });
  it('gain after losses = 0', () => {
    expect(owner.ownerGainAfterLossesCents).toBe(0n);
  });
  it('taxable gain = 0', () => {
    expect(owner.ownerTaxableGainCents).toBe(0n);
  });
  it('carry-forward = excess losses ($30,000 = 3,000,000 cents)', () => {
    expect(owner.ownerCarryForwardLossCents).toBe(3_000_000n);
  });
});

// ── Element-3 exclusion for income-producing properties ───────────────────────
// Validates the "classic CGT trap": element3 must be excluded when income-producing.

describe('element-3 (ownership costs) excluded when wasIncomeProducing=true', () => {
  const incomeProducing = computeCGT(
    {
      acquisitionDateISO: '2024-07-01',
      disposalDateISO: '2024-12-31',
      grossProceedsCents: 50_000_000n,
      sellingCostsCents: 1_000_000n,
      costBase: BASE_COST_BASE, // element3 = 1,500,000
      div43ClaimedCents: 0n,
      wasIncomeProducing: true, // element3 excluded
      priorYearCapitalLossesCents: 0n,
      owners: SINGLE_INDIVIDUAL,
      isPreCgtAsset: false,
    },
    ruleset,
  );
  const nonIncomeProducing = computeCGT(
    {
      acquisitionDateISO: '2024-07-01',
      disposalDateISO: '2024-12-31',
      grossProceedsCents: 50_000_000n,
      sellingCostsCents: 1_000_000n,
      costBase: BASE_COST_BASE, // element3 = 1,500,000
      div43ClaimedCents: 0n,
      wasIncomeProducing: false, // element3 included
      priorYearCapitalLossesCents: 0n,
      owners: SINGLE_INDIVIDUAL,
      isPreCgtAsset: false,
    },
    ruleset,
  );

  it('income-producing: cost base excludes element3', () => {
    expect(incomeProducing.totalCostBaseCents).toBe(
      nonIncomeProducing.totalCostBaseCents - 1_500_000n,
    );
  });
  it('income-producing: taxable gain HIGHER (lower cost base)', () => {
    expect(incomeProducing.owners[0]!.ownerTaxableGainCents).toBeGreaterThan(
      nonIncomeProducing.owners[0]!.ownerTaxableGainCents,
    );
  });
});
