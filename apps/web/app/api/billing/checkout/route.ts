import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getApiSession, unauthorised } from '../../../../server/auth/api-guard';
import { getStripeClient } from '../../../../server/billing/client';

const CheckoutBodySchema = z.object({
  priceId: z.string().min(1),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

export async function POST(req: NextRequest) {
  const sess = await getApiSession();
  if (!sess) return unauthorised();

  let stripe;
  try {
    stripe = getStripeClient();
  } catch {
    return NextResponse.json({ error: 'Billing not configured' }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const parsed = CheckoutBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { priceId, successUrl, cancelUrl } = parsed.data;

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { userId: sess.userId },
    subscription_data: { metadata: { userId: sess.userId } },
  });

  return NextResponse.json({ url: session.url }, { status: 201 });
}
