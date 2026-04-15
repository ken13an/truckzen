-- F-19: explicit per-shop ACL for platform-admin impersonation.
CREATE TABLE IF NOT EXISTS platform_impersonation_acl (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shop_id    uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES users(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  reason     text,
  PRIMARY KEY (user_id, shop_id)
);

CREATE INDEX IF NOT EXISTS platform_impersonation_acl_active_idx
  ON platform_impersonation_acl (user_id, shop_id)
  WHERE revoked_at IS NULL;

-- Seed: preserve current behavior by granting each existing platform owner
-- access to each existing shop. Going forward, new shops / new platform owners
-- require explicit grants. Revocations enforce immediately on next start.
INSERT INTO platform_impersonation_acl (user_id, shop_id, granted_by, reason)
SELECT u.id, s.id, u.id, 'initial-seed:preserve-pre-F19-behavior'
FROM users u CROSS JOIN shops s
WHERE u.is_platform_owner = true
ON CONFLICT (user_id, shop_id) DO NOTHING;
