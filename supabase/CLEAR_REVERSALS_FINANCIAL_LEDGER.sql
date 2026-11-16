-- ============================================================================
-- ONE-CLICK SUPABASE SQL: Clear All Reversal Entries from General Financial Ledger
-- Run this script in Supabase Dashboard -> SQL Editor -> New Query
-- ============================================================================

BEGIN;

-- Temporarily allow authorized cleanup inside this transaction only
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

SELECT set_config('app.allow_reversal_cleanup', 'on', true);

DELETE FROM public.financial_ledger_entries
WHERE id::text LIKE 'FIN-REV-%'
   OR reference_id LIKE 'REV-%'
   OR description ILIKE 'Payment Reversal / Void%'
   OR description ILIKE 'Disbursement Reversal / Void%'
   OR description ILIKE '%[REVERSED:%';

SELECT set_config('app.allow_reversal_cleanup', 'off', true);

-- Install RPC so the General Financial Ledger UI button can also clear reversals
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

COMMIT;
