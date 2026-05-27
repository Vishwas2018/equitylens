/**
 * POST /api/exports/worker
 *
 * Called by Upstash QStash when a job is dequeued. In development, can be
 * called directly without a QStash signature for testing.
 *
 * State machine: queued → running → succeeded | failed
 *
 * DEV-0024: This handler runs as a Next.js API route (Node.js runtime), not a
 * Supabase Edge Function. See deviation log for rationale.
 *
 * HUMAN PREREQUISITE: 'exports' bucket must exist in Supabase Storage.
 */

import crypto from 'crypto';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getSupabaseAdmin } from '../../../../server/db/client';
import type { DisclaimerContext } from '../../../../server/reports/disclaimer';
import type { IdentificationContext } from '../../../../server/reports/identification';
import { renderArtifact } from '../../../../server/reports/render';

export const runtime = 'nodejs';

const PRESIGNED_URL_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const STORAGE_BUCKET = 'exports';

const WorkerPayloadSchema = z.object({
  jobId: z.string().uuid(),
  templateSlug: z.string().min(1),
  format: z.enum(['pdf', 'csv']),
  userId: z.string().uuid(),
  orgId: z.string().uuid(),
  scopeJson: z.string().min(2),
  rulesetVersion: z.string().min(1),
});

export async function POST(req: NextRequest) {
  // QStash signature verification (skip in dev when QSTASH_CURRENT_SIGNING_KEY is absent)
  const signingKey = process.env['QSTASH_CURRENT_SIGNING_KEY'];
  if (signingKey) {
    const sig = req.headers.get('upstash-signature');
    if (!sig) {
      return NextResponse.json({ error: 'Missing QStash signature' }, { status: 401 });
    }
    // Minimal HMAC verification — full JWT validation via @upstash/qstash SDK in production
    // For now: trust signature presence check; add full verification when QSTASH_TOKEN is set
  }

  const body = await req.json().catch(() => null);
  const parsed = WorkerPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid job payload' }, { status: 422 });
  }

  const { jobId, templateSlug, format, userId, orgId, scopeJson, rulesetVersion } = parsed.data;
  const admin = getSupabaseAdmin();

  // Mark job as running
  await admin
    .from('report_jobs')
    .update({ status: 'running' })
    .eq('id', jobId)
    .eq('status', 'queued');

  try {
    const generatedAt = new Date().toISOString();

    // Build render context — identification + disclaimer
    // In production, user details would be fetched from the DB; for Day 12 we
    // use org_id/user_id as the display names (extended in a follow-up).
    const disclaimer: DisclaimerContext = {
      engineVersion: process.env['ENGINE_VERSION'] ?? '0.1.0',
      rulesetVersion,
      rulesetStatus: 'draft', // All rulesets are draft per ADR-0011
      generatedAt,
      reportId: jobId,
      templateSlug,
      templateVersion: '1.0.0',
    };

    const identification: IdentificationContext = {
      templateHumanName: humanName(templateSlug),
      tenantDisplayName: orgId,
      userDisplayName: userId,
      userEmail: 'user@equitylens.com.au', // masked in output; placeholder for D12
      generatedAtHuman: new Date(generatedAt).toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      scenarioName: templateSlug,
      scenarioId: jobId,
    };

    // Render — disclaimer enforced structurally inside renderArtifact()
    const artifact = await renderArtifact(templateSlug, format, scopeJson, {
      disclaimer,
      identification,
    });

    // SHA-256 of artifact bytes for idempotency verification
    const outputHash = crypto.createHash('sha256').update(artifact.bytes).digest('hex');

    // Upload to Supabase Storage
    const artifactKey = `${orgId}/${userId}/${jobId}.${artifact.extension}`;
    const { error: uploadErr } = await admin.storage
      .from(STORAGE_BUCKET)
      .upload(artifactKey, artifact.bytes, {
        contentType: artifact.mimeType,
        upsert: false,
      });

    if (uploadErr) {
      throw new Error(`Storage upload failed: ${uploadErr.message}`);
    }

    // Issue presigned URL (7-day TTL)
    const { data: signed, error: signErr } = await admin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(artifactKey, PRESIGNED_URL_TTL_SECONDS);

    if (signErr || !signed) {
      throw new Error(`Failed to create signed URL: ${signErr?.message ?? 'unknown'}`);
    }

    const expiresAt = new Date(Date.now() + PRESIGNED_URL_TTL_SECONDS * 1000).toISOString();

    // Mark succeeded
    await admin
      .from('report_jobs')
      .update({
        status: 'succeeded',
        artifact_key: artifactKey,
        output_hash: outputHash,
        presigned_url: signed.signedUrl,
        presigned_url_expires_at: expiresAt,
        completed_at: generatedAt,
      })
      .eq('id', jobId);

    return NextResponse.json({ ok: true, jobId }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown render error';

    await admin
      .from('report_jobs')
      .update({
        status: 'failed',
        error_detail: message,
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function humanName(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
