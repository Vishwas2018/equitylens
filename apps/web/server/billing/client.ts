import Stripe from 'stripe';

let _stripe: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
    // Closed-beta guard: live keys are forbidden until beta is lifted (D16-A6).
    if (!key.startsWith('sk_test_')) {
      throw new Error('STRIPE_SECRET_KEY must be a test-mode key (sk_test_...) during closed beta');
    }
    _stripe = new Stripe(key);
  }
  return _stripe;
}
