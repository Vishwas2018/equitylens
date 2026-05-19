import { execSync } from 'node:child_process';

export function run(cmd: string, opts?: { allowFailure?: boolean }): string {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (err) {
    if (opts?.allowFailure) return '';
    throw err;
  }
}

export function headSha(): string {
  return run('git rev-parse HEAD');
}

export function currentBranch(): string {
  return run('git rev-parse --abbrev-ref HEAD');
}

export function lastCommit(): string {
  return run('git log -1 --format="%H %ai %an: %s"');
}

export function statusPorcelain(): string {
  return run('git status --porcelain');
}

export function dayTags(): string[] {
  const raw = run('git tag --list "day-*"', { allowFailure: true });
  return raw ? raw.split('\n').filter(Boolean) : [];
}

export function latestEndTagDay(tags: string[]): number {
  const endTags = tags.filter((t) => t.match(/^day-(\d+)-end$/));
  if (endTags.length === 0) return 0;
  const days = endTags.map((t) => parseInt(t.replace('day-', '').replace('-end', ''), 10));
  return Math.max(...days);
}

export function tagExists(tag: string): boolean {
  return run(`git tag --list "${tag}"`, { allowFailure: true }) !== '';
}

export function diffStatSince(tag: string): string {
  if (!tagExists(tag)) return `(tag ${tag} not found — skipped)`;
  return run(`git diff --stat ${tag}..HEAD`, { allowFailure: true }) || '(no changes)';
}
