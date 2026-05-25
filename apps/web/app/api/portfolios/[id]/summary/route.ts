import { NextRequest, NextResponse } from 'next/server';

import { getApiSession, notFound, unauthorised } from '../../../../../server/auth/api-guard';
import { getPortfolioSummary } from '../../../../../server/data/portfolios';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const sess = await getApiSession();
  if (!sess) return unauthorised();

  const { data, error } = await getPortfolioSummary(params.id, sess);
  if (error || !data) return notFound();

  return NextResponse.json({ data });
}
