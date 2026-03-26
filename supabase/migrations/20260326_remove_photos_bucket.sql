-- ============================================================
-- TRUCKZEN — Remove photos bucket (feature removed)
-- Photo uploads replaced by Telegram. Zero data in bucket.
-- ============================================================

-- Drop RLS policies
DROP POLICY IF EXISTS "photos: auth users can upload to own shop path" ON storage.objects;
DROP POLICY IF EXISTS "photos: auth users can read own shop files" ON storage.objects;

-- Delete bucket (only works if empty — confirmed empty by audit)
DELETE FROM storage.buckets WHERE id = 'photos';
