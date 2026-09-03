-- ============================================================================
-- FROSTLY SEAFOOD COLD-CHAIN ERP
-- Migration 009: Idempotent Realistic Production Seed Data
-- ============================================================================

-- 1. App Settings Singleton
INSERT INTO public.app_settings (
    id, company_name, facility_code, fda_registration_number, eu_approval_number,
    haccp_coordinator, primary_port, tax_rate, currency, super_cryo_target_c,
    super_cryo_max_alert_c, commercial_freeze_target_c, commercial_freeze_max_alert_c,
    slush_ice_target_c, slush_ice_max_alert_c, histamine_limit_ppm
) VALUES (
    1, 'Pacific Cold-Chain & Seafood Holdings Ltd.', 'FAC-PAC-808-CRY', 'FDA-REG-#1948201', 'EU-ESP-9281-CE',
    'Dr. Elena Rostova, Lead Quality Auditor', 'Port of Tema & Pier 38 Fishing Harbour', 15.00, 'GHS',
    -60.0, -50.0, -22.0, -18.0, 0.5, 3.0, 50.0
)
ON CONFLICT (id) DO NOTHING;

-- 2. Master Species Catalog
INSERT INTO public.species (
    id, name, scientific_name, category, default_zone, standard_price_per_kg,
    available_grades, fao_zones, gear_types, seasonal_peak, image,
    shelf_life_fresh_days, shelf_life_frozen_months
) VALUES 
(
    'SPEC-BF-TUNA', 'Pacific Bluefin Tuna', 'Thunnus orientalis', 'Pelagic',
    'Super-Cryo Deep Freeze (-60°C)', 45.00,
    ARRAY['Sashimi AAA', 'Grade #1', 'Grade #2']::public.quality_grade[],
    ARRAY['FAO 61 (Northwest Pacific)', 'FAO 71 (Western Central Pacific)'],
    ARRAY['Pelagic Longline', 'Pole and Line'],
    'November - February',
    'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80',
    7, 24
),
(
    'SPEC-SALMON', 'Norwegian Atlantic Salmon', 'Salmo salar', 'Salmonid',
    'Fresh Slush Ice (0°C to +2°C)', 22.50,
    ARRAY['Sashimi AAA', 'Grade #1']::public.quality_grade[],
    ARRAY['FAO 27 (Northeast Atlantic)'],
    ARRAY['Aquaculture Sea Pen'],
    'Year-Round Peak',
    'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=1200&q=80',
    12, 18
),
(
    'SPEC-MAHI', 'Wild Pacific Mahi Mahi', 'Coryphaena hippurus', 'Pelagic',
    'Commercial Cold Storage (-22°C)', 18.20,
    ARRAY['Grade #1', 'Grade #2', 'Processing Grade']::public.quality_grade[],
    ARRAY['FAO 77 (Eastern Central Pacific)'],
    ARRAY['Trolling Lines', 'Drifting Longlines'],
    'May - September',
    'https://images.unsplash.com/photo-1534482421-64566f976cfa?auto=format&fit=crop&w=1200&q=80',
    8, 12
),
(
    'SPEC-OCTOPUS', 'Giant Pacific Octopus', 'Enteroctopus dofleini', 'Mollusk',
    'Commercial Cold Storage (-22°C)', 26.00,
    ARRAY['Grade #1', 'Grade #2']::public.quality_grade[],
    ARRAY['FAO 67 (Northeast Pacific)'],
    ARRAY['Pots / Traps'],
    'October - March',
    'https://images.unsplash.com/photo-1545671913-b89ac1b4ac10?auto=format&fit=crop&w=1200&q=80',
    10, 14
)
ON CONFLICT (id) DO NOTHING;

-- 3. Supplier Harvesters
INSERT INTO public.suppliers (
    id, name, contact_person, type, email, phone, port_location, country,
    vessel_names, supplied_species, payment_terms, outstanding_payable_usd,
    total_purchased_usd, total_weight_supplied_kg, rating, status
) VALUES 
(
    'SUP-201', 'Aleutian Longline Cooperative', 'Captain Aris Thorne', 'Fishermen Co-op',
    'ops@aleutianharvesters.org', '+1 (907) 555-0182', 'Dutch Harbor, AK', 'United States',
    ARRAY['F/V Pacific Storm', 'F/V Bering Challenger', 'F/V Ocean Jewel'],
    ARRAY['Pacific Bluefin Tuna', 'Giant Pacific Octopus', 'Wild Pacific Mahi Mahi'],
    'Net-30', 84200.00, 482000.00, 19400.00, 4.95, 'Preferred Partner'
),
(
    'SUP-202', 'Fjord Prime Aquaculture AS', 'Astrid Lindholm', 'Aquaculture Farm',
    'sales@fjordprime.no', '+47 55 90 12 00', 'Bergen Marine Port', 'Norway',
    ARRAY['M/V Fjord Transporter'],
    ARRAY['Norwegian Atlantic Salmon'],
    'Net-15', 38000.00, 712000.00, 32000.00, 4.90, 'Preferred Partner'
)
ON CONFLICT (id) DO NOTHING;

-- 4. B2B Wholesale Customers
INSERT INTO public.customers (
    id, name, company_name, type, tier, contact_person, email, phone,
    address, city, credit_limit_usd, outstanding_balance_usd, payment_terms,
    total_orders_count, total_spend_usd, status
) VALUES 
(
    'CUST-101', 'Chef Kenji Sato', 'Sashimi Master Gastronomy LLC', 'Wholesale Restaurant',
    'Tier 1 (VIP Wholesale -15%)', 'Kenji Sato', 'purchasing@sashimimaster.com', '+1 (415) 555-8921',
    '742 Pier Boulevard, Suite 400', 'San Francisco, CA', 75000.00, 12450.00, 'Net-30',
    24, 184500.00, 'Active'
),
(
    'CUST-102', 'Executive Chef Marcus Vance', 'Ocean Grand Resort & Marina', 'Hotel & Resort',
    'Tier 2 (Standard Wholesale)', 'Marcus Vance', 'procurement@oceangrandresort.com', '+1 (305) 555-3891',
    '1200 Ocean Shore Parkway', 'Miami, FL', 120000.00, 31800.00, 'Net-30',
    18, 245000.00, 'Active'
)
ON CONFLICT (id) DO NOTHING;

-- 5. Inventory Batches (Landed Catch Lots)
INSERT INTO public.inventory_batches (
    id, species_id, species_name, scientific_name, category, harvest_date,
    landing_port, vessel_name, vessel_registration, captain_name, fao_area,
    gps_coordinates, location_description, gear_type, grade, initial_weight_kg,
    available_weight_kg, allocated_weight_kg, storage_zone, current_temp_celsius,
    target_temp_celsius, cost_per_kg, wholesale_price_per_kg, certifications,
    inspection_status, histamine_ppm, core_temp_celsius, received_date, expiry_date,
    qr_code_seed
) VALUES 
(
    'LOT-2026-TUNA-094', 'SPEC-BF-TUNA', 'Pacific Bluefin Tuna', 'Thunnus orientalis', 'Pelagic',
    '2026-08-28', 'Pier 38 Commercial Fish Auction', 'F/V Pacific Storm', 'USCG-DOC-98214',
    'Capt. Thorne', 'FAO 61 (Northwest Pacific)', '{"latitude": 34.219, "longitude": -139.812}'::jsonb,
    'Zone A - Super-Cryo Vault Unit 01', 'Pelagic Longline', 'Sashimi AAA', 680.00,
    460.00, 220.00, 'Super-Cryo Deep Freeze (-60°C)', -59.4, -60.0, 32.00, 48.00,
    ARRAY['MSC Certified', 'Dolphin-Safe', 'HACCP Grade-AAA Verified'], 'Passed', 8.4, -59.1,
    '2026-08-30', '2028-08-30', 'FROSTLY-LOT-2026-TUNA-094-HASH-891A'
),
(
    'LOT-2026-SALM-112', 'SPEC-SALMON', 'Norwegian Atlantic Salmon', 'Salmo salar', 'Salmonid',
    '2026-09-01', 'Bergen Marine Air Terminal', 'M/V Fjord Transporter', 'NO-REG-44912',
    'Capt. Lindholm', 'FAO 27 (Northeast Atlantic)', '{"latitude": 60.391, "longitude": 5.322}'::jsonb,
    'Zone C - Fresh Slush Ice Chilled Room #3', 'Aquaculture Sea Pen', 'Sashimi AAA', 1200.00,
    950.00, 250.00, 'Fresh Slush Ice (0°C to +2°C)', 0.8, 0.5, 14.50, 22.50,
    ARRAY['GlobalG.A.P.', 'ASC Certified Salmon'], 'Passed', 4.1, 0.6,
    '2026-09-02', '2026-09-14', 'FROSTLY-LOT-2026-SALM-112-HASH-441B'
)
ON CONFLICT (id) DO NOTHING;

-- 6. Insert-Only HACCP Regulatory Inspection Records
INSERT INTO public.haccp_audit_records (
    lot_id, species_name, inspection_date, inspector_name, inspector_id,
    core_temperature, histamine_level_ppm, organoleptic_score, parasite_visual_check,
    sanitization_log_pass, final_compliance, certification_ref, notes
) VALUES 
(
    'LOT-2026-TUNA-094', 'Pacific Bluefin Tuna', now() - INTERVAL '2 days',
    'Dr. Elena Rostova', 'AUD-STAFF-902', -59.1, 8.4, 9.8, 'Clean', true,
    'Approved - Grade AAA', 'HACCP-CERT-US-2026-9481',
    'Optimal cryo flesh density. Zero discoloration, deep ruby red core flesh.'
),
(
    'LOT-2026-SALM-112', 'Norwegian Atlantic Salmon', now() - INTERVAL '1 day',
    'Marcus Thorne, Lead QA', 'AUD-STAFF-411', 0.6, 4.1, 9.5, 'Clean', true,
    'Approved - Grade AAA', 'HACCP-CERT-EU-2026-1102',
    'Flesh firmness optimal, clear bright eyes, fresh marine scent.'
);

-- 7. Reefer Fleet Logistics Vehicles
INSERT INTO public.reefer_vehicles (
    id, name, driver_name, driver_phone, vehicle_plate, type, origin_port,
    destination, status, current_temp_celsius, target_temp_celsius, min_safe_temp,
    max_safe_temp, ambient_humidity_pct, battery_level_pct, eta, route_progress_pct,
    active_lot_ids, active_order_ids
) VALUES 
(
    'REEFER-01', 'Cryo-Trans Alpha 01', 'Viktor Kowalski', '+1 (415) 555-9011',
    'CA-9XF-402', 'Freightliner Cascadia Super-Cryo (-60°C Liquid N2)',
    'Pier 38 Cryo Hub, SF', 'San Francisco Bay Luxury Dining District',
    'In Transit', -58.4, -60.0, -65.0, -50.0, 78.0, 94.0, '38 mins', 68.0,
    ARRAY['LOT-2026-TUNA-094'], ARRAY['ORD-9421']
),
(
    'REEFER-02', 'Chilled-Express Beta 02', 'Darius Mensah', '+1 (305) 555-7721',
    'FL-882-MIA', 'Isuzu NPR Chilled Slush Carrier (+0.5°C)',
    'Port of Miami Reefer Gate', 'Ocean Grand Resort Delivery Bay',
    'Standby', 1.2, 0.5, -0.5, 3.0, 84.0, 98.0, 'Docked', 0.0,
    ARRAY['LOT-2026-SALM-112'], ARRAY[]::TEXT[]
)
ON CONFLICT (id) DO NOTHING;

-- 8. Client Orders & Line Items
INSERT INTO public.client_orders (
    id, customer_id, client_name, client_category, contact_person, contact_email,
    contact_phone, destination_city, delivery_address, order_date,
    required_delivery_date, status, quoted_total_usd, adjusted_total_usd,
    assigned_reefer_id, assigned_driver, payment_status, packaging_requirement
) VALUES 
(
    'ORD-9421', 'CUST-101', 'Sashimi Master Gastronomy LLC', 'Wholesale Restaurant',
    'Kenji Sato', 'purchasing@sashimimaster.com', '+1 (415) 555-8921',
    'San Francisco, CA', '742 Pier Boulevard, Suite 400', CURRENT_DATE,
    CURRENT_DATE, 'In Reefer Transit', 10560.00, 10560.00,
    'REEFER-01', 'Viktor Kowalski', 'Pending Net-30',
    'Super-Cryo Vacuum Sealed in Dry-Ice Poly Box (-60°C)'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.order_line_items (
    order_id, species_id, species_name, grade, lot_id, requested_weight_kg,
    actual_weighed_kg, price_per_kg
) VALUES 
(
    'ORD-9421', 'SPEC-BF-TUNA', 'Pacific Bluefin Tuna', 'Sashimi AAA',
    'LOT-2026-TUNA-094', 220.00, 220.00, 48.00
);

-- 9. Insert-Only Telemetry Sensor Stream
INSERT INTO public.reefer_sensor_readings (
    vehicle_id, temperature, humidity, power_status, recorded_at
) VALUES 
('REEFER-01', -58.9, 77.2, 'Optimal', now() - INTERVAL '15 minutes'),
('REEFER-01', -58.6, 78.0, 'Optimal', now() - INTERVAL '5 minutes'),
('REEFER-01', -58.4, 78.1, 'Optimal', now());

-- 10. Insert-Only Financial Ledger Entries
INSERT INTO public.financial_ledger_entries (
    entry_date, type, category, description, reference_id, entity_name,
    amount, payment_method, status
) VALUES 
(
    CURRENT_DATE, 'COGS', 'COGS (Catch Intake)',
    'Intake Landed Batch 680kg Bluefin Tuna from F/V Pacific Storm',
    'LOT-2026-TUNA-094', 'Aleutian Longline Cooperative',
    21760.00, 'Wire Transfer / Net-30', 'Pending'
),
(
    CURRENT_DATE, 'Income', 'Revenue (Wholesale)',
    'Wholesale Dispatch 220kg Bluefin Tuna Sashimi AAA',
    'ORD-9421', 'Sashimi Master Gastronomy LLC',
    10560.00, 'Accounts Receivable Net-30', 'Settled'
);
