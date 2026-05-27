import { NextRequest, NextResponse } from 'next/server';

import { getApiSession, notFound, unauthorised } from '../../../../server/auth/api-guard';
import { getProperty } from '../../../../server/data/properties';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sess = await getApiSession();
  if (!sess) return unauthorised();

  const { data, error } = await getProperty(id, sess);
  if (error || !data) return notFound();

  return NextResponse.json({ data });
}
