-- Migration 0004: org_invites table + hash chain columns on audit_logs
-- Applied: 2026-05-20

-- ---------------------------------------------------------------------------
-- 1. org_invites — one-time membership invitation tokens (stored hashed)
-- ---------------------------------------------------------------------------
CREATE TABLE org_invites (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL,
  role        org_role    NOT NULL DEFAULT 'viewer',
  token_hash  TEXT        NOT NULL UNIQUE,
  invited_by  UUID        NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '7 days',
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_oi_org   ON org_invites(org_id);
CREATE INDEX idx_oi_email ON org_invites(email);
CREATE INDEX idx_oi_token ON org_invites(token_hash) WHERE accepted_at IS NULL;

ALTER TABLE org_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_invites FORCE  ROW LEVEL SECURITY;

-- Org admins/owners can see their org's pending invites.
CREATE POLICY invite_select_org ON org_invites
  FOR SELECT TO authenticated
  USING (is_org_member(org_id, ARRAY['owner','admin']::org_role[]));

-- Only the service role writes invites (avoid privilege escalation).
CREATE POLICY invite_insert_service ON org_invites
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY invite_update_service ON org_invites
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 2. audit_logs hash chain columns
--    prev_hash:     computed_hash of the previous row (or '0'*64 for first)
--    payload_hash:  sha256(canonicalJson(anonymised_payload))
--    computed_hash: sha256(prev_hash || canonicalJson(anonymised_payload))
-- ---------------------------------------------------------------------------
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS prev_hash     TEXT,
  ADD COLUMN IF NOT EXISTS payload_hash  TEXT,
  ADD COLUMN IF NOT EXISTS computed_hash TEXT;
