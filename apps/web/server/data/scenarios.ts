import type { ApiSession } from '../auth/api-guard';
import { getRlsAwareClient } from '../db/client';

export interface ScenarioRow {
  id: string;
  label: string;
  property_id: string | null;
  portfolio_id: string | null;
  input_payload: Record<string, unknown>;
  pinned: boolean;
  created_at: string;
}

export interface ScenarioOwnerResult {
  entityType: string;
  shareBps: number;
  ownerGrossGainCents: string;
  ownerLossesAppliedCents: string;
  ownerGainAfterLossesCents: string;
  ownerDiscountAppliedCents: string;
  ownerTaxableGainCents: string;
  ownerCarryForwardLossCents: string;
}

export interface ScenarioResultPayload {
  daysHeld: number;
  isPreCgtAsset: boolean;
  totalCostBaseCents: string;
  netProceedsCents: string;
  grossGainCents: string;
  isCapitalLoss: boolean;
  discountEligible: boolean;
  owners: ScenarioOwnerResult[];
  ruleset_status: 'draft' | 'staged' | 'published' | 'retired';
  output_hash: string;
}

export interface ScenarioResultRow {
  id: string;
  scenario_id: string;
  tax_rule_set_id: string;
  engine_version: string;
  status: string;
  result_payload: ScenarioResultPayload;
  duration_ms: number;
  created_at: string;
}

const SCENARIO_FIELDS = 'id, label, property_id, portfolio_id, input_payload, pinned, created_at';
const RESULT_FIELDS =
  'id, scenario_id, tax_rule_set_id, engine_version, status, result_payload, duration_ms, created_at';

export async function getScenarios(sess: ApiSession) {
  const result = await getRlsAwareClient(sess.accessToken)
    .from('scenarios')
    .select('id, label, property_id, portfolio_id, pinned, created_at')
    .eq('user_id', sess.userId)
    .order('created_at', { ascending: false });
  return { data: (result.data ?? []) as unknown as ScenarioRow[], error: result.error };
}

export async function getScenario(scenarioId: string, sess: ApiSession) {
  const result = await getRlsAwareClient(sess.accessToken)
    .from('scenarios')
    .select(SCENARIO_FIELDS)
    .eq('id', scenarioId)
    .eq('user_id', sess.userId)
    .single();
  return { data: result.data as unknown as ScenarioRow | null, error: result.error };
}

export async function getLatestScenarioResult(scenarioId: string, sess: ApiSession) {
  const result = await getRlsAwareClient(sess.accessToken)
    .from('scenario_results')
    .select(RESULT_FIELDS)
    .eq('scenario_id', scenarioId)
    .eq('user_id', sess.userId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false });
  const rows = (result.data ?? []) as unknown as ScenarioResultRow[];
  return { data: rows[0] ?? null, error: result.error };
}
