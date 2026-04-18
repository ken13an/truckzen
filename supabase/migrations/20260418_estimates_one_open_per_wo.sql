-- Hard protection: only one open (draft|sent) estimate per work order.
-- Complements the server-side soft idempotency added to
-- POST /api/estimates action=create_from_wo by closing the concurrent-call
-- race (two parallel callers both passing the reuse SELECT, then both
-- inserting). Approved/declined history is preserved — terminal rows are
-- outside the partial filter, so any number of prior approved/declined
-- estimates may coexist with one current open estimate for the same WO.
--
-- Idempotent (IF NOT EXISTS). No row mutation. Applies cleanly against an
-- empty estimates table; would fail loudly if duplicates ever exist (which
-- has been verified to be zero before apply).

CREATE UNIQUE INDEX IF NOT EXISTS estimates_one_open_per_wo
  ON public.estimates (wo_id)
  WHERE deleted_at IS NULL
    AND status IN ('draft', 'sent')
    AND wo_id IS NOT NULL;
