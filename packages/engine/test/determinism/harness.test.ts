import { describe, it, expect } from 'vitest';

import { FixedClock } from '../../src/runtime/clock.js';
import type { Clock } from '../../src/runtime/clock.js';
import { runScenario, type ScenarioInputs } from '../../src/runtime/scenario.js';

interface TestInputs extends ScenarioInputs {
  readonly amount: bigint;
  readonly rateBps: number;
  readonly termMonths: number;
}

function computeFixture(inputs: TestInputs, _clock: Clock) {
  // Deterministic pure computation — no entropy
  const monthlyRate = inputs.rateBps;
  const periods = Array.from({ length: inputs.termMonths }, (_, i) => ({
    period: i + 1,
    balance: inputs.amount - BigInt(i) * (inputs.amount / BigInt(inputs.termMonths)),
    rateBps: monthlyRate,
  }));
  return { periods, totalPeriods: inputs.termMonths };
}

const FIXTURE: TestInputs = {
  scenarioId: 'test-det-001',
  asOfMs: 1_748_736_000_000, // 2025-06-01 00:00:00 UTC
  horizonYears: 5,
  amount: 50_000_000n, // $500,000
  rateBps: 600,
  termMonths: 60,
};

const CLOCK = new FixedClock(FIXTURE.asOfMs);

describe('determinism harness — 1000 iterations', () => {
  it('produces identical output_hash across 1000 runs', () => {
    const hashes: string[] = [];
    for (let i = 0; i < 1000; i++) {
      const r = runScenario(FIXTURE, 'FY2026.1', computeFixture, CLOCK);
      hashes.push(r.output_hash);
    }
    const first = hashes[0];
    const divergences = hashes.filter((h) => h !== first);
    expect(divergences).toHaveLength(0);
  });

  it('engine_version is stamped on every result', () => {
    const r = runScenario(FIXTURE, 'FY2026.1', computeFixture, CLOCK);
    expect(r.engine_version).toBe('0.1.0');
  });

  it('ruleset_version is stamped on every result', () => {
    const r = runScenario(FIXTURE, 'FY2026.1', computeFixture, CLOCK);
    expect(r.ruleset_version).toBe('FY2026.1');
  });

  it('different ruleset versions produce different hashes', () => {
    const r1 = runScenario(FIXTURE, 'FY2026.1', computeFixture, CLOCK);
    const r2 = runScenario(FIXTURE, 'FY2025.1', computeFixture, CLOCK);
    expect(r1.output_hash).not.toBe(r2.output_hash);
  });

  it('FixedClock always returns the same timestamp', () => {
    const clock = new FixedClock(1_700_000_000_000);
    expect(clock.now()).toBe(1_700_000_000_000);
    expect(clock.now()).toBe(1_700_000_000_000);
  });
});
