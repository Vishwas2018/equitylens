/**
 * Injected clock interface — engine code never calls Date.now() or new Date()
 * directly. All time inputs arrive via Clock or explicit date strings in inputs.
 */

export type EpochMillis = number;

export interface Clock {
  now(): EpochMillis;
}

/** Deterministic clock for tests. Returns a fixed timestamp forever. */
export class FixedClock implements Clock {
  constructor(private readonly _ms: EpochMillis) {}
  now(): EpochMillis {
    return this._ms;
  }
}
