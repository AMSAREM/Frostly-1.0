-- ============================================================================
-- FROSTLY SEAFOOD COLD-CHAIN ERP
-- Migration 024: Customer Payment Ledger Enhancements
-- Extends financial_ledger_entries with explicit customer_id, receipt_number, and notes
-- for comprehensive customer statement tracking and receipt voucher generation.
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'financial_ledger_entries' AND column_name = 'customer_id'
    ) THEN
        ALTER TABLE public.financial_ledger_entries ADD COLUMN customer_id TEXT;
        CREATE INDEX IF NOT EXISTS idx_fin_ledger_customer ON public.financial_ledger_entries(customer_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'financial_ledger_entries' AND column_name = 'receipt_number'
    ) THEN
        ALTER TABLE public.financial_ledger_entries ADD COLUMN receipt_number TEXT;
        CREATE INDEX IF NOT EXISTS idx_fin_ledger_receipt ON public.financial_ledger_entries(receipt_number);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'financial_ledger_entries' AND column_name = 'notes'
    ) THEN
        ALTER TABLE public.financial_ledger_entries ADD COLUMN notes TEXT;
    END IF;
END $$;
