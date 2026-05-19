import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type CheckResult = {
  name: string;
  status: 'pass' | 'fail' | 'skipped';
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

  const checks: Array<{ name: string; cmd: string }> = [
    { name: 'git-status', cmd: 'git status --porcelain' },
    { name: 'typecheck', cmd: 'pnpm typecheck' },
    { name: 'lint', cmd: 'pnpm lint' },
    { name: 'format-check', cmd: 'pnpm format:check' },
    { name: 'test', cmd: 'pnpm test' },
    { name: 'audit-deps', cmd: 'pnpm audit --audit-level=high' },
  ];

  for (const check of checks) {
    const { ok, output } = runCheck(check.cmd);
    results.push({
      name: check.name,
      status: ok ? 'pass' : 'fail',
      output,
    });
  }

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
