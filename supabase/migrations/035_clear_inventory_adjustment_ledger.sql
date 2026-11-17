-- ============================================================================
-- Migration 035: Clear Inventory Adjustment Entries from General Financial Ledger
-- & Provide Authorized Tenant-Scoped Cleanup RPC
-- ============================================================================
-- Background:
--   Test inventory stock adjustments / catalog write-offs posted
--   'Inventory Adjustment' rows (FIN-ADJ-*, FIN-WO-*) into
--   public.financial_ledger_entries, which is protected by
--   trg_immutable_financial_ledger (enforce_insert_only / enforce_insert_only_compliance).
--
--   This migration:
--   1. Ensures enforce_insert_only() and enforce_insert_only_compliance() allow
--      transaction-local cleanup when app.allow_ledger_cleanup = 'on'.
--   2. Purges all Inventory Adjustment test entries from public.financial_ledger_entries,
--      clears public.inventory_adjustments (if present), and resets
--      public.inventory_adjustment_accounts.balance_usd to 0.00.
--   3. Installs SECURITY DEFINER RPC public.clear_financial_ledger_inventory_adjustments()
--      for authenticated staff users scoped to their organization_id.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enforce_insert_only()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF current_setting('app.allow_ledger_cleanup', true) = 'on'
       OR current_setting('app.allow_reversal_cleanup', true) = 'on' THEN
        RETURN COALESCE(NEW, OLD);
    END IF;
    RAISE EXCEPTION 'REGULATORY COMPLIANCE VIOLATION: Table % is strictly insert-only. Updates and deletions are legally prohibited.', TG_TABLE_NAME;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_insert_only_compliance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF current_setting('app.allow_ledger_cleanup', true) = 'on'
       OR current_setting('app.allow_reversal_cleanup', true) = 'on' THEN
        RETURN COALESCE(NEW, OLD);
    END IF;
    RAISE EXCEPTION 'LEGAL & REGULATORY VIOLATION: Table % is strictly insert-only. Modifications and deletions are prohibited.', TG_TABLE_NAME;
END;
$$;

-- One-time purge of all existing Inventory Adjustment rows across all tenants
DO $$
DECLARE
    v_deleted_count INTEGER := 0;
BEGIN
    PERFORM set_config('app.allow_ledger_cleanup', 'on', true);

    DELETE FROM public.financial_ledger_entries
    WHERE category::text = 'Inventory Adjustment'
       OR id::text LIKE 'FIN-ADJ-%'
       OR id::text LIKE 'FIN-WO-%'
       OR description ILIKE 'Inventory Lot % Adjustment%'
       OR description ILIKE 'Catalog Removal Inventory Write-Off:%'
       OR payment_method ILIKE 'Adjustment Account%'
       OR entity_name ILIKE 'Internal Cold Vault [Acc %';

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'inventory_adjustments'
    ) THEN
        DELETE FROM public.inventory_adjustments;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'inventory_adjustment_accounts'
    ) THEN
        UPDATE public.inventory_adjustment_accounts
        SET balance_usd = 0.00,
            updated_at = NOW();
    END IF;

    PERFORM set_config('app.allow_ledger_cleanup', 'off', true);

    RAISE NOTICE 'Cleared % Inventory Adjustment ledger row(s) from public.financial_ledger_entries.', v_deleted_count;
END $$;

-- Tenant-scoped RPC callable from Financials -> Ledger Transactions
CREATE OR REPLACE FUNCTION public.clear_financial_ledger_inventory_adjustments()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_org_id UUID;
    v_deleted_count INTEGER := 0;
BEGIN
    IF NOT public.is_staff() THEN
        RAISE EXCEPTION 'Unauthorized: staff authentication required.';
    END IF;

    v_org_id := public.current_org_id();
    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'Organization ID could not be resolved for active user.';
    END IF;

    PERFORM set_config('app.allow_ledger_cleanup', 'on', true);

    DELETE FROM public.financial_ledger_entries
    WHERE organization_id = v_org_id
      AND (
          category::text = 'Inventory Adjustment'
          OR id::text LIKE 'FIN-ADJ-%'
          OR id::text LIKE 'FIN-WO-%'
          OR description ILIKE 'Inventory Lot % Adjustment%'
          OR description ILIKE 'Catalog Removal Inventory Write-Off:%'
          OR payment_method ILIKE 'Adjustment Account%'
          OR entity_name ILIKE 'Internal Cold Vault [Acc %'
      );

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'inventory_adjustments'
    ) THEN
        DELETE FROM public.inventory_adjustments
        WHERE organization_id = v_org_id;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'inventory_adjustment_accounts'
    ) THEN
        UPDATE public.inventory_adjustment_accounts
        SET balance_usd = 0.00,
            updated_at = NOW()
        WHERE organization_id = v_org_id;
    END IF;

    PERFORM set_config('app.allow_ledger_cleanup', 'off', true);

    RETURN v_deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clear_financial_ledger_inventory_adjustments() TO authenticated;
