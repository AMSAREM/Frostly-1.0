-- ============================================================================
-- FROSTLY SEAFOOD COLD-CHAIN ERP
-- Migration 023: Inventory Batch Image URL Column
-- Supports user-uploaded and custom photos for catch batches & inventory lots
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'inventory_batches'
          AND column_name = 'image_url'
    ) THEN
        ALTER TABLE public.inventory_batches ADD COLUMN image_url TEXT;
        COMMENT ON COLUMN public.inventory_batches.image_url IS 'User-provided photo URL or base64 storage URI for the catch lot. Not auto-generated.';
    END IF;
END $$;
