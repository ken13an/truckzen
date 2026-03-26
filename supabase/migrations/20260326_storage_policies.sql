-- ============================================================
-- TRUCKZEN — Storage bucket RLS policies
-- Run this in Supabase SQL Editor to enforce storage security
-- ============================================================

-- 1. UPLOADS bucket — WO files
-- Users can only upload/read within their shop_id prefix
INSERT INTO storage.buckets (id, name, public) VALUES ('uploads', 'uploads', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "uploads: auth users can upload to own shop path"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'uploads'
  AND (storage.foldername(name))[1] = (
    SELECT shop_id::text FROM public.users WHERE id = auth.uid()
  )
);

CREATE POLICY "uploads: auth users can read own shop files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'uploads'
  AND (storage.foldername(name))[1] = (
    SELECT shop_id::text FROM public.users WHERE id = auth.uid()
  )
);

-- 2. PHOTOS bucket — mechanic photos
-- Already shop_id prefixed in path: {shop_id}/so/{soId}/{ts}-{name}
CREATE POLICY "photos: auth users can upload to own shop path"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'photos'
  AND (storage.foldername(name))[1] = (
    SELECT shop_id::text FROM public.users WHERE id = auth.uid()
  )
);

CREATE POLICY "photos: auth users can read own shop files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'photos'
  AND (storage.foldername(name))[1] = (
    SELECT shop_id::text FROM public.users WHERE id = auth.uid()
  )
);

-- 3. CUSTOMER-DOCS bucket — private, signed URLs only
INSERT INTO storage.buckets (id, name, public) VALUES ('customer-docs', 'customer-docs', false)
ON CONFLICT (id) DO UPDATE SET public = false;

CREATE POLICY "customer-docs: auth users can upload to own shop path"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'customer-docs'
  AND (storage.foldername(name))[1] = (
    SELECT shop_id::text FROM public.users WHERE id = auth.uid()
  )
);

CREATE POLICY "customer-docs: auth users can read own shop files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'customer-docs'
  AND (storage.foldername(name))[1] = (
    SELECT shop_id::text FROM public.users WHERE id = auth.uid()
  )
);

CREATE POLICY "customer-docs: auth users can delete own shop files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'customer-docs'
  AND (storage.foldername(name))[1] = (
    SELECT shop_id::text FROM public.users WHERE id = auth.uid()
  )
);

-- 4. SHOP-LOGOS bucket — public read, server-only write (via service role)
-- No user-facing upload policy needed — logo upload goes through API route with service role
INSERT INTO storage.buckets (id, name, public) VALUES ('shop-logos', 'shop-logos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Public read for logos (used in UI, invoices, etc.)
CREATE POLICY "shop-logos: public read"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'shop-logos');

-- NOTE: No INSERT/UPDATE/DELETE policy for authenticated users.
-- Logo uploads go through /api/shop/logo which uses service_role key (bypasses RLS).
-- This means no user can upload logos directly via client — only through the API.
