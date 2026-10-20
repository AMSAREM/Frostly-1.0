-- ============================================================================
-- FROSTLY SEAFOOD COLD-CHAIN ERP
-- Migration 025: Supplier Payment Ledger & Disbursement Enhancements
-- Extends financial_ledger_entries with explicit supplier_id and voucher_number
-- for comprehensive Accounts Payable (AP) statement tracking and remittance advice vouchers.
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'financial_ledger_entries' AND column_name = 'supplier_id'
    ) THEN
        ALTER TABLE public.financial_ledger_entries ADD COLUMN supplier_id TEXT;
        CREATE INDEX IF NOT EXISTS idx_fin_ledger_supplier ON public.financial_ledger_entries(supplier_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'financial_ledger_entries' AND column_name = 'voucher_number'
    ) THEN
        ALTER TABLE public.financial_ledger_entries ADD COLUMN voucher_number TEXT;
        CREATE INDEX IF NOT EXISTS idx_fin_ledger_voucher ON public.financial_ledger_entries(voucher_number);
    END IF;
END $$;
