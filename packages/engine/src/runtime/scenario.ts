import { outputHash } from '../money/canonical.js';

import type { Clock } from './clock.js';

export const ENGINE_VERSION = '0.1.0';

export interface ScenarioInputs {
  readonly scenarioId: string;
  readonly asOfMs: number;
  readonly horizonYears: number;
  readonly [key: string]: unknown;
}

export interface ScenarioResult<T = unknown> {
  readonly result: T;
  readonly output_hash: string;
  readonly engine_version: string;
  readonly ruleset_version: string;
}

/**
 * Skeleton scenario runner. The compute function receives validated inputs
 * and a clock; it returns a result. The runner adds the output_hash and
 * version metadata.
 *
 * No I/O, no Date.now(), no Math.random() — all entropy via inputs/clock.
 */
export function runScenario<TInputs extends ScenarioInputs, TResult>(
  inputs: TInputs,
  rulesetVersion: string,
  compute: (inputs: TInputs, clock: Clock) => TResult,
  clock: Clock,
): ScenarioResult<TResult> {
  const result = compute(inputs, clock);
  const hash = outputHash({
    result,
    engine_version: ENGINE_VERSION,
    ruleset_version: rulesetVersion,
  });
  return {
    result,
    output_hash: hash,
    engine_version: ENGINE_VERSION,
    ruleset_version: rulesetVersion,
  };
}
