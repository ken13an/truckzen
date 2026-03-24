-- =============================================
-- NOTIFICATIONS TABLE
-- TruckZen | March 23 2026
-- =============================================
-- NOTE: Table uses user_id (not recipient_id) to match existing codebase.
-- All code (NotificationBell, createNotification, dashboard API) uses user_id.

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  related_wo_id UUID,
  related_unit TEXT,
  read BOOLEAN DEFAULT false,
  is_read BOOLEAN DEFAULT false,
  is_dismissed BOOLEAN DEFAULT false,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
  ON notifications(user_id, read, is_dismissed, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_shop_type
  ON notifications(shop_id, type, created_at DESC);

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users see only their own notifications
DROP POLICY IF EXISTS "notif_own" ON notifications;
CREATE POLICY "notif_own" ON notifications
  FOR SELECT USING (user_id = auth.uid());

-- Users can insert (for service role bypass)
DROP POLICY IF EXISTS "notif_insert" ON notifications;
CREATE POLICY "notif_insert" ON notifications
  FOR INSERT WITH CHECK (true);

-- Users can update their own (mark read/dismiss)
DROP POLICY IF EXISTS "notif_update_own" ON notifications;
CREATE POLICY "notif_update_own" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

-- Users can delete their own
DROP POLICY IF EXISTS "notif_delete_own" ON notifications;
CREATE POLICY "notif_delete_own" ON notifications
  FOR DELETE USING (user_id = auth.uid());

-- Owners/admins see all notifications for their shop
DROP POLICY IF EXISTS "admins_see_all_notifications" ON notifications;
CREATE POLICY "admins_see_all_notifications" ON notifications
  FOR SELECT USING (
    shop_id IN (
      SELECT shop_id FROM users
      WHERE id = auth.uid()
      AND role IN ('owner','gm','it_person')
    )
  );
