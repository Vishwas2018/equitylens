import { NextRequest, NextResponse } from 'next/server';

import { getApiSession, notFound, unauthorised } from '../../../../server/auth/api-guard';
import { getRlsAwareClient } from '../../../../server/db/client';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sess = await getApiSession();
  if (!sess) return unauthorised();

  const client = getRlsAwareClient(sess.accessToken);
  const { data, error } = await client
    .from('scenarios')
    .select('id, label, property_id, portfolio_id, input_payload, pinned, created_at')
    .eq('id', id)
    .eq('user_id', sess.userId)
    .single();

  if (error || !data) return notFound();
  return NextResponse.json({ data });
}
