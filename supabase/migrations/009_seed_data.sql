-- ============================================================================
-- FROSTLY SEAFOOD COLD-CHAIN ERP
-- Migration 009: Clean Production State (No Mock/Seeded Transactions)
-- ============================================================================

-- 1. App Settings Default Configuration (if not exists)
INSERT INTO public.app_settings (
    id, company_name, facility_code, fda_registration_number, eu_approval_number,
    haccp_coordinator, primary_port, tax_rate, currency, super_cryo_target_c,
    super_cryo_max_alert_c, commercial_freeze_target_c, commercial_freeze_max_alert_c,
    slush_ice_target_c, slush_ice_max_alert_c, histamine_limit_ppm
) VALUES (
    1, 'Frostly Cold-Chain Operations', 'FAC-001', '', '',
    '', '', 0.00, 'GHS',
    -60.0, -50.0, -22.0, -18.0, 0.5, 3.0, 50.0
)
ON CONFLICT (id) DO NOTHING;
