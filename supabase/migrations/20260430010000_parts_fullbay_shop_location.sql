-- Additive: promote preserved Fullbay shop/building/location truth into
-- typed columns on public.parts. Backfilled from the existing
-- external_data jsonb so no source data is rewritten.
--
-- Reversible: the columns are nullable, additive only. To undo, drop the
-- two columns. Existing rows' description / on_hand / pricing / source /
-- import_batch_id / external_data are NOT modified.

ALTER TABLE public.parts
  ADD COLUMN IF NOT EXISTS fullbay_shop_title text,
  ADD COLUMN IF NOT EXISTS fullbay_location_raw text;

-- Backfill ONLY source='fullbay' rows. Use COALESCE so a future re-run cannot
-- overwrite an existing non-null value. Native source='truckzen' and
-- source='csv_import' rows are excluded by the WHERE clause.
UPDATE public.parts
SET
  fullbay_shop_title   = COALESCE(fullbay_shop_title,   NULLIF(external_data->>'fullbay_shop','')),
  fullbay_location_raw = COALESCE(fullbay_location_raw, NULLIF(external_data->>'ui_default_location_raw',''))
WHERE source = 'fullbay'
  AND external_data IS NOT NULL;
