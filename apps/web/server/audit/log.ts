import { createHash, randomBytes } from 'crypto';

import { getSupabaseAdmin } from '../db/client';

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'export'
  | 'scenario_run'
  | 'subscription_change'
  | 'rls_deny'
  | 'admin_recompute';

export interface AuditEntry {
  action: AuditAction;
  resourceType: string;
  actorUserId?: string | undefined;
  tenantId?: string | undefined;
  resourceId?: string | undefined;
  ip?: string | undefined;
  userAgent?: string | undefined;
}

function pepper(): string {
  const p = process.env['AUDIT_HASH_PEPPER'];
  if (!p) throw new Error('AUDIT_HASH_PEPPER not set');
  return p;
}

export function hashId(id: string): string {
  return createHash('sha256')
    .update(id + pepper())
    .digest('hex');
}

export function hashTenant(orgId: string): string {
  return hashId(orgId);
}

// Canonical JSON: recursively sorts object keys for deterministic hashing.
export function canonicalJson(val: unknown): string {
  if (val === null || typeof val !== 'object') return JSON.stringify(val);
  if (Array.isArray(val)) return '[' + val.map(canonicalJson).join(',') + ']';
  const obj = val as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalJson(obj[k])).join(',') + '}';
}

export async function appendAuditEntry(entry: AuditEntry): Promise<void> {
  const admin = getSupabaseAdmin();

  const anonymised = {
    actor_user_id_hash: entry.actorUserId ? hashId(entry.actorUserId) : null,
    tenant_id_hash: entry.tenantId ? hashTenant(entry.tenantId) : null,
    action: entry.action,
    resource_type: entry.resourceType,
    resource_id: entry.resourceId ? hashId(entry.resourceId) : null,
    occurred_at: new Date().toISOString(),
    ip_hash: entry.ip ? hashId(entry.ip) : null,
    user_agent_hash: entry.userAgent ? hashId(entry.userAgent) : null,
  };

  const canonicalPayload = canonicalJson(anonymised);
  const payloadHash = createHash('sha256').update(canonicalPayload).digest('hex');

  // Fetch previous computed_hash atomically — single-row lock via .limit(1).
  const { data: lastRow } = await admin
    .from('audit_logs')
    .select('computed_hash')
    .not('computed_hash', 'is', null)
    .order('occurred_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const prevHash = lastRow?.computed_hash ?? '0'.repeat(64);
  const computedHash = createHash('sha256')
    .update(prevHash + canonicalPayload)
    .digest('hex');

  await admin.from('audit_logs').insert({
    actor_user_id: entry.actorUserId ?? null,
    org_id: entry.tenantId ?? null,
    action: entry.action,
    entity_type: entry.resourceType,
    metadata: anonymised,
    prev_hash: prevHash,
    payload_hash: payloadHash,
    computed_hash: computedHash,
  });
}

// Generates a cryptographically random one-time token (hex) and its SHA256 hash.
export function generateInviteToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  return { token, tokenHash };
}
