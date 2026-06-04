#!/usr/bin/env tsx
/**
 * CCTV Audit Script — full implementation (D01-T4)
 * Replaces the stub from D00-T3.
 *
 * Usage:  pnpm audit:cctv [--day NN]
 *   --day NN   audit for day NN (default: latest day-*-end tag + 1)
 *
 * Exit codes:
 *   0  all wired checks pass
 *   1  one or more wired checks failed
 *   2  drift (previous day-end tag missing)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runWiredChecks, skippedChecks, saveCheckOutput } from './lib/checks.js';
import {
  headSha,
  currentBranch,
  lastCommit,
  statusPorcelain,
  dayTags,
  latestEndTagDay,
  tagExists,
  diffStatSince,
} from './lib/git.js';

const EXPECTED_NODE_PREFIX = 'v20.14.';
const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url)).replace(/[\\/]$/, '');

// --- Parse --day flag ---
const dayArg = process.argv.indexOf('--day');
let day: number;
if (dayArg !== -1 && process.argv[dayArg + 1]) {
  day = parseInt(process.argv[dayArg + 1]!, 10);
} else {
  const tags = dayTags();
  day = latestEndTagDay(tags) + 1;
}

const dayStr = String(day).padStart(2, '0');
const prevDayStr = String(day - 1).padStart(2, '0');
const prevEndTag = `day-${prevDayStr}-end`;
const reportDir = join(REPO_ROOT, `docs/process/prompts/day-${dayStr}`);
const checkpointsDir = join(reportDir, 'checkpoints');

// --- Drift check ---
if (day > 1 && !tagExists(prevEndTag)) {
  console.error(`❌ DRIFT: tag '${prevEndTag}' not found. Cannot audit Day ${day}.`);
  console.error(`   Run 'git tag --list day-*' to see available tags.`);
  process.exit(2);
}

// --- Header ---
const date = new Date().toISOString();
const branch = currentBranch();
const sha = headSha();
const lastCmt = lastCommit();
const gitStatus = statusPorcelain();
const tags = dayTags();
const diffStat = diffStatSince(prevEndTag);

const nodeDrift = !process.version.startsWith(EXPECTED_NODE_PREFIX);

console.log(`=== CCTV Audit — Day ${dayStr} ===`);
console.log(`Date:         ${date}`);
console.log(`Branch:       ${branch}`);
console.log(`HEAD SHA:     ${sha}`);
console.log(`Last commit:  ${lastCmt}`);
console.log(`Node:         ${process.version}`);

if (nodeDrift) {
  console.warn(
    `⚠  WARNING: Node version drift. Running: ${process.version}. ` +
      `Expected: ${EXPECTED_NODE_PREFIX}x (see .nvmrc). ` +
      `CI enforces exact version; local results may differ.`,
  );
}

console.log(`\nPrev tag:     ${prevEndTag} ${tagExists(prevEndTag) ? '✅' : '❌ MISSING'}`);
console.log(`All day tags: ${tags.join(', ') || '(none)'}`);

// --- Git status ---
console.log('\n--- git status --porcelain ---');
console.log(gitStatus || '(clean)');

// --- Diff stat ---
console.log(`\n--- git diff --stat ${prevEndTag}..HEAD ---`);
console.log(diffStat);

// --- Run checks ---
mkdirSync(checkpointsDir, { recursive: true });

console.log('\n--- Automated checks ---');
const wired = runWiredChecks();
const skipped = skippedChecks();
const allResults = [...wired, ...skipped];

let anyFailed = false;
for (const r of allResults) {
  const icon =
    r.status === 'pass'
      ? '✅'
      : r.status === 'skipped'
        ? '⏭ '
        : r.status === 'warn'
          ? '⚠ '
          : '❌';
  console.log(`  ${icon} ${r.name}: ${r.status}`);
  if (r.status === 'fail') {
    anyFailed = true;
    console.log(`     ${r.output.split('\n').slice(0, 3).join('\n     ')}`);
  } else if (r.status === 'warn') {
    console.log(`     ${r.output.split('\n').slice(0, 3).join('\n     ')}`);
  }
  saveCheckOutput(checkpointsDir, r.name, `Check: ${r.name}\nStatus: ${r.status}\n\n${r.output}`);
}

// --- Generate report ---
const wiredRows = wired
  .map(
    (r) =>
      `| ${r.name.padEnd(28)} | ${r.status.padEnd(7)} | ${r.status === 'fail' || r.status === 'warn' ? (r.output.split('\n')[0]?.slice(0, 50) ?? '') : ''} |`,
  )
  .join('\n');

const skippedRows = skipped
  .map((r) => `| ${r.name.padEnd(28)} | SKIPPED | wired Day ${r.wiredDay} |`)
  .join('\n');

const report = `# CCTV Audit Report — Day ${dayStr}

## 0. Header

| Field                      | Value                                              |
| -------------------------- | -------------------------------------------------- |
| Day number                 | \`${dayStr}\`                                      |
| Date                       | \`${date}\`                                        |
| Branch                     | \`${branch}\`                                      |
| HEAD SHA                   | \`${sha}\`                                         |
| Last commit                | \`${lastCmt}\`                                     |
| Start-of-day tag           | \`${prevEndTag}\` ${tagExists(prevEndTag) ? '✅' : '❌ MISSING'} |
| Audit script version       | D01-T4 (full implementation)                       |
| Node version               | \`${process.version}\` ${nodeDrift ? '⚠ drift from ^20.14.0' : '✅'} |

## 1. Reconciliation Against Yesterday

> Day ${dayStr} opening — no prior End-of-Day Report to reconcile against (this is the first audit run).

## 2. Automated Check Outcomes

### Wired checks

| Check                        | Result  | Notes                                              |
| ---------------------------- | ------- | -------------------------------------------------- |
${wiredRows}

### Skipped checks (not yet wired)

| Check                        | Status  | Notes                                              |
| ---------------------------- | ------- | -------------------------------------------------- |
${skippedRows}

## 3. Diff Summary Since ${prevEndTag}

\`\`\`
${diffStat}
\`\`\`

## 4. Coverage Delta

N/A — coverage thresholds not yet wired (Day 4 for engine, Day 8 for app).

## 5. Engine Correctness Signals

N/A — engine days start Day 4.

## 6. Open Issues at Start of Day

Pulled from registers at time of audit.

| Register        | Open | New since yesterday | High-severity open |
| --------------- | ---- | ------------------- | ------------------ |
| Product backlog | TBD  | TBD                 | n/a                |
| Defect log      | TBD  | TBD                 | TBD                |
| Deviation log   | TBD  | TBD                 | TBD                |
| Technical debt  | TBD  | TBD                 | TBD                |
| Open ADRs       | TBD  | TBD                 | n/a                |

## 7. Drift & Anomalies

${gitStatus ? `Working tree has uncommitted changes:\n\`\`\`\n${gitStatus}\n\`\`\`` : 'None observed.'}

## 8. Recommended Focus

1. Carry-over from yesterday: per End-of-Day Report.
2. Today's Day-${dayStr} spine per \`/docs/process/15-day-plan.md\`.
3. Risks from audit: ${nodeDrift ? 'Node version drift on local dev machine (DEV-0002, accepted).' : 'None.'}
4. Suggested ordering: execute daily prompt tasks in order.

## 9. Sign-Off

- Code: audit complete, no edits made, registers untouched except for new defects/drift entries appended.
- Awaiting Opus's Daily Execution Prompt before any execution work begins.
`;

const reportPath = join(reportDir, '01-cctv-audit-report.md');
writeFileSync(reportPath, report);
console.log(`\nReport written → docs/process/prompts/day-${dayStr}/01-cctv-audit-report.md`);

process.exit(anyFailed ? 1 : 0);
