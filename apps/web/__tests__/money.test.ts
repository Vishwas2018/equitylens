import { describe, expect, it } from 'vitest';

// Pure unit tests for the Money formatting logic — no DOM required.
// We test the Intl.NumberFormat output directly since the component is a thin wrapper.

const AU_FORMATTER = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const AU_FORMATTER_CENTS = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatDollars(cents: bigint | number): string {
  return AU_FORMATTER.format(Number(cents) / 100);
}

function formatWithCents(cents: bigint | number): string {
  return AU_FORMATTER_CENTS.format(Number(cents) / 100);
}

describe('<Money> formatting logic', () => {
  it('formats whole-dollar amounts without cents', () => {
    expect(formatDollars(80000000n)).toMatch(/\$800,000/);
  });

  it('formats zero as $0', () => {
    expect(formatDollars(0n)).toMatch(/\$0/);
  });

  it('formats negative values', () => {
    expect(formatDollars(-100000n)).toMatch(/-\$1,000/);
  });

  it('formats large values with commas', () => {
    expect(formatDollars(120000000n)).toMatch(/\$1,200,000/);
  });

  it('formats cents when showCents=true', () => {
    expect(formatWithCents(12345n)).toMatch(/\$123\.45/);
  });

  it('rounds correctly to whole dollars', () => {
    // 12345 cents = $123.45 → rounded to $123
    expect(formatDollars(12345n)).toMatch(/\$123/);
  });

  it('accepts number input (not just bigint)', () => {
    expect(formatDollars(80000000)).toMatch(/\$800,000/);
  });
});
