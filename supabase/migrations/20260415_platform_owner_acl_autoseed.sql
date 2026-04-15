-- Patch 11: auto-seed impersonation ACL when a user becomes platform owner.
-- WHEN-clause form of spec failed because TG_OP/OLD.* cannot be referenced
-- in the WHEN clause of a trigger handling both INSERT and UPDATE. Semantics
-- are preserved by gating inside the function body.

CREATE OR REPLACE FUNCTION seed_platform_owner_impersonation_acl()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_platform_owner IS NOT TRUE THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND COALESCE(OLD.is_platform_owner, false) = true THEN
    RETURN NEW;
  END IF;

  INSERT INTO platform_impersonation_acl (user_id, shop_id, granted_by, reason)
  SELECT NEW.id, s.id, NEW.id, 'auto-seed:new-platform-owner'
  FROM shops s
  ON CONFLICT (user_id, shop_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_platform_owner_impersonation_acl ON users;

CREATE TRIGGER trg_seed_platform_owner_impersonation_acl
AFTER INSERT OR UPDATE OF is_platform_owner ON users
FOR EACH ROW
EXECUTE FUNCTION seed_platform_owner_impersonation_acl();
