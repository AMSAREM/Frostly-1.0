-- ============================================================================
-- FROSTLY SEAFOOD COLD-CHAIN ERP
-- Migration 009: Clean Production State (No Mock/Seeded Transactions)
-- ============================================================================

-- 1. App Settings Default Configuration (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.app_settings WHERE id = 1) THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'app_settings' AND column_name = 'organization_id'
        ) THEN
            INSERT INTO public.app_settings (
                id, organization_id, company_name, facility_code, fda_registration_number, eu_approval_number,
                haccp_coordinator, primary_port, tax_rate, currency, super_cryo_target_c,
                super_cryo_max_alert_c, commercial_freeze_target_c, commercial_freeze_max_alert_c,
                slush_ice_target_c, slush_ice_max_alert_c, histamine_limit_ppm
            ) VALUES (
                1, '00000000-0000-0000-0000-000000000001', 'Frostly Cold-Chain Operations', 'FAC-001', '', '',
                '', '', 0.00, 'GHS',
                -60.0, -50.0, -22.0, -18.0, 0.5, 3.0, 50.0
            );
        ELSE
            INSERT INTO public.app_settings (
                id, company_name, facility_code, fda_registration_number, eu_approval_number,
                haccp_coordinator, primary_port, tax_rate, currency, super_cryo_target_c,
                super_cryo_max_alert_c, commercial_freeze_target_c, commercial_freeze_max_alert_c,
                slush_ice_target_c, slush_ice_max_alert_c, histamine_limit_ppm
            ) VALUES (
                1, 'Frostly Cold-Chain Operations', 'FAC-001', '', '',
                '', '', 0.00, 'GHS',
                -60.0, -50.0, -22.0, -18.0, 0.5, 3.0, 50.0
            );
        END IF;
    END IF;
END $$;
