import { NextRequest, NextResponse } from 'next/server';

import { getApiSession, notFound, unauthorised } from '../../../../server/auth/api-guard';
import { getRlsAwareClient, getSupabaseAdmin } from '../../../../server/db/client';

const PRESIGNED_URL_TTL_SECONDS = 7 * 24 * 60 * 60;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sess = await getApiSession();
  if (!sess) return unauthorised();

  const client = getRlsAwareClient(sess.accessToken);
  const { data: job, error } = await client
    .from('report_jobs')
    .select(
      'id, template_id, format, status, artifact_key, presigned_url, presigned_url_expires_at, output_hash, requested_at, completed_at, error_detail',
    )
    .eq('id', id)
    .eq('user_id', sess.userId)
    .single();

  if (error || !job) return notFound();

  // Refresh presigned URL if expired or within 1 hour of expiry
  const expiresAt = job.presigned_url_expires_at as string | null;
  const artifactKey = job.artifact_key as string | null;
  const needsRefresh =
    artifactKey &&
    job.status === 'succeeded' &&
    expiresAt &&
    new Date(expiresAt).getTime() < Date.now() + 3600_000;

  if (needsRefresh) {
    const admin = getSupabaseAdmin();
    const { data: signed } = await admin.storage
      .from('exports')
      .createSignedUrl(artifactKey, PRESIGNED_URL_TTL_SECONDS);

    if (signed) {
      const newExpiry = new Date(Date.now() + PRESIGNED_URL_TTL_SECONDS * 1000).toISOString();
      await admin
        .from('report_jobs')
        .update({ presigned_url: signed.signedUrl, presigned_url_expires_at: newExpiry })
        .eq('id', id);

      return NextResponse.json({
        data: { ...job, presigned_url: signed.signedUrl, presigned_url_expires_at: newExpiry },
      });
    }
  }

  return NextResponse.json({ data: job });
}
