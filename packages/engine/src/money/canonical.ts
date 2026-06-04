import { createHash } from 'node:crypto';

/**
 * Canonical JSON serialisation for deterministic hashing.
 *
 * Rules:
 * - Object keys are sorted lexicographically (recursive)
 * - bigint values are serialised as strings with "n" suffix to distinguish
 *   from numeric strings (e.g. 123456n → "123456n")
 * - Arrays preserve insertion order (sorting arrays would change semantics)
 * - undefined values are excluded (JSON.stringify behaviour)
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, replacer);
}

function replacer(_key: string, v: unknown): unknown {
  if (typeof v === 'bigint') {
    return `${v.toString()}n`;
  }
  if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
    const sorted = Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, val]) => [k, val]),
    );
    return sorted;
  }
  return v;
}

/** sha256 of the canonical JSON of value, hex-encoded. */
export function outputHash(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}
