/**
 * Billing webhook tests — two distinct concerns:
 *
 * 1. Signature verification (no skipIf — pure crypto, no live Stripe key needed).
 *    Uses a deterministic test secret + Stripe's generateTestHeaderString helper.
 *    This is the security assertion: a tampered or unsigned payload must be rejected
 *    before any DB write. It MUST run in CI always.
 *
 * 2. Live Stripe path (skipIf no STRIPE_SECRET_KEY). Requires a real Stripe test-mode
 *    key. If this block skips in CI, BL-0032 tracks it as an open gap.
 */
import Stripe from 'stripe';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// ── constants ─────────────────────────────────────────────────────────────────

const TEST_WEBHOOK_SECRET = 'whsec_test_equitylens_unit_test_secret_00000000000000000';
const TEST_STRIPE_KEY = 'sk_test_unit_test_key_placeholder';

// Minimal stub matching the fields the handler actually reads.
const SAMPLE_SUB = {
  id: 'sub_test123',
  status: 'active',
  customer: 'cus_test123',
  metadata: { userId: '00000000-0000-0000-0000-000000000001' },
  cancel_at_period_end: false,
  trial_end: null,
  items: {
    object: 'list',
    data: [
      {
        id: 'si_test',
        object: 'subscription_item',
        price: { id: 'price_test', object: 'price', metadata: { tier: 'pro' } },
      },
    ],
    has_more: false,
    url: '',
  },
};

// ── helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: string, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/billing/webhook', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function buildSignedRequest(payload: string, secret = TEST_WEBHOOK_SECRET): Request {
  const timestamp = Math.floor(Date.now() / 1000);
  const sig = Stripe.webhooks.generateTestHeaderString({ payload, secret, timestamp });
  return makeRequest(payload, { 'stripe-signature': sig });
}

// ── Mock Supabase admin — avoids real DB calls ────────────────────────────────

const mockUpsert = vi.fn().mockResolvedValue({ error: null });
const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
const mockSelect = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  }),
});
const mockFrom = vi.fn().mockReturnValue({
  select: mockSelect,
  upsert: mockUpsert,
  update: mockUpdate,
});

vi.mock('../server/db/client', () => ({
  getSupabaseAdmin: () => ({ from: mockFrom }),
}));

// ── 1. Signature verification — NO skipIf, always runs ───────────────────────

describe('webhook signature verification (pure crypto — always runs)', () => {
  beforeAll(() => {
    vi.stubEnv('STRIPE_SECRET_KEY', TEST_STRIPE_KEY);
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', TEST_WEBHOOK_SECRET);
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it('returns 400 when stripe-signature header is missing', async () => {
    const { POST } = await import('../app/api/billing/webhook/route');
    const payload = JSON.stringify({ id: 'evt_test', type: 'ping' });
    const res = await POST(makeRequest(payload) as never);
    expect(res.status).toBe(400);
  });

  it('returns 400 when signature is from a different secret', async () => {
    const { POST } = await import('../app/api/billing/webhook/route');
    const payload = JSON.stringify({ id: 'evt_test', type: 'ping' });
    const wrongSig = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret: 'whsec_wrong_secret_0000000000000000000000000000000',
      timestamp: Math.floor(Date.now() / 1000),
    });
    const res = await POST(makeRequest(payload, { 'stripe-signature': wrongSig }) as never);
    expect(res.status).toBe(400);
  });

  it('returns 400 when payload is tampered after signing', async () => {
    const { POST } = await import('../app/api/billing/webhook/route');
    const originalPayload = JSON.stringify({ id: 'evt_test', type: 'ping' });
    const sig = Stripe.webhooks.generateTestHeaderString({
      payload: originalPayload,
      secret: TEST_WEBHOOK_SECRET,
      timestamp: Math.floor(Date.now() / 1000),
    });
    const res = await POST(
      makeRequest(JSON.stringify({ id: 'evt_test', type: 'INJECTED' }), {
        'stripe-signature': sig,
      }) as never,
    );
    expect(res.status).toBe(400);
  });

  it('does NOT return 400 when signature is valid', async () => {
    const { POST } = await import('../app/api/billing/webhook/route');
    const payload = JSON.stringify({
      id: 'evt_unit_valid',
      type: 'customer.subscription.updated',
      data: { object: SAMPLE_SUB },
    });
    const res = await POST(buildSignedRequest(payload) as never);
    // Sig passed — handler proceeds to business logic (DB mocked); result is not 400.
    expect(res.status).not.toBe(400);
  });
});

// ── 2. 503 when secrets are not configured ────────────────────────────────────

describe('webhook 503 when billing not configured', () => {
  beforeAll(() => {
    vi.stubEnv('STRIPE_SECRET_KEY', '');
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', '');
  });
  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it('returns 503 when STRIPE_SECRET_KEY is absent', async () => {
    const { POST } = await import('../app/api/billing/webhook/route');
    const res = await POST(makeRequest('{}') as never);
    expect(res.status).toBe(503);
  });
});

// ── 3. Live Stripe path — skipIf no key ──────────────────────────────────────
// Requires STRIPE_SECRET_KEY (test-mode). If absent in CI → BL-0032 (untested gap).

const hasStripeKey = !!process.env['STRIPE_SECRET_KEY'];

describe.skipIf(!hasStripeKey)('live stripe checkout (requires STRIPE_SECRET_KEY)', () => {
  beforeAll(() => {
    vi.mock('../server/auth/api-guard', () => ({
      getApiSession: vi.fn().mockResolvedValue(null),
      unauthorised: () => new Response(JSON.stringify({ error: 'Unauthorised' }), { status: 401 }),
      notFound: () => new Response(JSON.stringify({ error: 'Not found' }), { status: 404 }),
    }));
  });

  it('checkout POST returns 401 when unauthenticated', async () => {
    const { POST } = await import('../app/api/billing/checkout/route');
    const res = await POST(
      new Request('http://localhost/api/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({
          priceId: 'price_test',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
        }),
        headers: { 'content-type': 'application/json' },
      }) as never,
    );
    expect(res.status).toBe(401);
  });
});
