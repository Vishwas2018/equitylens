import { describe, expect, it } from 'vitest';

import { maskPii } from '../server/ai/pii-mask';

// ── Email (6 canaries) ────────────────────────────────────────────────────────

describe('PII masking — email', () => {
  it('E-01: masks plain email', () => {
    const { masked, tfnFound } = maskPii('Contact alice@example.com for details.');
    expect(masked).not.toContain('@');
    expect(masked).toContain('[EMAIL]');
    expect(tfnFound).toBe(false);
  });

  it('E-02: masks email with subdomain', () => {
    const { masked } = maskPii('Send to bob@mail.company.com.au today.');
    expect(masked).toContain('[EMAIL]');
    expect(masked).not.toContain('@');
  });

  it('E-03: masks email with plus addressing', () => {
    const { masked } = maskPii('Reply-to: carol+tag@gmail.com');
    expect(masked).toContain('[EMAIL]');
  });

  it('E-04: masks multiple emails in one string', () => {
    const { masked } = maskPii('From: a@b.com; CC: c@d.org');
    expect(masked.match(/\[EMAIL\]/g)).toHaveLength(2);
  });

  it('E-05: does not corrupt non-email text', () => {
    const { masked } = maskPii('Gross gain is $250,000.');
    expect(masked).toBe('Gross gain is $250,000.');
  });

  it('E-06: masks email adjacent to other text with no space', () => {
    const { masked } = maskPii('(alice@test.io)');
    expect(masked).toContain('[EMAIL]');
  });
});

// ── Mobile (5 canaries) ───────────────────────────────────────────────────────

describe('PII masking — Australian mobile', () => {
  it('M-01: masks 04xx xxx xxx format', () => {
    const { masked } = maskPii('Call me on 0412 345 678 please.');
    expect(masked).toContain('[MOBILE]');
    expect(masked).not.toMatch(/04\d{2}/);
  });

  it('M-02: masks +614xx format', () => {
    const { masked } = maskPii('International: +61412345678');
    expect(masked).toContain('[MOBILE]');
  });

  it('M-03: masks 04xx with dashes', () => {
    const { masked } = maskPii('Mobile: 0499-876-543');
    expect(masked).toContain('[MOBILE]');
  });

  it('M-04: does not mask landline numbers (02 xxxx xxxx)', () => {
    const { masked } = maskPii('Office: 02 9876 5432');
    expect(masked).not.toContain('[MOBILE]');
  });

  it('M-05: masks multiple mobiles', () => {
    const { masked } = maskPii('Primary 0400 111 222 backup 0411 333 444');
    expect(masked.match(/\[MOBILE\]/g)?.length).toBeGreaterThanOrEqual(2);
  });
});

// ── TFN (4 canaries including split-token + refuse) ───────────────────────────

describe('PII masking — TFN (hard refuse)', () => {
  it('T-01: flags compact TFN (no spaces)', () => {
    const { tfnFound } = maskPii('TFN: 123456789');
    expect(tfnFound).toBe(true);
  });

  it('T-02: flags TFN with spaces — split-across-tokens canary', () => {
    // Naive regex without \s? would miss "123 456 789"
    const { tfnFound } = maskPii('Tax file number 123 456 789 is confidential.');
    expect(tfnFound).toBe(true);
  });

  it('T-03: card masked before TFN scan — no false positive', () => {
    // "4111 1111 1111 1111" has substring "111 111 111" which looks like a TFN
    // Cards are masked first, so TFN regex never sees the digits
    const { tfnFound, masked } = maskPii('Card: 4111 1111 1111 1111');
    expect(masked).toContain('[CARD]');
    expect(tfnFound).toBe(false);
  });

  it('T-04: TFN-refuse case — 8-digit variant', () => {
    // Some TFNs are 8 digits (older assignments)
    const { tfnFound } = maskPii('Old TFN: 12345678');
    expect(tfnFound).toBe(true);
  });
});

// ── Address (5 canaries) ──────────────────────────────────────────────────────

describe('PII masking — street address', () => {
  it('A-01: masks "34 Oak Avenue"', () => {
    const { masked } = maskPii('Property at 34 Oak Avenue is under contract.');
    expect(masked).toContain('[ADDRESS]');
  });

  it('A-02: masks abbreviated street type "St"', () => {
    const { masked } = maskPii('Located at 12 High St Sydney');
    expect(masked).toContain('[ADDRESS]');
  });

  it('A-03: masks multi-word street name', () => {
    const { masked } = maskPii('Address: 7 Mount Pleasant Rd');
    expect(masked).toContain('[ADDRESS]');
  });

  it('A-04: does not mask pure dollar amounts', () => {
    const { masked } = maskPii('Proceeds: $850,000');
    expect(masked).not.toContain('[ADDRESS]');
  });

  it('A-05: masks address with Drive abbreviated', () => {
    const { masked } = maskPii('Living at 99 Lakeview Dr for 5 years.');
    expect(masked).toContain('[ADDRESS]');
  });
});

// ── Card (4 canaries) ─────────────────────────────────────────────────────────

describe('PII masking — payment card', () => {
  it('C-01: masks 16-digit card with spaces', () => {
    const { masked } = maskPii('Visa: 4111 1111 1111 1111');
    expect(masked).toContain('[CARD]');
    expect(masked).not.toMatch(/\d{4} \d{4}/);
  });

  it('C-02: masks 16-digit card with dashes', () => {
    const { masked } = maskPii('Card 5500-0000-0000-0004 expires 12/26');
    expect(masked).toContain('[CARD]');
  });

  it('C-03: masks card and prevents TFN false-positive', () => {
    const { masked, tfnFound } = maskPii('Amex: 4111 1111 1111 1111');
    expect(masked).toContain('[CARD]');
    expect(tfnFound).toBe(false);
  });

  it('C-04: does not mask innocent digit strings', () => {
    const { masked } = maskPii('Gain: $1,234,567');
    expect(masked).not.toContain('[CARD]');
  });
});
