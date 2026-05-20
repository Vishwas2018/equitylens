-- ============================================================================
-- EquityLens — RLS Policies ROLLBACK  (migration 0002 down)
-- ============================================================================

-- Drop policies
DROP POLICY IF EXISTS sr2_all ON scheduled_reports;
DROP POLICY IF EXISTS rj_insert ON report_jobs;
DROP POLICY IF EXISTS rj_select ON report_jobs;
DROP POLICY IF EXISTS audit_select_own ON audit_logs;
DROP POLICY IF EXISTS ai_select_own ON ai_interactions;
DROP POLICY IF EXISTS sr_select ON scenario_results;
DROP POLICY IF EXISTS scenarios_delete ON scenarios;
DROP POLICY IF EXISTS scenarios_update ON scenarios;
DROP POLICY IF EXISTS scenarios_insert ON scenarios;
DROP POLICY IF EXISTS scenarios_select ON scenarios;
DROP POLICY IF EXISTS trs_select ON tax_rule_sets;
DROP POLICY IF EXISTS dep_lines_all ON depreciation_line_items;
DROP POLICY IF EXISTS dep_sch_write ON depreciation_schedules;
DROP POLICY IF EXISTS dep_sch_select ON depreciation_schedules;
DROP POLICY IF EXISTS expense_delete ON expense_records;
DROP POLICY IF EXISTS expense_update ON expense_records;
DROP POLICY IF EXISTS expense_write ON expense_records;
DROP POLICY IF EXISTS expense_select ON expense_records;
DROP POLICY IF EXISTS income_delete ON income_records;
DROP POLICY IF EXISTS income_update ON income_records;
DROP POLICY IF EXISTS income_write ON income_records;
DROP POLICY IF EXISTS income_select ON income_records;
DROP POLICY IF EXISTS loans_delete ON loans;
DROP POLICY IF EXISTS loans_update ON loans;
DROP POLICY IF EXISTS loans_write ON loans;
DROP POLICY IF EXISTS loans_select ON loans;
DROP POLICY IF EXISTS ppor_all ON property_ppor_history;
DROP POLICY IF EXISTS pos_all ON property_ownership_splits;
DROP POLICY IF EXISTS properties_delete ON properties;
DROP POLICY IF EXISTS properties_update ON properties;
DROP POLICY IF EXISTS properties_insert ON properties;
DROP POLICY IF EXISTS properties_select ON properties;
DROP POLICY IF EXISTS portfolios_delete ON portfolios;
DROP POLICY IF EXISTS portfolios_update ON portfolios;
DROP POLICY IF EXISTS portfolios_insert ON portfolios;
DROP POLICY IF EXISTS portfolios_select ON portfolios;
DROP POLICY IF EXISTS usage_select_own ON usage_events;
DROP POLICY IF EXISTS subs_select_own ON subscriptions;
DROP POLICY IF EXISTS uom_delete ON user_org_membership;
DROP POLICY IF EXISTS uom_update ON user_org_membership;
DROP POLICY IF EXISTS uom_insert ON user_org_membership;
DROP POLICY IF EXISTS uom_select ON user_org_membership;
DROP POLICY IF EXISTS org_delete ON organisations;
DROP POLICY IF EXISTS org_update ON organisations;
DROP POLICY IF EXISTS org_insert ON organisations;
DROP POLICY IF EXISTS org_select ON organisations;

-- Disable RLS
ALTER TABLE scheduled_reports   DISABLE ROW LEVEL SECURITY;
ALTER TABLE report_jobs         DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs          DISABLE ROW LEVEL SECURITY;
ALTER TABLE ai_interactions     DISABLE ROW LEVEL SECURITY;
ALTER TABLE scenario_results    DISABLE ROW LEVEL SECURITY;
ALTER TABLE scenarios           DISABLE ROW LEVEL SECURITY;
ALTER TABLE tax_rule_sets       DISABLE ROW LEVEL SECURITY;
ALTER TABLE depreciation_line_items   DISABLE ROW LEVEL SECURITY;
ALTER TABLE depreciation_schedules    DISABLE ROW LEVEL SECURITY;
ALTER TABLE expense_records     DISABLE ROW LEVEL SECURITY;
ALTER TABLE income_records      DISABLE ROW LEVEL SECURITY;
ALTER TABLE loans               DISABLE ROW LEVEL SECURITY;
ALTER TABLE property_ppor_history     DISABLE ROW LEVEL SECURITY;
ALTER TABLE property_ownership_splits DISABLE ROW LEVEL SECURITY;
ALTER TABLE properties          DISABLE ROW LEVEL SECURITY;
ALTER TABLE portfolios          DISABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events        DISABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_events       DISABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions       DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_org_membership DISABLE ROW LEVEL SECURITY;
ALTER TABLE organisations       DISABLE ROW LEVEL SECURITY;

DROP FUNCTION IF EXISTS public.is_org_member(UUID, org_role[]);
