/**
 * Draft-resolution production guard — ADR-0011
 *
 * Proves that resolveByFY blocks non-published rulesets when NODE_ENV==='production'
 * unless ALLOW_DRAFT_RULESETS==='true' is explicitly set.
 *
 * Four cases:
 *   DG-01: draft + production + no flag  → throws (guard fires)
 *   DG-02: draft + production + flag     → succeeds (explicit opt-in)
 *   DG-03: draft + test env             → succeeds (guard only fires in production)
 *   DG-04: published + production        → always succeeds (no guard for published)
 */

import { beforeEach, afterEach, describe, it, expect } from 'vitest';

import { RulesetAdapter } from '../src/tax/ruleset/index.js';
import type { RawRuleset } from '../src/tax/ruleset/types.js';

// ── Minimal ruleset fixture ───────────────────────────────────────────────────

function makeMinimal(status: string): RawRuleset {
  return {
    $schema: 'https://schemas.equitylens.au/ruleset/v3',
    version: 'TEST.1',
    status,
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
  } as RawRuleset;
}

const draftAdapter = new RulesetAdapter([makeMinimal('draft')]);
const publishedAdapter = new RulesetAdapter([makeMinimal('published')]);

// ── Environment save / restore ────────────────────────────────────────────────

let savedNodeEnv: string | undefined;
let savedAllowDraft: string | undefined;

beforeEach(() => {
  savedNodeEnv = process.env['NODE_ENV'];
  savedAllowDraft = process.env['ALLOW_DRAFT_RULESETS'];
});

afterEach(() => {
  if (savedNodeEnv === undefined) delete process.env['NODE_ENV'];
  else process.env['NODE_ENV'] = savedNodeEnv;

  if (savedAllowDraft === undefined) delete process.env['ALLOW_DRAFT_RULESETS'];
  else process.env['ALLOW_DRAFT_RULESETS'] = savedAllowDraft;
});

// ── DG-01: draft + production + no flag → throws ─────────────────────────────

describe('DG-01 — draft + NODE_ENV=production + no flag → throws', () => {
  it('throws when resolving draft in production', () => {
    process.env['NODE_ENV'] = 'production';
    delete process.env['ALLOW_DRAFT_RULESETS'];
    expect(() => draftAdapter.resolveByFY('FY2026', { status: 'draft' })).toThrow(Error);
  });

  it('error message mentions "production"', () => {
    process.env['NODE_ENV'] = 'production';
    delete process.env['ALLOW_DRAFT_RULESETS'];
    expect(() => draftAdapter.resolveByFY('FY2026', { status: 'draft' })).toThrow(/production/i);
  });

  it('error message mentions the offending status', () => {
    process.env['NODE_ENV'] = 'production';
    delete process.env['ALLOW_DRAFT_RULESETS'];
    expect(() => draftAdapter.resolveByFY('FY2026', { status: 'draft' })).toThrow(/draft/);
  });
});

// ── DG-02: draft + production + ALLOW_DRAFT_RULESETS=true → succeeds ─────────

describe('DG-02 — draft + NODE_ENV=production + ALLOW_DRAFT_RULESETS=true → succeeds', () => {
  it('resolves successfully with explicit opt-in flag', () => {
    process.env['NODE_ENV'] = 'production';
    process.env['ALLOW_DRAFT_RULESETS'] = 'true';
    const ruleset = draftAdapter.resolveByFY('FY2026', { status: 'draft' });
    expect(ruleset.status).toBe('draft');
  });

  it('returned ruleset carries status "draft"', () => {
    process.env['NODE_ENV'] = 'production';
    process.env['ALLOW_DRAFT_RULESETS'] = 'true';
    const ruleset = draftAdapter.resolveByFY('FY2026', { status: 'draft' });
    expect(ruleset.status).toBe('draft');
    expect(ruleset.version).toBe('TEST.1');
  });
});

// ── DG-03: draft + test env → succeeds ───────────────────────────────────────

describe('DG-03 — draft + NODE_ENV=test → succeeds (guard is production-only)', () => {
  it('resolves draft without any flag in test environment', () => {
    process.env['NODE_ENV'] = 'test';
    delete process.env['ALLOW_DRAFT_RULESETS'];
    const ruleset = draftAdapter.resolveByFY('FY2026', { status: 'draft' });
    expect(ruleset.status).toBe('draft');
  });
});

// ── DG-04: published + production → always succeeds ──────────────────────────

describe('DG-04 — published + NODE_ENV=production → always succeeds', () => {
  it('resolves published in production with no special flag', () => {
    process.env['NODE_ENV'] = 'production';
    delete process.env['ALLOW_DRAFT_RULESETS'];
    const ruleset = publishedAdapter.resolveByFY('FY2026', { status: 'published' });
    expect(ruleset.status).toBe('published');
  });
});
