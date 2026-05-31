import { NextRequest, NextResponse } from 'next/server';

import { getApiSession, notFound, unauthorised } from '../../../../../server/auth/api-guard';
import { getPortfolioSummary } from '../../../../../server/data/portfolios';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sess = await getApiSession();
  if (!sess) return unauthorised();

  const { data, error } = await getPortfolioSummary(id, sess);
  if (error || !data) return notFound();

  return NextResponse.json({ data });
}
