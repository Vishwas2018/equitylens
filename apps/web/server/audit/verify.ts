import { createHash } from 'crypto';

import { getSupabaseAdmin } from '../db/client';

import { canonicalJson } from './log';

interface AuditRow {
  id: string;
  occurred_at: string;
  prev_hash: string | null;
  payload_hash: string | null;
  computed_hash: string | null;
  metadata: Record<string, unknown>;
}

export interface ChainVerifyResult {
  totalRows: number;
  verified: boolean;
  firstBrokenId: string | null;
}

export async function verifyAuditChain(orgId?: string): Promise<ChainVerifyResult> {
  const admin = getSupabaseAdmin();

  let query = admin
    .from('audit_logs')
    .select('id,occurred_at,prev_hash,payload_hash,computed_hash,metadata')
    .not('computed_hash', 'is', null)
    .order('occurred_at', { ascending: true });

  if (orgId) query = query.eq('org_id', orgId);

  const { data: rows, error } = await query;
  if (error) throw error;
  if (!rows || rows.length === 0) return { totalRows: 0, verified: true, firstBrokenId: null };

  let expectedPrevHash = '0'.repeat(64);

  for (const row of rows as AuditRow[]) {
    if (!row.computed_hash || !row.prev_hash) {
      return { totalRows: rows.length, verified: false, firstBrokenId: row.id };
    }

    const canonicalPayload = canonicalJson(row.metadata);
    const expectedComputedHash = createHash('sha256')
      .update(expectedPrevHash + canonicalPayload)
      .digest('hex');

    if (row.prev_hash !== expectedPrevHash || row.computed_hash !== expectedComputedHash) {
      return { totalRows: rows.length, verified: false, firstBrokenId: row.id };
    }

    expectedPrevHash = row.computed_hash;
  }

  return { totalRows: rows.length, verified: true, firstBrokenId: null };
}
