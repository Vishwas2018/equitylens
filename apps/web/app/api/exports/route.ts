import crypto from 'crypto';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getApiSession, unauthorised } from '../../../server/auth/api-guard';
import { getRlsAwareClient, getSupabaseAdmin } from '../../../server/db/client';
import { enqueueExportJob } from '../../../server/reports/queue';

const ALLOWED_TEMPLATES = ['portfolio-summary', 'cashflow-annual', 'cgt-disposal'] as const;
const ALLOWED_FORMATS = ['pdf', 'csv'] as const;

// Templates that go into the bulk queue (longer render time expected)
const BULK_TEMPLATES = new Set(['cashflow-annual']);

const CreateExportSchema = z.object({
  templateSlug: z.enum(ALLOWED_TEMPLATES),
  format: z.enum(ALLOWED_FORMATS),
  scopeJson: z.string().min(2),
  rulesetVersion: z.string().min(1).default('FY2026.1'),
});

// ── GET /api/exports ──────────────────────────────────────────────────────────

export async function GET() {
  const sess = await getApiSession();
  if (!sess) return unauthorised();

  const client = getRlsAwareClient(sess.accessToken);
  const { data, error } = await client
    .from('report_jobs')
    .select(
      'id, template_id, format, status, presigned_url, presigned_url_expires_at, requested_at, completed_at, error_detail',
    )
    .eq('user_id', sess.userId)
    .order('requested_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

// ── POST /api/exports ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const sess = await getApiSession();
  if (!sess) return unauthorised();

  const body = await req.json().catch(() => null);
  const parsed = CreateExportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { templateSlug, format, scopeJson, rulesetVersion } = parsed.data;

  // Idempotency key: hash of (org_id, template, format, scope, ruleset)
  const idempotencyKey = crypto
    .createHash('sha256')
    .update(JSON.stringify({ orgId: sess.orgId, templateSlug, format, scopeJson, rulesetVersion }))
    .digest('hex');

  // Check for existing job with same idempotency key
  const admin = getSupabaseAdmin();
  const { data: existing } = await admin
    .from('report_jobs')
    .select('id, status, presigned_url, presigned_url_expires_at')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ data: existing, idempotent: true }, { status: 200 });
  }

  // Insert new job in 'queued' state
  const { data: job, error: insertErr } = await admin
    .from('report_jobs')
    .insert({
      user_id: sess.userId,
      org_id: sess.orgId,
      template_id: templateSlug,
      format,
      scope: JSON.parse(scopeJson) as Record<string, unknown>,
      status: 'queued',
      queue_name: BULK_TEMPLATES.has(templateSlug) ? 'exports.bulk' : 'exports.fast',
      idempotency_key: idempotencyKey,
    })
    .select('id, status, template_id, format, requested_at')
    .single();

  if (insertErr || !job) {
    return NextResponse.json({ error: insertErr?.message ?? 'Insert failed' }, { status: 500 });
  }

  // Enqueue to QStash (no-op in dev when QSTASH_TOKEN absent)
  await enqueueExportJob(BULK_TEMPLATES.has(templateSlug) ? 'exports.bulk' : 'exports.fast', {
    jobId: job.id as string,
    templateSlug,
    format,
    userId: sess.userId,
    orgId: sess.orgId,
    scopeJson,
    rulesetVersion,
  });

  return NextResponse.json({ data: job }, { status: 202 });
}
