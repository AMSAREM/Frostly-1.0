-- ============================================================================
-- Migration 033: Authorized Tenant-Scoped Deletion RPC for Nuisance / Erroneous
-- Financial Ledger Entries
-- ============================================================================
-- Why:
--   public.financial_ledger_entries is protected by trg_immutable_financial_ledger
--   (enforce_insert_only_compliance / enforce_insert_only), so direct deletions
--   in the Supabase Table Editor fail with:
--     ERROR: P0001: LEGAL & REGULATORY VIOLATION: Table financial_ledger_entries
--     is strictly insert-only. Modifications and deletions are prohibited.
--
--   This migration:
--   1. Permits deletions ONLY inside a transaction that sets
--      app.allow_ledger_cleanup = 'on' (or app.allow_reversal_cleanup = 'on').
--   2. Installs SECURITY DEFINER RPC public.delete_financial_ledger_entries_by_ids(TEXT[])
--      scoped strictly to the authenticated staff member's organization_id.
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

GRANT EXECUTE ON FUNCTION public.delete_financial_ledger_entries_by_ids(TEXT[]) TO authenticated;
