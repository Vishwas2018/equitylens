#!/usr/bin/env tsx
/**
 * Migration dry-run script.
 * Applies all supabase/migrations/*.sql files in order against a postgres database.
 * Down migrations live in supabase/rollback/ and are applied with --reverse.
 *
 * Usage:
 *   DATABASE_URL=postgres://... pnpm db:migrate:dryrun           # apply all up migrations
 *   DATABASE_URL=postgres://... pnpm db:migrate:dryrun --reverse # apply down migrations in reverse
 *
 * On CI: DATABASE_URL points to the postgres service container.
 * Locally: set DATABASE_URL to a local, docker, or Supabase postgres instance.
 *
 * Exit codes:
 *   0  all migrations applied successfully
 *   1  one or more migrations failed or DATABASE_URL not set
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

const { Client } = pg;

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url)).replace(/[\\/]$/, '');
const MIGRATIONS_DIR = join(REPO_ROOT, 'supabase', 'migrations');
const ROLLBACK_DIR = join(REPO_ROOT, 'supabase', 'rollback');

const isReverse = process.argv.includes('--reverse');

const dbUrl = process.env['DATABASE_URL'];
if (!dbUrl) {
  console.error(
    '❌ DATABASE_URL not set. On CI this is provided by the postgres service container.',
  );
  console.error(
    '   Locally: export DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres',
  );
  process.exit(1);
}

if (!existsSync(MIGRATIONS_DIR)) {
  console.log('ℹ  No migrations directory found — nothing to apply.');
  process.exit(0);
}

const upFiles = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort();

const downFiles = existsSync(ROLLBACK_DIR)
  ? readdirSync(ROLLBACK_DIR)
      .filter((f) => f.endsWith('_down.sql'))
      .sort()
      .reverse()
  : [];

const filesToApply = isReverse ? downFiles : upFiles;
const baseDir = isReverse ? ROLLBACK_DIR : MIGRATIONS_DIR;

if (filesToApply.length === 0) {
  const kind = isReverse ? 'down' : 'up';
  console.log(`ℹ  No ${kind} migration files found.`);
  process.exit(0);
}

console.log(`Applying ${filesToApply.length} ${isReverse ? 'down' : 'up'} migration(s)...`);

async function run(): Promise<void> {
  const client = new Client({ connectionString: dbUrl });
  let failed = false;
  try {
    await client.connect();

    for (const file of filesToApply) {
      const filePath = join(baseDir, file);
      process.stdout.write(`  → ${file} ... `);
      try {
        const sql = readFileSync(filePath, 'utf8');
        await client.query(sql);
        process.stdout.write('✅\n');
      } catch (err: unknown) {
        const e = err as { message?: string };
        process.stdout.write('❌\n');
        console.error(`     ${(e.message ?? '').split('\n').slice(0, 5).join('\n     ')}`);
        failed = true;
        break;
      }
    }
  } finally {
    await client.end();
  }
  process.exit(failed ? 1 : 0);
}

run().catch((err) => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
