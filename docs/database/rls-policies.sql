-- ============================================================================
-- EquityLens — Row-Level Security Policies
-- ----------------------------------------------------------------------------
-- Conventions:
--   * Every multi-tenant table: ENABLE + FORCE RLS.
--   * Two predicate idioms:
--       (a) personal:  user_id = auth.uid()
--       (b) org-scoped: EXISTS (SELECT 1 FROM user_org_membership uom
--                               WHERE uom.user_id = auth.uid()
--                                 AND uom.org_id  = <table>.org_id
--                                 AND uom.role    = ANY(allowed_roles))
--   * Append-only tables (audit_logs, scenario_results, ai_interactions,
--     stripe_events, tax_rule_sets when published) have NO update/delete
--     policy for authenticated role.
--   * service_role bypasses RLS by default in Supabase; we still write
--     policies for it so DB-level introspection is complete.
-- ============================================================================

-- Helper: is user an org member with one of the given roles?
CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id UUID, p_roles org_role[])
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_org_membership
    WHERE user_id = auth.uid()
      AND org_id  = p_org_id
      AND role    = ANY(p_roles)
  );
$$;
REVOKE ALL ON FUNCTION public.is_org_member(UUID, org_role[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_org_member(UUID, org_role[]) TO authenticated;

-- ===========================================================================
-- 1. ORGANISATIONS
-- ===========================================================================

ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisations FORCE  ROW LEVEL SECURITY;

CREATE POLICY org_select ON organisations
  FOR SELECT TO authenticated
  USING ( is_org_member(id, ARRAY['owner','admin','accountant','viewer']::org_role[]) );

CREATE POLICY org_insert ON organisations
  FOR INSERT TO authenticated
  WITH CHECK ( created_by = auth.uid() );

CREATE POLICY org_update ON organisations
  FOR UPDATE TO authenticated
  USING ( is_org_member(id, ARRAY['owner','admin']::org_role[]) )
  WITH CHECK ( is_org_member(id, ARRAY['owner','admin']::org_role[]) );

CREATE POLICY org_delete ON organisations
  FOR DELETE TO authenticated
  USING ( is_org_member(id, ARRAY['owner']::org_role[]) );

-- ===========================================================================
-- 2. MEMBERSHIPS
-- ===========================================================================

ALTER TABLE user_org_membership ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_org_membership FORCE  ROW LEVEL SECURITY;

CREATE POLICY uom_select ON user_org_membership
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR is_org_member(org_id, ARRAY['owner','admin']::org_role[])
  );

CREATE POLICY uom_insert ON user_org_membership
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Org owners may invite; or a user may insert their own membership when accepting an invite token (validated server-side)
    is_org_member(org_id, ARRAY['owner','admin']::org_role[])
  );

CREATE POLICY uom_update ON user_org_membership
  FOR UPDATE TO authenticated
  USING ( is_org_member(org_id, ARRAY['owner','admin']::org_role[]) )
  WITH CHECK ( is_org_member(org_id, ARRAY['owner','admin']::org_role[]) );

CREATE POLICY uom_delete ON user_org_membership
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR is_org_member(org_id, ARRAY['owner','admin']::org_role[])
  );

-- ===========================================================================
-- 3. SUBSCRIPTIONS  (read-only to user; writes via service_role only)
-- ===========================================================================

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions FORCE  ROW LEVEL SECURITY;

CREATE POLICY subs_select_own ON subscriptions
  FOR SELECT TO authenticated USING ( user_id = auth.uid() );

-- No INSERT/UPDATE/DELETE policy for authenticated; only service_role writes.

ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_events FORCE  ROW LEVEL SECURITY;
-- No policies → authenticated cannot access; service_role only.

ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events FORCE  ROW LEVEL SECURITY;

CREATE POLICY usage_select_own ON usage_events
  FOR SELECT TO authenticated USING ( user_id = auth.uid() );
-- No INSERT for authenticated; engine middleware writes via service_role.

-- ===========================================================================
-- 4. PORTFOLIOS
-- ===========================================================================

ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolios FORCE  ROW LEVEL SECURITY;

CREATE POLICY portfolios_select ON portfolios
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR is_org_member(org_id, ARRAY['owner','admin','accountant','viewer']::org_role[])
  );

CREATE POLICY portfolios_insert ON portfolios
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND is_org_member(org_id, ARRAY['owner','admin']::org_role[])
  );

CREATE POLICY portfolios_update ON portfolios
  FOR UPDATE TO authenticated
  USING ( user_id = auth.uid() OR is_org_member(org_id, ARRAY['owner','admin']::org_role[]) )
  WITH CHECK ( user_id = auth.uid() OR is_org_member(org_id, ARRAY['owner','admin']::org_role[]) );

CREATE POLICY portfolios_delete ON portfolios
  FOR DELETE TO authenticated
  USING ( user_id = auth.uid() OR is_org_member(org_id, ARRAY['owner']::org_role[]) );

-- ===========================================================================
-- 5. PROPERTIES
-- ===========================================================================

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties FORCE  ROW LEVEL SECURITY;

CREATE POLICY properties_select ON properties
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR is_org_member(org_id, ARRAY['owner','admin','accountant','viewer']::org_role[])
  );

CREATE POLICY properties_insert ON properties
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND is_org_member(org_id, ARRAY['owner','admin']::org_role[])
  );

CREATE POLICY properties_update ON properties
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR is_org_member(org_id, ARRAY['owner','admin']::org_role[])
  )
  WITH CHECK (
    user_id = auth.uid()
    OR is_org_member(org_id, ARRAY['owner','admin']::org_role[])
  );

CREATE POLICY properties_delete ON properties
  FOR DELETE TO authenticated
  USING ( user_id = auth.uid() OR is_org_member(org_id, ARRAY['owner']::org_role[]) );

-- ===========================================================================
-- 6. OWNERSHIP SPLITS & PPOR HISTORY  (inherit via property_id)
-- ===========================================================================

ALTER TABLE property_ownership_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_ownership_splits FORCE  ROW LEVEL SECURITY;

CREATE POLICY pos_all ON property_ownership_splits
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = property_id
        AND ( p.user_id = auth.uid()
              OR is_org_member(p.org_id, ARRAY['owner','admin','accountant']::org_role[]) )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = property_id
        AND ( p.user_id = auth.uid()
              OR is_org_member(p.org_id, ARRAY['owner','admin']::org_role[]) )
    )
  );

ALTER TABLE property_ppor_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_ppor_history FORCE  ROW LEVEL SECURITY;

CREATE POLICY ppor_all ON property_ppor_history
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = property_id
        AND ( p.user_id = auth.uid()
              OR is_org_member(p.org_id, ARRAY['owner','admin','accountant','viewer']::org_role[]) )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = property_id
        AND ( p.user_id = auth.uid()
              OR is_org_member(p.org_id, ARRAY['owner','admin']::org_role[]) )
    )
  );

-- ===========================================================================
-- 7. LOANS
-- ===========================================================================

ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans FORCE  ROW LEVEL SECURITY;

CREATE POLICY loans_select ON loans
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = loans.property_id
        AND is_org_member(p.org_id, ARRAY['owner','admin','accountant','viewer']::org_role[])
    )
  );

CREATE POLICY loans_write ON loans
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = loans.property_id
        AND ( p.user_id = auth.uid()
              OR is_org_member(p.org_id, ARRAY['owner','admin']::org_role[]) )
    )
  );

CREATE POLICY loans_update ON loans
  FOR UPDATE TO authenticated
  USING ( user_id = auth.uid() )
  WITH CHECK ( user_id = auth.uid() );

CREATE POLICY loans_delete ON loans
  FOR DELETE TO authenticated
  USING ( user_id = auth.uid() );

-- ===========================================================================
-- 8. INCOME & EXPENSES
-- ===========================================================================

ALTER TABLE income_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_records FORCE  ROW LEVEL SECURITY;

CREATE POLICY income_select ON income_records
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = income_records.property_id
        AND is_org_member(p.org_id, ARRAY['owner','admin','accountant','viewer']::org_role[])
    )
  );

CREATE POLICY income_write ON income_records
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY income_update ON income_records
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY income_delete ON income_records
  FOR DELETE TO authenticated USING (user_id = auth.uid());

ALTER TABLE expense_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_records FORCE  ROW LEVEL SECURITY;

CREATE POLICY expense_select ON expense_records
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = expense_records.property_id
        AND is_org_member(p.org_id, ARRAY['owner','admin','accountant','viewer']::org_role[])
    )
  );

CREATE POLICY expense_write ON expense_records
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY expense_update ON expense_records
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY expense_delete ON expense_records
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ===========================================================================
-- 9. DEPRECIATION
-- ===========================================================================

ALTER TABLE depreciation_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE depreciation_schedules FORCE  ROW LEVEL SECURITY;

CREATE POLICY dep_sch_select ON depreciation_schedules
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = depreciation_schedules.property_id
        AND is_org_member(p.org_id, ARRAY['owner','admin','accountant','viewer']::org_role[])
    )
  );
CREATE POLICY dep_sch_write ON depreciation_schedules
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE depreciation_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE depreciation_line_items FORCE  ROW LEVEL SECURITY;

CREATE POLICY dep_lines_all ON depreciation_line_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM depreciation_schedules s
      WHERE s.id = schedule_id
        AND ( s.user_id = auth.uid()
              OR EXISTS (
                SELECT 1 FROM properties p
                WHERE p.id = s.property_id
                  AND is_org_member(p.org_id, ARRAY['owner','admin','accountant','viewer']::org_role[])
              ) )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM depreciation_schedules s
      WHERE s.id = schedule_id AND s.user_id = auth.uid()
    )
  );

-- ===========================================================================
-- 10. TAX RULE SETS  (read-only to all authenticated; writes service_role only)
-- ===========================================================================

ALTER TABLE tax_rule_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_rule_sets FORCE  ROW LEVEL SECURITY;

CREATE POLICY trs_select ON tax_rule_sets
  FOR SELECT TO authenticated USING ( status IN ('published','archived') );
-- No write policies; service_role only.

-- ===========================================================================
-- 11. SCENARIOS & RESULTS
-- ===========================================================================

ALTER TABLE scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenarios FORCE  ROW LEVEL SECURITY;

CREATE POLICY scenarios_select ON scenarios
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR (
      property_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM properties p
        WHERE p.id = scenarios.property_id
          AND is_org_member(p.org_id, ARRAY['owner','admin','accountant','viewer']::org_role[])
      )
    )
  );

CREATE POLICY scenarios_insert ON scenarios
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY scenarios_update ON scenarios
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY scenarios_delete ON scenarios
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- scenario_results: SELECT only; APPEND-ONLY (service_role writes)
ALTER TABLE scenario_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenario_results FORCE  ROW LEVEL SECURITY;

CREATE POLICY sr_select ON scenario_results
  FOR SELECT TO authenticated USING ( user_id = auth.uid() );

-- ===========================================================================
-- 12. AI INTERACTIONS  (SELECT own; APPEND-ONLY)
-- ===========================================================================

ALTER TABLE ai_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_interactions FORCE  ROW LEVEL SECURITY;

CREATE POLICY ai_select_own ON ai_interactions
  FOR SELECT TO authenticated USING ( user_id = auth.uid() );

-- ===========================================================================
-- 13. AUDIT LOGS  (SELECT own; APPEND-ONLY)
-- ===========================================================================

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE  ROW LEVEL SECURITY;

CREATE POLICY audit_select_own ON audit_logs
  FOR SELECT TO authenticated USING (
    actor_user_id = auth.uid()
    OR (org_id IS NOT NULL AND is_org_member(org_id, ARRAY['owner','admin']::org_role[]))
  );

-- ===========================================================================
-- 14. REPORTS
-- ===========================================================================

ALTER TABLE report_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_jobs FORCE  ROW LEVEL SECURITY;

CREATE POLICY rj_select ON report_jobs
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY rj_insert ON report_jobs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_reports FORCE  ROW LEVEL SECURITY;

CREATE POLICY sr2_all ON scheduled_reports
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- POLICY TEST MATRIX (run via pgTAP in CI; abbreviated set below)
-- ============================================================================
-- Each row asserts: as user X with role Y, action Z on table T should: result
--
-- | User      | Role        | Action          | Table              | Expected |
-- |-----------|-------------|-----------------|--------------------|----------|
-- | owner_a   | n/a         | SELECT          | properties (own)   | row(s)   |
-- | owner_a   | n/a         | SELECT          | properties (b's)   | 0 rows   |
-- | viewer_b  | viewer      | UPDATE          | properties (b's)   | DENIED   |
-- | accountant| accountant  | SELECT          | scenario_results   | rows     |
-- | accountant| accountant  | UPDATE          | properties         | DENIED   |
-- | owner_a   | n/a         | INSERT          | scenario_results   | DENIED   |
-- | owner_a   | n/a         | UPDATE          | audit_logs         | DENIED   |
-- | owner_a   | n/a         | SELECT          | tax_rule_sets(pub) | rows     |
-- | owner_a   | n/a         | SELECT          | tax_rule_sets(drf) | 0 rows   |
-- | owner_a   | n/a         | DELETE          | properties (own)   | OK       |
-- | non-mem   | n/a         | SELECT          | organisations      | 0 rows   |
-- | owner_a   | n/a         | INSERT splits   | sum != 100         | ERROR    |
-- | spousal   | viewer      | SELECT          | loans (org)        | rows     |
-- | spousal   | viewer      | INSERT          | loans              | DENIED   |

-- ============================================================================
-- END OF POLICIES
-- ============================================================================
