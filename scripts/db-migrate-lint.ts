#!/usr/bin/env tsx
/**
 * Migration linter — fails on destructive patterns per ci-cd-pipeline.md §6.2.
 *
 * Usage: pnpm db:migrate:lint
 *
 * Exit codes:
 *   0  no forbidden patterns found
 *   1  one or more forbidden patterns detected
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url)).replace(/[\\/]$/, '');
const MIGRATIONS_DIR = join(REPO_ROOT, 'supabase', 'migrations');

type ForbiddenRule = { pattern: RegExp; reason: string };

const FORBIDDEN: ForbiddenRule[] = [
  {
    pattern: /\bDROP\s+TABLE\b/i,
    reason: 'Drop tables in a follow-up release after read paths are removed',
  },
  {
    pattern: /\bDROP\s+COLUMN\b/i,
    reason: 'Drop columns in a follow-up release after read paths are removed',
  },
  {
    pattern: /\bALTER\s+TYPE\b/i,
    reason: 'Use new enum + dual-write pattern instead of ALTER TYPE',
  },
  { pattern: /\bTRUNCATE\b/i, reason: 'TRUNCATE is forbidden in migrations' },
  {
    pattern: /CREATE\s+INDEX\s+(?!CONCURRENTLY)/i,
    reason: 'Use CREATE INDEX CONCURRENTLY to avoid table locks',
  },
];

if (!existsSync(MIGRATIONS_DIR)) {
  console.log('ℹ  No migrations directory — nothing to lint.');
  process.exit(0);
}

const upFiles = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql') && !f.endsWith('_down.sql'))
  .sort();

if (upFiles.length === 0) {
  console.log('ℹ  No migration files to lint.');
  process.exit(0);
}

let violations = 0;

for (const file of upFiles) {
  const content = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
  for (const rule of FORBIDDEN) {
    if (rule.pattern.test(content)) {
      console.error(`❌  ${file}: ${rule.reason}`);
      violations++;
    }
  }
}

if (violations === 0) {
  console.log(`✅  db:migrate:lint — ${upFiles.length} file(s) clean`);
}

process.exit(violations > 0 ? 1 : 0);
