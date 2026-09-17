-- ============================================================================
-- FROSTLY SEAFOOD COLD-CHAIN ERP
-- Migration 017: Inventory Retail Linking Columns
-- ============================================================================

DO $$
BEGIN
    -- 1. linked_product_id (maps retail cut inventory lots to product catalogue items)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'inventory_batches' 
          AND column_name = 'linked_product_id'
    ) THEN
        ALTER TABLE public.inventory_batches ADD COLUMN linked_product_id TEXT;
        CREATE INDEX IF NOT EXISTS idx_inventory_linked_product ON public.inventory_batches(linked_product_id);
    END IF;

    -- 2. product_sku (maps retail cut lots to inventory SKU)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'inventory_batches' 
          AND column_name = 'product_sku'
    ) THEN
        ALTER TABLE public.inventory_batches ADD COLUMN product_sku TEXT;
        CREATE INDEX IF NOT EXISTS idx_inventory_product_sku ON public.inventory_batches(product_sku);
    END IF;

    -- 3. is_retail_cut_lot (boolean flag for retail cut lot filtering)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'inventory_batches' 
          AND column_name = 'is_retail_cut_lot'
    ) THEN
        ALTER TABLE public.inventory_batches ADD COLUMN is_retail_cut_lot BOOLEAN NOT NULL DEFAULT false;
        CREATE INDEX IF NOT EXISTS idx_inventory_is_retail_cut ON public.inventory_batches(is_retail_cut_lot);
    END IF;
END $$;
