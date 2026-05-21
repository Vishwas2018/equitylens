import type {
  LandTaxBracket,
  ProcessedBracket,
  RawLandTaxBracket,
  RawRuleset,
  Ruleset,
  SurchargeBracket,
  VicLandTaxConfig,
} from './types.js';

/**
 * Loads and validates raw ruleset JSON, pre-processes brackets.
 *
 * resolveByFY throws on: missing FY, no matching status (never silently defaults).
 * Validates required fields on construction; malformed input = throw at load, not at use.
 */
export class RulesetAdapter {
  private readonly registry: Map<string, RawRuleset[]>;

  constructor(rawRulesets: readonly RawRuleset[]) {
    for (const r of rawRulesets) {
      assertValidRawRuleset(r);
    }
    this.registry = new Map();
    for (const r of rawRulesets) {
      const list = this.registry.get(r.financialYear) ?? [];
      list.push(r);
      this.registry.set(r.financialYear, list);
    }
  }

  resolveByFY(fy: string, options: { status: 'published' }): Ruleset {
    const candidates = this.registry.get(fy);
    if (candidates === undefined || candidates.length === 0) {
      throw new RangeError(`RulesetAdapter: no ruleset found for financial year "${fy}"`);
    }
    const matched = candidates.filter((r) => r.status === options.status);
    if (matched.length === 0) {
      throw new RangeError(
        `RulesetAdapter: no ${options.status} ruleset found for financial year "${fy}"`,
      );
    }
    // Use the last entry when multiple published versions exist (latest wins).
    const raw = matched[matched.length - 1];
    // c8 ignore next — last element always exists when matched.length > 0
    if (raw === undefined) throw new RangeError('RulesetAdapter: unexpected empty match array');
    return processRuleset(raw);
  }
}

// ── Validation ───────────────────────────────────────────────────────────────

function assertValidRawRuleset(r: unknown): asserts r is RawRuleset {
  if (r === null || typeof r !== 'object') {
    throw new TypeError('RulesetAdapter: ruleset must be an object');
  }
  const obj = r as Record<string, unknown>;

  const requireString = (field: string): void => {
    if (typeof obj[field] !== 'string' || (obj[field] as string).length === 0) {
      throw new TypeError(`RulesetAdapter: field "${field}" must be a non-empty string`);
    }
  };

  requireString('financialYear');
  requireString('version');
  requireString('status');
  requireString('jurisdiction');
  requireString('effectiveFrom');
  requireString('effectiveTo');

  if (!/^FY\d{4}$/.test(obj['financialYear'] as string)) {
    throw new TypeError(
      `RulesetAdapter: financialYear must match /^FY\\d{4}$/, got "${obj['financialYear']}"`,
    );
  }

  const marginalRates = obj['marginalRates'];
  if (marginalRates === null || typeof marginalRates !== 'object') {
    throw new TypeError('RulesetAdapter: marginalRates must be an object');
  }
  const brackets = (marginalRates as Record<string, unknown>)['brackets'];
  if (!Array.isArray(brackets) || brackets.length < 2) {
    throw new TypeError('RulesetAdapter: marginalRates.brackets must have at least 2 entries');
  }
  for (const b of brackets as unknown[]) {
    assertRawBracket(b);
  }

  const medicareLevy = obj['medicareLevy'];
  if (medicareLevy === null || typeof medicareLevy !== 'object') {
    throw new TypeError('RulesetAdapter: medicareLevy must be an object');
  }
  const ml = medicareLevy as Record<string, unknown>;
  if (typeof ml['rateBps'] !== 'number') {
    throw new TypeError('RulesetAdapter: medicareLevy.rateBps must be a number');
  }
  if (typeof ml['singleThresholdCents'] !== 'string') {
    throw new TypeError('RulesetAdapter: medicareLevy.singleThresholdCents must be a string');
  }
  if (typeof ml['familyThresholdCents'] !== 'string') {
    throw new TypeError('RulesetAdapter: medicareLevy.familyThresholdCents must be a string');
  }
  if (!Array.isArray(ml['surchargeBrackets'])) {
    throw new TypeError('RulesetAdapter: medicareLevy.surchargeBrackets must be an array');
  }
}

function assertRawBracket(b: unknown): void {
  if (b === null || typeof b !== 'object') throw new TypeError('bracket must be an object');
  const obj = b as Record<string, unknown>;
  if (typeof obj['thresholdCents'] !== 'string' || !/^\d+$/.test(obj['thresholdCents'] as string)) {
    throw new TypeError(`RulesetAdapter: bracket.thresholdCents must be a decimal string`);
  }
  if (typeof obj['rateBps'] !== 'number' || !Number.isInteger(obj['rateBps'] as number)) {
    throw new TypeError(`RulesetAdapter: bracket.rateBps must be an integer`);
  }
}

// ── Processing ────────────────────────────────────────────────────────────────

function processRuleset(raw: RawRuleset): Ruleset {
  const base = {
    version: raw.version,
    financialYear: raw.financialYear,
    status: raw.status as Ruleset['status'],
    jurisdiction: raw.jurisdiction,
    effectiveFrom: raw.effectiveFrom,
    effectiveTo: raw.effectiveTo,
    brackets: processBrackets(raw.marginalRates.brackets),
    medicareLevy: {
      rateBps: raw.medicareLevy.rateBps,
      singleThresholdCents: BigInt(raw.medicareLevy.singleThresholdCents),
      familyThresholdCents: BigInt(raw.medicareLevy.familyThresholdCents),
      surchargeBrackets: raw.medicareLevy.surchargeBrackets.map(
        (b): SurchargeBracket => ({
          thresholdCents: BigInt(b.thresholdCents),
          rateBps: b.rateBps,
        }),
      ),
    },
    negativeGearingRules: raw.negativeGearingRules,
    cgt: raw.cgt,
    depreciation: {
      div40: {
        defaultMethod: raw.depreciation.div40.defaultMethod as 'prime_cost' | 'diminishing_value',
        secondHandResidentialDisallowed: raw.depreciation.div40.secondHandResidentialDisallowed,
        secondHandRuleAcquisitionFromDate: raw.depreciation.div40.secondHandRuleAcquisitionFromDate,
      },
      div43: raw.depreciation.div43,
    },
  };
  if (raw.landTax === undefined) return base;
  const vicRaw = raw.landTax.vic;
  return {
    ...base,
    landTax: {
      ...(vicRaw !== undefined && { vic: processVicLandTax(vicRaw) }),
    },
  };
}

function processBrackets(
  raw: readonly { thresholdCents: string; rateBps: number }[],
): ProcessedBracket[] {
  const result: ProcessedBracket[] = [];
  let prev = 0n;
  for (const b of raw) {
    const threshold = BigInt(b.thresholdCents);
    result.push({ previousThresholdCents: prev, thresholdCents: threshold, rateBps: b.rateBps });
    prev = threshold;
  }
  return result;
}

function processVicLandTax(
  raw: NonNullable<NonNullable<RawRuleset['landTax']>['vic']>,
): VicLandTaxConfig {
  return {
    ...(raw.individualBrackets !== undefined && {
      individualBrackets: raw.individualBrackets.map(processLandTaxBracket),
    }),
    ...(raw.trustBrackets !== undefined && {
      trustBrackets: raw.trustBrackets.map(processLandTaxBracket),
    }),
    ...(raw.absenteeSurchargeBps !== undefined && {
      absenteeSurchargeBps: raw.absenteeSurchargeBps,
    }),
    ...(raw.vacantSurchargeBps !== undefined && {
      vacantSurchargeBps: raw.vacantSurchargeBps,
    }),
  };
}

function processLandTaxBracket(b: RawLandTaxBracket): LandTaxBracket {
  return {
    previousThresholdCents: BigInt(b.previousThresholdCents),
    thresholdCents: BigInt(b.thresholdCents),
    flatCents: BigInt(b.flatCents),
    marginalBps: b.marginalBps,
  };
}
