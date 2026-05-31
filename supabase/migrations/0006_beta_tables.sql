-- =============================================================================
-- Migration 0006 — closed-beta tables
-- =============================================================================
-- Adds two tables for the D16 closed-beta gating:
--
--   beta_invites  — email allowlist. Supabase Auth public sign-up is disabled;
--                   only emails inserted here by an admin can create accounts.
--                   App-layer enforcement is a defence-in-depth on top of the
--                   Supabase Auth signup-disabled setting.
--
-- Note: beta_ack state is stored in Supabase auth.users.raw_user_meta_data
-- (beta_ack=true) via supabase.auth.updateUser() — no separate table needed.
-- =============================================================================

CREATE TABLE IF NOT EXISTS beta_invites (
  email        TEXT PRIMARY KEY,
  invited_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  invited_by   UUID
);

COMMENT ON TABLE beta_invites IS
  'Closed-beta email allowlist. Supabase Auth public sign-up is disabled; '
  'admin inserts invited emails here before creating accounts via magic-link.';

ALTER TABLE beta_invites ENABLE ROW LEVEL SECURITY;

-- No public access — admin reads/writes via service-role key, bypassing RLS.
CREATE POLICY beta_invites_deny_all ON beta_invites
  FOR ALL
  USING (false);
