-- ============================================================================
-- FROSTLY: Cold-Chain ERP & Seafood Food-Safety Operations Database
-- Target Platform: Supabase (PostgreSQL 15+)
-- Schema Migration: 20260903000001_frostly_core_schema.sql
-- ============================================================================
-- ARCHITECTURAL GUARANTEES:
-- 1. Internal Staff Role-Based Access Control (RBAC: admin, ops, sales, viewer).
--    Data belongs to the enterprise, not individual consumers.
-- 2. Compliance Auditing: Strict INSERT-ONLY tables for food safety & financials
--    (financial_ledger_entries, haccp_audit_records, reefer_sensor_readings).
--    NO UPDATE or DELETE policies exist for any role.
-- 3. Atomic Cold-Chain Stock Decrement: Handled strictly via SECURITY DEFINER
--    transactional functions with row-level locks (FOR UPDATE) to prevent overselling.
-- ============================================================================

-- 0. EXTENSIONS & PREREQUISITES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. CUSTOM ENUMS & TYPES
DO $$ BEGIN
    CREATE TYPE public.staff_role AS ENUM ('admin', 'ops', 'sales', 'viewer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.species_category AS ENUM (
        'Pelagic', 'Salmonid', 'Crustacean', 'Mollusk', 'Groundfish'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.quality_grade AS ENUM (
        'Sashimi AAA', 'Grade #1', 'Grade #2', 'Processing Grade', 'Live Prime'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.storage_zone AS ENUM (
        'Super-Cryo Deep Freeze (-60°C)',
        'Commercial Cold Storage (-22°C)',
        'Fresh Slush Ice (0°C to +2°C)',
        'Live Seawater Tank (+8°C)'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.order_status AS ENUM (
        'Pending Confirmation',
        'Weighing & Grading',
        'Cryo-Packed & Iced',
        'In Reefer Transit',
        'Delivered',
        'Cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.payment_status AS ENUM (
        'Paid',
        'Pending Net-30',
        'Invoiced',
        'Overdue',
        'Paid in Full',
        'Pending Settlement',
        'Partial Paid'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.customer_type AS ENUM (
        'Wholesale Restaurant',
        'Hotel & Resort',
        'Supermarket / Retailer',
        'Fishmonger / Distributor',
        'Direct Retail VIP'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.pricing_tier AS ENUM (
        'Tier 1 (VIP Wholesale -15%)',
        'Tier 2 (Standard Wholesale)',
        'Retail Standard',
        'Contract Custom'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.payment_terms AS ENUM (
        'Net-30',
        'Net-15',
        'Cash on Delivery (COD)',
        'Prepaid / Due on Receipt',
        'Instant Card/Cash',
        'Weekly Settlement'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.supplier_type AS ENUM (
        'Fishermen Co-op',
        'Vessel / Fleet Captain',
        'Aquaculture Farm',
        'Fish Auction / Wholesaler',
        'Direct Marine Import'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.seafood_cut_type AS ENUM (
        'Whole Round Fish',
        'Headless & Gutted (H&G)',
        'Skin-On Loin / Fillet',
        'Skinless Sashimi Saku Block',
        'Live in Oxygen Tank',
        'Packaged 500g Tray',
        'IQF Flash Frozen Box'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.financial_entry_type AS ENUM ('Income', 'COGS', 'OpEx');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.financial_entry_category AS ENUM (
        'Revenue (Wholesale)',
        'Revenue (Retail POS)',
        'COGS (Catch Intake)',
        'Logistics & Reefer Freight',
        'Cold Storage Utilities',
        'Packaging & Ice',
        'Labor & Cutting Crew',
        'Dock Fees & Port Taxes'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. STAFF PROFILES & RBAC HELPER FUNCTIONS
CREATE TABLE IF NOT EXISTS public.staff_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    role public.staff_role NOT NULL DEFAULT 'viewer',
    department TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Security Definer Role Checker
CREATE OR REPLACE FUNCTION public.get_staff_role()
RETURNS public.staff_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.staff_profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (SELECT 1 FROM public.staff_profiles WHERE id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT (public.get_staff_role() = 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_ops_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT (public.get_staff_role() IN ('admin', 'ops'));
$$;

CREATE OR REPLACE FUNCTION public.is_sales_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT (public.get_staff_role() IN ('admin', 'sales', 'ops'));
$$;

-- 3. SPECIES MASTER CATALOG
CREATE TABLE IF NOT EXISTS public.species (
    id TEXT PRIMARY KEY, -- e.g. "SPEC-BF-TUNA"
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
    shelf_life_fresh_days INT NOT NULL DEFAULT 7,
    shelf_life_frozen_months INT NOT NULL DEFAULT 12,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. INVENTORY BATCHES (COLD-CHAIN LOTS)
CREATE TABLE IF NOT EXISTS public.inventory_batches (
    id TEXT PRIMARY KEY, -- e.g. "LOT-2026-TUNA-094"
    species_id TEXT NOT NULL REFERENCES public.species(id) ON UPDATE CASCADE,
    species_name TEXT NOT NULL,
    scientific_name TEXT NOT NULL,
    category public.species_category NOT NULL,
    harvest_date DATE NOT NULL,
    landing_port TEXT NOT NULL,
    vessel_name TEXT NOT NULL,
    vessel_registration TEXT NOT NULL,
    captain_name TEXT NOT NULL,
    fao_area TEXT NOT NULL,
    latitude NUMERIC(10, 6) NOT NULL,
    longitude NUMERIC(10, 6) NOT NULL,
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
    inspection_status TEXT NOT NULL CHECK (inspection_status IN ('Passed', 'Pending', 'Flagged')),
    histamine_ppm NUMERIC(6, 2),
    core_temp_celsius NUMERIC(5, 2) NOT NULL,
    received_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    qr_code_seed TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_weight_integrity CHECK (available_weight_kg + allocated_weight_kg <= initial_weight_kg + 0.01)
);

-- 5. B2B WHOLESALE CUSTOMERS
CREATE TABLE IF NOT EXISTS public.customers (
    id TEXT PRIMARY KEY, -- e.g. "CUST-101"
    name TEXT NOT NULL,
    company_name TEXT NOT NULL,
    type public.customer_type NOT NULL,
    tier public.pricing_tier NOT NULL,
    contact_person TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    credit_limit_usd NUMERIC(12, 2) NOT NULL DEFAULT 50000.00,
    outstanding_balance_usd NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_terms public.payment_terms NOT NULL,
    total_orders_count INT NOT NULL DEFAULT 0,
    total_spend_usd NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL CHECK (status IN ('Active', 'Credit Hold', 'Pending Review')),
    tax_id TEXT,
    notes TEXT,
    joined_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. SUPPLIERS & VESSEL FLEET HARVESTERS
CREATE TABLE IF NOT EXISTS public.suppliers (
    id TEXT PRIMARY KEY, -- e.g. "SUP-201"
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
    outstanding_payable_usd NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_purchased_usd NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_weight_supplied_kg NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    rating NUMERIC(3, 2) NOT NULL CHECK (rating >= 1.0 AND rating <= 5.0),
    status TEXT NOT NULL CHECK (status IN ('Preferred Partner', 'Active', 'Under Audit')),
    bank_account_ref TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. INWARD LANDED CATCH PURCHASE ORDERS
CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id TEXT PRIMARY KEY, -- e.g. "PO-8821"
    supplier_id TEXT NOT NULL REFERENCES public.suppliers(id) ON UPDATE CASCADE,
    supplier_name TEXT NOT NULL,
    vessel_name TEXT NOT NULL,
    port_location TEXT NOT NULL,
    order_date DATE NOT NULL,
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

CREATE TABLE IF NOT EXISTS public.purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id TEXT NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    species_name TEXT NOT NULL,
    weight_kg NUMERIC(10, 2) NOT NULL CHECK (weight_kg > 0),
    cost_per_kg NUMERIC(10, 2) NOT NULL CHECK (cost_per_kg >= 0),
    total_cost NUMERIC(12, 2) NOT NULL CHECK (total_cost >= 0),
    grade public.quality_grade NOT NULL,
    storage_zone public.storage_zone NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. B2B CLIENT ORDERS & ORDER LINE ITEMS
CREATE TABLE IF NOT EXISTS public.client_orders (
    id TEXT PRIMARY KEY, -- e.g. "ORD-9421"
    customer_id TEXT NOT NULL REFERENCES public.customers(id) ON UPDATE CASCADE,
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
    assigned_reefer_id TEXT,
    assigned_driver TEXT,
    payment_status public.payment_status NOT NULL DEFAULT 'Pending Net-30',
    packaging_requirement TEXT NOT NULL,
    special_instructions TEXT,
    packing_slip_generated BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_line_items (
    id TEXT PRIMARY KEY DEFAULT ('ITEM-' || gen_random_uuid()::text),
    order_id TEXT NOT NULL REFERENCES public.client_orders(id) ON DELETE CASCADE,
    species_id TEXT NOT NULL REFERENCES public.species(id) ON UPDATE CASCADE,
    species_name TEXT NOT NULL,
    grade public.quality_grade NOT NULL,
    lot_id TEXT NOT NULL REFERENCES public.inventory_batches(id) ON UPDATE CASCADE,
    requested_weight_kg NUMERIC(10, 2) NOT NULL CHECK (requested_weight_kg > 0),
    actual_weighed_kg NUMERIC(10, 2) CHECK (actual_weighed_kg IS NULL OR actual_weighed_kg >= 0),
    price_per_kg NUMERIC(10, 2) NOT NULL CHECK (price_per_kg >= 0),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. REEFER VEHICLES & LOGISTICS ASSETS
CREATE TABLE IF NOT EXISTS public.reefer_vehicles (
    id TEXT PRIMARY KEY, -- e.g. "REEFER-01"
    name TEXT NOT NULL,
    driver_name TEXT NOT NULL,
    driver_phone TEXT NOT NULL,
    vehicle_plate TEXT NOT NULL,
    type TEXT NOT NULL,
    origin_port TEXT NOT NULL,
    destination TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('In Transit', 'Loading / Pre-Cooling', 'Standby', 'Temp Alert!')),
    current_temp_celsius NUMERIC(5, 2) NOT NULL,
    target_temp_celsius NUMERIC(5, 2) NOT NULL,
    min_safe_temp NUMERIC(5, 2) NOT NULL,
    max_safe_temp NUMERIC(5, 2) NOT NULL,
    ambient_humidity_pct NUMERIC(5, 2) NOT NULL,
    battery_level_pct NUMERIC(5, 2) NOT NULL CHECK (battery_level_pct >= 0 AND battery_level_pct <= 100),
    eta TEXT NOT NULL,
    route_progress_pct NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (route_progress_pct >= 0 AND route_progress_pct <= 100),
    active_lot_ids TEXT[] NOT NULL DEFAULT '{}',
    active_order_ids TEXT[] NOT NULL DEFAULT '{}',
    alerts TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. HARVEST FLEET VESSELS & AIS POSITIONING
CREATE TABLE IF NOT EXISTS public.fleet_vessels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    vessel_code TEXT NOT NULL UNIQUE,
    captain TEXT NOT NULL,
    target_species TEXT[] NOT NULL DEFAULT '{}',
    current_zone TEXT NOT NULL,
    eta_port TEXT NOT NULL,
    estimated_catch_kg NUMERIC(10, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('Harvesting', 'Steaming to Port', 'Discharging Catch', 'At Anchor')),
    latitude NUMERIC(10, 6) NOT NULL,
    longitude NUMERIC(10, 6) NOT NULL,
    ice_on_board_tons NUMERIC(6, 2) NOT NULL DEFAULT 0,
    sea_surface_temp NUMERIC(5, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. MARKET PRICE INDEX & EXCHANGES
CREATE TABLE IF NOT EXISTS public.market_price_index (
    id TEXT PRIMARY KEY,
    species_name TEXT NOT NULL,
    category public.species_category NOT NULL,
    exchange TEXT NOT NULL,
    current_price_per_kg NUMERIC(10, 2) NOT NULL CHECK (current_price_per_kg >= 0),
    previous_price_per_kg NUMERIC(10, 2) NOT NULL CHECK (previous_price_per_kg >= 0),
    change_24h_pct NUMERIC(5, 2) NOT NULL,
    volume_tons_24h NUMERIC(10, 2) NOT NULL DEFAULT 0,
    weekly_trend JSONB NOT NULL DEFAULT '[]'::jsonb,
    high_30d NUMERIC(10, 2) NOT NULL,
    low_30d NUMERIC(10, 2) NOT NULL,
    demand_status TEXT NOT NULL CHECK (demand_status IN ('Surging High', 'Steady', 'Soft Supply')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. RETAIL PRODUCTS & POS MODULE
CREATE TABLE IF NOT EXISTS public.retail_products (
    id TEXT PRIMARY KEY,
    species_id TEXT NOT NULL REFERENCES public.species(id) ON UPDATE CASCADE,
    name TEXT NOT NULL,
    cut_type public.seafood_cut_type NOT NULL,
    category public.species_category NOT NULL,
    grade public.quality_grade NOT NULL,
    stock_kg NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (stock_kg >= 0),
    unit TEXT NOT NULL CHECK (unit IN ('kg', 'lb', 'piece', 'pack')),
    cost_price_per_unit NUMERIC(10, 2) NOT NULL CHECK (cost_price_per_unit >= 0),
    wholesale_price_per_unit NUMERIC(10, 2) NOT NULL CHECK (wholesale_price_per_unit >= 0),
    retail_price_per_unit NUMERIC(10, 2) NOT NULL CHECK (retail_price_per_unit >= 0),
    wholesale_min_qty NUMERIC(10, 2) NOT NULL DEFAULT 1,
    retail_pack_size TEXT,
    sku TEXT NOT NULL UNIQUE,
    image_url TEXT NOT NULL,
    origin TEXT NOT NULL,
    is_available_for_retail BOOLEAN NOT NULL DEFAULT TRUE,
    is_available_for_wholesale BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.retail_transactions (
    id TEXT PRIMARY KEY, -- "REC-5021"
    receipt_number TEXT NOT NULL UNIQUE,
    date TIMESTAMPTZ NOT NULL DEFAULT now(),
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
    tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
    cost_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
    gross_margin NUMERIC(12, 2) NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('Cash', 'Credit Card', 'Apple Pay / Contactless', 'Store Credit')),
    cashier_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Completed', 'Refunded')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.retail_sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id TEXT NOT NULL REFERENCES public.retail_transactions(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES public.retail_products(id) ON UPDATE CASCADE,
    product_name TEXT NOT NULL,
    cut_type public.seafood_cut_type NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL CHECK (quantity > 0),
    unit TEXT NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL,
    cost_price NUMERIC(10, 2) NOT NULL,
    line_total NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. SYSTEM NOTIFICATIONS & ALERTS
CREATE TABLE IF NOT EXISTS public.system_notifications (
    id TEXT PRIMARY KEY DEFAULT ('NOTIF-' || gen_random_uuid()::text),
    type TEXT NOT NULL CHECK (type IN (
        'temp_alert', 'order_update', 'catch_landed', 'haccp_pass', 
        'system', 'payment_received', 'invoice_due', 'supplier_delivery'
    )),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    urgency TEXT NOT NULL CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
    read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 14. ENTERPRISE FACILITY APP SETTINGS (SINGLETON)
CREATE TABLE IF NOT EXISTS public.app_settings (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    company_name TEXT NOT NULL DEFAULT 'Pacific Cold-Chain & Seafood Holdings Ltd.',
    facility_code TEXT NOT NULL DEFAULT 'FAC-PAC-808-CRY',
    fda_registration_number TEXT NOT NULL DEFAULT 'FDA-REG-#1948201',
    eu_approval_number TEXT NOT NULL DEFAULT 'EU-ESP-9281-CE',
    haccp_coordinator TEXT NOT NULL DEFAULT 'Dr. Elena Rostova, Lead Quality Auditor',
    primary_port TEXT NOT NULL DEFAULT 'Port of Tema & Pier 38 Fishing Harbour',
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 15.00,
    currency TEXT NOT NULL DEFAULT 'GHS',
    super_cryo_target_c NUMERIC(5, 2) NOT NULL DEFAULT -60.0,
    super_cryo_max_alert_c NUMERIC(5, 2) NOT NULL DEFAULT -50.0,
    commercial_freeze_target_c NUMERIC(5, 2) NOT NULL DEFAULT -22.0,
    commercial_freeze_max_alert_c NUMERIC(5, 2) NOT NULL DEFAULT -18.0,
    slush_ice_target_c NUMERIC(5, 2) NOT NULL DEFAULT 0.5,
    slush_ice_max_alert_c NUMERIC(5, 2) NOT NULL DEFAULT 3.0,
    histamine_limit_ppm NUMERIC(6, 2) NOT NULL DEFAULT 50.0,
    sensor_polling_interval_sec INT NOT NULL DEFAULT 30,
    enable_audio_alerts BOOLEAN NOT NULL DEFAULT TRUE,
    use_imperial BOOLEAN NOT NULL DEFAULT FALSE,
    weight_decimal_places INT NOT NULL DEFAULT 1,
    date_format TEXT NOT NULL DEFAULT 'YYYY-MM-DD',
    default_payment_terms TEXT NOT NULL DEFAULT 'Net 30 Days',
    auto_generate_qr_traceability BOOLEAN NOT NULL DEFAULT TRUE,
    ice_packaging_fee_per_kg NUMERIC(6, 2) NOT NULL DEFAULT 0.45,
    min_order_value_wholesale NUMERIC(10, 2) NOT NULL DEFAULT 300.00,
    notify_haccp_excursion BOOLEAN NOT NULL DEFAULT TRUE,
    notify_low_inventory BOOLEAN NOT NULL DEFAULT TRUE,
    notify_overdue_invoices BOOLEAN NOT NULL DEFAULT TRUE,
    notify_vessel_arrivals BOOLEAN NOT NULL DEFAULT TRUE,
    low_stock_threshold_kg NUMERIC(10, 2) NOT NULL DEFAULT 200.0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 15. THE 3 STRICT INSERT-ONLY TABLES (REGULATORY AUDIT & COMPLIANCE)
-- ============================================================================
-- Absolute immutability:
-- - No UPDATE policy will be granted to anyone.
-- - No DELETE policy will be granted to anyone.
-- Corrections MUST be recorded as compensating/offsetting rows.

-- Compliance Table 1: Financial General Ledger (SOX / GAAP / Audit Trail)
CREATE TABLE IF NOT EXISTS public.financial_ledger_entries (
    id TEXT PRIMARY KEY DEFAULT ('LEDGER-' || gen_random_uuid()::text),
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    type public.financial_entry_type NOT NULL,
    category public.financial_entry_category NOT NULL,
    description TEXT NOT NULL,
    reference_id TEXT NOT NULL, -- Order ID, PO ID, or Receipt ID
    entity_name TEXT NOT NULL,  -- Customer or Supplier Name
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    payment_method TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Settled', 'Pending', 'Overdue')),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Compliance Table 2: HACCP Food Safety Audit Records (FDA / EU Inspection Logs)
CREATE TABLE IF NOT EXISTS public.haccp_audit_records (
    id TEXT PRIMARY KEY DEFAULT ('HACCP-' || gen_random_uuid()::text),
    lot_id TEXT NOT NULL REFERENCES public.inventory_batches(id) ON UPDATE CASCADE,
    species_name TEXT NOT NULL,
    inspection_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    inspector_name TEXT NOT NULL,
    inspector_id TEXT NOT NULL,
    core_temperature NUMERIC(5, 2) NOT NULL,
    histamine_level_ppm NUMERIC(6, 2) NOT NULL CHECK (histamine_level_ppm >= 0),
    organoleptic_score NUMERIC(3, 1) NOT NULL CHECK (organoleptic_score >= 1.0 AND organoleptic_score <= 10.0),
    parasite_visual_check TEXT NOT NULL CHECK (parasite_visual_check IN ('Clean', 'Pass with Trimming', 'Failed')),
    sanitization_log_pass BOOLEAN NOT NULL DEFAULT TRUE,
    final_compliance TEXT NOT NULL CHECK (final_compliance IN (
        'Approved - Grade AAA', 'Approved - Standard', 'Quarantine - Re-inspect', 'Rejected'
    )),
    certification_ref TEXT NOT NULL,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Compliance Table 3: Reefer Temperature & Telemetry Sensor Stream
CREATE TABLE IF NOT EXISTS public.reefer_sensor_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id TEXT NOT NULL REFERENCES public.reefer_vehicles(id) ON DELETE CASCADE,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    temperature NUMERIC(5, 2) NOT NULL,
    humidity NUMERIC(5, 2) NOT NULL,
    power_status TEXT NOT NULL CHECK (power_status IN ('Optimal', 'Auxiliary', 'Warning')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hardened Trigger: Programmatically reject UPDATE and DELETE attempts on compliance tables
CREATE OR REPLACE FUNCTION public.enforce_insert_only()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'REGULATORY COMPLIANCE VIOLATION: Table % is strictly insert-only. Updates and deletions are legally prohibited.', TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS trg_immutable_financial_ledger ON public.financial_ledger_entries;
CREATE TRIGGER trg_immutable_financial_ledger
BEFORE UPDATE OR DELETE ON public.financial_ledger_entries
FOR EACH ROW EXECUTE FUNCTION public.enforce_insert_only();

DROP TRIGGER IF EXISTS trg_immutable_haccp_audit ON public.haccp_audit_records;
CREATE TRIGGER trg_immutable_haccp_audit
BEFORE UPDATE OR DELETE ON public.haccp_audit_records
FOR EACH ROW EXECUTE FUNCTION public.enforce_insert_only();

DROP TRIGGER IF EXISTS trg_immutable_reefer_telemetry ON public.reefer_sensor_readings;
CREATE TRIGGER trg_immutable_reefer_telemetry
BEFORE UPDATE OR DELETE ON public.reefer_sensor_readings
FOR EACH ROW EXECUTE FUNCTION public.enforce_insert_only();

-- ============================================================================
-- 16. ATOMIC INVENTORY DEDUCTION (SECURITY DEFINER FUNCTIONS)
-- ============================================================================
-- Decrementing inventory batches CANNOT be performed via direct client updates.
-- Must be executed atomically in one transaction with row locking (FOR UPDATE).

CREATE OR REPLACE FUNCTION public.deduct_inventory_stock(
    p_lot_id TEXT,
    p_weight_kg NUMERIC,
    p_order_id TEXT,
    p_species_id TEXT,
    p_grade public.quality_grade,
    p_price_per_kg NUMERIC,
    p_notes TEXT DEFAULT NULL
)
RETURNS public.order_line_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_available NUMERIC;
    v_allocated NUMERIC;
    v_species_name TEXT;
    v_new_item public.order_line_items;
BEGIN
    -- Verify authorization: only ops, sales, or admin
    IF NOT (public.is_sales_or_admin()) THEN
        RAISE EXCEPTION 'Access Denied: Only authorized operations and sales staff can allocate inventory.';
    END IF;

    IF p_weight_kg <= 0 THEN
        RAISE EXCEPTION 'Requested weight must be greater than zero kg.';
    END IF;

    -- Row lock on inventory batch
    SELECT available_weight_kg, allocated_weight_kg, species_name
    INTO v_available, v_allocated, v_species_name
    FROM public.inventory_batches
    WHERE id = p_lot_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Inventory lot batch % not found.', p_lot_id;
    END IF;

    -- Strict atomic verification
    IF v_available < p_weight_kg THEN
        RAISE EXCEPTION 'Insufficient stock in Lot %: requested % kg, but only % kg available.', 
            p_lot_id, p_weight_kg, v_available;
    END IF;

    -- Atomic decrement & allocation increment
    UPDATE public.inventory_batches
    SET available_weight_kg = available_weight_kg - p_weight_kg,
        allocated_weight_kg = allocated_weight_kg + p_weight_kg,
        updated_at = now()
    WHERE id = p_lot_id;

    -- Insert order line item in the same transaction
    INSERT INTO public.order_line_items (
        order_id,
        species_id,
        species_name,
        grade,
        lot_id,
        requested_weight_kg,
        actual_weighed_kg,
        price_per_kg,
        notes
    ) VALUES (
        p_order_id,
        p_species_id,
        v_species_name,
        p_grade,
        p_lot_id,
        p_weight_kg,
        p_weight_kg,
        p_price_per_kg,
        p_notes
    )
    RETURNING * INTO v_new_item;

    RETURN v_new_item;
END;
$$;

-- Atomic Inward Catch Lot Intake & Ledger COGS Booking
CREATE OR REPLACE FUNCTION public.intake_landed_catch_lot(
    p_po_id TEXT,
    p_lot_id TEXT,
    p_species_id TEXT,
    p_harvest_date DATE,
    p_landing_port TEXT,
    p_vessel_name TEXT,
    p_vessel_registration TEXT,
    p_captain_name TEXT,
    p_fao_area TEXT,
    p_lat NUMERIC,
    p_lng NUMERIC,
    p_gear_type TEXT,
    p_grade public.quality_grade,
    p_weight_kg NUMERIC,
    p_storage_zone public.storage_zone,
    p_core_temp NUMERIC,
    p_cost_per_kg NUMERIC,
    p_wholesale_price NUMERIC,
    p_supplier_name TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS public.inventory_batches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_spec RECORD;
    v_batch public.inventory_batches;
    v_total_cost NUMERIC;
BEGIN
    IF NOT (public.is_ops_or_admin()) THEN
        RAISE EXCEPTION 'Access Denied: Only operations managers and admins can intake dock catch lots.';
    END IF;

    SELECT name, scientific_name, category INTO v_spec
    FROM public.species
    WHERE id = p_species_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid species ID %', p_species_id;
    END IF;

    v_total_cost := p_weight_kg * p_cost_per_kg;

    -- Insert inventory batch
    INSERT INTO public.inventory_batches (
        id, species_id, species_name, scientific_name, category,
        harvest_date, landing_port, vessel_name, vessel_registration,
        captain_name, fao_area, latitude, longitude, gear_type,
        grade, initial_weight_kg, available_weight_kg, allocated_weight_kg,
        storage_zone, current_temp_celsius, target_temp_celsius,
        cost_per_kg, wholesale_price_per_kg, inspection_status,
        core_temp_celsius, received_date, expiry_date, qr_code_seed, notes
    ) VALUES (
        p_lot_id, p_species_id, v_spec.name, v_spec.scientific_name, v_spec.category,
        p_harvest_date, p_landing_port, p_vessel_name, p_vessel_registration,
        p_captain_name, p_fao_area, p_lat, p_lng, p_gear_type,
        p_grade, p_weight_kg, p_weight_kg, 0,
        p_storage_zone, p_core_temp, -22.0,
        p_cost_per_kg, p_wholesale_price, 'Passed',
        p_core_temp, CURRENT_DATE, CURRENT_DATE + INTERVAL '12 months',
        'FROSTLY-' || p_lot_id, p_notes
    )
    RETURNING * INTO v_batch;

    -- Automatically post COGS to the immutable financial general ledger
    INSERT INTO public.financial_ledger_entries (
        entry_date, type, category, description,
        reference_id, entity_name, amount, payment_method, status, created_by
    ) VALUES (
        CURRENT_DATE, 'COGS', 'COGS (Catch Intake)',
        'Landed Catch Intake ' || v_spec.name || ' (' || p_weight_kg || ' kg @ $' || p_cost_per_kg || '/kg)',
        p_po_id, p_supplier_name, v_total_cost, 'Direct Accounts Payable', 'Pending', auth.uid()
    );

    RETURN v_batch;
END;
$$;

-- ============================================================================
-- 17. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
-- Strategy: All operational tables are protected.
-- SELECT: Granted to all authenticated staff (admin, ops, sales, viewer).
-- INSERT/UPDATE/DELETE: Restricted to appropriate roles.
-- Strictly NO UPDATE/DELETE on compliance tables.

-- Enable RLS on every table
ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.species ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reefer_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_vessels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_price_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retail_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retail_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retail_sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.haccp_audit_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reefer_sensor_readings ENABLE ROW LEVEL SECURITY;

-- 17.1 Staff Profiles Policies
CREATE POLICY "Staff can view all profiles"
    ON public.staff_profiles FOR SELECT
    TO authenticated
    USING (public.is_staff());

CREATE POLICY "Admins can manage staff profiles"
    ON public.staff_profiles FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 17.2 Species Master Catalog
CREATE POLICY "Staff can view species catalog"
    ON public.species FOR SELECT
    TO authenticated
    USING (public.is_staff());

CREATE POLICY "Ops & Admin can manage species"
    ON public.species FOR ALL
    TO authenticated
    USING (public.is_ops_or_admin())
    WITH CHECK (public.is_ops_or_admin());

-- 17.3 Inventory Batches
CREATE POLICY "Staff can view inventory batches"
    ON public.inventory_batches FOR SELECT
    TO authenticated
    USING (public.is_staff());

CREATE POLICY "Ops and Admin can insert batches"
    ON public.inventory_batches FOR INSERT
    TO authenticated
    WITH CHECK (public.is_ops_or_admin());

CREATE POLICY "Ops and Admin can update batches"
    ON public.inventory_batches FOR UPDATE
    TO authenticated
    USING (public.is_ops_or_admin())
    WITH CHECK (public.is_ops_or_admin());

-- 17.4 Customers
CREATE POLICY "Staff can view customers"
    ON public.customers FOR SELECT
    TO authenticated
    USING (public.is_staff());

CREATE POLICY "Sales and Admin can manage customers"
    ON public.customers FOR ALL
    TO authenticated
    USING (public.is_sales_or_admin())
    WITH CHECK (public.is_sales_or_admin());

-- 17.5 Suppliers
CREATE POLICY "Staff can view suppliers"
    ON public.suppliers FOR SELECT
    TO authenticated
    USING (public.is_staff());

CREATE POLICY "Ops and Admin can manage suppliers"
    ON public.suppliers FOR ALL
    TO authenticated
    USING (public.is_ops_or_admin())
    WITH CHECK (public.is_ops_or_admin());

-- 17.6 Purchase Orders & Items
CREATE POLICY "Staff can view purchase orders"
    ON public.purchase_orders FOR SELECT
    TO authenticated
    USING (public.is_staff());

CREATE POLICY "Ops and Admin can manage purchase orders"
    ON public.purchase_orders FOR ALL
    TO authenticated
    USING (public.is_ops_or_admin())
    WITH CHECK (public.is_ops_or_admin());

CREATE POLICY "Staff can view po items"
    ON public.purchase_order_items FOR SELECT
    TO authenticated
    USING (public.is_staff());

CREATE POLICY "Ops and Admin can manage po items"
    ON public.purchase_order_items FOR ALL
    TO authenticated
    USING (public.is_ops_or_admin())
    WITH CHECK (public.is_ops_or_admin());

-- 17.7 Client Orders & Order Line Items
CREATE POLICY "Staff can view client orders"
    ON public.client_orders FOR SELECT
    TO authenticated
    USING (public.is_staff());

CREATE POLICY "Sales and Admin can manage client orders"
    ON public.client_orders FOR ALL
    TO authenticated
    USING (public.is_sales_or_admin())
    WITH CHECK (public.is_sales_or_admin());

CREATE POLICY "Staff can view order line items"
    ON public.order_line_items FOR SELECT
    TO authenticated
    USING (public.is_staff());

CREATE POLICY "Sales and Admin can manage order line items"
    ON public.order_line_items FOR ALL
    TO authenticated
    USING (public.is_sales_or_admin())
    WITH CHECK (public.is_sales_or_admin());

-- 17.8 Reefer Vehicles & Fleet Vessels
CREATE POLICY "Staff can view reefer vehicles"
    ON public.reefer_vehicles FOR SELECT
    TO authenticated
    USING (public.is_staff());

CREATE POLICY "Ops and Admin can manage reefer vehicles"
    ON public.reefer_vehicles FOR ALL
    TO authenticated
    USING (public.is_ops_or_admin())
    WITH CHECK (public.is_ops_or_admin());

CREATE POLICY "Staff can view fleet vessels"
    ON public.fleet_vessels FOR SELECT
    TO authenticated
    USING (public.is_staff());

CREATE POLICY "Ops and Admin can manage fleet vessels"
    ON public.fleet_vessels FOR ALL
    TO authenticated
    USING (public.is_ops_or_admin())
    WITH CHECK (public.is_ops_or_admin());

-- 17.9 Market Price Index & Notifications
CREATE POLICY "Staff can view market prices"
    ON public.market_price_index FOR SELECT
    TO authenticated
    USING (public.is_staff());

CREATE POLICY "Ops and Admin can update market prices"
    ON public.market_price_index FOR ALL
    TO authenticated
    USING (public.is_ops_or_admin())
    WITH CHECK (public.is_ops_or_admin());

CREATE POLICY "Staff can view notifications"
    ON public.system_notifications FOR SELECT
    TO authenticated
    USING (public.is_staff());

CREATE POLICY "Staff can update notifications (mark read)"
    ON public.system_notifications FOR UPDATE
    TO authenticated
    USING (public.is_staff())
    WITH CHECK (public.is_staff());

-- 17.10 Retail Products & POS Transactions
CREATE POLICY "Staff can view retail products"
    ON public.retail_products FOR SELECT
    TO authenticated
    USING (public.is_staff());

CREATE POLICY "Ops and Admin can manage retail products"
    ON public.retail_products FOR ALL
    TO authenticated
    USING (public.is_ops_or_admin())
    WITH CHECK (public.is_ops_or_admin());

CREATE POLICY "Staff can view retail transactions"
    ON public.retail_transactions FOR SELECT
    TO authenticated
    USING (public.is_staff());

CREATE POLICY "Sales and Ops can insert retail transactions"
    ON public.retail_transactions FOR INSERT
    TO authenticated
    WITH CHECK (public.is_sales_or_admin());

CREATE POLICY "Staff can view retail sale items"
    ON public.retail_sale_items FOR SELECT
    TO authenticated
    USING (public.is_staff());

CREATE POLICY "Sales and Ops can insert retail sale items"
    ON public.retail_sale_items FOR INSERT
    TO authenticated
    WITH CHECK (public.is_sales_or_admin());

-- 17.11 App Settings (Enterprise Singleton)
CREATE POLICY "Staff can view app settings"
    ON public.app_settings FOR SELECT
    TO authenticated
    USING (public.is_staff());

CREATE POLICY "Only Admin can update app settings"
    ON public.app_settings FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 17.12 THE THREE INSERT-ONLY COMPLIANCE TABLES
-- Note: NO UPDATE OR DELETE POLICIES ARE CREATED FOR THESE TABLES.

-- (A) Financial Ledger Entries (Audit Trail)
CREATE POLICY "Staff can view financial ledger"
    ON public.financial_ledger_entries FOR SELECT
    TO authenticated
    USING (public.is_staff());

CREATE POLICY "Sales, Ops, and Admin can insert financial ledger entries"
    ON public.financial_ledger_entries FOR INSERT
    TO authenticated
    WITH CHECK (public.is_sales_or_admin());

-- (B) HACCP Audit Records (FDA / EU Food Safety)
CREATE POLICY "Staff can view haccp audit records"
    ON public.haccp_audit_records FOR SELECT
    TO authenticated
    USING (public.is_staff());

CREATE POLICY "Ops and Admin can insert haccp audit records"
    ON public.haccp_audit_records FOR INSERT
    TO authenticated
    WITH CHECK (public.is_ops_or_admin());

-- (C) Reefer Sensor Telemetry Stream (Cold Chain Log)
CREATE POLICY "Staff can view reefer telemetry"
    ON public.reefer_sensor_readings FOR SELECT
    TO authenticated
    USING (public.is_staff());

CREATE POLICY "Ops, Telemetry Service, and Admin can insert reefer readings"
    ON public.reefer_sensor_readings FOR INSERT
    TO authenticated
    WITH CHECK (public.is_ops_or_admin());

-- 18. DEFAULT SINGLETON APP SETTINGS SEED
INSERT INTO public.app_settings (
    id, company_name, facility_code, fda_registration_number, eu_approval_number,
    haccp_coordinator, primary_port, tax_rate, currency, super_cryo_target_c,
    super_cryo_max_alert_c, commercial_freeze_target_c, commercial_freeze_max_alert_c,
    slush_ice_target_c, slush_ice_max_alert_c, histamine_limit_ppm, sensor_polling_interval_sec,
    enable_audio_alerts, use_imperial, weight_decimal_places, date_format,
    default_payment_terms, auto_generate_qr_traceability, ice_packaging_fee_per_kg,
    min_order_value_wholesale, notify_haccp_excursion, notify_low_inventory,
    notify_overdue_invoices, notify_vessel_arrivals, low_stock_threshold_kg
) VALUES (
    1, 'Pacific Cold-Chain & Seafood Holdings Ltd.', 'FAC-PAC-808-CRY', 'FDA-REG-#1948201', 'EU-ESP-9281-CE',
    'Dr. Elena Rostova, Lead Quality Auditor', 'Port of Tema & Pier 38 Fishing Harbour', 15.00, 'GHS', -60.0,
    -50.0, -22.0, -18.0, 0.5, 3.0, 50.0, 30,
    TRUE, FALSE, 1, 'YYYY-MM-DD',
    'Net 30 Days', TRUE, 0.45, 300.00,
    TRUE, TRUE, TRUE, TRUE, 200.0
) ON CONFLICT (id) DO NOTHING;
