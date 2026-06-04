-- ============================================================================
-- EquityLens — Add is_default to user_org_membership  (migration 0003)
-- Enables active-org tracking: each user has at most one default org.
-- ============================================================================

-- 1. Add column (default false so existing rows are unaffected)
ALTER TABLE user_org_membership
  ADD COLUMN is_default BOOLEAN NOT NULL DEFAULT false;

-- 2. Partial unique index: at most one default org per user
CREATE UNIQUE INDEX idx_uom_one_default_per_user
  ON user_org_membership(user_id)
  WHERE is_default = true;

-- 3. SECURITY DEFINER helper: users switch their own active org atomically.
--    Bypasses RLS so it can UPDATE across rows; auth.uid() enforces ownership.
CREATE OR REPLACE FUNCTION public.set_active_org(p_org_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM user_org_membership
    WHERE user_id = v_uid AND org_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'User is not a member of org %', p_org_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE user_org_membership
    SET is_default = false
    WHERE user_id = v_uid AND is_default = true;

  UPDATE user_org_membership
    SET is_default = true
    WHERE user_id = v_uid AND org_id = p_org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_active_org(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_active_org(UUID) TO authenticated;
