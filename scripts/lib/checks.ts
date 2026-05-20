import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkException, loadExceptions, parseAuditAdvisories } from './audit-exceptions.js';

export type CheckResult = {
  name: string;
  status: 'pass' | 'fail' | 'warn' | 'skipped';
  output: string;
  wiredDay?: number;
};

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url)).replace(/[\\/]$/, '');

function runCheck(cmd: string): { ok: boolean; output: string } {
  try {
    const output = execSync(cmd, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: REPO_ROOT,
      env: { ...process.env, npm_config_engine_strict: 'false' },
    });
    return { ok: true, output: output.trim() };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const output = [e.stdout, e.stderr, e.message].filter(Boolean).join('\n').trim();
    return { ok: false, output };
  }
}

/** Run `pnpm audit --json`, apply exception list, return structured result. */
function runAuditDeps(): CheckResult {
  const exceptions = loadExceptions();

  // Always capture output even on non-zero exit (vulnerabilities found)
  let jsonOutput = '';
  try {
    jsonOutput = execSync('pnpm audit --json', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: REPO_ROOT,
      env: { ...process.env, npm_config_engine_strict: 'false' },
    });
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string };
    jsonOutput = e.stdout ?? '';
  }

  const advisories = parseAuditAdvisories(jsonOutput);

  if (advisories.length === 0) {
    return { name: 'audit-deps', status: 'pass', output: 'No vulnerabilities found.' };
  }

  const lines: string[] = [];
  let hasFailure = false;
  let hasWarn = false;

  for (const adv of advisories) {
    const result = checkException(adv.ghsaId, exceptions);
    if (result.status === 'warn') {
      hasWarn = true;
      lines.push(
        `WARN [excepted until ${result.exception.until}] ${adv.ghsaId} — ${adv.packageName} (${adv.severity}) — ${result.exception.reason} [${result.exception.linked_defect}]`,
      );
    } else if (result.status === 'expired') {
      hasFailure = true;
      lines.push(
        `FAIL [exception expired on ${result.expiredOn}] ${adv.ghsaId} — ${adv.packageName} (${adv.severity})`,
      );
    } else {
      hasFailure = true;
      lines.push(`FAIL [no exception] ${adv.ghsaId} — ${adv.packageName} (${adv.severity})`);
    }
  }

  const output = lines.join('\n');

  if (hasFailure) return { name: 'audit-deps', status: 'fail', output };
  if (hasWarn) return { name: 'audit-deps', status: 'warn', output };
  return { name: 'audit-deps', status: 'pass', output };
}

function skipped(name: string, wiredDay: number): CheckResult {
  return {
    name,
    status: 'skipped',
    output: `SKIPPED — wired on Day ${wiredDay} (see docs/process/15-day-plan.md § Day ${wiredDay})`,
    wiredDay,
  };
}

export function saveCheckOutput(dayDir: string, checkName: string, content: string): void {
  mkdirSync(dayDir, { recursive: true });
  writeFileSync(join(dayDir, `audit-${checkName}.txt`), content + '\n');
}

export function runWiredChecks(): CheckResult[] {
  const results: CheckResult[] = [];

  const simpleChecks: Array<{ name: string; cmd: string }> = [
    { name: 'git-status', cmd: 'git status --porcelain' },
    { name: 'typecheck', cmd: 'pnpm typecheck' },
    { name: 'lint', cmd: 'pnpm lint' },
    { name: 'format-check', cmd: 'pnpm format:check' },
    { name: 'test', cmd: 'pnpm test' },
  ];

  for (const check of simpleChecks) {
    const { ok, output } = runCheck(check.cmd);
    results.push({ name: check.name, status: ok ? 'pass' : 'fail', output });
  }

  results.push(runAuditDeps());

  return results;
}

export function skippedChecks(): CheckResult[] {
  return [
    skipped('migration-status', 2),
    skipped('migration-dryrun', 2),
    skipped('rls-coverage', 2),
    skipped('cross-tenant-probe', 2),
    skipped('region-check', 2),
    skipped('engine-determinism', 4),
    skipped('ato-fixture-canary', 4),
    skipped('bundle-budgets', 8),
    skipped('a11y', 8),
    skipped('disclaimer-audit', 8),
    skipped('secret-scan', 15),
  ];
}
