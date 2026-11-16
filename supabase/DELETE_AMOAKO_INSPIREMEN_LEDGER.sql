-- ============================================================================
-- SUPABASE SQL EDITOR SCRIPT:
-- Delete Financial Ledger Entries Associated with "Amoako Emmanuel" or "Inspiremen"
-- (+ Reversal Entries & Install In-App Delete RPC)
--
-- HOW TO RUN:
--   1. Open Supabase Dashboard -> SQL Editor -> New Query
--   2. Paste this entire script and click "Run"
--   (Do NOT delete rows from the Table Editor UI — the immutability trigger
--    blocks direct Table Editor deletes by design.)
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

-- 3. Delete entries associated with Amoako Emmanuel or Inspiremen
--    (Uses to_jsonb(f) for optional columns so it works across all schema versions)
DELETE FROM public.financial_ledger_entries f
WHERE
    -- Direct matches on entity_name, description, reference_id, or optional text columns
    (f.entity_name ILIKE '%amoako%' AND f.entity_name ILIKE '%emmanuel%')
    OR f.entity_name ILIKE '%amoakoemmanuel%'
    OR f.entity_name ILIKE '%amoakoimml%'
    OR f.entity_name ILIKE '%inspiremen%'
    OR (f.description ILIKE '%amoako%' AND f.description ILIKE '%emmanuel%')
    OR f.description ILIKE '%amoakoemmanuel%'
    OR f.description ILIKE '%amoakoimml%'
    OR f.description ILIKE '%inspiremen%'
    OR f.reference_id ILIKE '%amoako%'
    OR f.reference_id ILIKE '%inspiremen%'
    OR COALESCE(to_jsonb(f)->>'notes', '') ILIKE '%amoako%emmanuel%'
    OR COALESCE(to_jsonb(f)->>'notes', '') ILIKE '%inspiremen%'
    OR COALESCE(to_jsonb(f)->>'voucher_number', '') ILIKE '%amoako%'
    OR COALESCE(to_jsonb(f)->>'voucher_number', '') ILIKE '%inspiremen%'
    OR COALESCE(to_jsonb(f)->>'receipt_number', '') ILIKE '%amoako%'
    OR COALESCE(to_jsonb(f)->>'receipt_number', '') ILIKE '%inspiremen%'
    -- Linked customers matching Amoako Emmanuel or Inspiremen
    OR COALESCE(to_jsonb(f)->>'customer_id', '') IN (
        SELECT c.id::text
        FROM public.customers c
        WHERE (c.name ILIKE '%amoako%' AND c.name ILIKE '%emmanuel%')
           OR c.name ILIKE '%inspiremen%'
           OR COALESCE(to_jsonb(c)->>'company_name', '') ILIKE '%inspiremen%'
           OR COALESCE(to_jsonb(c)->>'contact_person', '') ILIKE '%amoako%emmanuel%'
    )
    -- Linked suppliers matching Amoako Emmanuel or Inspiremen
    OR COALESCE(to_jsonb(f)->>'supplier_id', '') IN (
        SELECT s.id::text
        FROM public.suppliers s
        WHERE (s.name ILIKE '%amoako%' AND s.name ILIKE '%emmanuel%')
           OR s.name ILIKE '%inspiremen%'
           OR COALESCE(to_jsonb(s)->>'contact_person', '') ILIKE '%amoako%emmanuel%'
    );

-- 4. Also purge any leftover reversal entries
DELETE FROM public.financial_ledger_entries
WHERE id::text LIKE 'FIN-REV-%'
   OR reference_id LIKE 'REV-%'
   OR description ILIKE 'Payment Reversal / Void%'
   OR description ILIKE 'Disbursement Reversal / Void%'
   OR description ILIKE '%[REVERSED:%';

SELECT set_config('app.allow_ledger_cleanup', 'off', true);

-- 5. Install in-app RPCs so future cleanup works straight from Financials -> Ledger Transactions
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

    PERFORM set_config('app.allow_ledger_cleanup', 'on', true);

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

    PERFORM set_config('app.allow_ledger_cleanup', 'off', true);

    RETURN v_deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_financial_ledger_entries_by_ids(p_entry_ids TEXT[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_org_id UUID;
    v_deleted_count INTEGER := 0;
BEGIN
    IF p_entry_ids IS NULL OR array_length(p_entry_ids, 1) IS NULL THEN
        RETURN 0;
    END IF;

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
      AND id::text = ANY(p_entry_ids);

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    PERFORM set_config('app.allow_ledger_cleanup', 'off', true);

    RETURN v_deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clear_financial_ledger_reversals() TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_financial_ledger_entries_by_ids(TEXT[]) TO authenticated;

COMMIT;
