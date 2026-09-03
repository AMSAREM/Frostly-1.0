-- ============================================================================
-- FROSTLY SEAFOOD COLD-CHAIN ERP
-- Migration 002: Relational Tables
-- ============================================================================
-- Primary Key Strategy:
-- Human-readable business keys (e.g. LOT-2026-..., ORD-9421, CUST-101, SUP-201,
-- SPEC-BF-TUNA, REEFER-01) are preserved as TEXT PRIMARY KEY to match the domain
-- and existing ERP client contracts exactly. Child tables, logs, and sensor
-- streams use UUID PRIMARY KEY DEFAULT gen_random_uuid().
-- ============================================================================

-- 1. Staff Profiles & RBAC (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.staff_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    role public.staff_role NOT NULL DEFAULT 'viewer',
    department TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit table for staff role modifications
CREATE TABLE IF NOT EXISTS public.staff_role_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_staff_id UUID NOT NULL REFERENCES public.staff_profiles(id) ON DELETE RESTRICT,
    previous_role public.staff_role NOT NULL,
    new_role public.staff_role NOT NULL,
    changed_by UUID NOT NULL REFERENCES public.staff_profiles(id) ON DELETE RESTRICT,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Species Master Catalog
CREATE TABLE IF NOT EXISTS public.species (
    id TEXT PRIMARY KEY, -- e.g. 'SPEC-BF-TUNA'
    name TEXT NOT NULL,
    scientific_name TEXT NOT NULL,
    category public.species_category NOT NULL,
    default_zone public.storage_zone NOT NULL,
    standard_price_per_kg NUMERIC(10, 2) NOT NULL CHECK (standard_price_per_kg >= 0),
    available_grades public.quality_grade[] NOT NULL DEFAULT '{}',
    fao_zones TEXT[] NOT NULL DEFAULT '{}',
    gear_types TEXT[] NOT NULL DEFAULT '{}',
    seasonal_peak TEXT NOT NULL,
    image TEXT NOT NULL,
    shelf_life_fresh_days INT NOT NULL DEFAULT 7 CHECK (shelf_life_fresh_days >= 0),
    shelf_life_frozen_months INT NOT NULL DEFAULT 12 CHECK (shelf_life_frozen_months >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Customers (B2B Wholesale Accounts)
CREATE TABLE IF NOT EXISTS public.customers (
    id TEXT PRIMARY KEY, -- e.g. 'CUST-101'
    name TEXT NOT NULL,
    company_name TEXT NOT NULL,
    type public.customer_type NOT NULL,
    tier public.pricing_tier NOT NULL,
    contact_person TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    credit_limit_usd NUMERIC(12, 2) NOT NULL DEFAULT 50000.00 CHECK (credit_limit_usd >= 0),
    outstanding_balance_usd NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (outstanding_balance_usd >= 0),
    payment_terms public.payment_terms NOT NULL,
    total_orders_count INT NOT NULL DEFAULT 0 CHECK (total_orders_count >= 0),
    total_spend_usd NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_spend_usd >= 0),
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Credit Hold', 'Pending Review')),
    tax_id TEXT,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    joined_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Suppliers (Harvesters, Co-ops, Vessels)
CREATE TABLE IF NOT EXISTS public.suppliers (
    id TEXT PRIMARY KEY, -- e.g. 'SUP-201'
    name TEXT NOT NULL,
    contact_person TEXT NOT NULL,
    type public.supplier_type NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    port_location TEXT NOT NULL,
    country TEXT NOT NULL,
    vessel_names TEXT[] NOT NULL DEFAULT '{}',
    supplied_species TEXT[] NOT NULL DEFAULT '{}',
    payment_terms public.payment_terms NOT NULL,
    outstanding_payable_usd NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (outstanding_payable_usd >= 0),
    total_purchased_usd NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_purchased_usd >= 0),
    total_weight_supplied_kg NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_weight_supplied_kg >= 0),
    rating NUMERIC(3, 2) NOT NULL DEFAULT 5.00 CHECK (rating >= 1.0 AND rating <= 5.0),
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Preferred Partner', 'Active', 'Under Audit')),
    bank_account_ref TEXT,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Inventory Batches (Cold-Chain Catch Lots)
CREATE TABLE IF NOT EXISTS public.inventory_batches (
    id TEXT PRIMARY KEY, -- e.g. 'LOT-2026-TUNA-094'
    species_id TEXT NOT NULL REFERENCES public.species(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    species_name TEXT NOT NULL,
    scientific_name TEXT NOT NULL,
    category public.species_category NOT NULL,
    harvest_date DATE NOT NULL,
    landing_port TEXT NOT NULL,
    vessel_name TEXT NOT NULL,
    vessel_registration TEXT NOT NULL,
    captain_name TEXT NOT NULL,
    fao_area TEXT NOT NULL,
    gps_coordinates JSONB NOT NULL DEFAULT '{"latitude": 0, "longitude": 0}'::jsonb,
    location_description TEXT,
    gear_type TEXT NOT NULL,
    grade public.quality_grade NOT NULL,
    initial_weight_kg NUMERIC(10, 2) NOT NULL CHECK (initial_weight_kg > 0),
    available_weight_kg NUMERIC(10, 2) NOT NULL CHECK (available_weight_kg >= 0),
    allocated_weight_kg NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (allocated_weight_kg >= 0),
    storage_zone public.storage_zone NOT NULL,
    current_temp_celsius NUMERIC(5, 2) NOT NULL,
    target_temp_celsius NUMERIC(5, 2) NOT NULL,
    cost_per_kg NUMERIC(10, 2) NOT NULL CHECK (cost_per_kg >= 0),
    wholesale_price_per_kg NUMERIC(10, 2) NOT NULL CHECK (wholesale_price_per_kg >= 0),
    certifications TEXT[] NOT NULL DEFAULT '{}',
    inspection_status TEXT NOT NULL DEFAULT 'Pending' CHECK (inspection_status IN ('Passed', 'Pending', 'Flagged')),
    histamine_ppm NUMERIC(6, 2) CHECK (histamine_ppm IS NULL OR histamine_ppm >= 0),
    core_temp_celsius NUMERIC(5, 2) NOT NULL,
    received_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiry_date DATE NOT NULL,
    qr_code_seed TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_weight_integrity CHECK (available_weight_kg + allocated_weight_kg <= initial_weight_kg + 0.05)
);

-- 6. Purchase Order Landings (Dockside Intake)
CREATE TABLE IF NOT EXISTS public.purchase_order_landings (
    id TEXT PRIMARY KEY, -- e.g. 'PO-8821'
    supplier_id TEXT NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    supplier_name TEXT NOT NULL,
    vessel_name TEXT NOT NULL,
    port_location TEXT NOT NULL,
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    delivery_date DATE NOT NULL,
    total_cost_usd NUMERIC(12, 2) NOT NULL CHECK (total_cost_usd >= 0),
    payment_status public.payment_status NOT NULL DEFAULT 'Pending Settlement',
    payment_due_date DATE NOT NULL,
    received_by TEXT NOT NULL,
    lot_assigned_id TEXT,
    status TEXT NOT NULL CHECK (status IN ('Received & In Stock', 'Pending Dock Inspection', 'In Transit')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Purchase Order Items (Normalized Species Catch Breakdown)
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id TEXT NOT NULL REFERENCES public.purchase_order_landings(id) ON DELETE CASCADE,
    species_id TEXT NOT NULL REFERENCES public.species(id) ON DELETE RESTRICT,
    species_name TEXT NOT NULL,
    weight_kg NUMERIC(10, 2) NOT NULL CHECK (weight_kg > 0),
    cost_per_kg NUMERIC(10, 2) NOT NULL CHECK (cost_per_kg >= 0),
    total_cost NUMERIC(12, 2) NOT NULL CHECK (total_cost >= 0),
    grade public.quality_grade NOT NULL,
    storage_zone public.storage_zone NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Reefer Vehicles (Cold-Chain Fleet Logistics)
CREATE TABLE IF NOT EXISTS public.reefer_vehicles (
    id TEXT PRIMARY KEY, -- e.g. 'REEFER-01'
    name TEXT NOT NULL,
    driver_name TEXT NOT NULL,
    driver_phone TEXT NOT NULL,
    vehicle_plate TEXT NOT NULL,
    type TEXT NOT NULL,
    origin_port TEXT NOT NULL,
    destination TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Standby' CHECK (status IN ('In Transit', 'Loading / Pre-Cooling', 'Standby', 'Temp Alert!')),
    current_temp_celsius NUMERIC(5, 2) NOT NULL,
    target_temp_celsius NUMERIC(5, 2) NOT NULL,
    min_safe_temp NUMERIC(5, 2) NOT NULL,
    max_safe_temp NUMERIC(5, 2) NOT NULL,
    ambient_humidity_pct NUMERIC(5, 2) NOT NULL CHECK (ambient_humidity_pct >= 0 AND ambient_humidity_pct <= 100),
    battery_level_pct NUMERIC(5, 2) NOT NULL CHECK (battery_level_pct >= 0 AND battery_level_pct <= 100),
    eta TEXT NOT NULL,
    route_progress_pct NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (route_progress_pct >= 0 AND route_progress_pct <= 100),
    active_lot_ids TEXT[] NOT NULL DEFAULT '{}',
    active_order_ids TEXT[] NOT NULL DEFAULT '{}',
    alerts TEXT[] NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Client Orders (B2B Wholesale Contracts)
CREATE TABLE IF NOT EXISTS public.client_orders (
    id TEXT PRIMARY KEY, -- e.g. 'ORD-9421'
    customer_id TEXT NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    client_name TEXT NOT NULL,
    client_category public.customer_type NOT NULL,
    contact_person TEXT NOT NULL,
    contact_email TEXT NOT NULL,
    contact_phone TEXT NOT NULL,
    destination_city TEXT NOT NULL,
    delivery_address TEXT NOT NULL,
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    required_delivery_date DATE NOT NULL,
    actual_delivery_date DATE,
    status public.order_status NOT NULL DEFAULT 'Pending Confirmation',
    quoted_total_usd NUMERIC(12, 2) NOT NULL CHECK (quoted_total_usd >= 0),
    adjusted_total_usd NUMERIC(12, 2) NOT NULL CHECK (adjusted_total_usd >= 0),
    assigned_reefer_id TEXT REFERENCES public.reefer_vehicles(id) ON DELETE SET NULL,
    assigned_driver TEXT,
    payment_status public.payment_status NOT NULL DEFAULT 'Pending Net-30',
    packaging_requirement TEXT NOT NULL,
    special_instructions TEXT,
    packing_slip_generated BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Order Line Items (Tied to Specific Inventory Lots)
CREATE TABLE IF NOT EXISTS public.order_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT NOT NULL REFERENCES public.client_orders(id) ON DELETE CASCADE,
    species_id TEXT NOT NULL REFERENCES public.species(id) ON DELETE RESTRICT,
    species_name TEXT NOT NULL,
    grade public.quality_grade NOT NULL,
    lot_id TEXT NOT NULL REFERENCES public.inventory_batches(id) ON DELETE RESTRICT,
    requested_weight_kg NUMERIC(10, 2) NOT NULL CHECK (requested_weight_kg > 0),
    actual_weighed_kg NUMERIC(10, 2) CHECK (actual_weighed_kg IS NULL OR actual_weighed_kg >= 0),
    price_per_kg NUMERIC(10, 2) NOT NULL CHECK (price_per_kg >= 0),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Fishing Fleet Vessels (Marine AIS Harvesting Tracker)
CREATE TABLE IF NOT EXISTS public.fleet_vessels (
    id TEXT PRIMARY KEY, -- e.g. 'VESSEL-PACIFIC-HARVESTER'
    name TEXT NOT NULL,
    vessel_code TEXT NOT NULL UNIQUE,
    captain TEXT NOT NULL,
    target_species TEXT[] NOT NULL DEFAULT '{}',
    current_zone TEXT NOT NULL,
    eta_port TEXT NOT NULL,
    estimated_catch_kg NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (estimated_catch_kg >= 0),
    status TEXT NOT NULL CHECK (status IN ('Harvesting', 'Steaming to Port', 'Discharging Catch', 'At Anchor')),
    gps_coordinates JSONB NOT NULL DEFAULT '{"latitude": 0, "longitude": 0}'::jsonb,
    ice_on_board_tons NUMERIC(6, 2) NOT NULL DEFAULT 0 CHECK (ice_on_board_tons >= 0),
    sea_surface_temp NUMERIC(5, 2) NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. External Market Price Index Feed
CREATE TABLE IF NOT EXISTS public.market_price_index (
    id TEXT PRIMARY KEY,
    species_name TEXT NOT NULL,
    category public.species_category NOT NULL,
    exchange TEXT NOT NULL,
    current_price_per_kg NUMERIC(10, 2) NOT NULL CHECK (current_price_per_kg >= 0),
    previous_price_per_kg NUMERIC(10, 2) NOT NULL CHECK (previous_price_per_kg >= 0),
    change_24h_pct NUMERIC(5, 2) NOT NULL,
    volume_tons_24h NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (volume_tons_24h >= 0),
    weekly_trend NUMERIC(10, 2)[] NOT NULL DEFAULT '{}',
    high_30d NUMERIC(10, 2) NOT NULL CHECK (high_30d >= 0),
    low_30d NUMERIC(10, 2) NOT NULL CHECK (low_30d >= 0),
    demand_status TEXT NOT NULL CHECK (demand_status IN ('Surging High', 'Steady', 'Soft Supply')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. Retail & Wholesale Processed Products Catalog
CREATE TABLE IF NOT EXISTS public.retail_wholesale_products (
    id TEXT PRIMARY KEY, -- e.g. 'PROD-BF-SAKU'
    species_id TEXT NOT NULL REFERENCES public.species(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    cut_type public.seafood_cut_type NOT NULL,
    category public.species_category NOT NULL,
    grade public.quality_grade NOT NULL,
    stock_kg NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (stock_kg >= 0),
    unit TEXT NOT NULL CHECK (unit IN ('kg', 'lb', 'piece', 'pack')),
    cost_price_per_unit NUMERIC(10, 2) NOT NULL CHECK (cost_price_per_unit >= 0),
    wholesale_price_per_unit NUMERIC(10, 2) NOT NULL CHECK (wholesale_price_per_unit >= 0),
    retail_price_per_unit NUMERIC(10, 2) NOT NULL CHECK (retail_price_per_unit >= 0),
    wholesale_min_qty NUMERIC(10, 2) NOT NULL DEFAULT 1 CHECK (wholesale_min_qty > 0),
    retail_pack_size TEXT,
    sku TEXT NOT NULL UNIQUE,
    image_url TEXT NOT NULL,
    origin TEXT NOT NULL,
    is_available_for_retail BOOLEAN NOT NULL DEFAULT TRUE,
    is_available_for_wholesale BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. Retail POS Transactions & Sale Items
CREATE TABLE IF NOT EXISTS public.retail_transactions (
    id TEXT PRIMARY KEY, -- e.g. 'REC-5021'
    receipt_number TEXT NOT NULL UNIQUE,
    customer_name TEXT NOT NULL DEFAULT 'Walk-in Customer',
    customer_phone TEXT,
    subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
    tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
    cost_total NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (cost_total >= 0),
    gross_margin NUMERIC(12, 2) NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('Cash', 'Credit Card', 'Apple Pay / Contactless', 'Store Credit')),
    cashier_id UUID REFERENCES public.staff_profiles(id) ON DELETE RESTRICT,
    cashier_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Completed' CHECK (status IN ('Completed', 'Refunded')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.retail_sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id TEXT NOT NULL REFERENCES public.retail_transactions(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES public.retail_wholesale_products(id) ON DELETE RESTRICT,
    product_name TEXT NOT NULL,
    cut_type public.seafood_cut_type NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL CHECK (quantity > 0),
    unit TEXT NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
    cost_price NUMERIC(10, 2) NOT NULL CHECK (cost_price >= 0),
    line_total NUMERIC(12, 2) NOT NULL CHECK (line_total >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. System Notifications
CREATE TABLE IF NOT EXISTS public.system_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type public.notification_type NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    urgency public.notification_urgency NOT NULL DEFAULT 'low',
    read BOOLEAN NOT NULL DEFAULT FALSE,
    related_entity_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 14. Single-Row App Settings
CREATE TABLE IF NOT EXISTS public.app_settings (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    company_name TEXT NOT NULL DEFAULT 'Pacific Cold-Chain & Seafood Holdings Ltd.',
    facility_code TEXT NOT NULL DEFAULT 'FAC-PAC-808-CRY',
    fda_registration_number TEXT NOT NULL DEFAULT 'FDA-REG-#1948201',
    eu_approval_number TEXT NOT NULL DEFAULT 'EU-ESP-9281-CE',
    haccp_coordinator TEXT NOT NULL DEFAULT 'Dr. Elena Rostova, Lead Quality Auditor',
    primary_port TEXT NOT NULL DEFAULT 'Port of Tema & Pier 38 Fishing Harbour',
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 15.00 CHECK (tax_rate >= 0),
    currency TEXT NOT NULL DEFAULT 'GHS',
    super_cryo_target_c NUMERIC(5, 2) NOT NULL DEFAULT -60.0,
    super_cryo_max_alert_c NUMERIC(5, 2) NOT NULL DEFAULT -50.0,
    commercial_freeze_target_c NUMERIC(5, 2) NOT NULL DEFAULT -22.0,
    commercial_freeze_max_alert_c NUMERIC(5, 2) NOT NULL DEFAULT -18.0,
    slush_ice_target_c NUMERIC(5, 2) NOT NULL DEFAULT 0.5,
    slush_ice_max_alert_c NUMERIC(5, 2) NOT NULL DEFAULT 3.0,
    histamine_limit_ppm NUMERIC(6, 2) NOT NULL DEFAULT 50.0 CHECK (histamine_limit_ppm >= 0),
    sensor_polling_interval_sec INT NOT NULL DEFAULT 30 CHECK (sensor_polling_interval_sec > 0),
    enable_audio_alerts BOOLEAN NOT NULL DEFAULT TRUE,
    use_imperial BOOLEAN NOT NULL DEFAULT FALSE,
    weight_decimal_places INT NOT NULL DEFAULT 1 CHECK (weight_decimal_places >= 0),
    date_format TEXT NOT NULL DEFAULT 'YYYY-MM-DD',
    default_payment_terms TEXT NOT NULL DEFAULT 'Net 30 Days',
    auto_generate_qr_traceability BOOLEAN NOT NULL DEFAULT TRUE,
    ice_packaging_fee_per_kg NUMERIC(6, 2) NOT NULL DEFAULT 0.45 CHECK (ice_packaging_fee_per_kg >= 0),
    min_order_value_wholesale NUMERIC(10, 2) NOT NULL DEFAULT 300.00 CHECK (min_order_value_wholesale >= 0),
    notify_haccp_excursion BOOLEAN NOT NULL DEFAULT TRUE,
    notify_low_inventory BOOLEAN NOT NULL DEFAULT TRUE,
    notify_overdue_invoices BOOLEAN NOT NULL DEFAULT TRUE,
    notify_vessel_arrivals BOOLEAN NOT NULL DEFAULT TRUE,
    low_stock_threshold_kg NUMERIC(10, 2) NOT NULL DEFAULT 200.0 CHECK (low_stock_threshold_kg >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 15. THE 3 STRICT INSERT-ONLY REGULATORY COMPLIANCE TABLES
-- ============================================================================
-- Absolute immutability:
-- - No updated_at column is defined.
-- - No UPDATE or DELETE policies are granted to any role (including admin).
-- - Database triggers programmatically block any UPDATE or DELETE attempt.
-- - Audit trail is preserved strictly via created_at.

-- (A) Financial General Ledger (SOX / GAAP Double-Entry Audit Trail)
CREATE TABLE IF NOT EXISTS public.financial_ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    type public.financial_entry_type NOT NULL,
    category public.financial_entry_category NOT NULL,
    description TEXT NOT NULL,
    reference_id TEXT NOT NULL, -- Order ID, PO ID, or Receipt ID
    entity_name TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    payment_method TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Settled', 'Pending', 'Overdue')),
    created_by UUID REFERENCES public.staff_profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- (B) HACCP Regulatory Food Safety Audit Records (FDA / EU Inspection Logs)
CREATE TABLE IF NOT EXISTS public.haccp_audit_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_id TEXT NOT NULL REFERENCES public.inventory_batches(id) ON DELETE RESTRICT,
    species_name TEXT NOT NULL,
    inspection_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    inspector_name TEXT NOT NULL,
    inspector_id TEXT NOT NULL,
    core_temperature NUMERIC(5, 2) NOT NULL,
    histamine_level_ppm NUMERIC(6, 2) NOT NULL CHECK (histamine_level_ppm >= 0),
    organoleptic_score NUMERIC(3, 1) NOT NULL CHECK (organoleptic_score >= 1.0 AND organoleptic_score <= 10.0),
    parasite_visual_check TEXT NOT NULL CHECK (parasite_visual_check IN ('Clean', 'Pass with Trimming', 'Failed')),
    sanitization_log_pass BOOLEAN NOT NULL DEFAULT TRUE,
    final_compliance public.haccp_compliance_status NOT NULL,
    certification_ref TEXT NOT NULL,
    notes TEXT,
    created_by UUID REFERENCES public.staff_profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- (C) Reefer Vehicle Live Sensor Telemetry Stream (IoT Time-Series Readings)
CREATE TABLE IF NOT EXISTS public.reefer_sensor_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id TEXT NOT NULL REFERENCES public.reefer_vehicles(id) ON DELETE CASCADE,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    temperature NUMERIC(5, 2) NOT NULL,
    humidity NUMERIC(5, 2) NOT NULL CHECK (humidity >= 0 AND humidity <= 100),
    power_status TEXT NOT NULL CHECK (power_status IN ('Optimal', 'Auxiliary', 'Warning')),
    gps_coordinates JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
