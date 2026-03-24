-- Single-device session enforcement
-- Each login generates a new session_token; old sessions are invalidated
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_token UUID DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_updated_at TIMESTAMPTZ DEFAULT NULL;
