import { mulDiv, RoundingMode } from '../money/cents.js';
import type { Cents } from '../money/cents.js';
import type { Ruleset } from '../tax/ruleset/types.js';

import { computeCostBase } from './cost-base.js';
import type { CGTResult, DisposalInput, EntityType, OwnerCGTResult } from './types.js';

/**
 * Convert a YYYY-MM-DD string to a Julian Day Number.
 * Gregorian calendar formula from https://en.wikipedia.org/wiki/Julian_day
 * Pure arithmetic — no Date object (banned in engine src per no-restricted-globals).
 */
function isoToJdn(iso: string): number {
  const y = parseInt(iso.slice(0, 4), 10);
  const m = parseInt(iso.slice(5, 7), 10);
  const d = parseInt(iso.slice(8, 10), 10);
  const a = Math.floor((14 - m) / 12);
  const y2 = y + 4800 - a;
  const m2 = m + 12 * a - 3;
  return (
    d +
    Math.floor((153 * m2 + 2) / 5) +
    365 * y2 +
    Math.floor(y2 / 4) -
    Math.floor(y2 / 100) +
    Math.floor(y2 / 400) -
    32045
  );
}

/** Calendar days between two YYYY-MM-DD strings (Gregorian, exact). */
function daysBetween(acquisitionISO: string, disposalISO: string): number {
  return isoToJdn(disposalISO) - isoToJdn(acquisitionISO);
}

function discountBpsForEntity(entityType: EntityType, cgt: Ruleset['cgt']): number {
  if (entityType === 'individual' || entityType === 'trust') return cgt.individualDiscountBps;
  if (entityType === 'smsf') return cgt.smsfDiscountBps;
  return 0; // company: no CGT discount
}

function zeroOwner(
  entityType: EntityType,
  shareBps: number,
  carryForwardLossCents: Cents,
): OwnerCGTResult {
  return {
    entityType,
    shareBps,
    ownerGrossGainCents: 0n,
    ownerLossesAppliedCents: 0n,
    ownerGainAfterLossesCents: 0n,
    ownerDiscountAppliedCents: 0n,
    ownerTaxableGainCents: 0n,
    ownerCarryForwardLossCents: carryForwardLossCents,
  };
}

/**
 * Compute CGT liability for a disposal event.
 *
 * ATO loss-then-discount ordering (s115-100 ITAA 1997):
 *   gross gain → subtract capital losses → apply discount to the REMAINDER.
 * Reversing the order understates taxable gain.
 *
 * @param input  Disposal parameters (dates, cost base, proceeds, owners).
 * @param ruleset FY ruleset supplying discount rates and minimum holding period.
 */
export function computeCGT(input: DisposalInput, ruleset: Ruleset): CGTResult {
  const netProceedsCents = input.grossProceedsCents - input.sellingCostsCents;
  const totalCostBaseCents = computeCostBase(
    input.costBase,
    input.wasIncomeProducing,
    input.div43ClaimedCents,
  );
  const grossGainCents = netProceedsCents - totalCostBaseCents;

  // Pre-CGT assets (acquired before 20 Sep 1985): exempt, zero taxable gain.
  if (input.isPreCgtAsset) {
    return {
      daysHeld: 0,
      isPreCgtAsset: true,
      totalCostBaseCents,
      netProceedsCents,
      grossGainCents: 0n,
      isCapitalLoss: false,
      discountEligible: false,
      owners: input.owners.map((o) => zeroOwner(o.entityType, o.shareBps, 0n)),
    };
  }

  const isCapitalLoss = grossGainCents < 0n;
  const daysHeld = daysBetween(input.acquisitionDateISO, input.disposalDateISO);
  const discountEligible = daysHeld >= ruleset.cgt.minimumHoldingDays;

  const owners: OwnerCGTResult[] = input.owners.map((owner) => {
    const ownerShare = BigInt(owner.shareBps);

    if (isCapitalLoss) {
      // s104-10: capital loss is NOT deductible against ordinary income.
      // Carry forward: this disposal's loss + any unabsorbed prior losses.
      const disposalLoss = -grossGainCents;
      const ownerDisposalLoss = mulDiv(disposalLoss, ownerShare, 10_000n, RoundingMode.HALF_UP);
      const ownerPriorLoss = mulDiv(
        input.priorYearCapitalLossesCents,
        ownerShare,
        10_000n,
        RoundingMode.HALF_UP,
      );
      return zeroOwner(owner.entityType, owner.shareBps, ownerDisposalLoss + ownerPriorLoss);
    }

    // Gain path — ATO ordering: losses before discount.
    const ownerGrossGain = mulDiv(grossGainCents, ownerShare, 10_000n, RoundingMode.HALF_UP);
    const ownerPriorLosses = mulDiv(
      input.priorYearCapitalLossesCents,
      ownerShare,
      10_000n,
      RoundingMode.HALF_UP,
    );

    const lossesApplied = ownerPriorLosses <= ownerGrossGain ? ownerPriorLosses : ownerGrossGain;
    const gainAfterLosses = ownerGrossGain - lossesApplied;
    const carryForwardLoss =
      ownerPriorLosses > ownerGrossGain ? ownerPriorLosses - ownerGrossGain : 0n;

    const discountBps = discountEligible ? discountBpsForEntity(owner.entityType, ruleset.cgt) : 0;
    const discountAmount =
      discountBps > 0
        ? mulDiv(gainAfterLosses, BigInt(discountBps), 10_000n, RoundingMode.HALF_UP)
        : 0n;
    const taxableGain = gainAfterLosses - discountAmount;

    return {
      entityType: owner.entityType,
      shareBps: owner.shareBps,
      ownerGrossGainCents: ownerGrossGain,
      ownerLossesAppliedCents: lossesApplied,
      ownerGainAfterLossesCents: gainAfterLosses,
      ownerDiscountAppliedCents: discountAmount,
      ownerTaxableGainCents: taxableGain,
      ownerCarryForwardLossCents: carryForwardLoss,
    };
  });

  return {
    daysHeld,
    isPreCgtAsset: false,
    totalCostBaseCents,
    netProceedsCents,
    grossGainCents,
    isCapitalLoss,
    discountEligible,
    owners,
  };
}
