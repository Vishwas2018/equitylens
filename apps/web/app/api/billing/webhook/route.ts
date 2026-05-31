import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

import { getSupabaseAdmin } from '../../../../server/db/client';

// App Router reads raw body via req.text() — no bodyParser config needed.

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sig = req.headers.get('stripe-signature') ?? '';

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeKey = process.env.STRIPE_SECRET_KEY;

  if (!webhookSecret || !stripeKey) {
    return NextResponse.json({ error: 'Billing webhook not configured' }, { status: 503 });
  }

  // Signature verification is UNCONDITIONAL — reject unsigned or tampered payloads
  // before any business logic runs. This is the security boundary; it cannot be
  // env-gated or skipped.
  let event: Stripe.Event;
  try {
    const stripe = new Stripe(stripeKey);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    return NextResponse.json(
      { error: `Signature verification failed: ${(err as Error).message}` },
      { status: 400 },
    );
  }

  const admin = getSupabaseAdmin();

  // Idempotency: skip events already recorded as processed.
  const { data: existing } = await admin
    .from('stripe_events')
    .select('event_id')
    .eq('event_id', event.id)
    .eq('processed', true)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  // Append to the event ledger before processing.
  await admin.from('stripe_events').upsert(
    {
      event_id: event.id,
      event_type: event.type,
      payload: event as unknown as Record<string, unknown>,
      processed: false,
    },
    { onConflict: 'event_id' },
  );

  await handleEvent(event, admin);

  await admin.from('stripe_events').update({ processed: true }).eq('event_id', event.id);

  return NextResponse.json({ received: true });
}

async function handleEvent(
  event: Stripe.Event,
  admin: ReturnType<typeof getSupabaseAdmin>,
): Promise<void> {
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.userId;
      if (!userId) return;

      const customerId =
        typeof sub.customer === 'string' ? sub.customer : (sub.customer as Stripe.Customer).id;

      await admin.from('subscriptions').upsert(
        {
          user_id: userId,
          stripe_customer_id: customerId,
          stripe_subscription_id: sub.id,
          tier: resolveTier(sub),
          status: sub.status,
          trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
          cancel_at_period_end: sub.cancel_at_period_end,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.userId;
      if (!userId) return;

      await admin
        .from('subscriptions')
        .update({ tier: 'free', status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('user_id', userId);
      break;
    }
  }
}

function resolveTier(sub: Stripe.Subscription): 'pro' | 'professional' {
  const meta = sub.items.data[0]?.price?.metadata ?? {};
  return meta['tier'] === 'professional' ? 'professional' : 'pro';
}
