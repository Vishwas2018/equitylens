-- ============================================================================
-- EquityLens — PostgreSQL DDL
-- ----------------------------------------------------------------------------
-- Engine: PostgreSQL 15+ (Supabase)
-- Conventions:
--   * snake_case names, plural tables
--   * UUIDv7 PKs (gen_random_uuid as fallback)
--   * All monetary values stored as BIGINT cents (no FLOAT for money)
--   * All timestamps TIMESTAMPTZ, default now()
--   * Soft delete via deleted_at where appropriate
--   * Append-only tables marked with comment "APPEND-ONLY"
--   * RLS policies live in rls-policies.sql
-- ============================================================================

-- Extensions ----------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_partman;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Enums ---------------------------------------------------------------------
CREATE TYPE subscription_tier        AS ENUM ('free','pro','professional');
CREATE TYPE subscription_status      AS ENUM ('trialing','active','past_due','cancelled','incomplete');
CREATE TYPE org_role                 AS ENUM ('owner','admin','accountant','viewer');
CREATE TYPE jurisdiction_au          AS ENUM ('VIC','NSW','QLD','WA','SA','TAS','ACT','NT');
CREATE TYPE property_type            AS ENUM ('house','apartment','townhouse','land','commercial');
CREATE TYPE ownership_kind           AS ENUM ('individual','joint','tenants_in_common','trust','company');
CREATE TYPE loan_type                AS ENUM ('principal_and_interest','interest_only');
CREATE TYPE loan_rate_type           AS ENUM ('variable','fixed','split');
CREATE TYPE expense_category         AS ENUM (
  'council_rates','water_rates','insurance','property_management',
  'maintenance','strata','land_tax','agent_letting','advertising',
  'gardening','pest_control','accounting_fees','other'
);
CREATE TYPE income_kind              AS ENUM ('rent','bond_drawdown','other');
CREATE TYPE depreciation_division    AS ENUM ('div_40','div_43');
CREATE TYPE scenario_status          AS ENUM ('pending','completed','failed');
CREATE TYPE audit_action             AS ENUM (
  'create','update','delete','login','logout','export','scenario_run',
  'subscription_change','rls_deny','admin_recompute'
);

-- ===========================================================================
-- 1. ORGANISATIONS & MEMBERSHIPS
-- ===========================================================================

CREATE TABLE organisations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  abn            TEXT,
  created_by     UUID NOT NULL,                  -- references auth.users
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ,
  CONSTRAINT abn_format CHECK (abn IS NULL OR abn ~ '^\d{11}$')
);
COMMENT ON TABLE organisations IS 'Workspaces. Personal accounts have an implicit org of size 1.';

CREATE TABLE user_org_membership (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,                      -- auth.users.id
  org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  role        org_role NOT NULL DEFAULT 'owner',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, org_id)
);
CREATE INDEX idx_uom_user ON user_org_membership(user_id);
CREATE INDEX idx_uom_org  ON user_org_membership(org_id);

-- ===========================================================================
-- 2. SUBSCRIPTIONS
-- ===========================================================================

CREATE TABLE subscriptions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL UNIQUE,
  stripe_customer_id       TEXT UNIQUE,
  stripe_subscription_id   TEXT UNIQUE,
  tier                     subscription_tier NOT NULL DEFAULT 'free',
  status                   subscription_status NOT NULL DEFAULT 'active',
  trial_ends_at            TIMESTAMPTZ,
  current_period_start     TIMESTAMPTZ,
  current_period_end       TIMESTAMPTZ,
  cancel_at_period_end     BOOLEAN NOT NULL DEFAULT FALSE,
  seat_count               SMALLINT NOT NULL DEFAULT 1,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_subscriptions_status ON subscriptions(status) WHERE status != 'active';

CREATE TABLE stripe_events (
  event_id    TEXT PRIMARY KEY,
  event_type  TEXT NOT NULL,
  payload     JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed   BOOLEAN NOT NULL DEFAULT FALSE
);
COMMENT ON TABLE stripe_events IS 'Idempotency ledger. APPEND-ONLY.';

CREATE TABLE usage_events (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID NOT NULL,
  entitlement  TEXT NOT NULL,                    -- 'scenario.run' etc
  period_key   TEXT NOT NULL,                    -- e.g. '2026-02' for monthly
  qty          INTEGER NOT NULL DEFAULT 1,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_usage_lookup ON usage_events(user_id, entitlement, period_key);

-- ===========================================================================
-- 3. PORTFOLIOS & PROPERTIES
-- ===========================================================================

CREATE TABLE portfolios (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL,
  name        TEXT NOT NULL DEFAULT 'My portfolio',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX idx_portfolios_user ON portfolios(user_id);
CREATE INDEX idx_portfolios_org  ON portfolios(org_id);

CREATE TABLE properties (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id             UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  org_id                   UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id                  UUID NOT NULL,
  address_line1            TEXT NOT NULL,
  address_line2            TEXT,
  suburb                   TEXT NOT NULL,
  state                    jurisdiction_au NOT NULL,
  postcode                 CHAR(4) NOT NULL CHECK (postcode ~ '^\d{4}$'),
  property_type            property_type NOT NULL,
  purchase_date            DATE NOT NULL,
  purchase_price_cents     BIGINT NOT NULL CHECK (purchase_price_cents > 0),
  stamp_duty_paid_cents    BIGINT NOT NULL DEFAULT 0 CHECK (stamp_duty_paid_cents >= 0),
  acquisition_costs_cents  BIGINT NOT NULL DEFAULT 0 CHECK (acquisition_costs_cents >= 0),
  current_estimated_value_cents BIGINT,
  ownership_kind           ownership_kind NOT NULL DEFAULT 'individual',
  status                   TEXT NOT NULL DEFAULT 'active'
                           CHECK (status IN ('draft','active','sold','archived')),
  notes                    TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at               TIMESTAMPTZ
);
CREATE INDEX idx_properties_user      ON properties(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_properties_portfolio ON properties(portfolio_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_properties_state     ON properties(state);
CREATE INDEX idx_properties_search    ON properties USING gin (address_line1 gin_trgm_ops, suburb gin_trgm_ops);

CREATE TABLE property_ownership_splits (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id  UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  owner_label  TEXT NOT NULL,                     -- 'Spouse A', 'Trust XYZ', etc
  user_id      UUID,                              -- optional: link to a real user
  percentage   NUMERIC(7,4) NOT NULL CHECK (percentage > 0 AND percentage <= 100),
  marginal_rate_pct NUMERIC(5,4) CHECK (marginal_rate_pct >= 0 AND marginal_rate_pct <= 1),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pos_property ON property_ownership_splits(property_id);

-- Enforce splits sum to 100 via deferred trigger
CREATE OR REPLACE FUNCTION enforce_ownership_total() RETURNS TRIGGER AS $$
DECLARE total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(percentage),0) INTO total
  FROM property_ownership_splits
  WHERE property_id = COALESCE(NEW.property_id, OLD.property_id);
  IF ABS(total - 100) > 0.001 THEN
    RAISE EXCEPTION 'Ownership splits must total exactly 100%% (got %)', total;
  END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_ownership_total
  AFTER INSERT OR UPDATE OR DELETE ON property_ownership_splits
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION enforce_ownership_total();

CREATE TABLE property_ppor_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id  UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  from_date    DATE NOT NULL,
  to_date      DATE,                              -- NULL = current
  CHECK (to_date IS NULL OR to_date >= from_date)
);
CREATE INDEX idx_ppor_property ON property_ppor_history(property_id);

-- ===========================================================================
-- 4. LOANS
-- ===========================================================================

CREATE TABLE loans (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id         UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL,
  lender              TEXT,
  account_label       TEXT,
  loan_type           loan_type NOT NULL,
  rate_type           loan_rate_type NOT NULL DEFAULT 'variable',
  principal_cents     BIGINT NOT NULL CHECK (principal_cents > 0),
  current_balance_cents BIGINT NOT NULL CHECK (current_balance_cents >= 0),
  interest_rate_pct   NUMERIC(6,5) NOT NULL CHECK (interest_rate_pct >= 0 AND interest_rate_pct < 0.5),
  term_months         INTEGER NOT NULL CHECK (term_months > 0 AND term_months <= 600),
  io_expiry_date      DATE,                      -- if interest_only
  fixed_until_date    DATE,                      -- if fixed
  offset_balance_cents BIGINT NOT NULL DEFAULT 0 CHECK (offset_balance_cents >= 0),
  split_of_loan_id    UUID REFERENCES loans(id), -- when one loan is split
  start_date          DATE NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ,
  CONSTRAINT io_requires_expiry CHECK (loan_type != 'interest_only' OR io_expiry_date IS NOT NULL),
  CONSTRAINT fixed_requires_until CHECK (rate_type != 'fixed' OR fixed_until_date IS NOT NULL)
);
CREATE INDEX idx_loans_property ON loans(property_id);
CREATE INDEX idx_loans_user     ON loans(user_id);

-- ===========================================================================
-- 5. INCOME & EXPENSE RECORDS
-- ===========================================================================

CREATE TABLE income_records (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL,
  kind          income_kind NOT NULL DEFAULT 'rent',
  period_start  DATE NOT NULL,
  period_end    DATE NOT NULL,
  amount_cents  BIGINT NOT NULL CHECK (amount_cents >= 0),
  weekly_rate_cents BIGINT,                       -- derived helper
  vacancy_days  INTEGER NOT NULL DEFAULT 0 CHECK (vacancy_days >= 0 AND vacancy_days <= 366),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start)
);
CREATE INDEX idx_income_property_period ON income_records(property_id, period_start DESC);

CREATE TABLE expense_records (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL,
  category      expense_category NOT NULL,
  description   TEXT,
  incurred_date DATE NOT NULL,
  amount_cents  BIGINT NOT NULL CHECK (amount_cents >= 0),
  is_capital    BOOLEAN NOT NULL DEFAULT FALSE,   -- if capital improvement (not deductible immediately)
  gst_inclusive BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_expense_property_date ON expense_records(property_id, incurred_date DESC);
CREATE INDEX idx_expense_category      ON expense_records(category);

-- ===========================================================================
-- 6. DEPRECIATION SCHEDULES
-- ===========================================================================

CREATE TABLE depreciation_schedules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL,
  qs_provider     TEXT,                           -- 'BMT', 'Washington Brown', etc
  effective_date  DATE NOT NULL,
  source_file_url TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE depreciation_line_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id        UUID NOT NULL REFERENCES depreciation_schedules(id) ON DELETE CASCADE,
  division           depreciation_division NOT NULL,
  description        TEXT NOT NULL,
  cost_cents         BIGINT NOT NULL CHECK (cost_cents >= 0),
  effective_life_years NUMERIC(6,2),
  method             TEXT NOT NULL CHECK (method IN ('prime_cost','diminishing_value','straight_line')),
  rate_pct           NUMERIC(6,5),
  starts_on          DATE NOT NULL,
  ends_on            DATE,                        -- NULL until fully depreciated
  CONSTRAINT div40_has_life CHECK (division != 'div_40' OR effective_life_years IS NOT NULL),
  CONSTRAINT div43_method CHECK (division != 'div_43' OR method = 'straight_line')
);
CREATE INDEX idx_dep_lines_schedule ON depreciation_line_items(schedule_id);

-- ===========================================================================
-- 7. TAX RULE SETS (versioned)
-- ===========================================================================

CREATE TABLE tax_rule_sets (
  id              TEXT PRIMARY KEY,               -- 'trs_FY2026_VIC_v3'
  financial_year  CHAR(6) NOT NULL CHECK (financial_year ~ '^FY\d{4}$'),
  jurisdiction    jurisdiction_au NOT NULL,
  version         INTEGER NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('draft','staged','published','archived')),
  effective_from  DATE NOT NULL,
  effective_to    DATE,
  rules           JSONB NOT NULL,                 -- see /engine/tax-rule-versioning.md
  authored_by     UUID NOT NULL,
  reviewed_by     UUID,
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (financial_year, jurisdiction, version)
);
COMMENT ON TABLE tax_rule_sets IS 'APPEND-ONLY once published. Updates only allowed when status=draft|staged.';

-- ===========================================================================
-- 8. SCENARIOS & RESULTS (partitioned)
-- ===========================================================================

CREATE TABLE scenarios (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  portfolio_id    UUID REFERENCES portfolios(id) ON DELETE CASCADE,
  property_id     UUID REFERENCES properties(id) ON DELETE CASCADE,
  label           TEXT,
  input_payload   JSONB NOT NULL,                 -- ScenarioInput Zod-validated
  pinned          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_scenarios_user ON scenarios(user_id, created_at DESC);

-- Partitioned by month on created_at for retention + query performance
CREATE TABLE scenario_results (
  id                    UUID         NOT NULL DEFAULT gen_random_uuid(),
  scenario_id           UUID         NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  user_id               UUID         NOT NULL,
  tax_rule_set_id       TEXT         NOT NULL REFERENCES tax_rule_sets(id),
  input_hash            TEXT         NOT NULL,    -- blake3 of canonical input
  engine_version        TEXT         NOT NULL,    -- semver of calc engine
  status                scenario_status NOT NULL DEFAULT 'pending',
  result_payload        JSONB        NOT NULL DEFAULT '{}'::jsonb,
  duration_ms           INTEGER,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
COMMENT ON TABLE scenario_results IS 'APPEND-ONLY. Each row is a deterministic snapshot.';

CREATE INDEX idx_scenario_results_user ON scenario_results(user_id, created_at DESC);
CREATE INDEX idx_scenario_results_hash ON scenario_results(input_hash);

-- Bootstrap partitions for 24 months; pg_partman maintains thereafter
SELECT partman.create_parent(
  p_parent_table   => 'public.scenario_results',
  p_control        => 'created_at',
  p_type           => 'native',
  p_interval       => 'monthly',
  p_premake        => 6
);

-- ===========================================================================
-- 9. AI INTERACTIONS (see /architecture/ai-integration.md)
-- ===========================================================================

CREATE TABLE ai_interactions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL,
  scenario_result_id  UUID NOT NULL,
  template_id         TEXT NOT NULL,
  model               TEXT NOT NULL,
  prompt_hash         TEXT NOT NULL,
  context_hash        TEXT NOT NULL,
  response_raw        JSONB NOT NULL,
  schema_valid        BOOLEAN NOT NULL,
  leak_detected       BOOLEAN NOT NULL,
  fallback_used       BOOLEAN NOT NULL,
  latency_ms          INTEGER NOT NULL,
  tokens_in           INTEGER NOT NULL,
  tokens_out          INTEGER NOT NULL,
  cost_cents          INTEGER NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE ai_interactions IS 'APPEND-ONLY.';
CREATE INDEX idx_ai_user_time ON ai_interactions(user_id, created_at DESC);
CREATE INDEX idx_ai_fallback  ON ai_interactions(created_at) WHERE fallback_used = TRUE;

-- ===========================================================================
-- 10. AUDIT LOGS (partitioned, APPEND-ONLY)
-- ===========================================================================

CREATE TABLE audit_logs (
  id           UUID         NOT NULL DEFAULT gen_random_uuid(),
  occurred_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  actor_user_id UUID,
  actor_email  TEXT,
  actor_ip     INET,
  org_id       UUID,
  action       audit_action NOT NULL,
  entity_type  TEXT NOT NULL,
  entity_id    UUID,
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  request_id   TEXT,
  PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);

CREATE INDEX idx_audit_actor ON audit_logs(actor_user_id, occurred_at DESC);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_action ON audit_logs(action);

SELECT partman.create_parent(
  p_parent_table   => 'public.audit_logs',
  p_control        => 'occurred_at',
  p_type           => 'native',
  p_interval       => 'monthly',
  p_premake        => 6
);

-- ===========================================================================
-- 11. REPORTS & EXPORTS
-- ===========================================================================

CREATE TABLE report_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  template_id     TEXT NOT NULL,
  format          TEXT NOT NULL CHECK (format IN ('pdf','csv')),
  scope           JSONB NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','running','completed','failed')),
  storage_path    TEXT,
  sha256          TEXT,
  error_detail    TEXT,
  requested_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);
CREATE INDEX idx_report_jobs_user ON report_jobs(user_id, requested_at DESC);

CREATE TABLE scheduled_reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL,
  template_id   TEXT NOT NULL,
  cadence       TEXT NOT NULL CHECK (cadence IN ('monthly','quarterly','annual')),
  next_run_at   TIMESTAMPTZ NOT NULL,
  enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================================================
-- 12. UPDATED_AT TRIGGER (one trigger fits all)
-- ===========================================================================

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$ LANGUAGE plpgsql;

DO $$ DECLARE r RECORD; BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND a.attname = 'updated_at'
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_set_updated_at ON public.%I;
       CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at();', r.relname, r.relname);
  END LOOP;
END $$;

-- ===========================================================================
-- 13. MATERIALISED VIEW: portfolio summary (refreshed by trigger or cron)
-- ===========================================================================

CREATE MATERIALIZED VIEW portfolio_summary AS
SELECT
  p.id            AS portfolio_id,
  p.user_id,
  COUNT(prop.id) FILTER (WHERE prop.deleted_at IS NULL) AS active_properties,
  COALESCE(SUM(prop.current_estimated_value_cents),0)   AS total_value_cents,
  COALESCE(SUM(l.current_balance_cents),0)              AS total_debt_cents,
  COALESCE(SUM(prop.current_estimated_value_cents
               - COALESCE(l.current_balance_cents,0)),0) AS estimated_equity_cents
FROM portfolios p
LEFT JOIN properties prop ON prop.portfolio_id = p.id AND prop.deleted_at IS NULL
LEFT JOIN loans l         ON l.property_id    = prop.id AND l.deleted_at IS NULL
GROUP BY p.id;

CREATE UNIQUE INDEX idx_portfolio_summary_pk ON portfolio_summary(portfolio_id);

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
