-- ============================================================================
-- EquityLens — Baseline Schema ROLLBACK  (migration 0001 down)
-- ============================================================================

-- Materialized views
DROP MATERIALIZED VIEW IF EXISTS portfolio_summary;

-- Tables (reverse FK order)
DROP TABLE IF EXISTS scheduled_reports CASCADE;
DROP TABLE IF EXISTS report_jobs CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS ai_interactions CASCADE;
DROP TABLE IF EXISTS scenario_results CASCADE;
DROP TABLE IF EXISTS scenarios CASCADE;
DROP TABLE IF EXISTS depreciation_line_items CASCADE;
DROP TABLE IF EXISTS depreciation_schedules CASCADE;
DROP TABLE IF EXISTS expense_records CASCADE;
DROP TABLE IF EXISTS income_records CASCADE;
DROP TABLE IF EXISTS loans CASCADE;
DROP TABLE IF EXISTS property_ppor_history CASCADE;
DROP TABLE IF EXISTS property_ownership_splits CASCADE;
DROP TABLE IF EXISTS properties CASCADE;
DROP TABLE IF EXISTS portfolios CASCADE;
DROP TABLE IF EXISTS tax_rule_sets CASCADE;
DROP TABLE IF EXISTS usage_events CASCADE;
DROP TABLE IF EXISTS stripe_events CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS user_org_membership CASCADE;
DROP TABLE IF EXISTS organisations CASCADE;

-- Functions
DROP FUNCTION IF EXISTS enforce_ownership_total() CASCADE;
DROP FUNCTION IF EXISTS set_updated_at() CASCADE;

-- Enums
DROP TYPE IF EXISTS audit_action CASCADE;
DROP TYPE IF EXISTS scenario_status CASCADE;
DROP TYPE IF EXISTS depreciation_division CASCADE;
DROP TYPE IF EXISTS income_kind CASCADE;
DROP TYPE IF EXISTS expense_category CASCADE;
DROP TYPE IF EXISTS loan_rate_type CASCADE;
DROP TYPE IF EXISTS loan_type CASCADE;
DROP TYPE IF EXISTS ownership_kind CASCADE;
DROP TYPE IF EXISTS property_type CASCADE;
DROP TYPE IF EXISTS jurisdiction_au CASCADE;
DROP TYPE IF EXISTS org_role CASCADE;
DROP TYPE IF EXISTS subscription_status CASCADE;
DROP TYPE IF EXISTS subscription_tier CASCADE;
