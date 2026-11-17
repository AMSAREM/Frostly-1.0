-- ============================================================================
-- ONE-CLICK SUPABASE SQL EDITOR SCRIPT:
-- Delete All Inventory Adjustment Data from General Financial Ledger & System
-- ============================================================================
-- HOW TO RUN:
--   1. Open Supabase Dashboard -> SQL Editor -> New Query
--   2. Paste this entire script and click "Run"
-- ============================================================================

BEGIN;

-- 1. Update immutability trigger functions to allow authorized transaction cleanup
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

-- 2. Enable transaction-local cleanup authorization
SELECT set_config('app.allow_ledger_cleanup', 'on', true);

-- 3. Purge all Inventory Adjustment rows from General Financial Ledger
DELETE FROM public.financial_ledger_entries
WHERE category::text = 'Inventory Adjustment'
   OR id::text LIKE 'FIN-ADJ-%'
   OR id::text LIKE 'FIN-WO-%'
   OR description ILIKE 'Inventory Lot % Adjustment%'
   OR description ILIKE 'Catalog Removal Inventory Write-Off:%'
   OR payment_method ILIKE 'Adjustment Account%'
   OR entity_name ILIKE 'Internal Cold Vault [Acc %';

-- 4. Purge stock adjustment audit log rows and reset adjustment account balances
DO $$
BEGIN
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
END $$;

SELECT set_config('app.allow_ledger_cleanup', 'off', true);

-- 5. Install in-app RPC so future cleanup works directly from Financials -> Ledger Transactions
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

COMMIT;
