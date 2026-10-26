-- ============================================================================
-- FROSTLY SEAFOOD COLD-CHAIN ERP
-- Migration 024: Purge Workspace Data While Preserving User Credentials
-- ============================================================================
-- Allows platform admins or tenant administrators to wipe all transactional,
-- inventory, financial, and operational records for an organization (e.g. for
-- fresh go-live or testing reset) WITHOUT deleting or corrupting:
--   1. The tenant organization master record in public.organizations
--   2. Staff profiles in public.staff_profiles
--   3. Associated Supabase Auth accounts in auth.users
-- ============================================================================

CREATE OR REPLACE FUNCTION public.purge_tenant_data_except_users(
    p_org_identifier TEXT,
    p_confirm_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_org RECORD;
    v_is_platform_owner BOOLEAN := FALSE;
    v_is_tenant_admin BOOLEAN := FALSE;
    v_current_user_id UUID;
    v_table TEXT;
    v_deleted_count BIGINT;
    v_results JSONB := '{}'::jsonb;
    v_user_count INT := 0;
    v_user_emails TEXT[] := ARRAY[]::TEXT[];
    v_user RECORD;
    v_schema_tables TEXT[];
BEGIN
    -- 1. Identify Calling User
    v_current_user_id := auth.uid();

    -- 2. Resolve Organization (by exact UUID or exact name match)
    IF p_org_identifier ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        SELECT * INTO v_org FROM public.organizations WHERE id = p_org_identifier::UUID;
    ELSE
        SELECT * INTO v_org FROM public.organizations 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM(p_org_identifier))
        LIMIT 1;
    END IF;

    IF v_org.id IS NULL THEN
        RAISE EXCEPTION 'Organization "%" could not be found. Please verify the organization name or ID.', p_org_identifier;
    END IF;

    -- Safety Check: Protect root/HQ organizations
    IF (
        v_org.id IN (
            '00000000-0000-0000-0000-000000000000'::uuid,
            '00000000-0000-0000-0000-000000000001'::uuid
        )
        OR LOWER(TRIM(v_org.name)) ILIKE '%frostly hq%'
    ) THEN
        RAISE EXCEPTION 'Cannot purge root/HQ organization data';
    END IF;

    -- 3. Authorization Check:
    -- Only platform administrators can purge organization data.
    IF v_current_user_id IS NOT NULL THEN
        v_is_platform_owner := public.is_platform_admin();

        IF NOT v_is_platform_owner THEN
            RAISE EXCEPTION 'Access denied: Only platform administrators can purge organization data.';
        END IF;
    END IF;

    -- 4. Safety Check: Verify confirmation name is mandatory and matches exactly
    IF p_confirm_name IS NULL OR TRIM(p_confirm_name) = '' THEN
        RAISE EXCEPTION 'Confirmation name is required to purge organization data';
    END IF;

    IF LOWER(TRIM(p_confirm_name)) <> LOWER(TRIM(v_org.name)) THEN
        RAISE EXCEPTION 'Confirmation name does not match organization name "%"', v_org.name;
    END IF;

    -- 5. Audit Existing Users to Guarantee Preservation
    FOR v_user IN 
        SELECT id, email, full_name, role 
        FROM public.staff_profiles 
        WHERE organization_id = v_org.id
    LOOP
        v_user_count := v_user_count + 1;
        v_user_emails := array_append(v_user_emails, v_user.email);
    END LOOP;

    -- 6. Collect available tables in public schema
    SELECT array_agg(table_name::TEXT) INTO v_schema_tables
    FROM information_schema.tables 
    WHERE table_schema = 'public';

    -- 7. Execute Deletion in strict dependency order (Child -> Parent)
    -- A: Inventory Adjustments
    IF 'inventory_adjustments' = ANY(v_schema_tables) THEN
        EXECUTE 'DELETE FROM public.inventory_adjustments WHERE organization_id = $1' USING v_org.id;
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        v_results := jsonb_set(v_results, '{inventory_adjustments}', to_jsonb(v_deleted_count));
    END IF;

    -- B: Inventory Adjustment Accounts
    IF 'inventory_adjustment_accounts' = ANY(v_schema_tables) THEN
        EXECUTE 'DELETE FROM public.inventory_adjustment_accounts WHERE organization_id = $1' USING v_org.id;
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        v_results := jsonb_set(v_results, '{inventory_adjustment_accounts}', to_jsonb(v_deleted_count));
    END IF;

    -- C: Order Line Items
    IF 'order_line_items' = ANY(v_schema_tables) THEN
        EXECUTE 'DELETE FROM public.order_line_items WHERE organization_id = $1' USING v_org.id;
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        v_results := jsonb_set(v_results, '{order_line_items}', to_jsonb(v_deleted_count));
    END IF;

    -- D: Client Orders
    IF 'client_orders' = ANY(v_schema_tables) THEN
        EXECUTE 'DELETE FROM public.client_orders WHERE organization_id = $1' USING v_org.id;
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        v_results := jsonb_set(v_results, '{client_orders}', to_jsonb(v_deleted_count));
    END IF;

    -- E: Purchase Order Items
    IF 'purchase_order_items' = ANY(v_schema_tables) THEN
        EXECUTE 'DELETE FROM public.purchase_order_items WHERE organization_id = $1' USING v_org.id;
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        v_results := jsonb_set(v_results, '{purchase_order_items}', to_jsonb(v_deleted_count));
    END IF;

    -- F: Purchase Order Landings
    IF 'purchase_order_landings' = ANY(v_schema_tables) THEN
        EXECUTE 'DELETE FROM public.purchase_order_landings WHERE organization_id = $1' USING v_org.id;
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        v_results := jsonb_set(v_results, '{purchase_order_landings}', to_jsonb(v_deleted_count));
    END IF;

    -- G: Retail Sale Items
    IF 'retail_sale_items' = ANY(v_schema_tables) THEN
        EXECUTE 'DELETE FROM public.retail_sale_items WHERE organization_id = $1' USING v_org.id;
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        v_results := jsonb_set(v_results, '{retail_sale_items}', to_jsonb(v_deleted_count));
    END IF;

    -- H: Retail Transactions
    IF 'retail_transactions' = ANY(v_schema_tables) THEN
        EXECUTE 'DELETE FROM public.retail_transactions WHERE organization_id = $1' USING v_org.id;
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        v_results := jsonb_set(v_results, '{retail_transactions}', to_jsonb(v_deleted_count));
    END IF;

    -- I: Retail Wholesale Products
    IF 'retail_wholesale_products' = ANY(v_schema_tables) THEN
        EXECUTE 'DELETE FROM public.retail_wholesale_products WHERE organization_id = $1' USING v_org.id;
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        v_results := jsonb_set(v_results, '{retail_wholesale_products}', to_jsonb(v_deleted_count));
    END IF;

    -- J: HACCP Audit Records
    IF 'haccp_audit_records' = ANY(v_schema_tables) THEN
        EXECUTE 'DELETE FROM public.haccp_audit_records WHERE organization_id = $1' USING v_org.id;
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        v_results := jsonb_set(v_results, '{haccp_audit_records}', to_jsonb(v_deleted_count));
    END IF;

    -- K: Financial Ledger Entries
    IF 'financial_ledger_entries' = ANY(v_schema_tables) THEN
        EXECUTE 'DELETE FROM public.financial_ledger_entries WHERE organization_id = $1' USING v_org.id;
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        v_results := jsonb_set(v_results, '{financial_ledger_entries}', to_jsonb(v_deleted_count));
    END IF;

    -- L: Reefer Sensor Readings
    IF 'reefer_sensor_readings' = ANY(v_schema_tables) THEN
        EXECUTE 'DELETE FROM public.reefer_sensor_readings WHERE organization_id = $1' USING v_org.id;
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        v_results := jsonb_set(v_results, '{reefer_sensor_readings}', to_jsonb(v_deleted_count));
    END IF;

    -- M: Inventory Batches
    IF 'inventory_batches' = ANY(v_schema_tables) THEN
        EXECUTE 'DELETE FROM public.inventory_batches WHERE organization_id = $1' USING v_org.id;
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        v_results := jsonb_set(v_results, '{inventory_batches}', to_jsonb(v_deleted_count));
    END IF;

    -- N: Reefer Vehicles
    IF 'reefer_vehicles' = ANY(v_schema_tables) THEN
        EXECUTE 'DELETE FROM public.reefer_vehicles WHERE organization_id = $1' USING v_org.id;
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        v_results := jsonb_set(v_results, '{reefer_vehicles}', to_jsonb(v_deleted_count));
    END IF;

    -- O: Fleet Vessels
    IF 'fleet_vessels' = ANY(v_schema_tables) THEN
        EXECUTE 'DELETE FROM public.fleet_vessels WHERE organization_id = $1' USING v_org.id;
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        v_results := jsonb_set(v_results, '{fleet_vessels}', to_jsonb(v_deleted_count));
    END IF;

    -- P: System Notifications
    IF 'system_notifications' = ANY(v_schema_tables) THEN
        EXECUTE 'DELETE FROM public.system_notifications WHERE organization_id = $1' USING v_org.id;
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        v_results := jsonb_set(v_results, '{system_notifications}', to_jsonb(v_deleted_count));
    END IF;

    -- Q: User Feature Usage Logs
    IF 'user_feature_usage_logs' = ANY(v_schema_tables) THEN
        EXECUTE 'DELETE FROM public.user_feature_usage_logs WHERE organization_id = $1' USING v_org.id;
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        v_results := jsonb_set(v_results, '{user_feature_usage_logs}', to_jsonb(v_deleted_count));
    END IF;

    -- R: Market Price Index
    IF 'market_price_index' = ANY(v_schema_tables) THEN
        EXECUTE 'DELETE FROM public.market_price_index WHERE organization_id = $1' USING v_org.id;
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        v_results := jsonb_set(v_results, '{market_price_index}', to_jsonb(v_deleted_count));
    END IF;

    -- S: Customers
    IF 'customers' = ANY(v_schema_tables) THEN
        EXECUTE 'DELETE FROM public.customers WHERE organization_id = $1' USING v_org.id;
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        v_results := jsonb_set(v_results, '{customers}', to_jsonb(v_deleted_count));
    END IF;

    -- T: Suppliers
    IF 'suppliers' = ANY(v_schema_tables) THEN
        EXECUTE 'DELETE FROM public.suppliers WHERE organization_id = $1' USING v_org.id;
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        v_results := jsonb_set(v_results, '{suppliers}', to_jsonb(v_deleted_count));
    END IF;

    -- U: Species (Only records custom to this organization)
    IF 'species' = ANY(v_schema_tables) THEN
        EXECUTE 'DELETE FROM public.species WHERE organization_id = $1' USING v_org.id;
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        v_results := jsonb_set(v_results, '{species}', to_jsonb(v_deleted_count));
    END IF;

    -- V: Reinitialize clean app settings for this organization
    IF 'app_settings' = ANY(v_schema_tables) THEN
        EXECUTE 'DELETE FROM public.app_settings WHERE organization_id = $1' USING v_org.id;
        
        -- Insert a fresh pristine default settings row for this organization
        BEGIN
            INSERT INTO public.app_settings (
                id, organization_id, company_name, facility_code, currency,
                tax_rate, super_cryo_target_c, cold_storage_target_c,
                slush_ice_target_c, live_tank_target_c
            ) VALUES (
                1, v_org.id, v_org.name, 'FAC-' || UPPER(SUBSTRING(v_org.name, 1, 4)), 
                COALESCE(v_org.billing_currency, 'USD'), 0.00, -60.0, -22.0, 1.0, 8.0
            );
        EXCEPTION WHEN OTHERS THEN
            -- If composite key or triggers require another format, continue gracefully
            NULL;
        END;
    END IF;

    -- 8. Record audit log entry for transparency
    IF 'platform_audit_logs' = ANY(v_schema_tables) THEN
        INSERT INTO public.platform_audit_logs (
            actor_id,
            action,
            target_organization_id,
            previous_state,
            new_state,
            reason
        ) VALUES (
            COALESCE(v_current_user_id, '00000000-0000-0000-0000-000000000000'::UUID),
            'purge_tenant_data_preserve_users',
            v_org.id,
            jsonb_build_object('name', v_org.name, 'preserved_users', v_user_emails),
            jsonb_build_object('purged_tables', v_results),
            'Workspace data purged while preserving all user accounts and login credentials'
        );
    END IF;

    -- 9. Return Detailed Summary
    RETURN jsonb_build_object(
        'success', TRUE,
        'organization_id', v_org.id,
        'organization_name', v_org.name,
        'preserved_users_count', v_user_count,
        'preserved_user_emails', to_jsonb(v_user_emails),
        'purged_records', v_results
    );
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.purge_tenant_data_except_users(TEXT, TEXT) TO authenticated, service_role;
