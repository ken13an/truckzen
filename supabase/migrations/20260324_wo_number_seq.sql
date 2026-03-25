-- Atomic WO number generator function
-- Finds the highest number across all formats (WO-YYYY-NNNNN and plain numeric)
-- and returns the next sequential WO number

CREATE OR REPLACE FUNCTION next_wo_number(p_shop_id UUID)
RETURNS TEXT AS $$
DECLARE
  max_wo BIGINT := 0;
  max_plain BIGINT := 0;
  next_num BIGINT;
BEGIN
  -- Find highest trailing number from WO-YYYY-NNNNN entries
  SELECT COALESCE(MAX(
    CAST(REGEXP_REPLACE(so_number, '^WO-[0-9]+-', '') AS BIGINT)
  ), 0)
  INTO max_wo
  FROM service_orders
  WHERE shop_id = p_shop_id
    AND so_number ~ '^WO-[0-9]+-[0-9]+$';

  -- Find highest plain numeric entries (historical imports)
  SELECT COALESCE(MAX(CAST(so_number AS BIGINT)), 0)
  INTO max_plain
  FROM service_orders
  WHERE shop_id = p_shop_id
    AND so_number ~ '^[0-9]+$';

  next_num := GREATEST(max_wo, max_plain) + 1;
  RETURN 'WO-' || EXTRACT(YEAR FROM NOW())::TEXT || '-' || next_num::TEXT;
END;
$$ LANGUAGE plpgsql;
