import { NextResponse } from 'next/server';

import { getApiSession, unauthorised } from '../../../server/auth/api-guard';
import { getPortfolios } from '../../../server/data/portfolios';

export async function GET() {
  const sess = await getApiSession();
  if (!sess) return unauthorised();

  const { data, error } = await getPortfolios(sess);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: data ?? [] });
}
