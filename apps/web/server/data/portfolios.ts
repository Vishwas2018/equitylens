import type { ApiSession } from '../auth/api-guard';
import { getRlsAwareClient } from '../db/client';

export async function getPortfolios(sess: ApiSession) {
  return getRlsAwareClient(sess.accessToken)
    .from('portfolios')
    .select('id, name, created_at, updated_at')
    .eq('org_id', sess.orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
}

export async function getPortfolioSummary(portfolioId: string, sess: ApiSession) {
  return getRlsAwareClient(sess.accessToken)
    .from('portfolio_summary')
    .select(
      'portfolio_id, user_id, active_properties, total_value_cents, total_debt_cents, estimated_equity_cents',
    )
    .eq('portfolio_id', portfolioId)
    .eq('user_id', sess.userId)
    .single();
}
