/**
 * Ruleset Provenance Guard — ADR-0011
 *
 * Enforces: every ruleset JSON committed to the repo must be status:"draft".
 * The "published" lifecycle state is reachable ONLY through the DB function
 * publish_tax_ruleset() with a real tax_admin sign-off. No file in the repo
 * may fabricate legal-review provenance.
 *
 * Fails CI if ANY ruleset JSON in src/tax/ruleset/data/ (excluding *.schema.json):
 *   1. Has status !== "draft"
 *   2. Has metadata.legalReviewSignedAt set (belongs in DB, not in file)
 *   3. Has metadata.legalReviewerId or publishedBy matching all-zeros UUID pattern
 *   4. Has metadata.rulesetHash that is a placeholder string, not a 64-char hex
 *
 * This test must be RED against any file violating these rules.
 * It went RED on fy2026.json before the Day 6 rebuild (DEF-0003).
 */

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

// ── Locate the ruleset data directory ────────────────────────────────────────

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DATA_DIR = join(__dirname, '../src/tax/ruleset/data');

// ── Load all ruleset JSON files (exclude *.schema.json — those are schemas) ──

interface RulesetFile {
  file: string;
  path: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>;
}

const rulesetFiles: RulesetFile[] = readdirSync(DATA_DIR)
  .filter((f) => f.endsWith('.json') && !f.endsWith('.schema.json'))
  .map((f) => {
    const path = join(DATA_DIR, f);
    return {
      file: f,
      path,
      data: JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>,
    };
  });

// ── Pattern matchers ──────────────────────────────────────────────────────────

const ZERO_UUID = /^0{8}-0{4}-0{4}-0{4}-0{12}$/;
const PLACEHOLDER_STRING = /^placeholder/i;
const SHA256_HEX = /^[a-f0-9]{64}$/;

// ── Canonical JSON for hash verification (keys sorted, recursively) ───────────

function sortedJson(value: unknown): unknown {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, sortedJson(v)]),
  );
}

function computeRulesetHash(data: Record<string, unknown>): string {
  // Hash covers the entire ruleset body EXCLUDING metadata.rulesetHash itself.
  const { metadata, ...body } = data;
  const metaWithoutHash = metadata
    ? Object.fromEntries(
        Object.entries(metadata as Record<string, unknown>).filter(([k]) => k !== 'rulesetHash'),
      )
    : undefined;
  const hashable = metaWithoutHash !== undefined ? { ...body, metadata: metaWithoutHash } : body;
  return createHash('sha256')
    .update(JSON.stringify(sortedJson(hashable)))
    .digest('hex');
}

// ── Tests ─────────────────────────────────────────────────────────────────────

if (rulesetFiles.length === 0) {
  throw new Error('ruleset-provenance: no ruleset JSON files found in ' + DATA_DIR);
}

for (const { file, data } of rulesetFiles) {
  describe(`${file} — provenance checks`, () => {
    // Rule 1: status must be "draft"
    it('status is "draft" (ADR-0011: published state lives in DB only)', () => {
      expect(data['status']).toBe('draft');
    });

    // Rule 2: legalReviewSignedAt must NOT be set in a file (DB-only field)
    it('metadata.legalReviewSignedAt is absent (review timestamp belongs in DB)', () => {
      expect(data['metadata']?.['legalReviewSignedAt']).toBeUndefined();
    });

    // Rule 3: no placeholder/all-zeros UUIDs for reviewer or publisher
    it('metadata.legalReviewerId is absent or not a placeholder UUID', () => {
      const id: unknown = data['metadata']?.['legalReviewerId'];
      if (id !== undefined) {
        expect(typeof id).toBe('string');
        expect(ZERO_UUID.test(id as string)).toBe(false);
        expect(PLACEHOLDER_STRING.test(id as string)).toBe(false);
      }
    });

    it('metadata.publishedBy is absent or not a placeholder UUID', () => {
      const id: unknown = data['metadata']?.['publishedBy'];
      if (id !== undefined) {
        expect(typeof id).toBe('string');
        expect(ZERO_UUID.test(id as string)).toBe(false);
        expect(PLACEHOLDER_STRING.test(id as string)).toBe(false);
      }
    });

    // Rule 4: rulesetHash, if present, must be a valid 64-char hex (not a placeholder)
    it('metadata.rulesetHash is absent or is a valid SHA-256 hex string', () => {
      const hash: unknown = data['metadata']?.['rulesetHash'];
      if (hash !== undefined) {
        expect(typeof hash).toBe('string');
        expect(PLACEHOLDER_STRING.test(hash as string)).toBe(false);
        expect(SHA256_HEX.test(hash as string)).toBe(true);
      }
    });

    // Rule 4 extended: if rulesetHash IS present and valid hex, it must match the body
    it('metadata.rulesetHash, if present, matches sha256(canonicalJson(body))', () => {
      const hash: unknown = data['metadata']?.['rulesetHash'];
      if (hash !== undefined && SHA256_HEX.test(hash as string)) {
        const expected = computeRulesetHash(data);
        expect(hash).toBe(expected);
      }
    });
  });
}
