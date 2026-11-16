-- ============================================================================
-- Migration 034: Authorized Tenant-Scoped RPC to Edit / Update Expenses
-- in public.financial_ledger_entries
-- ============================================================================
-- Background:
--   There is NO separate "expenses" table in Supabase; all operating expenses
--   are stored in public.financial_ledger_entries with type = 'OpEx'.
--   Because trg_immutable_financial_ledger blocks direct client UPDATEs,
--   this migration installs a SECURITY DEFINER RPC that updates an expense row
--   within the authenticated staff user's organization_id.
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

CREATE OR REPLACE FUNCTION public.update_financial_ledger_expense(
    p_entry_id TEXT,
    p_entry_date DATE,
    p_category TEXT,
    p_description TEXT,
    p_reference_id TEXT,
    p_entity_name TEXT,
    p_amount NUMERIC,
    p_payment_method TEXT,
    p_status TEXT,
    p_notes TEXT DEFAULT NULL,
    p_voucher_number TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_org_id UUID;
    v_updated public.financial_ledger_entries%ROWTYPE;
    v_has_notes BOOLEAN := FALSE;
    v_has_voucher BOOLEAN := FALSE;
BEGIN
    IF NOT public.is_staff() THEN
        RAISE EXCEPTION 'Unauthorized: staff authentication required.';
    END IF;

    v_org_id := public.current_org_id();
    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'Organization ID could not be resolved for active user.';
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Expense amount must be greater than zero.';
    END IF;

    IF p_status NOT IN ('Settled', 'Pending', 'Overdue') THEN
        RAISE EXCEPTION 'Invalid status: %', p_status;
    END IF;

    PERFORM set_config('app.allow_ledger_cleanup', 'on', true);

    UPDATE public.financial_ledger_entries
    SET
        entry_date = COALESCE(p_entry_date, entry_date),
        type = CASE
            WHEN p_category = 'COGS (Catch Intake)' THEN 'COGS'::public.financial_entry_type
            ELSE 'OpEx'::public.financial_entry_type
        END,
        category = p_category::public.financial_entry_category,
        description = COALESCE(NULLIF(TRIM(p_description), ''), description),
        reference_id = COALESCE(NULLIF(TRIM(p_reference_id), ''), reference_id),
        entity_name = COALESCE(NULLIF(TRIM(p_entity_name), ''), entity_name),
        amount = ROUND(p_amount, 2),
        payment_method = COALESCE(NULLIF(TRIM(p_payment_method), ''), payment_method),
        status = p_status
    WHERE organization_id = v_org_id
      AND id::text = p_entry_id
    RETURNING * INTO v_updated;

    IF NOT FOUND THEN
        PERFORM set_config('app.allow_ledger_cleanup', 'off', true);
        RETURN NULL;
    END IF;

    -- Safely update optional columns if present in this database
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'financial_ledger_entries'
          AND column_name = 'notes'
    ) INTO v_has_notes;

    IF v_has_notes THEN
        EXECUTE 'UPDATE public.financial_ledger_entries SET notes = $1 WHERE organization_id = $2 AND id::text = $3'
        USING p_notes, v_org_id, p_entry_id;
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'financial_ledger_entries'
          AND column_name = 'voucher_number'
    ) INTO v_has_voucher;

    IF v_has_voucher THEN
        EXECUTE 'UPDATE public.financial_ledger_entries SET voucher_number = $1 WHERE organization_id = $2 AND id::text = $3'
        USING p_voucher_number, v_org_id, p_entry_id;
    END IF;

    SELECT * INTO v_updated
    FROM public.financial_ledger_entries
    WHERE organization_id = v_org_id
      AND id::text = p_entry_id;

    PERFORM set_config('app.allow_ledger_cleanup', 'off', true);

    RETURN to_jsonb(v_updated);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_financial_ledger_expense(
    TEXT, DATE, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT
) TO authenticated;
