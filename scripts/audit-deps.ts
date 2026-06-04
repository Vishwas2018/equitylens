#!/usr/bin/env tsx
/**
 * Standalone audit-deps check with exception support — for use in CI.
 * Mirrors the runAuditDeps() logic from scripts/lib/checks.ts.
 *
 * Exit codes:
 *   0  all high/critical CVEs are excepted (WARN) or no findings
 *   1  one or more high/critical CVEs are not excepted or exception expired
 */
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { checkException, loadExceptions, parseAuditAdvisories } from './lib/audit-exceptions.js';

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url)).replace(/[\\/]$/, '');

let jsonOutput = '';
try {
  jsonOutput = execSync('pnpm audit --json', {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: REPO_ROOT,
    env: { ...process.env, npm_config_engine_strict: 'false' },
  });
} catch (err: unknown) {
  const e = err as { stdout?: string };
  jsonOutput = e.stdout ?? '';
}

const exceptions = loadExceptions();
const advisories = parseAuditAdvisories(jsonOutput);

if (advisories.length === 0) {
  console.log('✅ audit-deps: no high/critical vulnerabilities found');
  process.exit(0);
}

let hasFailure = false;

for (const adv of advisories) {
  const result = checkException(adv.ghsaId, exceptions);
  if (result.status === 'warn') {
    console.warn(
      `⚠  WARN [excepted until ${result.exception.until}] ${adv.ghsaId} — ${adv.packageName} (${adv.severity}) — ${result.exception.linked_defect}`,
    );
  } else if (result.status === 'expired') {
    console.error(
      `❌ FAIL [exception expired on ${result.expiredOn}] ${adv.ghsaId} — ${adv.packageName} (${adv.severity})`,
    );
    hasFailure = true;
  } else {
    console.error(`❌ FAIL [no exception] ${adv.ghsaId} — ${adv.packageName} (${adv.severity})`);
    hasFailure = true;
  }
}

process.exit(hasFailure ? 1 : 0);
