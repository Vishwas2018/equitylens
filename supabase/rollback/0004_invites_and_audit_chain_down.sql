-- Rollback 0004
ALTER TABLE audit_logs
  DROP COLUMN IF EXISTS computed_hash,
  DROP COLUMN IF EXISTS payload_hash,
  DROP COLUMN IF EXISTS prev_hash;

DROP TABLE IF EXISTS org_invites;
