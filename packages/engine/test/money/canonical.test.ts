import { describe, it, expect } from 'vitest';

import { canonicalJson, outputHash } from '../../src/money/canonical.js';

describe('canonicalJson', () => {
  it('sorts object keys alphabetically', () => {
    const a = canonicalJson({ z: 1, a: 2, m: 3 });
    const b = canonicalJson({ m: 3, z: 1, a: 2 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":2,"m":3,"z":1}');
  });

  it('sorts keys recursively in nested objects', () => {
    const a = canonicalJson({ z: { b: 1, a: 2 }, a: { y: 3, x: 4 } });
    const b = canonicalJson({ a: { x: 4, y: 3 }, z: { a: 2, b: 1 } });
    expect(a).toBe(b);
  });

  it('serialises bigint with "n" suffix', () => {
    const r = canonicalJson({ amount: 123456n });
    expect(r).toBe('{"amount":"123456n"}');
  });

  it('serialises zero bigint as "0n"', () => {
    expect(canonicalJson({ v: 0n })).toBe('{"v":"0n"}');
  });

  it('distinguishes bigint from a string that looks like a bigint', () => {
    const withBigint = canonicalJson({ v: 42n });
    const withString = canonicalJson({ v: '42' });
    expect(withBigint).not.toBe(withString);
    expect(withBigint).toBe('{"v":"42n"}');
    expect(withString).toBe('{"v":"42"}');
  });

  it('preserves array order (no key sorting in arrays)', () => {
    const r = canonicalJson([3, 1, 2]);
    expect(r).toBe('[3,1,2]');
  });

  it('two structurally equal objects with different key insertion order → same JSON', () => {
    const obj1 = { b: true, a: 1, c: [1, 2, 3] };
    const obj2 = { c: [1, 2, 3], a: 1, b: true };
    expect(canonicalJson(obj1)).toBe(canonicalJson(obj2));
  });

  it('handles null', () => {
    expect(canonicalJson(null)).toBe('null');
  });

  it('handles primitive number', () => {
    expect(canonicalJson(42)).toBe('42');
  });
});

describe('outputHash', () => {
  it('returns a 64-char hex string', () => {
    const h = outputHash({ x: 1 });
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it('same value → same hash (determinism)', () => {
    const a = outputHash({ result: 100n, engine: '0.1.0' });
    const b = outputHash({ result: 100n, engine: '0.1.0' });
    expect(a).toBe(b);
  });

  it('different key insertion order → same hash', () => {
    const a = outputHash({ z: 'hello', a: 42n });
    const b = outputHash({ a: 42n, z: 'hello' });
    expect(a).toBe(b);
  });

  it('different values → different hashes', () => {
    const a = outputHash({ amount: 100n });
    const b = outputHash({ amount: 101n });
    expect(a).not.toBe(b);
  });

  it('bigint vs same-number numeric string → different hashes', () => {
    const a = outputHash({ v: 42n });
    const b = outputHash({ v: 42 });
    expect(a).not.toBe(b);
  });
});
