/**
 * RB-01..RB-05 — Ruleset binding proof.
 *
 * Proves that runScenario stamps ruleset_version into output_hash, so two
 * rulesets with different version strings produce different hashes even when
 * the computation result is byte-for-byte identical. This is the mechanism
 * that prevents a stale cached output from being re-used after a ruleset update.
 */

import { describe, expect, it } from 'vitest';

import { runScenario, FixedClock } from '../../src/index.js';
import fy2026Variant from '../../src/tax/ruleset/data/fy2026-variant.json' assert { type: 'json' };
import { defaultRulesetAdapter } from '../../src/tax/ruleset/index.js';
import { RulesetAdapter } from '../../src/tax/ruleset/index.js';
import type { RawRuleset } from '../../src/tax/ruleset/types.js';
import { applyMarginalRates } from '../../src/tax/service.js';

const clock = new FixedClock(0);
const baseInputs = { scenarioId: 'rb-test', asOfMs: 0, horizonYears: 1 };

describe('RB-01: different ruleset version strings → different output_hash', () => {
  it('same computation, FY2026.1 vs FY2026.2 → hashes differ', () => {
    const result = { taxCents: 2_078_800n };
    const r1 = runScenario(baseInputs, 'FY2026.1', () => result, clock);
    const r2 = runScenario(baseInputs, 'FY2026.2', () => result, clock);

    expect(r1.output_hash).not.toBe(r2.output_hash);
    expect(r1.ruleset_version).toBe('FY2026.1');
    expect(r2.ruleset_version).toBe('FY2026.2');
  });
});

describe('RB-02: same ruleset version → same output_hash (determinism)', () => {
  it('two calls with identical inputs and version → identical hash', () => {
    const result = { taxCents: 578_800n };
    const r1 = runScenario(baseInputs, 'FY2026.1', () => result, clock);
    const r2 = runScenario(baseInputs, 'FY2026.1', () => result, clock);

    expect(r1.output_hash).toBe(r2.output_hash);
  });
});

describe('RB-03: fy2026 (16%) vs fy2026-variant (17%) on identical input → different hash', () => {
  it('different brackets produce different tax AND different output_hash via runScenario', () => {
    const fy2026v1 = defaultRulesetAdapter.resolveByFY('FY2026', { status: 'published' });

    const variantAdapter = new RulesetAdapter([fy2026Variant as unknown as RawRuleset]);
    const fy2026v2 = variantAdapter.resolveByFY('FY2026', { status: 'published' });

    const income = 4_500_000n; // $45,000 — in the 16% vs 17% bracket

    // Compute tax from each ruleset's brackets
    const taxV1 = applyMarginalRates(income, fy2026v1.brackets);
    const taxV2 = applyMarginalRates(income, fy2026v2.brackets);

    // FY2026.1 (16%): 2,680,000 × 1600/10000 = 428,800c  ($4,288)
    expect(taxV1).toBe(428_800n);
    // FY2026.2 (17%): 2,680,000 × 1700/10000 = 455,600c  ($4,556)
    expect(taxV2).toBe(455_600n);

    // Route through runScenario — hashed payload is { result, engine_version, ruleset_version }
    // Both the result object AND the ruleset_version differ, so hashes must differ.
    const r1 = runScenario(
      baseInputs,
      fy2026v1.version,
      () => ({ taxCents: taxV1, incomeCents: income }),
      clock,
    );
    const r2 = runScenario(
      baseInputs,
      fy2026v2.version,
      () => ({ taxCents: taxV2, incomeCents: income }),
      clock,
    );

    expect(r1.ruleset_version).toBe('FY2026.1');
    expect(r2.ruleset_version).toBe('FY2026.2');
    expect(r1.output_hash).not.toBe(r2.output_hash);
  });
});

describe('RB-04: output_hash encodes ruleset_version', () => {
  it('changing only ruleset_version changes the hash', () => {
    const computeFn = () => ({ x: 1n, y: 'hello' });
    const r1 = runScenario(baseInputs, 'v1', computeFn, clock);
    const r2 = runScenario(baseInputs, 'v2', computeFn, clock);
    const r3 = runScenario(baseInputs, 'v1', computeFn, clock);

    expect(r1.output_hash).not.toBe(r2.output_hash);
    expect(r1.output_hash).toBe(r3.output_hash); // v1 is reproducible
  });
});

describe('RB-05: variant ruleset loads and resolves without error', () => {
  it('fy2026-variant.json passes validation with version FY2026.2', () => {
    const adapter = new RulesetAdapter([fy2026Variant as unknown as RawRuleset]);
    const ruleset = adapter.resolveByFY('FY2026', { status: 'published' });

    expect(ruleset.version).toBe('FY2026.2');
    expect(ruleset.financialYear).toBe('FY2026');
    // Second bracket should be 17% (1700bps) not 16%
    expect(ruleset.brackets[1]?.rateBps).toBe(1700);
  });
});
