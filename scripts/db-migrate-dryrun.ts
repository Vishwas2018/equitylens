#!/usr/bin/env tsx
/**
 * Migration dry-run script.
 * Applies all supabase/migrations/*.sql files in order against a postgres database.
 *
 * Usage:
 *   DATABASE_URL=postgres://... pnpm db:migrate:dryrun           # apply all up migrations
 *   DATABASE_URL=postgres://... pnpm db:migrate:dryrun --reverse # apply down migrations in reverse
 *
 * On CI: DATABASE_URL points to the postgres service container.
 * Locally: set DATABASE_URL to a local or docker postgres instance.
 *
 * Exit codes:
 *   0  all migrations applied successfully
 *   1  one or more migrations failed or DATABASE_URL not set
 */
import { execSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url)).replace(/[\\/]$/, '');
const MIGRATIONS_DIR = join(REPO_ROOT, 'supabase', 'migrations');

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

const allFiles = readdirSync(MIGRATIONS_DIR).sort();
const upFiles = allFiles.filter((f) => f.endsWith('.sql') && !f.endsWith('_down.sql'));
const downFiles = allFiles.filter((f) => f.endsWith('_down.sql')).reverse();

const filesToApply = isReverse ? downFiles : upFiles;

if (filesToApply.length === 0) {
  const kind = isReverse ? 'down' : 'up';
  console.log(`ℹ  No ${kind} migration files found in supabase/migrations/.`);
  process.exit(0);
}

console.log(`Applying ${filesToApply.length} ${isReverse ? 'down' : 'up'} migration(s)...`);

let failed = false;
for (const file of filesToApply) {
  const filePath = join(MIGRATIONS_DIR, file);
  process.stdout.write(`  → ${file} ... `);
  try {
    execSync(`psql "${dbUrl}" -f "${filePath}"`, {
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf8',
    });
    process.stdout.write('✅\n');
  } catch (err: unknown) {
    const e = err as { stderr?: string; stdout?: string };
    process.stdout.write('❌\n');
    console.error(`     ${(e.stderr ?? e.stdout ?? '').split('\n').slice(0, 5).join('\n     ')}`);
    failed = true;
    break;
  }
}

process.exit(failed ? 1 : 0);
