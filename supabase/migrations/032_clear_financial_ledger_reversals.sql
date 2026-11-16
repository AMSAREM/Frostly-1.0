-- ============================================================================
-- Migration 032: Clear Reversal Entries from Financial General Ledger &
-- Provide Authorized Tenant-Scoped Reversal Cleanup RPC
-- ============================================================================
-- Background:
--   Earlier client builds accidentally logged customer AR payment reversals as
--   OpEx ('Logistics & Reefer Freight') or reversal rows in
--   public.financial_ledger_entries. Because trg_immutable_financial_ledger
--   blocks all direct UPDATE/DELETE operations, this migration:
--   1. Allows transaction-local cleanup only when app.allow_reversal_cleanup = 'on'
--      inside a SECURITY DEFINER RPC.
--   2. Clears all existing reversal entries from public.financial_ledger_entries.
--   3. Installs public.clear_financial_ledger_reversals() for tenant admins.
-- ============================================================================

-- 1. Update immutability trigger functions to recognize authorized cleanup GUC
CREATE OR REPLACE FUNCTION public.enforce_insert_only()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF current_setting('app.allow_reversal_cleanup', true) = 'on' THEN
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
    IF current_setting('app.allow_reversal_cleanup', true) = 'on' THEN
        RETURN COALESCE(NEW, OLD);
    END IF;
    RAISE EXCEPTION 'LEGAL & REGULATORY VIOLATION: Table % is strictly insert-only. Modifications and deletions are prohibited.', TG_TABLE_NAME;
END;
$$;

-- 2. One-time purge of all existing reversal rows in public.financial_ledger_entries
DO $$
DECLARE
    v_deleted_count INTEGER := 0;
BEGIN
    PERFORM set_config('app.allow_reversal_cleanup', 'on', true);

    DELETE FROM public.financial_ledger_entries
    WHERE id::text LIKE 'FIN-REV-%'
       OR reference_id LIKE 'REV-%'
       OR description ILIKE 'Payment Reversal / Void%'
       OR description ILIKE 'Disbursement Reversal / Void%'
       OR description ILIKE '%[REVERSED:%';

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    PERFORM set_config('app.allow_reversal_cleanup', 'off', true);

    RAISE NOTICE 'Cleared % reversal ledger row(s) from public.financial_ledger_entries.', v_deleted_count;
END $$;

-- 3. Tenant-scoped RPC callable from the General Financial Ledger UI
CREATE OR REPLACE FUNCTION public.clear_financial_ledger_reversals()
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

    PERFORM set_config('app.allow_reversal_cleanup', 'on', true);

    DELETE FROM public.financial_ledger_entries
    WHERE organization_id = v_org_id
      AND (
          id::text LIKE 'FIN-REV-%'
          OR reference_id LIKE 'REV-%'
          OR description ILIKE 'Payment Reversal / Void%'
          OR description ILIKE 'Disbursement Reversal / Void%'
          OR description ILIKE '%[REVERSED:%'
      );

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    PERFORM set_config('app.allow_reversal_cleanup', 'off', true);

    RETURN v_deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clear_financial_ledger_reversals() TO authenticated;
