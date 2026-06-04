import type { SupabaseClient } from '@supabase/supabase-js';

export type SubscriptionTier = 'free' | 'pro' | 'professional';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'cancelled' | 'incomplete';

export interface Entitlement {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  /** true when tier is paid AND status is active or trialing */
  active: boolean;
}

export async function getEntitlement(userId: string, client: SupabaseClient): Promise<Entitlement> {
  const { data } = await client
    .from('subscriptions')
    .select('tier, status')
    .eq('user_id', userId)
    .maybeSingle();

  const tier = (data?.tier ?? 'free') as SubscriptionTier;
  const status = (data?.status ?? 'active') as SubscriptionStatus;
  const active = tier !== 'free' && (status === 'active' || status === 'trialing');

  return { tier, status, active };
}
