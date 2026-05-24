import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getApiSession, unauthorised } from '../../../server/auth/api-guard';
import { getRlsAwareClient } from '../../../server/db/client';

const CreateScenarioSchema = z.object({
  label: z.string().min(1),
  property_id: z.string().uuid().optional(),
  portfolio_id: z.string().uuid().optional(),
  input_payload: z.record(z.string(), z.unknown()),
  pinned: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  const sess = await getApiSession();
  if (!sess) return unauthorised();

  const body = await req.json().catch(() => null);
  const parsed = CreateScenarioSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const client = getRlsAwareClient(sess.accessToken);
  const { data, error } = await client
    .from('scenarios')
    .insert({
      label: parsed.data.label,
      property_id: parsed.data.property_id ?? null,
      portfolio_id: parsed.data.portfolio_id ?? null,
      input_payload: parsed.data.input_payload,
      pinned: parsed.data.pinned,
      user_id: sess.userId,
    })
    .select('id, label, property_id, portfolio_id, input_payload, pinned, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
