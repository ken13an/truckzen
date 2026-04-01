-- Backfill existing UGL Truck Center payment info into DB
-- Restricted to the real UGL shop only (matched by name/dba)
-- Does not touch other shops

UPDATE shops SET
  payment_payee_name     = 'UGL Truck Center Inc',
  payment_bank_name      = 'Chase Bank',
  payment_ach_account    = '583509081',
  payment_ach_routing    = '071000013',
  payment_wire_account   = '583509081',
  payment_wire_routing   = '021000021',
  payment_zelle_email_1  = 'accounting.truckcenter@yahoo.com',
  payment_zelle_email_2  = 'sanjarbek@ugltruckcenterinc.com',
  payment_mail_payee     = 'UGL Truck Center Inc',
  payment_mail_address   = '325 State Rte 31',
  payment_mail_city      = 'Montgomery',
  payment_mail_state     = 'IL',
  payment_mail_zip       = '60538'
WHERE payment_payee_name IS NULL
  AND (name ILIKE '%UGL%' OR dba ILIKE '%UGL%');
