import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url)).replace(/[\\/]$/, '');
const EXCEPTIONS_PATH = join(REPO_ROOT, '.audit-exceptions.json');

export type AuditException = {
  cve: string;
  package: string;
  severity: 'high' | 'critical';
  reason: string;
  until: string;
  linked_defect: string;
};

type ExceptionsFile = {
  version: number;
  exceptions: AuditException[];
};

export type ExceptionResult =
  | { status: 'warn'; exception: AuditException }
  | { status: 'expired'; exception: AuditException; expiredOn: string }
  | { status: 'none' };

export function loadExceptions(): AuditException[] {
  if (!existsSync(EXCEPTIONS_PATH)) return [];
  const raw = readFileSync(EXCEPTIONS_PATH, 'utf8');
  const data = JSON.parse(raw) as ExceptionsFile;
  if (data.version !== 1) throw new Error(`Unknown audit-exceptions version: ${data.version}`);
  return data.exceptions;
}

function parseUntil(until: string): Date {
  // Accepts 'YYYY-MM-DD' or 'Day NN' (Day NN is not a real date — reject)
  if (/^Day \d+$/.test(until)) {
    throw new Error(
      `Exception 'until' value "${until}" must be a calendar date (YYYY-MM-DD), not a day number.`,
    );
  }
  return new Date(until);
}

export function checkException(cve: string, exceptions: AuditException[]): ExceptionResult {
  const match = exceptions.find((e) => e.cve === cve);
  if (!match) return { status: 'none' };

  const until = parseUntil(match.until);
  const now = new Date();
  // Compare at date granularity: exception is still valid if until >= today
  const untilDay = new Date(until.getFullYear(), until.getMonth(), until.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (untilDay >= today) {
    return { status: 'warn', exception: match };
  }
  return { status: 'expired', exception: match, expiredOn: match.until };
}

export type AuditAdvisory = {
  ghsaId: string;
  packageName: string;
  severity: string;
};

/** Parse CVE IDs from `pnpm audit --json` output. */
export function parseAuditAdvisories(jsonOutput: string): AuditAdvisory[] {
  if (!jsonOutput.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonOutput);
  } catch {
    return [];
  }
  const advisories: AuditAdvisory[] = [];
  if (typeof parsed !== 'object' || parsed === null) return [];
  const obj = parsed as Record<string, unknown>;

  // pnpm audit --json emits { advisories: { [id]: { github_advisory_id, module_name, severity } } }
  if ('advisories' in obj && typeof obj['advisories'] === 'object' && obj['advisories'] !== null) {
    for (const adv of Object.values(obj['advisories'] as Record<string, unknown>)) {
      if (typeof adv === 'object' && adv !== null) {
        const a = adv as Record<string, unknown>;
        const ghsaId = typeof a['github_advisory_id'] === 'string' ? a['github_advisory_id'] : '';
        const packageName = typeof a['module_name'] === 'string' ? a['module_name'] : '';
        const severity = typeof a['severity'] === 'string' ? a['severity'] : '';
        // Only surface high/critical — matching pnpm audit --audit-level=high behaviour
        if (ghsaId && (severity === 'high' || severity === 'critical')) {
          advisories.push({ ghsaId, packageName, severity });
        }
      }
    }
  }

  return advisories;
}
