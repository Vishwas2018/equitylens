import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getApiSession, unauthorised } from '../../../server/auth/api-guard';
import { getRlsAwareClient } from '../../../server/db/client';

const CreatePropertySchema = z.object({
  address_line1: z.string().min(1),
  address_line2: z.string().optional(),
  suburb: z.string().min(1),
  state: z.string().min(2).max(3),
  postcode: z.string().regex(/^\d{4}$/),
  purchase_price_cents: z.number().int().positive(),
  status: z.enum(['draft', 'active', 'sold', 'archived']).default('draft'),
});

export async function GET() {
  const sess = await getApiSession();
  if (!sess) return unauthorised();

  const client = getRlsAwareClient(sess.accessToken);
  const { data, error } = await client
    .from('properties')
    .select(
      'id, address_line1, address_line2, suburb, state, postcode, purchase_price_cents, status, created_at',
    )
    .eq('org_id', sess.orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: NextRequest) {
  const sess = await getApiSession();
  if (!sess) return unauthorised();

  const body = await req.json().catch(() => null);
  const parsed = CreatePropertySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const client = getRlsAwareClient(sess.accessToken);
  const { data, error } = await client
    .from('properties')
    .insert({
      ...parsed.data,
      org_id: sess.orgId,
      user_id: sess.userId,
    })
    .select(
      'id, address_line1, address_line2, suburb, state, postcode, purchase_price_cents, status, created_at',
    )
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
