-- Patch 120: invite token columns on public.users for dedicated accept-invite flow.
-- Additive only. No existing columns altered.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS invite_token text,
  ADD COLUMN IF NOT EXISTS invite_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS invite_accepted_at timestamptz;

-- Unique lookup for active tokens only; nullable values remain non-conflicting.
CREATE UNIQUE INDEX IF NOT EXISTS users_invite_token_uniq
  ON public.users (invite_token)
  WHERE invite_token IS NOT NULL;
