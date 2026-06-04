-- Rollback migration 0003: remove is_default from user_org_membership
DROP FUNCTION IF EXISTS public.set_active_org(UUID);
DROP INDEX IF EXISTS idx_uom_one_default_per_user;
ALTER TABLE user_org_membership DROP COLUMN IF EXISTS is_default;
