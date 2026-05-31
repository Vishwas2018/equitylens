/**
 * Export queue — Upstash QStash wrapper.
 *
 * fast  → portfolio-summary, cgt-disposal (< 5s expected render time)
 * bulk  → cashflow-annual (may involve many properties; longer tail)
 *
 * QStash delivers the job by POSTing to /api/exports/worker with the job
 * payload as JSON body. The worker handler verifies the QStash signature
 * before processing.
 */

import { Client } from '@upstash/qstash';

export type QueueName = 'exports.fast' | 'exports.bulk';

export interface ExportJobPayload {
  jobId: string;
  templateSlug: string;
  format: 'pdf' | 'csv';
  userId: string;
  orgId: string;
  scopeJson: string;
  rulesetVersion: string;
}

function getWorkerUrl(): string {
  const base =
    process.env['NEXT_PUBLIC_APP_URL'] ?? process.env['VERCEL_URL'] ?? 'http://localhost:3000';
  const origin = base.startsWith('http') ? base : `https://${base}`;
  return `${origin}/api/exports/worker`;
}

export async function enqueueExportJob(queue: QueueName, payload: ExportJobPayload): Promise<void> {
  const token = process.env['QSTASH_TOKEN'];
  if (!token) {
    // In dev/test without QStash, skip enqueue — worker is called directly by POST /api/exports/worker
    return;
  }

  const client = new Client({ token });
  const delay = queue === 'exports.bulk' ? 0 : 0;

  await client.publishJSON({
    url: getWorkerUrl(),
    body: payload,
    retries: 3,
    delay,
  });
}
