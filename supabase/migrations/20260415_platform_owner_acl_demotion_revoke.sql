-- Patch 14: extend Patch 11 trigger function to also auto-revoke impersonation
-- ACL rows when a user is demoted from platform owner. The existing trigger on
-- users (AFTER INSERT OR UPDATE OF is_platform_owner) is reused unchanged.

CREATE OR REPLACE FUNCTION seed_platform_owner_impersonation_acl()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Promotion / new platform owner: seed ACL rows for every shop.
  IF NEW.is_platform_owner IS TRUE THEN
    IF TG_OP = 'INSERT' OR COALESCE(OLD.is_platform_owner, false) = false THEN
      INSERT INTO platform_impersonation_acl (user_id, shop_id, granted_by, reason)
      SELECT NEW.id, s.id, NEW.id, 'auto-seed:new-platform-owner'
      FROM shops s
      ON CONFLICT (user_id, shop_id) DO NOTHING;
    END IF;
    RETURN NEW;
  END IF;

  -- Demotion (true -> false): revoke active ACL rows for this user.
  IF TG_OP = 'UPDATE' AND COALESCE(OLD.is_platform_owner, false) = true THEN
    UPDATE platform_impersonation_acl
    SET revoked_at = now()
    WHERE user_id = NEW.id AND revoked_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$;
