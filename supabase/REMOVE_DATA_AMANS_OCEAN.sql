-- ============================================================================
-- FROSTLY SEAFOOD COLD-CHAIN ERP
-- ONE-CLICK SUPABASE SQL SCRIPT: PURGE ALL DATA FROM "Amans ocean"
-- (PRESERVING ALL USER ACCOUNTS, PASSWORDS, AND STAFF CREDENTIALS)
-- ============================================================================
-- Instructions:
-- 1. Open your Supabase Dashboard: https://supabase.com/dashboard/
-- 2. Select your Frostly project -> Click "SQL Editor" in the left sidebar
-- 3. Click "New Query", paste this entire script, and click "Run" (Ctrl+Enter)
-- ============================================================================

DO $$
DECLARE
    v_org RECORD;
    v_staff RECORD;
    v_staff_count INT := 0;
    v_deleted_count BIGINT;
    v_target_name_query TEXT := 'amans ocean';
    v_tables TEXT[];
BEGIN
    RAISE NOTICE '============================================================================';
    RAISE NOTICE '▶ INITIATING WORKSPACE DATA PURGE FOR "Amans ocean"';
    RAISE NOTICE '============================================================================';

    -- 1. Locate the Organization "Amans ocean" (case-insensitive & accent-insensitive)
    SELECT * INTO v_org 
    FROM public.organizations 
    WHERE LOWER(TRIM(name)) = v_target_name_query
       OR LOWER(TRIM(name)) = 'aman''s ocean'
       OR LOWER(TRIM(name)) LIKE '%aman%ocean%'
       OR LOWER(TRIM(name)) LIKE '%amans%'
    ORDER BY 
        CASE 
            WHEN LOWER(TRIM(name)) = v_target_name_query THEN 1
            WHEN LOWER(TRIM(name)) = 'aman''s ocean' THEN 2
            ELSE 3
        END
    LIMIT 1;

    -- If not found, list available organizations to assist the user
    IF v_org.id IS NULL THEN
        RAISE NOTICE '⚠️ Organization matching "%" was not found.', v_target_name_query;
        RAISE NOTICE 'Available organizations currently in your database:';
        FOR v_org IN SELECT id, name, created_at FROM public.organizations ORDER BY created_at DESC LOOP
            RAISE NOTICE '  - [%] "%" (created: %)', v_org.id, v_org.name, v_org.created_at;
        END LOOP;
        RAISE EXCEPTION 'Aborted: Could not find target organization "Amans ocean". Please check the name listed above.';
    END IF;

    RAISE NOTICE '✓ FOUND TARGET ORGANIZATION:';
    RAISE NOTICE '  ID:   %', v_org.id;
    RAISE NOTICE '  Name: "%"', v_org.name;
    RAISE NOTICE '  Tier: % (Status: %)', v_org.plan_tier, v_org.subscription_status;
    RAISE NOTICE '----------------------------------------------------------------------------';

    -- 2. Audit and confirm User Credentials to PRESERVE
    RAISE NOTICE '🔒 AUDITING USER CREDENTIALS (THESE WILL REMAIN FULLY PRESERVED & INTACT):';
    FOR v_staff IN 
        SELECT id, email, full_name, role, is_active 
        FROM public.staff_profiles 
        WHERE organization_id = v_org.id 
        ORDER BY created_at ASC
    LOOP
        v_staff_count := v_staff_count + 1;
        RAISE NOTICE '  [%] % (%): role = %, active = %', 
            v_staff_count, v_staff.full_name, v_staff.email, v_staff.role, v_staff.is_active;
    END LOOP;

    IF v_staff_count = 0 THEN
        RAISE NOTICE '  (No staff profiles found directly under this organization_id)';
    ELSE
        RAISE NOTICE '  Total User Credentials Preserved: %', v_staff_count;
    END IF;
    RAISE NOTICE '----------------------------------------------------------------------------';

    -- 3. Gather existing tables in public schema
    SELECT array_agg(table_name::TEXT) INTO v_tables
    FROM information_schema.tables 
    WHERE table_schema = 'public';

    RAISE NOTICE '🗑️ PURGING OPERATIONAL, INVENTORY & TRANSACTIONAL RECORDS...';

    -- Table 1: Inventory Adjustments
    IF 'inventory_adjustments' = ANY(v_tables) THEN
        DELETE FROM public.inventory_adjustments WHERE organization_id = v_org.id;
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        RAISE NOTICE '  - inventory_adjustments: % records deleted', v_deleted_count;
    END IF;

    -- Table 2: Inventory Adjustment Accounts
    IF 'inventory_adjustment_accounts' = ANY(v_tables) THEN
        DELETE FROM public.inventory_adjustment_accounts WHERE organization_id = v_org.id;
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        RAISE NOTICE '  - inventory_adjustment_accounts: % records deleted', v_deleted_count;
    END IF;

    -- Table 3: Order Line Items
    IF 'order_line_items' = ANY(v_tables) THEN
        DELETE FROM public.order_line_items WHERE organization_id = v_org.id;
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        RAISE NOTICE '  - order_line_items: % records deleted', v_deleted_count;
    END IF;

    -- Table 4: Client Orders
    IF 'client_orders' = ANY(v_tables) THEN
        DELETE FROM public.client_orders WHERE organization_id = v_org.id;
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        RAISE NOTICE '  - client_orders: % records deleted', v_deleted_count;
    END IF;

    -- Table 5: Purchase Order Items
    IF 'purchase_order_items' = ANY(v_tables) THEN
        DELETE FROM public.purchase_order_items WHERE organization_id = v_org.id;
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        RAISE NOTICE '  - purchase_order_items: % records deleted', v_deleted_count;
    END IF;

    -- Table 6: Purchase Order Landings
    IF 'purchase_order_landings' = ANY(v_tables) THEN
        DELETE FROM public.purchase_order_landings WHERE organization_id = v_org.id;
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        RAISE NOTICE '  - purchase_order_landings: % records deleted', v_deleted_count;
    END IF;

    -- Table 7: Retail Sale Items
    IF 'retail_sale_items' = ANY(v_tables) THEN
        DELETE FROM public.retail_sale_items WHERE organization_id = v_org.id;
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        RAISE NOTICE '  - retail_sale_items: % records deleted', v_deleted_count;
    END IF;

    -- Table 8: Retail Transactions (POS)
    IF 'retail_transactions' = ANY(v_tables) THEN
        DELETE FROM public.retail_transactions WHERE organization_id = v_org.id;
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        RAISE NOTICE '  - retail_transactions: % records deleted', v_deleted_count;
    END IF;

    -- Table 9: Retail Wholesale Products
    IF 'retail_wholesale_products' = ANY(v_tables) THEN
        DELETE FROM public.retail_wholesale_products WHERE organization_id = v_org.id;
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        RAISE NOTICE '  - retail_wholesale_products: % records deleted', v_deleted_count;
    END IF;

    -- Table 10: HACCP Audit Records
    IF 'haccp_audit_records' = ANY(v_tables) THEN
        DELETE FROM public.haccp_audit_records WHERE organization_id = v_org.id;
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        RAISE NOTICE '  - haccp_audit_records: % records deleted', v_deleted_count;
    END IF;

    -- Table 11: Financial Ledger Entries
    IF 'financial_ledger_entries' = ANY(v_tables) THEN
        DELETE FROM public.financial_ledger_entries WHERE organization_id = v_org.id;
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        RAISE NOTICE '  - financial_ledger_entries: % records deleted', v_deleted_count;
    END IF;

    -- Table 12: Reefer Sensor Readings
    IF 'reefer_sensor_readings' = ANY(v_tables) THEN
        DELETE FROM public.reefer_sensor_readings WHERE organization_id = v_org.id;
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        RAISE NOTICE '  - reefer_sensor_readings: % records deleted', v_deleted_count;
    END IF;

    -- Table 13: Inventory Batches (Seafood lots)
    IF 'inventory_batches' = ANY(v_tables) THEN
        DELETE FROM public.inventory_batches WHERE organization_id = v_org.id;
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        RAISE NOTICE '  - inventory_batches: % records deleted', v_deleted_count;
    END IF;

    -- Table 14: Reefer Vehicles
    IF 'reefer_vehicles' = ANY(v_tables) THEN
        DELETE FROM public.reefer_vehicles WHERE organization_id = v_org.id;
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        RAISE NOTICE '  - reefer_vehicles: % records deleted', v_deleted_count;
    END IF;

    -- Table 15: Fleet Vessels
    IF 'fleet_vessels' = ANY(v_tables) THEN
        DELETE FROM public.fleet_vessels WHERE organization_id = v_org.id;
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        RAISE NOTICE '  - fleet_vessels: % records deleted', v_deleted_count;
    END IF;

    -- Table 16: System Notifications
    IF 'system_notifications' = ANY(v_tables) THEN
        DELETE FROM public.system_notifications WHERE organization_id = v_org.id;
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        RAISE NOTICE '  - system_notifications: % records deleted', v_deleted_count;
    END IF;

    -- Table 17: User Feature Usage Logs
    IF 'user_feature_usage_logs' = ANY(v_tables) THEN
        DELETE FROM public.user_feature_usage_logs WHERE organization_id = v_org.id;
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        RAISE NOTICE '  - user_feature_usage_logs: % records deleted', v_deleted_count;
    END IF;

    -- Table 18: Market Price Index
    IF 'market_price_index' = ANY(v_tables) THEN
        DELETE FROM public.market_price_index WHERE organization_id = v_org.id;
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        RAISE NOTICE '  - market_price_index: % records deleted', v_deleted_count;
    END IF;

    -- Table 19: Customers (Wholesale B2B)
    IF 'customers' = ANY(v_tables) THEN
        DELETE FROM public.customers WHERE organization_id = v_org.id;
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        RAISE NOTICE '  - customers: % records deleted', v_deleted_count;
    END IF;

    -- Table 20: Suppliers (Harvesters & Co-ops)
    IF 'suppliers' = ANY(v_tables) THEN
        DELETE FROM public.suppliers WHERE organization_id = v_org.id;
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        RAISE NOTICE '  - suppliers: % records deleted', v_deleted_count;
    END IF;

    -- Table 21: Species (Tenant-custom species catalog)
    IF 'species' = ANY(v_tables) THEN
        DELETE FROM public.species WHERE organization_id = v_org.id;
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        RAISE NOTICE '  - species: % records deleted', v_deleted_count;
    END IF;

    -- Table 22: App Settings (Reset to clean defaults for Amans ocean)
    IF 'app_settings' = ANY(v_tables) THEN
        DELETE FROM public.app_settings WHERE organization_id = v_org.id;
        
        BEGIN
            INSERT INTO public.app_settings (
                id, organization_id, company_name, facility_code, currency,
                tax_rate, super_cryo_target_c, cold_storage_target_c,
                slush_ice_target_c, live_tank_target_c
            ) VALUES (
                1, v_org.id, v_org.name, 'FAC-' || UPPER(SUBSTRING(v_org.name, 1, 4)), 
                COALESCE(v_org.billing_currency, 'USD'), 0.00, -60.0, -22.0, 1.0, 8.0
            );
            RAISE NOTICE '  - app_settings: Reset to clean initial default configuration';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '  - app_settings: Cleared old custom settings';
        END;
    END IF;

    RAISE NOTICE '----------------------------------------------------------------------------';
    RAISE NOTICE '✅ VERIFICATION & COMPLETION SUMMARY:';
    RAISE NOTICE '  Organization: "%" [%] (PRESERVED)', v_org.name, v_org.id;
    RAISE NOTICE '  User Credentials: % accounts (ALL PRESERVED & UNTOUCHED)', v_staff_count;
    RAISE NOTICE '  Business/Inventory Data: ALL PURGED & CLEANED';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'Operation successfully completed!';
END;
$$;
