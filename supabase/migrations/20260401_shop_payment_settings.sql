-- Shop Payment Settings — DB-backed per-shop payment info
-- Replaces hardcoded payment constants in code

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS payment_payee_name TEXT,
  ADD COLUMN IF NOT EXISTS payment_bank_name TEXT,
  ADD COLUMN IF NOT EXISTS payment_ach_account TEXT,
  ADD COLUMN IF NOT EXISTS payment_ach_routing TEXT,
  ADD COLUMN IF NOT EXISTS payment_wire_account TEXT,
  ADD COLUMN IF NOT EXISTS payment_wire_routing TEXT,
  ADD COLUMN IF NOT EXISTS payment_zelle_email_1 TEXT,
  ADD COLUMN IF NOT EXISTS payment_zelle_email_2 TEXT,
  ADD COLUMN IF NOT EXISTS payment_mail_payee TEXT,
  ADD COLUMN IF NOT EXISTS payment_mail_address TEXT,
  ADD COLUMN IF NOT EXISTS payment_mail_address_2 TEXT,
  ADD COLUMN IF NOT EXISTS payment_mail_city TEXT,
  ADD COLUMN IF NOT EXISTS payment_mail_state TEXT,
  ADD COLUMN IF NOT EXISTS payment_mail_zip TEXT,
  ADD COLUMN IF NOT EXISTS payment_note TEXT;
