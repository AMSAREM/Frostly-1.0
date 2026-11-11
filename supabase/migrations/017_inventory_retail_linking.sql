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

    -- 4. linked_batch_id on retail_wholesale_products (maps catalogue items to vault inventory lot)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'retail_wholesale_products' 
          AND column_name = 'linked_batch_id'
    ) THEN
        ALTER TABLE public.retail_wholesale_products ADD COLUMN linked_batch_id TEXT;
        CREATE INDEX IF NOT EXISTS idx_retail_linked_batch ON public.retail_wholesale_products(linked_batch_id);
    END IF;

    -- 5. storage_zone on retail_wholesale_products (stores cold chain zone requirement)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'retail_wholesale_products' 
          AND column_name = 'storage_zone'
    ) THEN
        ALTER TABLE public.retail_wholesale_products ADD COLUMN storage_zone TEXT;
    END IF;

    -- 6. customer_id on financial_ledger_entries (optional customer linkage for customer ledger reconciliation)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'financial_ledger_entries' 
          AND column_name = 'customer_id'
    ) THEN
        ALTER TABLE public.financial_ledger_entries ADD COLUMN customer_id TEXT;
        CREATE INDEX IF NOT EXISTS idx_financial_customer_id ON public.financial_ledger_entries(customer_id);
    END IF;

    -- 7. notes on financial_ledger_entries (audit notes and payment reference descriptions)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'financial_ledger_entries' 
          AND column_name = 'notes'
    ) THEN
        ALTER TABLE public.financial_ledger_entries ADD COLUMN notes TEXT;
    END IF;
END $$;
