/**
 * RulesetAdapter tests — D05-T1
 *
 * Covers:
 *   - resolveByFY: happy path, missing FY, no published ruleset
 *   - Validation: malformed rulesets throw at construction (fail-fast)
 *   - Bracket processing: previousThresholdCents derived correctly
 *   - Medicare levy: thresholds converted to BigInt
 *   - Land tax brackets: all fields converted to BigInt
 *   - defaultRulesetAdapter: FY2026 resolves cleanly
 *   - No-hardcoded-brackets: numeric rate constants absent from engine/src/*.ts
 *     (grep proof is in checkpoints/D05-T1.txt; tested here via FY2026 fixture)
 *
 * Fails-closed guarantee: assertValidRawRuleset() in adapter.ts uses
 * TypeScript's `asserts r is T` form — this is a RUNTIME assertion function
 * whose throw statements execute in JavaScript, not a compile-time cast.
 * The `as Record<string, unknown>` inside the function is a TypeScript
 * narrowing only; every field check that follows is a typeof/Array.isArray
 * runtime test. RS-07 and RS-13 prove this by bypassing TypeScript's type
 * system via `as unknown as RawRuleset` and `JSON.parse` casts and still
 * observing throws.
 *
 * DEV: fy2026.schema.json documents the expected structure but is not wired
 * for runtime JSON Schema validation (no ajv). Runtime validation is
 * authoritative; the schema.json file may drift and should not be treated
 * as a source of truth. Logged in checkpoints/D05-T1.txt.
 */

import { describe, it, expect } from 'vitest';

import { RulesetAdapter, defaultRulesetAdapter } from '../../../src/tax/ruleset/index.js';
import type { RawRuleset } from '../../../src/tax/ruleset/index.js';

// ---------------------------------------------------------------------------
// Minimal valid raw ruleset fixture for unit tests
// ---------------------------------------------------------------------------

function makeMinimalRuleset(overrides: Partial<RawRuleset> = {}): RawRuleset {
  return {
    $schema: 'https://schemas.equitylens.au/ruleset/v3',
    version: 'TEST.1',
    status: 'published',
    jurisdiction: 'AUS',
    financialYear: 'FY2026',
    effectiveFrom: '2025-07-01',
    effectiveTo: '2026-06-30',
    marginalRates: {
      residency: 'resident',
      brackets: [
        { thresholdCents: '1820000', rateBps: 0 },
        { thresholdCents: '9007199254740992', rateBps: 1900 },
      ],
    },
    medicareLevy: {
      rateBps: 200,
      singleThresholdCents: '2716800',
      familyThresholdCents: '4584000',
      surchargeBrackets: [],
    },
    negativeGearingRules: {
      enabled: true,
      propertyTypeExclusions: [],
      quarantineCarryForward: true,
    },
    cgt: {
      individualDiscountBps: 5000,
      smsfDiscountBps: 3333,
      minimumHoldingDays: 366,
    },
    depreciation: {
      div40: {
        defaultMethod: 'diminishing_value',
        secondHandResidentialDisallowed: true,
        secondHandRuleAcquisitionFromDate: '2017-05-09',
      },
      div43: {
        defaultLifeYears: 40,
        defaultRateBps: 250,
        qualifyingConstructionFromDate: '1987-09-15',
      },
    },
    ...overrides,
  } as RawRuleset;
}

// ---------------------------------------------------------------------------
// RS-01 — resolveByFY happy path returns a Ruleset with correct bracket count
// ---------------------------------------------------------------------------

describe('RS-01 — resolveByFY returns processed ruleset for published FY', () => {
  const adapter = new RulesetAdapter([makeMinimalRuleset()]);

  it('resolves FY2026 published ruleset', () => {
    const ruleset = adapter.resolveByFY('FY2026', { status: 'published' });
    expect(ruleset.financialYear).toBe('FY2026');
    expect(ruleset.version).toBe('TEST.1');
    expect(ruleset.status).toBe('published');
  });

  it('brackets array has same length as raw input', () => {
    const ruleset = adapter.resolveByFY('FY2026', { status: 'published' });
    expect(ruleset.brackets).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// RS-02 — bracket processing derives previousThresholdCents correctly
//
// Raw brackets: [{threshold:"1820000", rate:0}, {threshold:"9999...", rate:1900}]
// Processed:
//   [0]: previousThreshold=0n, threshold=1820000n, rate=0
//   [1]: previousThreshold=1820000n, threshold=big, rate=1900
// ---------------------------------------------------------------------------

describe('RS-02 — bracket previousThresholdCents derived from sequence', () => {
  const adapter = new RulesetAdapter([makeMinimalRuleset()]);
  const ruleset = adapter.resolveByFY('FY2026', { status: 'published' });

  it('first bracket has previousThresholdCents = 0n', () => {
    expect(ruleset.brackets[0]?.previousThresholdCents).toBe(0n);
  });

  it('first bracket threshold = 1820000n', () => {
    expect(ruleset.brackets[0]?.thresholdCents).toBe(1_820_000n);
  });

  it('second bracket previousThreshold equals first bracket threshold', () => {
    expect(ruleset.brackets[1]?.previousThresholdCents).toBe(1_820_000n);
  });

  it('all thresholds are bigints', () => {
    for (const b of ruleset.brackets) {
      expect(typeof b.previousThresholdCents).toBe('bigint');
      expect(typeof b.thresholdCents).toBe('bigint');
    }
  });
});

// ---------------------------------------------------------------------------
// RS-03 — Medicare levy fields converted to BigInt
// ---------------------------------------------------------------------------

describe('RS-03 — medicareLevy thresholds are BigInt', () => {
  const adapter = new RulesetAdapter([makeMinimalRuleset()]);
  const ruleset = adapter.resolveByFY('FY2026', { status: 'published' });

  it('singleThresholdCents = 2716800n', () => {
    expect(ruleset.medicareLevy.singleThresholdCents).toBe(2_716_800n);
  });

  it('familyThresholdCents = 4584000n', () => {
    expect(ruleset.medicareLevy.familyThresholdCents).toBe(4_584_000n);
  });

  it('rateBps is a number', () => {
    expect(typeof ruleset.medicareLevy.rateBps).toBe('number');
    expect(ruleset.medicareLevy.rateBps).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// RS-04 — resolveByFY throws RangeError for unknown FY
// ---------------------------------------------------------------------------

describe('RS-04 — resolveByFY throws on unknown financialYear', () => {
  const adapter = new RulesetAdapter([makeMinimalRuleset()]);

  it('throws RangeError for FY2099', () => {
    expect(() => adapter.resolveByFY('FY2099', { status: 'published' })).toThrow(RangeError);
  });

  it('error message mentions the FY', () => {
    expect(() => adapter.resolveByFY('FY2099', { status: 'published' })).toThrow('FY2099');
  });
});

// ---------------------------------------------------------------------------
// RS-05 — resolveByFY throws when no published ruleset exists for a FY
// ---------------------------------------------------------------------------

describe('RS-05 — resolveByFY throws when FY exists but has no published ruleset', () => {
  const draftRuleset = makeMinimalRuleset({ status: 'draft' } as Partial<RawRuleset>);
  const adapter = new RulesetAdapter([draftRuleset]);

  it('throws RangeError for draft-only FY', () => {
    expect(() => adapter.resolveByFY('FY2026', { status: 'published' })).toThrow(RangeError);
  });

  it('error message mentions "published"', () => {
    expect(() => adapter.resolveByFY('FY2026', { status: 'published' })).toThrow('published');
  });
});

// ---------------------------------------------------------------------------
// RS-06 — multiple rulesets for same FY: last published wins
// ---------------------------------------------------------------------------

describe('RS-06 — last published ruleset wins when multiple registered for same FY', () => {
  const v1 = makeMinimalRuleset({ version: 'TEST.1' } as Partial<RawRuleset>);
  const v2 = makeMinimalRuleset({ version: 'TEST.2' } as Partial<RawRuleset>);
  const adapter = new RulesetAdapter([v1, v2]);

  it('resolves to the last registered published version', () => {
    const ruleset = adapter.resolveByFY('FY2026', { status: 'published' });
    expect(ruleset.version).toBe('TEST.2');
  });
});

// ---------------------------------------------------------------------------
// RS-07 — constructor throws on malformed rulesets (fail-fast)
// ---------------------------------------------------------------------------

describe('RS-07 — constructor validates all rulesets on construction', () => {
  it('throws TypeError when ruleset is null', () => {
    expect(() => new RulesetAdapter([null as unknown as RawRuleset])).toThrow(TypeError);
  });

  it('throws TypeError for missing financialYear', () => {
    const bad = { ...makeMinimalRuleset(), financialYear: '' };
    expect(() => new RulesetAdapter([bad as unknown as RawRuleset])).toThrow(TypeError);
  });

  it('throws TypeError for invalid FY pattern (not FY + 4 digits)', () => {
    const bad = { ...makeMinimalRuleset(), financialYear: 'FY26' };
    expect(() => new RulesetAdapter([bad as unknown as RawRuleset])).toThrow(TypeError);
  });

  it('throws TypeError when brackets array has fewer than 2 entries', () => {
    const bad = {
      ...makeMinimalRuleset(),
      marginalRates: {
        residency: 'resident',
        brackets: [{ thresholdCents: '9999999999', rateBps: 0 }],
      },
    };
    expect(() => new RulesetAdapter([bad as unknown as RawRuleset])).toThrow(TypeError);
  });

  it('throws TypeError when bracket thresholdCents is not a decimal string', () => {
    const bad = {
      ...makeMinimalRuleset(),
      marginalRates: {
        residency: 'resident',
        brackets: [
          { thresholdCents: '1820000', rateBps: 0 },
          { thresholdCents: '1.5e8', rateBps: 4500 },
        ],
      },
    };
    expect(() => new RulesetAdapter([bad as unknown as RawRuleset])).toThrow(TypeError);
  });

  it('throws TypeError when bracket rateBps is not an integer', () => {
    const bad = {
      ...makeMinimalRuleset(),
      marginalRates: {
        residency: 'resident',
        brackets: [
          { thresholdCents: '1820000', rateBps: 0 },
          { thresholdCents: '9999999999', rateBps: 45.0001 },
        ],
      },
    };
    expect(() => new RulesetAdapter([bad as unknown as RawRuleset])).toThrow(TypeError);
  });

  it('throws TypeError when medicareLevy is missing', () => {
    const { medicareLevy: _ml, ...rest } = makeMinimalRuleset();
    expect(() => new RulesetAdapter([rest as unknown as RawRuleset])).toThrow(TypeError);
  });

  it('throws TypeError when medicareLevy.rateBps is not a number', () => {
    const bad = {
      ...makeMinimalRuleset(),
      medicareLevy: {
        rateBps: '200',
        singleThresholdCents: '2716800',
        familyThresholdCents: '4584000',
        surchargeBrackets: [],
      },
    };
    expect(() => new RulesetAdapter([bad as unknown as RawRuleset])).toThrow(TypeError);
  });

  it('throws TypeError when bracket thresholdCents is a number (not a decimal string)', () => {
    // JSON with numeric threshold instead of string — common JSON authoring mistake.
    // assertValidRawRuleset must catch this at load, not let it through silently.
    const bad = {
      ...makeMinimalRuleset(),
      marginalRates: {
        residency: 'resident',
        brackets: [
          { thresholdCents: '1820000', rateBps: 0 },
          { thresholdCents: 9007199254740992, rateBps: 4500 },
        ],
      },
    };
    expect(() => new RulesetAdapter([bad as unknown as RawRuleset])).toThrow(TypeError);
  });

  it('throws TypeError when marginalRates is missing entirely', () => {
    const { marginalRates: _mr, ...rest } = makeMinimalRuleset();
    expect(() => new RulesetAdapter([rest as unknown as RawRuleset])).toThrow(TypeError);
  });

  it('throws TypeError when medicareLevy.familyThresholdCents is not a string', () => {
    const bad = {
      ...makeMinimalRuleset(),
      medicareLevy: {
        rateBps: 200,
        singleThresholdCents: '2716800',
        familyThresholdCents: 4584000, // number, not string
        surchargeBrackets: [],
      },
    };
    expect(() => new RulesetAdapter([bad as unknown as RawRuleset])).toThrow(TypeError);
  });

  it('throws TypeError when medicareLevy.surchargeBrackets is not an array', () => {
    const bad = {
      ...makeMinimalRuleset(),
      medicareLevy: {
        rateBps: 200,
        singleThresholdCents: '2716800',
        familyThresholdCents: '4584000',
        surchargeBrackets: null, // not an array
      },
    };
    expect(() => new RulesetAdapter([bad as unknown as RawRuleset])).toThrow(TypeError);
  });
});

// ---------------------------------------------------------------------------
// RS-08 — land tax brackets processed to BigInt
// ---------------------------------------------------------------------------

describe('RS-08 — VIC land tax brackets convert to BigInt', () => {
  const withLandTax = makeMinimalRuleset({
    landTax: {
      vic: {
        individualBrackets: [
          {
            previousThresholdCents: '0',
            thresholdCents: '5000000',
            flatCents: '0',
            marginalBps: 0,
          },
          {
            previousThresholdCents: '5000000',
            thresholdCents: '10000000',
            flatCents: '50000',
            marginalBps: 10,
          },
        ],
        absenteeSurchargeBps: 400,
        vacantSurchargeBps: 200,
      },
    },
  } as Partial<RawRuleset>);
  const adapter = new RulesetAdapter([withLandTax]);
  const ruleset = adapter.resolveByFY('FY2026', { status: 'published' });

  it('individualBrackets are present', () => {
    expect(ruleset.landTax?.vic?.individualBrackets).toHaveLength(2);
  });

  it('bracket thresholds are BigInt', () => {
    const b = ruleset.landTax?.vic?.individualBrackets?.[0];
    expect(typeof b?.previousThresholdCents).toBe('bigint');
    expect(typeof b?.thresholdCents).toBe('bigint');
    expect(typeof b?.flatCents).toBe('bigint');
    expect(b?.previousThresholdCents).toBe(0n);
    expect(b?.thresholdCents).toBe(5_000_000n);
    expect(b?.flatCents).toBe(0n);
  });

  it('second bracket flatCents = 50000n ($500)', () => {
    const b = ruleset.landTax?.vic?.individualBrackets?.[1];
    expect(b?.flatCents).toBe(50_000n);
    expect(b?.marginalBps).toBe(10);
  });

  it('absenteeSurchargeBps preserved', () => {
    expect(ruleset.landTax?.vic?.absenteeSurchargeBps).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// RS-08b — VIC config without optional surcharge fields: properties absent
// Covers the `undefined` paths in processVicLandTax conditional spreads.
// ---------------------------------------------------------------------------

describe('RS-08b — VIC config without optional surcharge fields', () => {
  const withMinimalVic = makeMinimalRuleset({
    landTax: {
      vic: {
        individualBrackets: [
          {
            previousThresholdCents: '0',
            thresholdCents: '5000000',
            flatCents: '0',
            marginalBps: 0,
          },
        ],
        // absenteeSurchargeBps and vacantSurchargeBps intentionally absent
      },
    },
  } as Partial<RawRuleset>);
  const adapter = new RulesetAdapter([withMinimalVic]);
  const ruleset = adapter.resolveByFY('FY2026', { status: 'published' });

  it('absenteeSurchargeBps is absent when not in raw JSON', () => {
    expect(ruleset.landTax?.vic?.absenteeSurchargeBps).toBeUndefined();
  });

  it('vacantSurchargeBps is absent when not in raw JSON', () => {
    expect(ruleset.landTax?.vic?.vacantSurchargeBps).toBeUndefined();
  });

  it('trustBrackets is absent when not in raw JSON', () => {
    expect(ruleset.landTax?.vic?.trustBrackets).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// RS-09 — ruleset without landTax: landTax is undefined
// ---------------------------------------------------------------------------

describe('RS-09 — landTax is optional; absent in ruleset → undefined', () => {
  const adapter = new RulesetAdapter([makeMinimalRuleset()]);
  const ruleset = adapter.resolveByFY('FY2026', { status: 'published' });

  it('landTax is undefined when not in raw JSON', () => {
    expect(ruleset.landTax).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// RS-10 — defaultRulesetAdapter resolves FY2026 from actual fy2026.json
//
// Verifies the published FY2026 ruleset loads cleanly:
//   - 5 income tax brackets (0%, 16%, 30%, 37%, 45%)
//   - MLS has 3 surcharge tiers
//   - version = "FY2026.1"
// ---------------------------------------------------------------------------

describe('RS-10 — defaultRulesetAdapter resolves actual FY2026 ruleset', () => {
  const ruleset = defaultRulesetAdapter.resolveByFY('FY2026', { status: 'published' });

  it('version is FY2026.1', () => {
    expect(ruleset.version).toBe('FY2026.1');
  });

  it('has 5 income tax brackets', () => {
    expect(ruleset.brackets).toHaveLength(5);
  });

  it('first bracket: 0–$18,200 at 0%', () => {
    const b = ruleset.brackets[0];
    expect(b?.previousThresholdCents).toBe(0n);
    expect(b?.thresholdCents).toBe(1_820_000n);
    expect(b?.rateBps).toBe(0);
  });

  it('second bracket: $18,200–$45,000 at 16%', () => {
    const b = ruleset.brackets[1];
    expect(b?.previousThresholdCents).toBe(1_820_000n);
    expect(b?.thresholdCents).toBe(4_500_000n);
    expect(b?.rateBps).toBe(1600);
  });

  it('third bracket: $45,000–$135,000 at 30%', () => {
    const b = ruleset.brackets[2];
    expect(b?.previousThresholdCents).toBe(4_500_000n);
    expect(b?.thresholdCents).toBe(13_500_000n);
    expect(b?.rateBps).toBe(3000);
  });

  it('fourth bracket: $135,000–$190,000 at 37%', () => {
    const b = ruleset.brackets[3];
    expect(b?.previousThresholdCents).toBe(13_500_000n);
    expect(b?.thresholdCents).toBe(19_000_000n);
    expect(b?.rateBps).toBe(3700);
  });

  it('fifth bracket: $190,000+ at 45%', () => {
    const b = ruleset.brackets[4];
    expect(b?.previousThresholdCents).toBe(19_000_000n);
    expect(b?.rateBps).toBe(4500);
  });

  it('Medicare levy rateBps = 200 (2%)', () => {
    expect(ruleset.medicareLevy.rateBps).toBe(200);
  });

  it('Medicare levy single threshold = $27,168 (2716800 cents)', () => {
    expect(ruleset.medicareLevy.singleThresholdCents).toBe(2_716_800n);
  });

  it('MLS has 3 surcharge tiers', () => {
    expect(ruleset.medicareLevy.surchargeBrackets).toHaveLength(3);
  });

  it('MLS first tier: >$93,000 at 1%', () => {
    const tier = ruleset.medicareLevy.surchargeBrackets[0];
    expect(tier?.thresholdCents).toBe(9_300_000n);
    expect(tier?.rateBps).toBe(100);
  });

  it('MLS second tier: >$108,000 at 1.25%', () => {
    const tier = ruleset.medicareLevy.surchargeBrackets[1];
    expect(tier?.thresholdCents).toBe(10_800_000n);
    expect(tier?.rateBps).toBe(125);
  });

  it('MLS third tier: >$144,000 at 1.5%', () => {
    const tier = ruleset.medicareLevy.surchargeBrackets[2];
    expect(tier?.thresholdCents).toBe(14_400_000n);
    expect(tier?.rateBps).toBe(150);
  });

  it('VIC land tax individualBrackets present (7 brackets)', () => {
    expect(ruleset.landTax?.vic?.individualBrackets).toHaveLength(7);
  });

  it('VIC absenteeSurchargeBps = 400', () => {
    expect(ruleset.landTax?.vic?.absenteeSurchargeBps).toBe(400);
  });

  it('CGT individual discount = 50% (5000 bps)', () => {
    expect(ruleset.cgt.individualDiscountBps).toBe(5000);
  });

  it('depreciation div40 defaultMethod = diminishing_value', () => {
    expect(ruleset.depreciation.div40.defaultMethod).toBe('diminishing_value');
  });

  it('negative gearing enabled', () => {
    expect(ruleset.negativeGearingRules.enabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// RS-11 — MLS surcharge brackets are all BigInt thresholds
// ---------------------------------------------------------------------------

describe('RS-11 — MLS surchargeBrackets thresholds are BigInt', () => {
  const withMls = makeMinimalRuleset({
    medicareLevy: {
      rateBps: 200,
      singleThresholdCents: '2716800',
      familyThresholdCents: '4584000',
      surchargeBrackets: [
        { thresholdCents: '9300000', rateBps: 100 },
        { thresholdCents: '10800000', rateBps: 125 },
      ],
    },
  } as Partial<RawRuleset>);
  const adapter = new RulesetAdapter([withMls]);
  const ruleset = adapter.resolveByFY('FY2026', { status: 'published' });

  it('surchargeBrackets[0].thresholdCents is BigInt', () => {
    expect(typeof ruleset.medicareLevy.surchargeBrackets[0]?.thresholdCents).toBe('bigint');
    expect(ruleset.medicareLevy.surchargeBrackets[0]?.thresholdCents).toBe(9_300_000n);
  });

  it('surchargeBrackets[1].thresholdCents is BigInt', () => {
    expect(ruleset.medicareLevy.surchargeBrackets[1]?.thresholdCents).toBe(10_800_000n);
  });
});

// ---------------------------------------------------------------------------
// RS-12 — empty RulesetAdapter registry
// ---------------------------------------------------------------------------

describe('RS-12 — empty adapter throws on any resolveByFY call', () => {
  const adapter = new RulesetAdapter([]);

  it('throws RangeError for any FY', () => {
    expect(() => adapter.resolveByFY('FY2026', { status: 'published' })).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// RS-13 — runtime assertions proven by JSON.parse round-trip
//
// Simulates loading a ruleset from an external JSON string the way a real
// app might (JSON.parse → cast). Proves the constructor's runtime assertions
// are NOT merely TypeScript type casts (which are erased at runtime) — the
// assertValidRawRuleset function fires real typeof/instanceof checks that
// throw even when TypeScript is bypassed via `as unknown as RawRuleset`.
//
// This is the "fails closed" guarantee: malformed JSON must not produce a
// silent partial Ruleset — it must throw at construction.
// ---------------------------------------------------------------------------

describe('RS-13 — runtime assertions fire on JSON.parse-style unknown input', () => {
  const goodJson = JSON.stringify({
    $schema: 'https://schemas.equitylens.au/ruleset/v3',
    version: 'TEST.1',
    status: 'published',
    jurisdiction: 'AUS',
    financialYear: 'FY2026',
    effectiveFrom: '2025-07-01',
    effectiveTo: '2026-06-30',
    marginalRates: {
      residency: 'resident',
      brackets: [
        { thresholdCents: '1820000', rateBps: 0 },
        { thresholdCents: '9007199254740992', rateBps: 4500 },
      ],
    },
    medicareLevy: {
      rateBps: 200,
      singleThresholdCents: '2716800',
      familyThresholdCents: '4584000',
      surchargeBrackets: [],
    },
    negativeGearingRules: {
      enabled: true,
      propertyTypeExclusions: [],
      quarantineCarryForward: true,
    },
    cgt: { individualDiscountBps: 5000, smsfDiscountBps: 3333, minimumHoldingDays: 366 },
    depreciation: {
      div40: {
        defaultMethod: 'diminishing_value',
        secondHandResidentialDisallowed: true,
        secondHandRuleAcquisitionFromDate: '2017-05-09',
      },
      div43: {
        defaultLifeYears: 40,
        defaultRateBps: 250,
        qualifyingConstructionFromDate: '1987-09-15',
      },
    },
  });

  it('valid JSON round-trips to a working Ruleset', () => {
    const parsed = JSON.parse(goodJson) as unknown as RawRuleset;
    const adapter = new RulesetAdapter([parsed]);
    const ruleset = adapter.resolveByFY('FY2026', { status: 'published' });
    expect(ruleset.version).toBe('TEST.1');
    expect(ruleset.brackets).toHaveLength(2);
  });

  it('JSON with numeric thresholdCents throws at construction (not silently accepted)', () => {
    // JSON.parse naturally produces numbers for unquoted values — this is the
    // real-world failure mode the runtime assertions guard against.
    const malformed = JSON.parse(goodJson.replace('"1820000"', '1820000')) as unknown as RawRuleset;
    expect(() => new RulesetAdapter([malformed])).toThrow(TypeError);
  });

  it('JSON with missing brackets array throws at construction', () => {
    const obj = JSON.parse(goodJson) as Record<string, unknown>;
    (obj['marginalRates'] as Record<string, unknown>)['brackets'] = [];
    expect(() => new RulesetAdapter([obj as unknown as RawRuleset])).toThrow(TypeError);
  });

  it('JSON with status "draft" is loaded but resolveByFY("published") throws', () => {
    const obj = JSON.parse(goodJson.replace('"published"', '"draft"')) as unknown as RawRuleset;
    const adapter = new RulesetAdapter([obj]);
    expect(() => adapter.resolveByFY('FY2026', { status: 'published' })).toThrow(RangeError);
  });

  it('JSON with wrong FY format throws at construction', () => {
    const obj = JSON.parse(goodJson.replace('"FY2026"', '"FY26"')) as unknown as RawRuleset;
    expect(() => new RulesetAdapter([obj])).toThrow(TypeError);
  });
});
