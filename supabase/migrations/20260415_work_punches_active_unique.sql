-- F-08 residual: enforce at most one open work_punch per user.
-- Partial unique index covering rows where punch_out_at IS NULL.
-- Allows any number of closed (punch_out_at IS NOT NULL) rows.

CREATE UNIQUE INDEX IF NOT EXISTS work_punches_user_active_uidx
  ON work_punches (user_id)
  WHERE punch_out_at IS NULL;
