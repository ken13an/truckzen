-- Refresh platform_services: add services present in code but missing from dashboard,
-- and update UptimeRobot to reflect free tier.
--
-- Rewritten 2026-04-23 for idempotency after a DB-truth audit proved all 6 INSERT
-- target rows were missing and exactly one UptimeRobot row existed at monthly_cost=7.
-- Uses INSERT ... SELECT ... WHERE NOT EXISTS so the insert is safe whether or not
-- platform_services.name carries a unique index (unique-constraint truth was not
-- obtainable at audit time). ON CONFLICT (name) is intentionally NOT used.

INSERT INTO platform_services
  (name, provider, category, monthly_cost, billing_cycle, is_active, auto_renews, notes)
SELECT v.name, v.provider, v.category, v.monthly_cost, v.billing_cycle,
       v.is_active, v.auto_renews, v.notes
FROM (VALUES
  ('Base44',        'Base44',     'other', 50::numeric, 'monthly',     true, true, NULL),
  ('Cloudflare',    'Cloudflare', 'other',  0::numeric, 'monthly',     true, true, 'Free tier'),
  ('Sentry',        'Sentry',     'other',  0::numeric, 'monthly',     true, true, 'Installed; awaiting DSN'),
  ('Stripe',        'Stripe',     'api',    0::numeric, 'usage_based', true, true, '2.9% + $0.30 per txn'),
  ('Upstash Redis', 'Upstash',    'proxy',  0::numeric, 'usage_based', true, true, 'Rate limiting'),
  ('Telegram Bot',  'Telegram',   'other',  0::numeric, 'monthly',     true, true, '@servicewriter bot')
) AS v(name, provider, category, monthly_cost, billing_cycle, is_active, auto_renews, notes)
WHERE NOT EXISTS (
  SELECT 1 FROM platform_services p WHERE p.name = v.name
);

UPDATE platform_services
SET monthly_cost = 0,
    notes = COALESCE(NULLIF(notes, ''), 'Free tier')
WHERE name ILIKE 'UptimeRobot%';
