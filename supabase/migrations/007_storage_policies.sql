-- ============================================================================
-- FROSTLY SEAFOOD COLD-CHAIN ERP
-- Migration 007: Supabase Storage Buckets & Policies
-- ============================================================================

-- 1. Create Storage Buckets
-- Bucket A: Species and Lot Reference Photos (Public Read, Ops/Admin Upload)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'product-species-media',
    'product-species-media',
    true,
    10485760, -- 10MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];

-- Bucket B: HACCP Official Regulatory Documents (Private, Ops/Admin Only)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'haccp-documents',
    'haccp-documents',
    false,
    26214400, -- 25MB limit
    ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 26214400,
    allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png'];

-- 2. Storage Object RLS Policies

-- Media Bucket: Public Read
DROP POLICY IF EXISTS "media_public_read" ON storage.objects;
CREATE POLICY "media_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-species-media');

-- Media Bucket: Ops & Admin Upload
DROP POLICY IF EXISTS "media_ops_admin_insert" ON storage.objects;
CREATE POLICY "media_ops_admin_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'product-species-media' AND
    (public.is_admin() OR public.is_ops_or_admin())
);

-- HACCP Bucket: Private Read (Ops and Admin only)
DROP POLICY IF EXISTS "haccp_docs_select" ON storage.objects;
CREATE POLICY "haccp_docs_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'haccp-documents' AND
    (public.is_admin() OR public.is_ops_or_admin())
);

-- HACCP Bucket: Private Insert (Ops and Admin only)
DROP POLICY IF EXISTS "haccp_docs_insert" ON storage.objects;
CREATE POLICY "haccp_docs_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'haccp-documents' AND
    (public.is_admin() OR public.is_ops_or_admin())
);
