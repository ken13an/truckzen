-- F-08 idempotency: add client_event_id to work_punches and enforce per-user uniqueness.
-- Narrow scope: column + partial unique index. No other schema changes.

ALTER TABLE work_punches
  ADD COLUMN IF NOT EXISTS client_event_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS work_punches_user_event_uidx
  ON work_punches (user_id, client_event_id)
  WHERE client_event_id IS NOT NULL;
