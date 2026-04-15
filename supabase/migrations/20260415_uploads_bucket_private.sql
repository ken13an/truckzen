-- F-14: flip uploads bucket to private so WO file URLs stop resolving without auth.
-- Only WO files use this bucket; all reads now go through /api/wo-files/[id]/download.
UPDATE storage.buckets SET public = false WHERE id = 'uploads';
