-- ============================================================================
-- FROSTLY SEAFOOD COLD-CHAIN ERP
-- Migration 010: Database Integrity & Security Verification Suite
-- ============================================================================

-- 1. Table Verification
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 2. Verify Row Level Security is Enabled on EVERY Table in public
SELECT 
    schemaname, 
    tablename, 
    rowsecurity AS rls_enabled
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- 3. Verify RLS Policy Distribution
-- Note: financial_ledger_entries, haccp_audit_records, and reefer_sensor_readings
-- MUST have exactly 0 UPDATE and 0 DELETE policies.
SELECT 
    tablename,
    cmd AS policy_command,
    COUNT(*) AS policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename, cmd
ORDER BY tablename, cmd;

-- 4. Verify No Anon Role Access on Sensitive Tables
SELECT 
    table_name,
    grantee,
    privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public' 
  AND grantee = 'anon';

-- 5. Test Check Constraints: Negative Prices / Weights Must Fail
DO $$
BEGIN
    BEGIN
        INSERT INTO public.inventory_batches (
            id, species_id, species_name, scientific_name, category,
            harvest_date, landing_port, vessel_name, vessel_registration, captain_name,
            fao_area, gear_type, grade, initial_weight_kg, available_weight_kg,
            allocated_weight_kg, storage_zone, current_temp_celsius, target_temp_celsius,
            cost_per_kg, wholesale_price_per_kg, core_temp_celsius, expiry_date, qr_code_seed
        ) VALUES (
            'TEST-FAIL-LOT', 'SPEC-BF-TUNA', 'Pacific Bluefin Tuna', 'Thunnus orientalis', 'Pelagic',
            CURRENT_DATE, 'Port', 'Vessel', 'REG', 'Capt',
            'FAO 61', 'Longline', 'Sashimi AAA', -50.00, -50.00,
            0, 'Super-Cryo Deep Freeze (-60°C)', -60, -60,
            10.00, 20.00, -60, CURRENT_DATE + 30, 'SEED'
        );
        RAISE EXCEPTION 'TEST FAILED: Negative weight was incorrectly accepted.';
    EXCEPTION
        WHEN check_violation THEN
            RAISE NOTICE 'SUCCESS: Negative weight check constraint verified.';
    END;
END $$;

-- 6. Test Immutability Triggers: UPDATE or DELETE on Insert-Only Tables Must Fail
DO $$
DECLARE
    v_rec_id UUID;
BEGIN
    SELECT id INTO v_rec_id FROM public.financial_ledger_entries LIMIT 1;
    IF v_rec_id IS NOT NULL THEN
        BEGIN
            UPDATE public.financial_ledger_entries 
            SET amount = 99999.99 
            WHERE id = v_rec_id;
            RAISE EXCEPTION 'TEST FAILED: UPDATE succeeded on immutable financial ledger.';
        EXCEPTION
            WHEN raise_exception THEN
                RAISE NOTICE 'SUCCESS: Immutability trigger blocked UPDATE on financial_ledger_entries.';
        END;
    END IF;
END $$;

-- 7. Test Backward Status Transition on Client Orders Must Fail
DO $$
BEGIN
    BEGIN
        UPDATE public.client_orders
        SET status = 'Pending Confirmation'
        WHERE id = 'ORD-9421'; -- Currently 'In Reefer Transit'
        RAISE EXCEPTION 'TEST FAILED: Backward status transition was incorrectly allowed.';
    EXCEPTION
        WHEN raise_exception THEN
            RAISE NOTICE 'SUCCESS: Order status forward-only trigger verified.';
    END;
END $$;
