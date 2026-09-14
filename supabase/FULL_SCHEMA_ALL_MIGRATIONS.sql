-- ============================================================================
-- FROSTLY SEAFOOD COLD-CHAIN ERP
-- COMPLETE ALL-IN-ONE SYSTEM SCHEMA (Migrations 001 to 015)
-- Run this in Supabase SQL Editor for fresh database initialization
-- ============================================================================


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- START OF 001_extensions_and_types.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ============================================================================
-- FROSTLY SEAFOOD COLD-CHAIN ERP
-- Migration 001: Extensions and Custom Types
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 1. Staff Role Enum
DO $$ BEGIN
    CREATE TYPE public.staff_role AS ENUM (
        'admin',
        'ops_staff',
        'sales_staff',
        'dispatch_staff',
        'viewer'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Seafood Species & Biological Category
DO $$ BEGIN
    CREATE TYPE public.species_category AS ENUM (
        'Pelagic',
        'Salmonid',
        'Crustacean',
        'Mollusk',
        'Groundfish'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Cold-Chain Storage Temperature Zone
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

-- 4. Seafood Quality Grade
DO $$ BEGIN
    CREATE TYPE public.quality_grade AS ENUM (
        'Sashimi AAA',
        'Grade #1',
        'Grade #2',
        'Processing Grade',
        'Live Prime'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 5. B2B Client Order Progression Status
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

-- 6. Settlement & Payment Status
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

-- 7. Commercial Terms
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

-- 8. Customer Institutional Type
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

-- 9. Commercial Pricing Tier
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

-- 10. Supplier Harvester Entity Type
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

-- 11. Processed Seafood Cut Type
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

-- 12. General Financial Ledger Entry Type
DO $$ BEGIN
    CREATE TYPE public.financial_entry_type AS ENUM ('Income', 'COGS', 'OpEx');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 13. Financial Ledger Operational Category
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

-- 14. System Notification Category & Urgency
DO $$ BEGIN
    CREATE TYPE public.notification_type AS ENUM (
        'temp_alert',
        'order_update',
        'catch_landed',
        'haccp_pass',
        'system',
        'payment_received',
        'invoice_due',
        'supplier_delivery'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.notification_urgency AS ENUM (
        'low',
        'medium',
        'high',
        'critical'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 15. HACCP Regulatory Audit Compliance Result
DO $$ BEGIN
    CREATE TYPE public.haccp_compliance_status AS ENUM (
        'Approved - Grade AAA',
        'Approved - Standard',
        'Quarantine - Re-inspect',
        'Rejected'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;



-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- START OF 002_tables.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

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



-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- START OF 003_indexes.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ============================================================================
-- FROSTLY SEAFOOD COLD-CHAIN ERP
-- Migration 003: Performance and Filter Indexes
-- ============================================================================

-- 1. Staff Profiles & RLS Helper Lookups
CREATE INDEX IF NOT EXISTS idx_staff_profiles_role ON public.staff_profiles(role);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_active ON public.staff_profiles(is_active);

-- 2. Species Lookups & Trigram Fuzzy Search
CREATE INDEX IF NOT EXISTS idx_species_category ON public.species(category);
CREATE INDEX IF NOT EXISTS idx_species_active ON public.species(is_active);
CREATE INDEX IF NOT EXISTS idx_species_name_trgm ON public.species USING gin (name gin_trgm_ops);

-- 3. Customers Lookups & Trigram Search
CREATE INDEX IF NOT EXISTS idx_customers_status ON public.customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_tier ON public.customers(tier);
CREATE INDEX IF NOT EXISTS idx_customers_active ON public.customers(is_active);
CREATE INDEX IF NOT EXISTS idx_customers_name_trgm ON public.customers USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_company_trgm ON public.customers USING gin (company_name gin_trgm_ops);

-- 4. Suppliers Lookups & Trigram Search
CREATE INDEX IF NOT EXISTS idx_suppliers_status ON public.suppliers(status);
CREATE INDEX IF NOT EXISTS idx_suppliers_active ON public.suppliers(is_active);
CREATE INDEX IF NOT EXISTS idx_suppliers_name_trgm ON public.suppliers USING gin (name gin_trgm_ops);

-- 5. Inventory Batches (Traceability, Storage & Expiry)
CREATE INDEX IF NOT EXISTS idx_inventory_species ON public.inventory_batches(species_id);
CREATE INDEX IF NOT EXISTS idx_inventory_storage_zone ON public.inventory_batches(storage_zone);
CREATE INDEX IF NOT EXISTS idx_inventory_expiry ON public.inventory_batches(expiry_date);
CREATE INDEX IF NOT EXISTS idx_inventory_inspection ON public.inventory_batches(inspection_status);
CREATE INDEX IF NOT EXISTS idx_inventory_available_weight ON public.inventory_batches(available_weight_kg);

-- 6. Purchase Orders & Intake Items
CREATE INDEX IF NOT EXISTS idx_po_supplier_id ON public.purchase_order_landings(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON public.purchase_order_landings(status);
CREATE INDEX IF NOT EXISTS idx_po_items_po_id ON public.purchase_order_items(po_id);
CREATE INDEX IF NOT EXISTS idx_po_items_species_id ON public.purchase_order_items(species_id);

-- 7. Client Orders & Line Items (Pagination & Query Performance)
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.client_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.client_orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_date ON public.client_orders(required_delivery_date);
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at ON public.client_orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_line_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_lot_id ON public.order_line_items(lot_id);

-- 8. Reefer Logistics & Fleet Vessels
CREATE INDEX IF NOT EXISTS idx_reefer_status ON public.reefer_vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vessels_status ON public.fleet_vessels(status);

-- 9. Retail Products & POS Transactions
CREATE INDEX IF NOT EXISTS idx_retail_products_species ON public.retail_wholesale_products(species_id);
CREATE INDEX IF NOT EXISTS idx_retail_products_sku ON public.retail_wholesale_products(sku);
CREATE INDEX IF NOT EXISTS idx_retail_tx_date ON public.retail_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_retail_tx_status_date ON public.retail_transactions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_retail_items_tx_id ON public.retail_sale_items(transaction_id);

-- 10. System Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.system_notifications(read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_urgency ON public.system_notifications(urgency);

-- 11. Insert-Only Compliance Tables (Time-Series & Foreign References)
CREATE INDEX IF NOT EXISTS idx_ledger_entry_date ON public.financial_ledger_entries(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_type ON public.financial_ledger_entries(type);
CREATE INDEX IF NOT EXISTS idx_ledger_reference_id ON public.financial_ledger_entries(reference_id);

CREATE INDEX IF NOT EXISTS idx_haccp_lot_id ON public.haccp_audit_records(lot_id, inspection_date DESC);
CREATE INDEX IF NOT EXISTS idx_haccp_compliance ON public.haccp_audit_records(final_compliance);

CREATE INDEX IF NOT EXISTS idx_reefer_sensor_vehicle_time ON public.reefer_sensor_readings(vehicle_id, recorded_at DESC);



-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- START OF 004_functions_and_triggers.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ============================================================================
-- FROSTLY SEAFOOD COLD-CHAIN ERP
-- Migration 004: Functions and Triggers
-- ============================================================================

-- 1. Standard Reusable Updated At Timestamp Trigger Function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Attach set_updated_at to mutable tables
DROP TRIGGER IF EXISTS trg_staff_profiles_updated_at ON public.staff_profiles;
CREATE TRIGGER trg_staff_profiles_updated_at
BEFORE UPDATE ON public.staff_profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_species_updated_at ON public.species;
CREATE TRIGGER trg_species_updated_at
BEFORE UPDATE ON public.species
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_customers_updated_at ON public.customers;
CREATE TRIGGER trg_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_suppliers_updated_at ON public.suppliers;
CREATE TRIGGER trg_suppliers_updated_at
BEFORE UPDATE ON public.suppliers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_inventory_batches_updated_at ON public.inventory_batches;
CREATE TRIGGER trg_inventory_batches_updated_at
BEFORE UPDATE ON public.inventory_batches
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_purchase_order_landings_updated_at ON public.purchase_order_landings;
CREATE TRIGGER trg_purchase_order_landings_updated_at
BEFORE UPDATE ON public.purchase_order_landings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_reefer_vehicles_updated_at ON public.reefer_vehicles;
CREATE TRIGGER trg_reefer_vehicles_updated_at
BEFORE UPDATE ON public.reefer_vehicles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_client_orders_updated_at ON public.client_orders;
CREATE TRIGGER trg_client_orders_updated_at
BEFORE UPDATE ON public.client_orders
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_fleet_vessels_updated_at ON public.fleet_vessels;
CREATE TRIGGER trg_fleet_vessels_updated_at
BEFORE UPDATE ON public.fleet_vessels
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_market_price_index_updated_at ON public.market_price_index;
CREATE TRIGGER trg_market_price_index_updated_at
BEFORE UPDATE ON public.market_price_index
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_retail_products_updated_at ON public.retail_wholesale_products;
CREATE TRIGGER trg_retail_products_updated_at
BEFORE UPDATE ON public.retail_wholesale_products
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER trg_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 2. New Staff Profile Creation on Supabase Auth Signup
CREATE OR REPLACE FUNCTION public.handle_new_staff_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.staff_profiles (
        id,
        email,
        full_name,
        role,
        department,
        is_active
    ) VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        'viewer', -- Default lowest privilege on signup; admin must elevate
        COALESCE(NEW.raw_user_meta_data->>'department', 'Operations'),
        TRUE
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_staff_signup();


-- 3. Staff Role Audit Logging Trigger
CREATE OR REPLACE FUNCTION public.audit_staff_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF (OLD.role IS DISTINCT FROM NEW.role) THEN
        INSERT INTO public.staff_role_audit_logs (
            target_staff_id,
            previous_role,
            new_role,
            changed_by,
            reason
        ) VALUES (
            NEW.id,
            OLD.role,
            NEW.role,
            COALESCE(auth.uid(), NEW.id),
            'Role updated via administrative interface'
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_staff_role ON public.staff_profiles;
CREATE TRIGGER trg_audit_staff_role
AFTER UPDATE ON public.staff_profiles
FOR EACH ROW EXECUTE FUNCTION public.audit_staff_role_change();


-- 4. Hardened Immutability Trigger for the 3 Compliance Tables
CREATE OR REPLACE FUNCTION public.enforce_insert_only_compliance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'LEGAL & REGULATORY VIOLATION: Table % is strictly insert-only. Modifications and deletions are prohibited.', TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS trg_immutable_financial_ledger ON public.financial_ledger_entries;
CREATE TRIGGER trg_immutable_financial_ledger
BEFORE UPDATE OR DELETE ON public.financial_ledger_entries
FOR EACH ROW EXECUTE FUNCTION public.enforce_insert_only_compliance();

DROP TRIGGER IF EXISTS trg_immutable_haccp_audit ON public.haccp_audit_records;
CREATE TRIGGER trg_immutable_haccp_audit
BEFORE UPDATE OR DELETE ON public.haccp_audit_records
FOR EACH ROW EXECUTE FUNCTION public.enforce_insert_only_compliance();

DROP TRIGGER IF EXISTS trg_immutable_reefer_telemetry ON public.reefer_sensor_readings;
CREATE TRIGGER trg_immutable_reefer_telemetry
BEFORE UPDATE OR DELETE ON public.reefer_sensor_readings
FOR EACH ROW EXECUTE FUNCTION public.enforce_insert_only_compliance();


-- 5. Food Safety Compliance Check Trigger on Order Line Items
-- Ensures a lot with a 'Rejected' HACCP status can never be added to an order.
CREATE OR REPLACE FUNCTION public.validate_lot_haccp_eligibility()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_latest_compliance public.haccp_compliance_status;
    v_inspection_status TEXT;
BEGIN
    -- Check batch inspection status
    SELECT inspection_status INTO v_inspection_status
    FROM public.inventory_batches
    WHERE id = NEW.lot_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Referenced inventory batch lot % does not exist.', NEW.lot_id;
    END IF;

    -- Query latest HACCP compliance status for this lot
    SELECT final_compliance INTO v_latest_compliance
    FROM public.haccp_audit_records
    WHERE lot_id = NEW.lot_id
    ORDER BY inspection_date DESC
    LIMIT 1;

    IF v_latest_compliance = 'Rejected' THEN
        RAISE EXCEPTION 'FOOD SAFETY AUDIT EXCEPTION: Lot % has been REJECTED by HACCP inspection and cannot be sold or allocated.', NEW.lot_id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_order_item_haccp ON public.order_line_items;
CREATE TRIGGER trg_validate_order_item_haccp
BEFORE INSERT OR UPDATE ON public.order_line_items
FOR EACH ROW EXECUTE FUNCTION public.validate_lot_haccp_eligibility();


-- 6. State Machine Trigger for Client Order Status Progression
-- Rule: Pending Confirmation → Weighing & Grading → Cryo-Packed & Iced → In Reefer Transit → Delivered.
-- May transition to 'Cancelled' from any non-terminal state.
-- Terminal states ('Delivered' and 'Cancelled') are irreversible.
CREATE OR REPLACE FUNCTION public.enforce_order_status_progression()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_old_rank INT;
    v_new_rank INT;
BEGIN
    IF (OLD.status = NEW.status) THEN
        RETURN NEW;
    END IF;

    -- Cannot leave terminal states
    IF OLD.status IN ('Delivered', 'Cancelled') THEN
        RAISE EXCEPTION 'INVALID STATE TRANSITION: Order % is already in terminal state % and cannot be modified.',
            OLD.id, OLD.status;
    END IF;

    -- Any non-terminal state may transition to Cancelled
    IF NEW.status = 'Cancelled' THEN
        RETURN NEW;
    END IF;

    -- Map sequential progression ranks
    v_old_rank := CASE OLD.status
        WHEN 'Pending Confirmation' THEN 1
        WHEN 'Weighing & Grading'    THEN 2
        WHEN 'Cryo-Packed & Iced'    THEN 3
        WHEN 'In Reefer Transit'     THEN 4
        ELSE 0
    END;

    v_new_rank := CASE NEW.status
        WHEN 'Pending Confirmation' THEN 1
        WHEN 'Weighing & Grading'    THEN 2
        WHEN 'Cryo-Packed & Iced'    THEN 3
        WHEN 'In Reefer Transit'     THEN 4
        WHEN 'Delivered'             THEN 5
        ELSE 0
    END;

    -- Enforce forward-only progression
    IF v_new_rank < v_old_rank THEN
        RAISE EXCEPTION 'INVALID STATE TRANSITION: Order % cannot move backward from "%" to "%".',
            OLD.id, OLD.status, NEW.status;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_order_status ON public.client_orders;
CREATE TRIGGER trg_enforce_order_status
BEFORE UPDATE OF status ON public.client_orders
FOR EACH ROW EXECUTE FUNCTION public.enforce_order_status_progression();


-- 7. Automated Cold-Chain Excursion Notification Trigger
CREATE OR REPLACE FUNCTION public.check_reefer_telemetry_excursion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_vehicle RECORD;
BEGIN
    SELECT name, min_safe_temp, max_safe_temp INTO v_vehicle
    FROM public.reefer_vehicles
    WHERE id = NEW.vehicle_id;

    IF FOUND THEN
        -- Update vehicle current temperature
        UPDATE public.reefer_vehicles
        SET current_temp_celsius = NEW.temperature,
            ambient_humidity_pct = NEW.humidity,
            status = CASE 
                WHEN (NEW.temperature < v_vehicle.min_safe_temp OR NEW.temperature > v_vehicle.max_safe_temp)
                THEN 'Temp Alert!'
                ELSE status
            END,
            updated_at = now()
        WHERE id = NEW.vehicle_id;

        -- If temperature excursion detected, push system notification
        IF (NEW.temperature > v_vehicle.max_safe_temp) THEN
            INSERT INTO public.system_notifications (
                type,
                title,
                message,
                urgency,
                related_entity_id
            ) VALUES (
                'temp_alert',
                'HACCP CRITICAL EXCURSION: ' || v_vehicle.name,
                'Reefer temperature spiked to ' || NEW.temperature || '°C (Max threshold is ' || v_vehicle.max_safe_temp || '°C). Cargo integrity at risk.',
                'critical',
                NEW.vehicle_id
            );
        ELSIF (NEW.temperature < v_vehicle.min_safe_temp) THEN
            INSERT INTO public.system_notifications (
                type,
                title,
                message,
                urgency,
                related_entity_id
            ) VALUES (
                'temp_alert',
                'TEMPERATURE WARNING: ' || v_vehicle.name,
                'Reefer temperature dropped to ' || NEW.temperature || '°C (Below minimum ' || v_vehicle.min_safe_temp || '°C).',
                'high',
                NEW.vehicle_id
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reefer_telemetry_alert ON public.reefer_sensor_readings;
CREATE TRIGGER trg_reefer_telemetry_alert
AFTER INSERT ON public.reefer_sensor_readings
FOR EACH ROW EXECUTE FUNCTION public.check_reefer_telemetry_excursion();


-- 8. Atomic Fulfillment & Stock Deduction RPC Function
-- Requirements:
-- - SECURITY DEFINER with safe search path.
-- - Atomically checks the lot's available_weight_kg via row lock (FOR UPDATE).
-- - Rejects if requested weight exceeds available weight.
-- - Updates order line item with actual_weighed_kg.
-- - Decrements available_weight_kg and increments allocated_weight_kg on the lot.
CREATE OR REPLACE FUNCTION public.fn_fulfill_order_line_item(
    p_order_line_item_id UUID,
    p_actual_weighed_kg NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_item RECORD;
    v_lot RECORD;
    v_calling_role public.staff_role;
BEGIN
    -- Verify authorization: only admin or sales_staff or ops_staff
    SELECT role INTO v_calling_role
    FROM public.staff_profiles
    WHERE id = auth.uid() AND is_active = TRUE;

    IF v_calling_role NOT IN ('admin', 'ops_staff', 'sales_staff') THEN
        RAISE EXCEPTION 'Access Denied: Only operations or sales staff can weigh and allocate seafood inventory.';
    END IF;

    IF p_actual_weighed_kg <= 0 THEN
        RAISE EXCEPTION 'Actual weighed weight must be greater than zero kg.';
    END IF;

    -- Lock and retrieve the order line item
    SELECT * INTO v_item
    FROM public.order_line_items
    WHERE id = p_order_line_item_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order line item % not found.', p_order_line_item_id;
    END IF;

    -- Row lock on the referenced inventory batch lot
    SELECT id, species_name, available_weight_kg, allocated_weight_kg, wholesale_price_per_kg
    INTO v_lot
    FROM public.inventory_batches
    WHERE id = v_item.lot_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Referenced inventory batch lot % not found.', v_item.lot_id;
    END IF;

    -- Concurrency check: reject if requested weight exceeds available weight
    IF v_lot.available_weight_kg < p_actual_weighed_kg THEN
        RAISE EXCEPTION 'INSUFFICIENT STOCK IN LOT %: requested % kg, but only % kg available.',
            v_lot.id, p_actual_weighed_kg, v_lot.available_weight_kg;
    END IF;

    -- Atomically update inventory lot balances
    UPDATE public.inventory_batches
    SET available_weight_kg = available_weight_kg - p_actual_weighed_kg,
        allocated_weight_kg = allocated_weight_kg + p_actual_weighed_kg,
        updated_at = now()
    WHERE id = v_lot.id;

    -- Update the order line item
    UPDATE public.order_line_items
    SET actual_weighed_kg = p_actual_weighed_kg
    WHERE id = p_order_line_item_id;

    -- Update parent order adjusted total
    UPDATE public.client_orders
    SET adjusted_total_usd = (
        SELECT COALESCE(SUM(COALESCE(actual_weighed_kg, requested_weight_kg) * price_per_kg), 0)
        FROM public.order_line_items
        WHERE order_id = v_item.order_id
    ),
    status = CASE 
        WHEN status = 'Pending Confirmation' THEN 'Weighing & Grading'
        ELSE status 
    END,
    updated_at = now()
    WHERE id = v_item.order_id;

    RETURN jsonb_build_object(
        'success', true,
        'order_line_item_id', p_order_line_item_id,
        'lot_id', v_lot.id,
        'actual_weighed_kg', p_actual_weighed_kg,
        'remaining_available_kg', (v_lot.available_weight_kg - p_actual_weighed_kg),
        'new_allocated_kg', (v_lot.allocated_weight_kg + p_actual_weighed_kg)
    );
END;
$$;



-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- START OF 005_rls_policies.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ============================================================================
-- FROSTLY SEAFOOD COLD-CHAIN ERP
-- Migration 005: Row Level Security (RLS) Policies
-- ============================================================================

-- 1. Helper Functions (SECURITY DEFINER, Safe search_path)
CREATE OR REPLACE FUNCTION public.current_staff_role()
RETURNS public.staff_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.staff_profiles
    WHERE id = auth.uid() AND is_active = TRUE;
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.staff_profiles
        WHERE id = auth.uid() AND is_active = TRUE
    );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.staff_profiles
        WHERE id = auth.uid() AND role = 'admin' AND is_active = TRUE
    );
$$;

CREATE OR REPLACE FUNCTION public.is_ops_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.staff_profiles
        WHERE id = auth.uid() AND role IN ('admin', 'ops_staff') AND is_active = TRUE
    );
$$;

CREATE OR REPLACE FUNCTION public.is_sales_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.staff_profiles
        WHERE id = auth.uid() AND role IN ('admin', 'sales_staff') AND is_active = TRUE
    );
$$;

CREATE OR REPLACE FUNCTION public.is_dispatch_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.staff_profiles
        WHERE id = auth.uid() AND role IN ('admin', 'dispatch_staff') AND is_active = TRUE
    );
$$;

-- Enable RLS on ALL tables
ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_role_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.species ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_landings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reefer_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_vessels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_price_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retail_wholesale_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retail_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retail_sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.haccp_audit_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reefer_sensor_readings ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 1. Staff Profiles Policies
-- ----------------------------------------------------------------------------
-- Any active staff member can read staff profiles (e.g. to see names/roles of teammates)
DROP POLICY IF EXISTS "staff_profiles_select" ON public.staff_profiles;
CREATE POLICY "staff_profiles_select"
ON public.staff_profiles FOR SELECT
TO authenticated
USING (public.is_staff());

-- Only admins can insert/update staff profiles (users cannot change their own role)
DROP POLICY IF EXISTS "staff_profiles_insert" ON public.staff_profiles;
CREATE POLICY "staff_profiles_insert"
ON public.staff_profiles FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "staff_profiles_update" ON public.staff_profiles;
CREATE POLICY "staff_profiles_update"
ON public.staff_profiles FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- No DELETE policy; staff are soft-deleted via is_active = false
-- Staff role audit logs: Read by admin, insert via trigger only
DROP POLICY IF EXISTS "staff_role_audit_select" ON public.staff_role_audit_logs;
CREATE POLICY "staff_role_audit_select"
ON public.staff_role_audit_logs FOR SELECT
TO authenticated
USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 2. Species Master Catalog Policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "species_select" ON public.species;
CREATE POLICY "species_select"
ON public.species FOR SELECT
TO authenticated
USING (public.is_staff());

DROP POLICY IF EXISTS "species_insert" ON public.species;
CREATE POLICY "species_insert"
ON public.species FOR INSERT
TO authenticated
WITH CHECK (public.is_admin() OR public.is_ops_or_admin());

DROP POLICY IF EXISTS "species_update" ON public.species;
CREATE POLICY "species_update"
ON public.species FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Soft-delete only; no delete policy

-- ----------------------------------------------------------------------------
-- 3. Customers Policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "customers_select" ON public.customers;
CREATE POLICY "customers_select"
ON public.customers FOR SELECT
TO authenticated
USING (public.is_staff());

DROP POLICY IF EXISTS "customers_insert" ON public.customers;
CREATE POLICY "customers_insert"
ON public.customers FOR INSERT
TO authenticated
WITH CHECK (public.is_sales_or_admin());

DROP POLICY IF EXISTS "customers_update" ON public.customers;
CREATE POLICY "customers_update"
ON public.customers FOR UPDATE
TO authenticated
USING (public.is_sales_or_admin())
WITH CHECK (public.is_sales_or_admin());

-- Soft-delete only; no delete policy

-- ----------------------------------------------------------------------------
-- 4. Suppliers Policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "suppliers_select" ON public.suppliers;
CREATE POLICY "suppliers_select"
ON public.suppliers FOR SELECT
TO authenticated
USING (public.is_staff());

DROP POLICY IF EXISTS "suppliers_insert" ON public.suppliers;
CREATE POLICY "suppliers_insert"
ON public.suppliers FOR INSERT
TO authenticated
WITH CHECK (public.is_ops_or_admin() OR public.is_sales_or_admin());

DROP POLICY IF EXISTS "suppliers_update" ON public.suppliers;
CREATE POLICY "suppliers_update"
ON public.suppliers FOR UPDATE
TO authenticated
USING (public.is_ops_or_admin() OR public.is_sales_or_admin())
WITH CHECK (public.is_ops_or_admin() OR public.is_sales_or_admin());

-- ----------------------------------------------------------------------------
-- 5. Inventory Batches Policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "inventory_batches_select" ON public.inventory_batches;
CREATE POLICY "inventory_batches_select"
ON public.inventory_batches FOR SELECT
TO authenticated
USING (public.is_staff());

DROP POLICY IF EXISTS "inventory_batches_insert" ON public.inventory_batches;
CREATE POLICY "inventory_batches_insert"
ON public.inventory_batches FOR INSERT
TO authenticated
WITH CHECK (public.is_ops_or_admin());

DROP POLICY IF EXISTS "inventory_batches_update" ON public.inventory_batches;
CREATE POLICY "inventory_batches_update"
ON public.inventory_batches FOR UPDATE
TO authenticated
USING (public.is_ops_or_admin())
WITH CHECK (public.is_ops_or_admin());

-- ----------------------------------------------------------------------------
-- 6. Purchase Order Landings & Items Policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "po_landings_select" ON public.purchase_order_landings;
CREATE POLICY "po_landings_select"
ON public.purchase_order_landings FOR SELECT
TO authenticated
USING (public.is_staff());

DROP POLICY IF EXISTS "po_landings_insert" ON public.purchase_order_landings;
CREATE POLICY "po_landings_insert"
ON public.purchase_order_landings FOR INSERT
TO authenticated
WITH CHECK (public.is_ops_or_admin());

DROP POLICY IF EXISTS "po_landings_update" ON public.purchase_order_landings;
CREATE POLICY "po_landings_update"
ON public.purchase_order_landings FOR UPDATE
TO authenticated
USING (public.is_ops_or_admin())
WITH CHECK (public.is_ops_or_admin());

DROP POLICY IF EXISTS "po_items_select" ON public.purchase_order_items;
CREATE POLICY "po_items_select"
ON public.purchase_order_items FOR SELECT
TO authenticated
USING (public.is_staff());

DROP POLICY IF EXISTS "po_items_insert" ON public.purchase_order_items;
CREATE POLICY "po_items_insert"
ON public.purchase_order_items FOR INSERT
TO authenticated
WITH CHECK (public.is_ops_or_admin());

DROP POLICY IF EXISTS "po_items_update" ON public.purchase_order_items;
CREATE POLICY "po_items_update"
ON public.purchase_order_items FOR UPDATE
TO authenticated
USING (public.is_ops_or_admin())
WITH CHECK (public.is_ops_or_admin());

-- ----------------------------------------------------------------------------
-- 7. Reefer Vehicles Policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "reefer_vehicles_select" ON public.reefer_vehicles;
CREATE POLICY "reefer_vehicles_select"
ON public.reefer_vehicles FOR SELECT
TO authenticated
USING (public.is_staff());

DROP POLICY IF EXISTS "reefer_vehicles_insert" ON public.reefer_vehicles;
CREATE POLICY "reefer_vehicles_insert"
ON public.reefer_vehicles FOR INSERT
TO authenticated
WITH CHECK (public.is_dispatch_or_admin() OR public.is_ops_or_admin());

DROP POLICY IF EXISTS "reefer_vehicles_update" ON public.reefer_vehicles;
CREATE POLICY "reefer_vehicles_update"
ON public.reefer_vehicles FOR UPDATE
TO authenticated
USING (public.is_dispatch_or_admin() OR public.is_ops_or_admin())
WITH CHECK (public.is_dispatch_or_admin() OR public.is_ops_or_admin());

-- ----------------------------------------------------------------------------
-- 8. Client Orders & Order Line Items Policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "client_orders_select" ON public.client_orders;
CREATE POLICY "client_orders_select"
ON public.client_orders FOR SELECT
TO authenticated
USING (public.is_staff());

DROP POLICY IF EXISTS "client_orders_insert" ON public.client_orders;
CREATE POLICY "client_orders_insert"
ON public.client_orders FOR INSERT
TO authenticated
WITH CHECK (public.is_sales_or_admin());

DROP POLICY IF EXISTS "client_orders_update" ON public.client_orders;
CREATE POLICY "client_orders_update"
ON public.client_orders FOR UPDATE
TO authenticated
USING (public.is_sales_or_admin() OR public.is_dispatch_or_admin() OR public.is_ops_or_admin())
WITH CHECK (public.is_sales_or_admin() OR public.is_dispatch_or_admin() OR public.is_ops_or_admin());

DROP POLICY IF EXISTS "order_line_items_select" ON public.order_line_items;
CREATE POLICY "order_line_items_select"
ON public.order_line_items FOR SELECT
TO authenticated
USING (public.is_staff());

DROP POLICY IF EXISTS "order_line_items_insert" ON public.order_line_items;
CREATE POLICY "order_line_items_insert"
ON public.order_line_items FOR INSERT
TO authenticated
WITH CHECK (public.is_sales_or_admin());

DROP POLICY IF EXISTS "order_line_items_update" ON public.order_line_items;
CREATE POLICY "order_line_items_update"
ON public.order_line_items FOR UPDATE
TO authenticated
USING (public.is_sales_or_admin() OR public.is_ops_or_admin())
WITH CHECK (public.is_sales_or_admin() OR public.is_ops_or_admin());

DROP POLICY IF EXISTS "order_line_items_delete" ON public.order_line_items;
CREATE POLICY "order_line_items_delete"
ON public.order_line_items FOR DELETE
TO authenticated
USING (public.is_sales_or_admin());

-- ----------------------------------------------------------------------------
-- 9. Fleet Vessels Policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "fleet_vessels_select" ON public.fleet_vessels;
CREATE POLICY "fleet_vessels_select"
ON public.fleet_vessels FOR SELECT
TO authenticated
USING (public.is_staff());

DROP POLICY IF EXISTS "fleet_vessels_insert" ON public.fleet_vessels;
CREATE POLICY "fleet_vessels_insert"
ON public.fleet_vessels FOR INSERT
TO authenticated
WITH CHECK (public.is_ops_or_admin());

DROP POLICY IF EXISTS "fleet_vessels_update" ON public.fleet_vessels;
CREATE POLICY "fleet_vessels_update"
ON public.fleet_vessels FOR UPDATE
TO authenticated
USING (public.is_ops_or_admin())
WITH CHECK (public.is_ops_or_admin());

-- ----------------------------------------------------------------------------
-- 10. Market Price Index Policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "market_price_index_select" ON public.market_price_index;
CREATE POLICY "market_price_index_select"
ON public.market_price_index FOR SELECT
TO authenticated
USING (public.is_staff());

DROP POLICY IF EXISTS "market_price_index_write" ON public.market_price_index;
CREATE POLICY "market_price_index_write"
ON public.market_price_index FOR ALL
TO authenticated
USING (public.is_admin() OR public.is_ops_or_admin())
WITH CHECK (public.is_admin() OR public.is_ops_or_admin());

-- ----------------------------------------------------------------------------
-- 11. Retail Products & Transactions Policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "retail_products_select" ON public.retail_wholesale_products;
CREATE POLICY "retail_products_select"
ON public.retail_wholesale_products FOR SELECT
TO authenticated
USING (public.is_staff());

DROP POLICY IF EXISTS "retail_products_insert" ON public.retail_wholesale_products;
CREATE POLICY "retail_products_insert"
ON public.retail_wholesale_products FOR INSERT
TO authenticated
WITH CHECK (public.is_admin() OR public.is_sales_or_admin());

DROP POLICY IF EXISTS "retail_products_update" ON public.retail_wholesale_products;
CREATE POLICY "retail_products_update"
ON public.retail_wholesale_products FOR UPDATE
TO authenticated
USING (public.is_admin() OR public.is_sales_or_admin())
WITH CHECK (public.is_admin() OR public.is_sales_or_admin());

DROP POLICY IF EXISTS "retail_transactions_select" ON public.retail_transactions;
CREATE POLICY "retail_transactions_select"
ON public.retail_transactions FOR SELECT
TO authenticated
USING (public.is_staff());

DROP POLICY IF EXISTS "retail_transactions_insert" ON public.retail_transactions;
CREATE POLICY "retail_transactions_insert"
ON public.retail_transactions FOR INSERT
TO authenticated
WITH CHECK (public.is_sales_or_admin());

DROP POLICY IF EXISTS "retail_sale_items_select" ON public.retail_sale_items;
CREATE POLICY "retail_sale_items_select"
ON public.retail_sale_items FOR SELECT
TO authenticated
USING (public.is_staff());

DROP POLICY IF EXISTS "retail_sale_items_insert" ON public.retail_sale_items;
CREATE POLICY "retail_sale_items_insert"
ON public.retail_sale_items FOR INSERT
TO authenticated
WITH CHECK (public.is_sales_or_admin());

-- ----------------------------------------------------------------------------
-- 12. System Notifications Policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "system_notifications_select" ON public.system_notifications;
CREATE POLICY "system_notifications_select"
ON public.system_notifications FOR SELECT
TO authenticated
USING (public.is_staff());

DROP POLICY IF EXISTS "system_notifications_insert" ON public.system_notifications;
CREATE POLICY "system_notifications_insert"
ON public.system_notifications FOR INSERT
TO authenticated
WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "system_notifications_update" ON public.system_notifications;
CREATE POLICY "system_notifications_update"
ON public.system_notifications FOR UPDATE
TO authenticated
USING (public.is_staff())
WITH CHECK (public.is_staff());

-- ----------------------------------------------------------------------------
-- 13. App Settings Policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "app_settings_select" ON public.app_settings;
CREATE POLICY "app_settings_select"
ON public.app_settings FOR SELECT
TO authenticated
USING (public.is_staff());

DROP POLICY IF EXISTS "app_settings_update" ON public.app_settings;
CREATE POLICY "app_settings_update"
ON public.app_settings FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ============================================================================
-- 14. THE THREE INSERT-ONLY COMPLIANCE TABLES
-- Note: Intentionally OMITTING UPDATE and DELETE policies.
-- In PostgreSQL RLS, when a policy is omitted, the action is strictly DENIED
-- for all roles, including administrators.
-- ============================================================================

-- (A) Financial Ledger Entries: INSERT and SELECT only
DROP POLICY IF EXISTS "financial_ledger_select" ON public.financial_ledger_entries;
CREATE POLICY "financial_ledger_select"
ON public.financial_ledger_entries FOR SELECT
TO authenticated
USING (public.is_admin() OR public.current_staff_role() = 'viewer');

DROP POLICY IF EXISTS "financial_ledger_insert" ON public.financial_ledger_entries;
CREATE POLICY "financial_ledger_insert"
ON public.financial_ledger_entries FOR INSERT
TO authenticated
WITH CHECK (public.is_admin() OR public.is_ops_or_admin() OR public.is_sales_or_admin());

-- (B) HACCP Audit Records: INSERT and SELECT only
DROP POLICY IF EXISTS "haccp_audit_select" ON public.haccp_audit_records;
CREATE POLICY "haccp_audit_select"
ON public.haccp_audit_records FOR SELECT
TO authenticated
USING (public.is_staff());

DROP POLICY IF EXISTS "haccp_audit_insert" ON public.haccp_audit_records;
CREATE POLICY "haccp_audit_insert"
ON public.haccp_audit_records FOR INSERT
TO authenticated
WITH CHECK (public.is_ops_or_admin());

-- (C) Reefer Sensor Readings: INSERT and SELECT only
DROP POLICY IF EXISTS "reefer_sensor_select" ON public.reefer_sensor_readings;
CREATE POLICY "reefer_sensor_select"
ON public.reefer_sensor_readings FOR SELECT
TO authenticated
USING (public.is_staff());

DROP POLICY IF EXISTS "reefer_sensor_insert" ON public.reefer_sensor_readings;
CREATE POLICY "reefer_sensor_insert"
ON public.reefer_sensor_readings FOR INSERT
TO authenticated
WITH CHECK (public.is_dispatch_or_admin() OR public.is_ops_or_admin());



-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- START OF 006_grants.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ============================================================================
-- FROSTLY SEAFOOD COLD-CHAIN ERP
-- Migration 006: Permissions, Grants, and Reporting Views
-- ============================================================================

-- 1. Revoke all privileges from anon (Frostly is strictly an internal staff ERP)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon;

-- 2. Grant explicit minimum permissions to authenticated
GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE ON public.staff_profiles TO authenticated;
GRANT SELECT ON public.staff_role_audit_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.species TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.customers TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.suppliers TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.inventory_batches TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.purchase_order_landings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.purchase_order_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.reefer_vehicles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_line_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.fleet_vessels TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_price_index TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.retail_wholesale_products TO authenticated;
GRANT SELECT, INSERT ON public.retail_transactions TO authenticated;
GRANT SELECT, INSERT ON public.retail_sale_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.system_notifications TO authenticated;
GRANT SELECT, UPDATE ON public.app_settings TO authenticated;

-- For the 3 insert-only tables, grant SELECT and INSERT only
GRANT SELECT, INSERT ON public.financial_ledger_entries TO authenticated;
GRANT SELECT, INSERT ON public.haccp_audit_records TO authenticated;
GRANT SELECT, INSERT ON public.reefer_sensor_readings TO authenticated;

-- 3. Execute privileges on functions
GRANT EXECUTE ON FUNCTION public.current_staff_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_ops_or_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_sales_or_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_dispatch_or_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_fulfill_order_line_item(UUID, NUMERIC) TO authenticated;

-- 4. Cross-Table Aggregated Reporting Views
-- (A) Customer Outstanding Receivables Summary (security_invoker = true to respect querying user RLS)
CREATE OR REPLACE VIEW public.view_customer_receivables_summary
WITH (security_invoker = true) AS
SELECT 
    c.id AS customer_id,
    c.name AS customer_name,
    c.company_name,
    c.tier,
    c.credit_limit_usd,
    c.outstanding_balance_usd,
    c.payment_terms,
    c.status AS account_status,
    COUNT(o.id) FILTER (WHERE o.payment_status IN ('Pending Net-30', 'Invoiced', 'Overdue')) AS open_invoices_count,
    COALESCE(SUM(o.adjusted_total_usd) FILTER (WHERE o.payment_status IN ('Pending Net-30', 'Invoiced', 'Overdue')), 0) AS total_unpaid_invoiced_usd
FROM public.customers c
LEFT JOIN public.client_orders o ON c.id = o.customer_id
WHERE c.is_active = TRUE
GROUP BY c.id, c.name, c.company_name, c.tier, c.credit_limit_usd, c.outstanding_balance_usd, c.payment_terms, c.status;

-- (B) Daily Financial Operations & Revenue Ledger Aggregation (security_invoker = true to respect querying user RLS)
CREATE OR REPLACE VIEW public.view_daily_financial_summary
WITH (security_invoker = true) AS
SELECT 
    entry_date,
    SUM(CASE WHEN type = 'Income' THEN amount ELSE 0 END) AS total_revenue_usd,
    SUM(CASE WHEN type = 'COGS' THEN amount ELSE 0 END) AS total_cogs_usd,
    SUM(CASE WHEN type = 'OpEx' THEN amount ELSE 0 END) AS total_opex_usd,
    SUM(CASE WHEN type = 'Income' THEN amount ELSE -amount END) AS net_profit_usd
FROM public.financial_ledger_entries
GROUP BY entry_date
ORDER BY entry_date DESC;

GRANT SELECT ON public.view_customer_receivables_summary TO authenticated;
GRANT SELECT ON public.view_daily_financial_summary TO authenticated;



-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- START OF 007_storage_policies.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ============================================================================
-- FROSTLY SEAFOOD COLD-CHAIN ERP
-- Migration 007: Supabase Storage Buckets & Policies
-- ============================================================================

-- 1. Create Storage Buckets
-- Bucket A: Species and Lot Reference Photos (Public Read, Ops/Admin Upload)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'product-species-media',
    'product-species-media',
    true,
    10485760, -- 10MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];

-- Bucket B: HACCP Official Regulatory Documents (Private, Ops/Admin Only)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'haccp-documents',
    'haccp-documents',
    false,
    26214400, -- 25MB limit
    ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 26214400,
    allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png'];

-- 2. Storage Object RLS Policies

-- Media Bucket: Public Read
DROP POLICY IF EXISTS "media_public_read" ON storage.objects;
CREATE POLICY "media_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-species-media');

-- Media Bucket: Ops & Admin Upload
DROP POLICY IF EXISTS "media_ops_admin_insert" ON storage.objects;
CREATE POLICY "media_ops_admin_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'product-species-media' AND
    (public.is_admin() OR public.is_ops_or_admin())
);

-- HACCP Bucket: Private Read (Ops and Admin only)
DROP POLICY IF EXISTS "haccp_docs_select" ON storage.objects;
CREATE POLICY "haccp_docs_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'haccp-documents' AND
    (public.is_admin() OR public.is_ops_or_admin())
);

-- HACCP Bucket: Private Insert (Ops and Admin only)
DROP POLICY IF EXISTS "haccp_docs_insert" ON storage.objects;
CREATE POLICY "haccp_docs_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'haccp-documents' AND
    (public.is_admin() OR public.is_ops_or_admin())
);



-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- START OF 008_realtime.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ============================================================================
-- FROSTLY SEAFOOD COLD-CHAIN ERP
-- Migration 008: Supabase Realtime Replication Setup
-- ============================================================================

-- Enable Realtime publication strictly on the operational tables requiring
-- live telemetry and instantaneous UI dispatch updates.
-- Excludes immutable compliance tables (financial_ledger_entries, haccp_audit_records).

-- 1. Check or create supabase_realtime publication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

-- 2. Add Live Telemetry & Dispatch Tables to Realtime Idempotently
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'reefer_sensor_readings'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.reefer_sensor_readings;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'system_notifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.system_notifications;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'client_orders'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.client_orders;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'reefer_vehicles'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.reefer_vehicles;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'fleet_vessels'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.fleet_vessels;
    END IF;
END $$;



-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- START OF 009_seed_data.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

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



-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- START OF 011_multi_tenant.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ============================================================================
-- FROSTLY SEAFOOD COLD-CHAIN ERP
-- Migration 011: Multi-Tenant Architecture & Complete Tenant Isolation
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Organizations & Invites Tables
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'enterprise',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default enterprise organization for existing records & backfill
INSERT INTO public.organizations (id, name, plan)
VALUES ('00000000-0000-0000-0000-000000000001', 'Frostly Cold-Chain Operations (Default)', 'enterprise')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role public.staff_role NOT NULL DEFAULT 'viewer',
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Remove obsolete generic auth signup trigger so unassigned viewer profiles are never auto-created without an org
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- ----------------------------------------------------------------------------
-- 2. Add organization_id and Backfill on staff_profiles & All 20 Business Tables
-- ----------------------------------------------------------------------------

DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN SELECT unnest(ARRAY[
        'staff_profiles',
        'staff_role_audit_logs',
        'species',
        'customers',
        'suppliers',
        'inventory_batches',
        'purchase_order_landings',
        'purchase_order_items',
        'reefer_vehicles',
        'client_orders',
        'order_line_items',
        'fleet_vessels',
        'market_price_index',
        'retail_wholesale_products',
        'retail_transactions',
        'retail_sale_items',
        'system_notifications',
        'app_settings',
        'financial_ledger_entries',
        'haccp_audit_records',
        'reefer_sensor_readings'
    ]) LOOP
        -- 1. Add organization_id column if not present
        EXECUTE 'ALTER TABLE public.' || quote_ident(t) || ' ADD COLUMN IF NOT EXISTS organization_id UUID;';
        
        -- 2. Backfill existing rows with default organization ID
        EXECUTE 'UPDATE public.' || quote_ident(t) || ' SET organization_id = ''00000000-0000-0000-0000-000000000001'' WHERE organization_id IS NULL;';
        
        -- 3. Enforce NOT NULL
        EXECUTE 'ALTER TABLE public.' || quote_ident(t) || ' ALTER COLUMN organization_id SET NOT NULL;';

        -- 4. Add foreign key to organizations table
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE table_schema = 'public' AND table_name = t AND constraint_name = 'fk_' || t || '_organization'
        ) THEN
            EXECUTE 'ALTER TABLE public.' || quote_ident(t) || 
                    ' ADD CONSTRAINT fk_' || quote_ident(t) || '_organization FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;';
        END IF;
    END LOOP;
END $$;

-- Enforce composite uniqueness on staff_profiles so composite FKs can reference (organization_id, id)
DO $$ BEGIN
    ALTER TABLE public.staff_profiles 
    ADD CONSTRAINT uq_staff_profiles_org_id UNIQUE (organization_id, id);
EXCEPTION
    WHEN duplicate_table OR duplicate_object THEN null;
END $$;

-- ----------------------------------------------------------------------------
-- 3. Convert Primary Keys & Foreign Keys to Composite (organization_id, id)
-- ----------------------------------------------------------------------------

-- Step 3A: Dynamically drop existing foreign key constraints on the 20 business tables
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tc.table_schema, tc.table_name, tc.constraint_name
        FROM information_schema.table_constraints tc
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
          AND tc.constraint_name NOT LIKE 'fk_%_organization'
          AND tc.table_name IN (
            'staff_role_audit_logs', 'species', 'customers', 'suppliers',
            'inventory_batches', 'purchase_order_landings', 'purchase_order_items',
            'reefer_vehicles', 'client_orders', 'order_line_items', 'fleet_vessels',
            'market_price_index', 'retail_wholesale_products', 'retail_transactions',
            'retail_sale_items', 'system_notifications', 'app_settings',
            'financial_ledger_entries', 'haccp_audit_records', 'reefer_sensor_readings'
          )
    ) LOOP
        EXECUTE 'ALTER TABLE ' || quote_ident(r.table_schema) || '.' || quote_ident(r.table_name) || 
                ' DROP CONSTRAINT ' || quote_ident(r.constraint_name);
    END LOOP;
END $$;

-- Step 3B: Drop single-column PK and recreate as composite PRIMARY KEY (organization_id, id) on each business table
DO $$
DECLARE
    t TEXT;
    pk_name TEXT;
BEGIN
    FOR t IN SELECT unnest(ARRAY[
        'staff_role_audit_logs', 'species', 'customers', 'suppliers',
        'inventory_batches', 'purchase_order_landings', 'purchase_order_items',
        'reefer_vehicles', 'client_orders', 'order_line_items', 'fleet_vessels',
        'market_price_index', 'retail_wholesale_products', 'retail_transactions',
        'retail_sale_items', 'system_notifications', 'app_settings',
        'financial_ledger_entries', 'haccp_audit_records', 'reefer_sensor_readings'
    ]) LOOP
        SELECT constraint_name INTO pk_name
        FROM information_schema.table_constraints
        WHERE table_schema = 'public' AND table_name = t AND constraint_type = 'PRIMARY KEY';

        IF pk_name IS NOT NULL THEN
            EXECUTE 'ALTER TABLE public.' || quote_ident(t) || ' DROP CONSTRAINT ' || quote_ident(pk_name);
        END IF;

        EXECUTE 'ALTER TABLE public.' || quote_ident(t) || ' ADD CONSTRAINT ' || quote_ident(t || '_pkey') || ' PRIMARY KEY (organization_id, id);';
    END LOOP;
END $$;

-- Step 3C: Re-add all inter-table foreign keys in composite (organization_id, target_id) form
ALTER TABLE public.staff_role_audit_logs
    ADD CONSTRAINT fk_staff_role_audit_target FOREIGN KEY (organization_id, target_staff_id) REFERENCES public.staff_profiles(organization_id, id) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_staff_role_audit_changer FOREIGN KEY (organization_id, changed_by) REFERENCES public.staff_profiles(organization_id, id) ON DELETE RESTRICT;

ALTER TABLE public.inventory_batches
    ADD CONSTRAINT fk_inventory_batches_species FOREIGN KEY (organization_id, species_id) REFERENCES public.species(organization_id, id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE public.purchase_order_landings
    ADD CONSTRAINT fk_po_landings_supplier FOREIGN KEY (organization_id, supplier_id) REFERENCES public.suppliers(organization_id, id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE public.purchase_order_items
    ADD CONSTRAINT fk_po_items_po FOREIGN KEY (organization_id, po_id) REFERENCES public.purchase_order_landings(organization_id, id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_po_items_species FOREIGN KEY (organization_id, species_id) REFERENCES public.species(organization_id, id) ON DELETE RESTRICT;

ALTER TABLE public.client_orders
    ADD CONSTRAINT fk_client_orders_customer FOREIGN KEY (organization_id, customer_id) REFERENCES public.customers(organization_id, id) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT fk_client_orders_reefer FOREIGN KEY (organization_id, assigned_reefer_id) REFERENCES public.reefer_vehicles(organization_id, id) ON DELETE SET NULL;

ALTER TABLE public.order_line_items
    ADD CONSTRAINT fk_order_items_order FOREIGN KEY (organization_id, order_id) REFERENCES public.client_orders(organization_id, id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_order_items_species FOREIGN KEY (organization_id, species_id) REFERENCES public.species(organization_id, id) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_order_items_lot FOREIGN KEY (organization_id, lot_id) REFERENCES public.inventory_batches(organization_id, id) ON DELETE RESTRICT;

ALTER TABLE public.retail_wholesale_products
    ADD CONSTRAINT fk_retail_products_species FOREIGN KEY (organization_id, species_id) REFERENCES public.species(organization_id, id) ON DELETE RESTRICT;

ALTER TABLE public.retail_transactions
    ADD CONSTRAINT fk_retail_tx_cashier FOREIGN KEY (organization_id, cashier_id) REFERENCES public.staff_profiles(organization_id, id) ON DELETE RESTRICT;

ALTER TABLE public.retail_sale_items
    ADD CONSTRAINT fk_retail_sale_items_tx FOREIGN KEY (organization_id, transaction_id) REFERENCES public.retail_transactions(organization_id, id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_retail_sale_items_product FOREIGN KEY (organization_id, product_id) REFERENCES public.retail_wholesale_products(organization_id, id) ON DELETE RESTRICT;

ALTER TABLE public.financial_ledger_entries
    ADD CONSTRAINT fk_fin_ledger_creator FOREIGN KEY (organization_id, created_by) REFERENCES public.staff_profiles(organization_id, id) ON DELETE RESTRICT;

ALTER TABLE public.haccp_audit_records
    ADD CONSTRAINT fk_haccp_audit_lot FOREIGN KEY (organization_id, lot_id) REFERENCES public.inventory_batches(organization_id, id) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_haccp_audit_creator FOREIGN KEY (organization_id, created_by) REFERENCES public.staff_profiles(organization_id, id) ON DELETE RESTRICT;

ALTER TABLE public.reefer_sensor_readings
    ADD CONSTRAINT fk_sensor_readings_vehicle FOREIGN KEY (organization_id, vehicle_id) REFERENCES public.reefer_vehicles(organization_id, id) ON DELETE CASCADE;

-- ----------------------------------------------------------------------------
-- 4. Multi-Tenant Indexes
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_organizations_name ON public.organizations(name);
CREATE INDEX IF NOT EXISTS idx_invites_org_token ON public.invites(organization_id, token);
CREATE INDEX IF NOT EXISTS idx_invites_token ON public.invites(token);

CREATE INDEX IF NOT EXISTS idx_staff_profiles_org ON public.staff_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_species_org ON public.species(organization_id);
CREATE INDEX IF NOT EXISTS idx_customers_org ON public.customers(organization_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_org ON public.suppliers(organization_id);
CREATE INDEX IF NOT EXISTS idx_inventory_batches_org ON public.inventory_batches(organization_id);
CREATE INDEX IF NOT EXISTS idx_client_orders_org ON public.client_orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_order_line_items_org ON public.order_line_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_landings_org ON public.purchase_order_landings(organization_id);
CREATE INDEX IF NOT EXISTS idx_retail_products_org ON public.retail_wholesale_products(organization_id);
CREATE INDEX IF NOT EXISTS idx_retail_transactions_org ON public.retail_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_financial_ledger_entries_org ON public.financial_ledger_entries(organization_id);
CREATE INDEX IF NOT EXISTS idx_haccp_audit_records_org ON public.haccp_audit_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_reefer_sensor_readings_org ON public.reefer_sensor_readings(organization_id);

-- ----------------------------------------------------------------------------
-- 5. Phase 2: Server-Side Tenant Enforcement
-- ----------------------------------------------------------------------------

-- A. Current User Organization ID Resolver
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT organization_id FROM public.staff_profiles
    WHERE id = auth.uid() AND is_active = TRUE
    LIMIT 1;
$$;

-- B. Automatic Server-Side Tenant Stamping Trigger
CREATE OR REPLACE FUNCTION public.stamp_organization_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_org_id UUID;
BEGIN
    v_org_id := public.current_org_id();
    IF v_org_id IS NOT NULL THEN
        -- Force the server-derived organization_id, preventing client tenant spoofing
        NEW.organization_id := v_org_id;
    ELSIF NEW.organization_id IS NULL THEN
        RAISE EXCEPTION 'Multi-Tenant Security: Cannot insert into % without an active organization session.', TG_TABLE_NAME;
    END IF;
    RETURN NEW;
END;
$$;

-- C. Attach BEFORE INSERT Trigger on all 20 business tables and invites
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN SELECT unnest(ARRAY[
        'staff_role_audit_logs',
        'species',
        'customers',
        'suppliers',
        'inventory_batches',
        'purchase_order_landings',
        'purchase_order_items',
        'reefer_vehicles',
        'client_orders',
        'order_line_items',
        'fleet_vessels',
        'market_price_index',
        'retail_wholesale_products',
        'retail_transactions',
        'retail_sale_items',
        'system_notifications',
        'app_settings',
        'financial_ledger_entries',
        'haccp_audit_records',
        'reefer_sensor_readings',
        'invites'
    ]) LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS trg_stamp_org_' || t || ' ON public.' || quote_ident(t) || ';';
        EXECUTE 'CREATE TRIGGER trg_stamp_org_' || t || ' BEFORE INSERT ON public.' || quote_ident(t) || 
                ' FOR EACH ROW EXECUTE FUNCTION public.stamp_organization_id();';
    END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 6. Rewrite Row-Level Security (RLS) with Complete Cross-Tenant Isolation
-- ----------------------------------------------------------------------------

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- 6.1 Organizations Policies
DROP POLICY IF EXISTS "organizations_select" ON public.organizations;
CREATE POLICY "organizations_select" ON public.organizations
FOR SELECT TO authenticated
USING (id = public.current_org_id());

DROP POLICY IF EXISTS "organizations_update" ON public.organizations;
CREATE POLICY "organizations_update" ON public.organizations
FOR UPDATE TO authenticated
USING (id = public.current_org_id() AND public.is_admin())
WITH CHECK (id = public.current_org_id() AND public.is_admin());

-- 6.2 Invites Policies
DROP POLICY IF EXISTS "invites_select" ON public.invites;
CREATE POLICY "invites_select" ON public.invites
FOR SELECT TO authenticated
USING (organization_id = public.current_org_id() AND public.is_admin());

DROP POLICY IF EXISTS "invites_insert" ON public.invites;
CREATE POLICY "invites_insert" ON public.invites
FOR INSERT TO authenticated
WITH CHECK (organization_id = public.current_org_id() AND public.is_admin());

DROP POLICY IF EXISTS "invites_update" ON public.invites;
CREATE POLICY "invites_update" ON public.invites
FOR UPDATE TO authenticated
USING (organization_id = public.current_org_id() AND public.is_admin())
WITH CHECK (organization_id = public.current_org_id() AND public.is_admin());

DROP POLICY IF EXISTS "invites_delete" ON public.invites;
CREATE POLICY "invites_delete" ON public.invites
FOR DELETE TO authenticated
USING (organization_id = public.current_org_id() AND public.is_admin());

-- 6.3 Staff Profiles Policies
-- CRITICAL REQUIREMENT: Remove ANY generic INSERT policy for authenticated on staff_profiles.
-- staff_profiles can ONLY be written by the SECURITY DEFINER bootstrap functions!
DROP POLICY IF EXISTS "staff_profiles_insert" ON public.staff_profiles;

DROP POLICY IF EXISTS "staff_profiles_select" ON public.staff_profiles;
CREATE POLICY "staff_profiles_select" ON public.staff_profiles
FOR SELECT TO authenticated
USING (public.is_staff() AND (organization_id = public.current_org_id() OR id = auth.uid()));

DROP POLICY IF EXISTS "staff_profiles_update" ON public.staff_profiles;
CREATE POLICY "staff_profiles_update" ON public.staff_profiles
FOR UPDATE TO authenticated
USING (public.is_admin() AND organization_id = public.current_org_id())
WITH CHECK (public.is_admin() AND organization_id = public.current_org_id());

-- 6.4 Staff Role Audit Logs Policies
DROP POLICY IF EXISTS "staff_role_audit_select" ON public.staff_role_audit_logs;
CREATE POLICY "staff_role_audit_select" ON public.staff_role_audit_logs
FOR SELECT TO authenticated
USING (public.is_admin() AND organization_id = public.current_org_id());

-- 6.5 Species Catalog Policies
DROP POLICY IF EXISTS "species_select" ON public.species;
CREATE POLICY "species_select" ON public.species
FOR SELECT TO authenticated
USING (public.is_staff() AND organization_id = public.current_org_id());

DROP POLICY IF EXISTS "species_insert" ON public.species;
CREATE POLICY "species_insert" ON public.species
FOR INSERT TO authenticated
WITH CHECK ((public.is_admin() OR public.is_ops_or_admin()) AND organization_id = public.current_org_id());

DROP POLICY IF EXISTS "species_update" ON public.species;
CREATE POLICY "species_update" ON public.species
FOR UPDATE TO authenticated
USING (public.is_admin() AND organization_id = public.current_org_id())
WITH CHECK (public.is_admin() AND organization_id = public.current_org_id());

-- 6.6 Customers Policies
DROP POLICY IF EXISTS "customers_select" ON public.customers;
CREATE POLICY "customers_select" ON public.customers
FOR SELECT TO authenticated
USING (public.is_staff() AND organization_id = public.current_org_id());

DROP POLICY IF EXISTS "customers_insert" ON public.customers;
CREATE POLICY "customers_insert" ON public.customers
FOR INSERT TO authenticated
WITH CHECK (public.is_sales_or_admin() AND organization_id = public.current_org_id());

DROP POLICY IF EXISTS "customers_update" ON public.customers;
CREATE POLICY "customers_update" ON public.customers
FOR UPDATE TO authenticated
USING (public.is_sales_or_admin() AND organization_id = public.current_org_id())
WITH CHECK (public.is_sales_or_admin() AND organization_id = public.current_org_id());

-- 6.7 Suppliers Policies
DROP POLICY IF EXISTS "suppliers_select" ON public.suppliers;
CREATE POLICY "suppliers_select" ON public.suppliers
FOR SELECT TO authenticated
USING (public.is_staff() AND organization_id = public.current_org_id());

DROP POLICY IF EXISTS "suppliers_insert" ON public.suppliers;
CREATE POLICY "suppliers_insert" ON public.suppliers
FOR INSERT TO authenticated
WITH CHECK ((public.is_ops_or_admin() OR public.is_sales_or_admin()) AND organization_id = public.current_org_id());

DROP POLICY IF EXISTS "suppliers_update" ON public.suppliers;
CREATE POLICY "suppliers_update" ON public.suppliers
FOR UPDATE TO authenticated
USING ((public.is_ops_or_admin() OR public.is_sales_or_admin()) AND organization_id = public.current_org_id())
WITH CHECK ((public.is_ops_or_admin() OR public.is_sales_or_admin()) AND organization_id = public.current_org_id());

-- 6.8 Inventory Batches Policies
DROP POLICY IF EXISTS "inventory_batches_select" ON public.inventory_batches;
CREATE POLICY "inventory_batches_select" ON public.inventory_batches
FOR SELECT TO authenticated
USING (public.is_staff() AND organization_id = public.current_org_id());

DROP POLICY IF EXISTS "inventory_batches_insert" ON public.inventory_batches;
CREATE POLICY "inventory_batches_insert" ON public.inventory_batches
FOR INSERT TO authenticated
WITH CHECK (public.is_ops_or_admin() AND organization_id = public.current_org_id());

DROP POLICY IF EXISTS "inventory_batches_update" ON public.inventory_batches;
CREATE POLICY "inventory_batches_update" ON public.inventory_batches
FOR UPDATE TO authenticated
USING (public.is_ops_or_admin() AND organization_id = public.current_org_id())
WITH CHECK (public.is_ops_or_admin() AND organization_id = public.current_org_id());

-- 6.9 Purchase Order Landings Policies
DROP POLICY IF EXISTS "po_landings_select" ON public.purchase_order_landings;
CREATE POLICY "po_landings_select" ON public.purchase_order_landings
FOR SELECT TO authenticated
USING (public.is_staff() AND organization_id = public.current_org_id());

DROP POLICY IF EXISTS "po_landings_insert" ON public.purchase_order_landings;
CREATE POLICY "po_landings_insert" ON public.purchase_order_landings
FOR INSERT TO authenticated
WITH CHECK (public.is_ops_or_admin() AND organization_id = public.current_org_id());

DROP POLICY IF EXISTS "po_landings_update" ON public.purchase_order_landings;
CREATE POLICY "po_landings_update" ON public.purchase_order_landings
FOR UPDATE TO authenticated
USING (public.is_ops_or_admin() AND organization_id = public.current_org_id())
WITH CHECK (public.is_ops_or_admin() AND organization_id = public.current_org_id());

-- 6.10 Purchase Order Items Policies
DROP POLICY IF EXISTS "po_items_select" ON public.purchase_order_items;
CREATE POLICY "po_items_select" ON public.purchase_order_items
FOR SELECT TO authenticated
USING (public.is_staff() AND organization_id = public.current_org_id());

DROP POLICY IF EXISTS "po_items_insert" ON public.purchase_order_items;
CREATE POLICY "po_items_insert" ON public.purchase_order_items
FOR INSERT TO authenticated
WITH CHECK (public.is_ops_or_admin() AND organization_id = public.current_org_id());

DROP POLICY IF EXISTS "po_items_update" ON public.purchase_order_items;
CREATE POLICY "po_items_update" ON public.purchase_order_items
FOR UPDATE TO authenticated
USING (public.is_ops_or_admin() AND organization_id = public.current_org_id())
WITH CHECK (public.is_ops_or_admin() AND organization_id = public.current_org_id());

-- 6.11 Reefer Vehicles Policies
DROP POLICY IF EXISTS "reefer_vehicles_select" ON public.reefer_vehicles;
CREATE POLICY "reefer_vehicles_select" ON public.reefer_vehicles
FOR SELECT TO authenticated
USING (public.is_staff() AND organization_id = public.current_org_id());

DROP POLICY IF EXISTS "reefer_vehicles_insert" ON public.reefer_vehicles;
CREATE POLICY "reefer_vehicles_insert" ON public.reefer_vehicles
FOR INSERT TO authenticated
WITH CHECK ((public.is_ops_or_admin() OR public.is_dispatch_or_admin()) AND organization_id = public.current_org_id());

DROP POLICY IF EXISTS "reefer_vehicles_update" ON public.reefer_vehicles;
CREATE POLICY "reefer_vehicles_update" ON public.reefer_vehicles
FOR UPDATE TO authenticated
USING ((public.is_ops_or_admin() OR public.is_dispatch_or_admin()) AND organization_id = public.current_org_id())
WITH CHECK ((public.is_ops_or_admin() OR public.is_dispatch_or_admin()) AND organization_id = public.current_org_id());

-- 6.12 Client Orders Policies
DROP POLICY IF EXISTS "client_orders_select" ON public.client_orders;
CREATE POLICY "client_orders_select" ON public.client_orders
FOR SELECT TO authenticated
USING (public.is_staff() AND organization_id = public.current_org_id());

DROP POLICY IF EXISTS "client_orders_insert" ON public.client_orders;
CREATE POLICY "client_orders_insert" ON public.client_orders
FOR INSERT TO authenticated
WITH CHECK (public.is_sales_or_admin() AND organization_id = public.current_org_id());

DROP POLICY IF EXISTS "client_orders_update" ON public.client_orders;
CREATE POLICY "client_orders_update" ON public.client_orders
FOR UPDATE TO authenticated
USING ((public.is_sales_or_admin() OR public.is_dispatch_or_admin()) AND organization_id = public.current_org_id())
WITH CHECK ((public.is_sales_or_admin() OR public.is_dispatch_or_admin()) AND organization_id = public.current_org_id());

DROP POLICY IF EXISTS "client_orders_delete" ON public.client_orders;
CREATE POLICY "client_orders_delete" ON public.client_orders
FOR DELETE TO authenticated
USING (public.is_admin() AND organization_id = public.current_org_id());

-- 6.13 Order Line Items Policies
DROP POLICY IF EXISTS "order_line_items_select" ON public.order_line_items;
CREATE POLICY "order_line_items_select" ON public.order_line_items
FOR SELECT TO authenticated
USING (public.is_staff() AND organization_id = public.current_org_id());

DROP POLICY IF EXISTS "order_line_items_insert" ON public.order_line_items;
CREATE POLICY "order_line_items_insert" ON public.order_line_items
FOR INSERT TO authenticated
WITH CHECK (public.is_sales_or_admin() AND organization_id = public.current_org_id());

DROP POLICY IF EXISTS "order_line_items_update" ON public.order_line_items;
CREATE POLICY "order_line_items_update" ON public.order_line_items
FOR UPDATE TO authenticated
USING ((public.is_sales_or_admin() OR public.is_dispatch_or_admin()) AND organization_id = public.current_org_id())
WITH CHECK ((public.is_sales_or_admin() OR public.is_dispatch_or_admin()) AND organization_id = public.current_org_id());

DROP POLICY IF EXISTS "order_line_items_delete" ON public.order_line_items;
CREATE POLICY "order_line_items_delete" ON public.order_line_items
FOR DELETE TO authenticated
USING (public.is_sales_or_admin() AND organization_id = public.current_org_id());

-- 6.14 Fleet Vessels Policies
DROP POLICY IF EXISTS "fleet_vessels_select" ON public.fleet_vessels;
CREATE POLICY "fleet_vessels_select" ON public.fleet_vessels
FOR SELECT TO authenticated
USING (public.is_staff() AND organization_id = public.current_org_id());

DROP POLICY IF EXISTS "fleet_vessels_insert" ON public.fleet_vessels;
CREATE POLICY "fleet_vessels_insert" ON public.fleet_vessels
FOR INSERT TO authenticated
WITH CHECK (public.is_ops_or_admin() AND organization_id = public.current_org_id());

DROP POLICY IF EXISTS "fleet_vessels_update" ON public.fleet_vessels;
CREATE POLICY "fleet_vessels_update" ON public.fleet_vessels
FOR UPDATE TO authenticated
USING (public.is_ops_or_admin() AND organization_id = public.current_org_id())
WITH CHECK (public.is_ops_or_admin() AND organization_id = public.current_org_id());

-- 6.15 Market Price Index Policies
DROP POLICY IF EXISTS "market_price_select" ON public.market_price_index;
CREATE POLICY "market_price_select" ON public.market_price_index
FOR SELECT TO authenticated
USING (public.is_staff() AND organization_id = public.current_org_id());

DROP POLICY IF EXISTS "market_price_insert" ON public.market_price_index;
CREATE POLICY "market_price_insert" ON public.market_price_index
FOR INSERT TO authenticated
WITH CHECK (public.is_sales_or_admin() AND organization_id = public.current_org_id());

DROP POLICY IF EXISTS "market_price_update" ON public.market_price_index;
CREATE POLICY "market_price_update" ON public.market_price_index
FOR UPDATE TO authenticated
USING (public.is_sales_or_admin() AND organization_id = public.current_org_id())
WITH CHECK (public.is_sales_or_admin() AND organization_id = public.current_org_id());

DROP POLICY IF EXISTS "market_price_delete" ON public.market_price_index;
CREATE POLICY "market_price_delete" ON public.market_price_index
FOR DELETE TO authenticated
USING (public.is_sales_or_admin() AND organization_id = public.current_org_id());

-- 6.16 Retail Wholesale Products Policies
DROP POLICY IF EXISTS "retail_products_select" ON public.retail_wholesale_products;
CREATE POLICY "retail_products_select" ON public.retail_wholesale_products
FOR SELECT TO authenticated
USING (public.is_staff() AND organization_id = public.current_org_id());

DROP POLICY IF EXISTS "retail_products_insert" ON public.retail_wholesale_products;
CREATE POLICY "retail_products_insert" ON public.retail_wholesale_products
FOR INSERT TO authenticated
WITH CHECK ((public.is_ops_or_admin() OR public.is_sales_or_admin()) AND organization_id = public.current_org_id());

DROP POLICY IF EXISTS "retail_products_update" ON public.retail_wholesale_products;
CREATE POLICY "retail_products_update" ON public.retail_wholesale_products
FOR UPDATE TO authenticated
USING ((public.is_ops_or_admin() OR public.is_sales_or_admin()) AND organization_id = public.current_org_id())
WITH CHECK ((public.is_ops_or_admin() OR public.is_sales_or_admin()) AND organization_id = public.current_org_id());

-- 6.17 Retail Transactions Policies
DROP POLICY IF EXISTS "retail_transactions_select" ON public.retail_transactions;
CREATE POLICY "retail_transactions_select" ON public.retail_transactions
FOR SELECT TO authenticated
USING (public.is_staff() AND organization_id = public.current_org_id());

DROP POLICY IF EXISTS "retail_transactions_insert" ON public.retail_transactions;
CREATE POLICY "retail_transactions_insert" ON public.retail_transactions
FOR INSERT TO authenticated
WITH CHECK (public.is_sales_or_admin() AND organization_id = public.current_org_id());

-- 6.18 Retail Sale Items Policies
DROP POLICY IF EXISTS "retail_sale_items_select" ON public.retail_sale_items;
CREATE POLICY "retail_sale_items_select" ON public.retail_sale_items
FOR SELECT TO authenticated
USING (public.is_staff() AND organization_id = public.current_org_id());

DROP POLICY IF EXISTS "retail_sale_items_insert" ON public.retail_sale_items;
CREATE POLICY "retail_sale_items_insert" ON public.retail_sale_items
FOR INSERT TO authenticated
WITH CHECK (public.is_sales_or_admin() AND organization_id = public.current_org_id());

-- 6.19 System Notifications Policies
DROP POLICY IF EXISTS "system_notifications_select" ON public.system_notifications;
CREATE POLICY "system_notifications_select" ON public.system_notifications
FOR SELECT TO authenticated
USING (public.is_staff() AND organization_id = public.current_org_id());

DROP POLICY IF EXISTS "system_notifications_insert" ON public.system_notifications;
CREATE POLICY "system_notifications_insert" ON public.system_notifications
FOR INSERT TO authenticated
WITH CHECK (public.is_staff() AND organization_id = public.current_org_id());

DROP POLICY IF EXISTS "system_notifications_update" ON public.system_notifications;
CREATE POLICY "system_notifications_update" ON public.system_notifications
FOR UPDATE TO authenticated
USING (public.is_staff() AND organization_id = public.current_org_id())
WITH CHECK (public.is_staff() AND organization_id = public.current_org_id());

-- 6.20 App Settings Policies
DROP POLICY IF EXISTS "app_settings_select" ON public.app_settings;
CREATE POLICY "app_settings_select" ON public.app_settings
FOR SELECT TO authenticated
USING (public.is_staff() AND organization_id = public.current_org_id());

DROP POLICY IF EXISTS "app_settings_update" ON public.app_settings;
CREATE POLICY "app_settings_update" ON public.app_settings
FOR UPDATE TO authenticated
USING (public.is_admin() AND organization_id = public.current_org_id())
WITH CHECK (public.is_admin() AND organization_id = public.current_org_id());

-- 6.21 Financial Ledger Entries (Strict Insert-Only)
DROP POLICY IF EXISTS "financial_ledger_select" ON public.financial_ledger_entries;
CREATE POLICY "financial_ledger_select" ON public.financial_ledger_entries
FOR SELECT TO authenticated
USING (public.is_staff() AND organization_id = public.current_org_id());

DROP POLICY IF EXISTS "financial_ledger_insert" ON public.financial_ledger_entries;
CREATE POLICY "financial_ledger_insert" ON public.financial_ledger_entries
FOR INSERT TO authenticated
WITH CHECK (public.is_staff() AND organization_id = public.current_org_id());

-- 6.22 HACCP Audit Records (Strict Insert-Only)
DROP POLICY IF EXISTS "haccp_audit_select" ON public.haccp_audit_records;
CREATE POLICY "haccp_audit_select" ON public.haccp_audit_records
FOR SELECT TO authenticated
USING (public.is_staff() AND organization_id = public.current_org_id());

DROP POLICY IF EXISTS "haccp_audit_insert" ON public.haccp_audit_records;
CREATE POLICY "haccp_audit_insert" ON public.haccp_audit_records
FOR INSERT TO authenticated
WITH CHECK (public.is_ops_or_admin() AND organization_id = public.current_org_id());

-- 6.23 Reefer Sensor Readings (Strict Insert-Only)
DROP POLICY IF EXISTS "reefer_telemetry_select" ON public.reefer_sensor_readings;
CREATE POLICY "reefer_telemetry_select" ON public.reefer_sensor_readings
FOR SELECT TO authenticated
USING (public.is_staff() AND organization_id = public.current_org_id());

DROP POLICY IF EXISTS "reefer_telemetry_insert" ON public.reefer_sensor_readings;
CREATE POLICY "reefer_telemetry_insert" ON public.reefer_sensor_readings
FOR INSERT TO authenticated
WITH CHECK ((public.is_ops_or_admin() OR public.is_dispatch_or_admin()) AND organization_id = public.current_org_id());

-- ----------------------------------------------------------------------------
-- 7. Phase 3: The Two Narrow Holes (Bootstrap Functions)
-- ----------------------------------------------------------------------------

-- 7.1 create_organization_and_admin
-- Callable once per fresh auth.users row: creates org + first staff_profile as 'admin'
CREATE OR REPLACE FUNCTION public.create_organization_and_admin(
    p_org_name TEXT,
    p_admin_full_name TEXT DEFAULT NULL,
    p_admin_department TEXT DEFAULT 'Executive'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID;
    v_email TEXT;
    v_org_id UUID;
    v_existing_profile RECORD;
    v_org_name_clean TEXT;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required: User must be logged in to create an organization.';
    END IF;

    v_org_name_clean := trim(p_org_name);
    IF v_org_name_clean IS NULL OR length(v_org_name_clean) < 2 THEN
        RAISE EXCEPTION 'Organization name must be at least 2 characters.';
    END IF;

    -- Verify this user does not already have a staff profile
    SELECT id, organization_id INTO v_existing_profile
    FROM public.staff_profiles
    WHERE id = v_uid;

    IF FOUND THEN
        RAISE EXCEPTION 'User % is already registered with an organization.', v_uid;
    END IF;

    -- Fetch user email from auth.users
    SELECT email INTO v_email
    FROM auth.users
    WHERE id = v_uid;

    IF v_email IS NULL THEN
        v_email := 'staff_' || substr(v_uid::TEXT, 1, 8) || '@frostly.internal';
    END IF;

    -- 1. Create Organization
    INSERT INTO public.organizations (name, plan)
    VALUES (v_org_name_clean, 'enterprise')
    RETURNING id INTO v_org_id;

    -- 2. Create Staff Profile as Admin
    INSERT INTO public.staff_profiles (
        id,
        organization_id,
        email,
        full_name,
        role,
        department,
        is_active
    ) VALUES (
        v_uid,
        v_org_id,
        v_email,
        COALESCE(NULLIF(trim(p_admin_full_name), ''), split_part(v_email, '@', 1)),
        'admin',
        COALESCE(NULLIF(trim(p_admin_department), ''), 'Executive'),
        TRUE
    );

    -- 3. Seed default organization app settings
    INSERT INTO public.app_settings (
        id,
        organization_id,
        company_name,
        facility_code,
        fda_registration_number,
        eu_approval_number,
        tax_rate,
        currency
    ) VALUES (
        1,
        v_org_id,
        v_org_name_clean,
        'FAC-' || upper(substr(md5(v_org_id::TEXT), 1, 6)),
        'FDA-REG-' || upper(substr(md5(v_org_id::TEXT), 7, 7)),
        'EU-APPR-' || upper(substr(md5(v_org_id::TEXT), 14, 6)),
        15.00,
        'GHS'
    ) ON CONFLICT (organization_id, id) DO NOTHING;

    RETURN jsonb_build_object(
        'success', TRUE,
        'organization_id', v_org_id,
        'organization_name', v_org_name_clean,
        'role', 'admin',
        'message', 'Organization and administrator profile initialized successfully.'
    );
END;
$$;

-- 7.2 accept_invite
-- Validates unexpired, unused invite; creates staff_profiles row with that invite's organization_id & role; marks token used
CREATE OR REPLACE FUNCTION public.accept_invite(
    p_token TEXT,
    p_full_name TEXT DEFAULT NULL,
    p_department TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID;
    v_email TEXT;
    v_invite RECORD;
    v_existing_profile RECORD;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required: User must be signed in to accept an invite.';
    END IF;

    IF p_token IS NULL OR trim(p_token) = '' THEN
        RAISE EXCEPTION 'Invite token is required.';
    END IF;

    -- Check if user is already enrolled in any organization
    SELECT id, organization_id INTO v_existing_profile
    FROM public.staff_profiles
    WHERE id = v_uid;

    IF FOUND THEN
        RAISE EXCEPTION 'User % is already registered with an organization.', v_uid;
    END IF;

    -- Lookup and lock the invite row
    SELECT * INTO v_invite
    FROM public.invites
    WHERE token = trim(p_token)
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid token: Invite was not found.';
    END IF;

    IF v_invite.used_at IS NOT NULL THEN
        RAISE EXCEPTION 'Replay error: This invite was already used on %.', v_invite.used_at;
    END IF;

    IF v_invite.expires_at < NOW() THEN
        RAISE EXCEPTION 'Expired error: This invite expired on %.', v_invite.expires_at;
    END IF;

    -- Fetch user email
    SELECT email INTO v_email
    FROM auth.users
    WHERE id = v_uid;

    IF v_email IS NULL THEN
        v_email := v_invite.email;
    END IF;

    -- Create Staff Profile with invited role & org
    INSERT INTO public.staff_profiles (
        id,
        organization_id,
        email,
        full_name,
        role,
        department,
        is_active
    ) VALUES (
        v_uid,
        v_invite.organization_id,
        v_email,
        COALESCE(NULLIF(trim(p_full_name), ''), split_part(v_email, '@', 1)),
        v_invite.role,
        COALESCE(NULLIF(trim(p_department), ''), 'Operations'),
        TRUE
    );

    -- Mark invite as consumed
    UPDATE public.invites
    SET used_at = NOW()
    WHERE id = v_invite.id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'organization_id', v_invite.organization_id,
        'role', v_invite.role,
        'message', 'Invite accepted successfully. Staff profile activated.'
    );
END;
$$;

-- 7.3 create_invite (Admin utility for generating invite tokens)
CREATE OR REPLACE FUNCTION public.create_invite(
    p_email TEXT,
    p_role public.staff_role DEFAULT 'viewer',
    p_validity_days INT DEFAULT 7
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_org_id UUID;
    v_token TEXT;
    v_invite_id UUID;
    v_expires_at TIMESTAMPTZ;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access Denied: Only organization administrators can issue staff invites.';
    END IF;

    v_org_id := public.current_org_id();
    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'Context Error: Administrator has no active organization.';
    END IF;

    IF p_email IS NULL OR trim(p_email) = '' OR p_email NOT LIKE '%@%.%' THEN
        RAISE EXCEPTION 'A valid email address is required.';
    END IF;

    v_token := encode(gen_random_bytes(24), 'hex');
    v_expires_at := NOW() + (GREATEST(1, LEAST(p_validity_days, 90)) || ' days')::INTERVAL;

    INSERT INTO public.invites (
        organization_id,
        email,
        role,
        token,
        expires_at
    ) VALUES (
        v_org_id,
        lower(trim(p_email)),
        COALESCE(p_role, 'viewer'),
        v_token,
        v_expires_at
    )
    RETURNING id INTO v_invite_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'invite_id', v_invite_id,
        'organization_id', v_org_id,
        'email', lower(trim(p_email)),
        'role', COALESCE(p_role, 'viewer'),
        'token', v_token,
        'expires_at', v_expires_at
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 8. Grants and Permissions
-- ----------------------------------------------------------------------------

GRANT SELECT, UPDATE ON public.organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invites TO authenticated;

GRANT EXECUTE ON FUNCTION public.current_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_organization_and_admin(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invite(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_invite(TEXT, public.staff_role, INT) TO authenticated;

-- Update reporting views to respect multi-tenant composite joins
DROP VIEW IF EXISTS public.view_customer_receivables_summary CASCADE;
DROP VIEW IF EXISTS public.view_daily_financial_summary CASCADE;

CREATE OR REPLACE VIEW public.view_customer_receivables_summary
WITH (security_invoker = true) AS
SELECT 
    c.organization_id,
    c.id AS customer_id,
    c.name AS customer_name,
    c.company_name,
    c.tier,
    c.credit_limit_usd,
    c.outstanding_balance_usd,
    c.payment_terms,
    c.status AS account_status,
    COUNT(o.id) FILTER (WHERE o.payment_status IN ('Pending Net-30', 'Invoiced', 'Overdue')) AS open_invoices_count,
    COALESCE(SUM(o.adjusted_total_usd) FILTER (WHERE o.payment_status IN ('Pending Net-30', 'Invoiced', 'Overdue')), 0) AS total_unpaid_invoiced_usd
FROM public.customers c
LEFT JOIN public.client_orders o 
       ON c.id = o.customer_id 
      AND c.organization_id = o.organization_id
WHERE c.is_active = TRUE
GROUP BY c.organization_id, c.id, c.name, c.company_name, c.tier, c.credit_limit_usd, c.outstanding_balance_usd, c.payment_terms, c.status;

CREATE OR REPLACE VIEW public.view_daily_financial_summary
WITH (security_invoker = true) AS
SELECT 
    organization_id,
    entry_date,
    SUM(CASE WHEN type = 'Income' THEN amount ELSE 0 END) AS total_revenue_usd,
    SUM(CASE WHEN type = 'COGS' THEN amount ELSE 0 END) AS total_cogs_usd,
    SUM(CASE WHEN type = 'OpEx' THEN amount ELSE 0 END) AS total_opex_usd,
    SUM(CASE WHEN type = 'Income' THEN amount ELSE -amount END) AS net_profit_usd
FROM public.financial_ledger_entries
GROUP BY organization_id, entry_date
ORDER BY entry_date DESC;

GRANT SELECT ON public.view_customer_receivables_summary TO authenticated;
GRANT SELECT ON public.view_daily_financial_summary TO authenticated;



-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- START OF 012_subscription_licensing.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ============================================================================
-- FROSTLY SEAFOOD COLD-CHAIN ERP
-- Migration 012: Subscription Licensing, Tiered Quotas & RLS Grace Period
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Split organizations.plan into plan_tier and subscription_status
-- ----------------------------------------------------------------------------

DO $$
BEGIN
    -- Add plan_tier if not present
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'plan_tier'
    ) THEN
        ALTER TABLE public.organizations 
        ADD COLUMN plan_tier TEXT NOT NULL DEFAULT 'starter'
        CHECK (plan_tier IN ('starter', 'standard', 'enterprise'));
    END IF;

    -- Add subscription_status if not present
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'subscription_status'
    ) THEN
        ALTER TABLE public.organizations 
        ADD COLUMN subscription_status TEXT NOT NULL DEFAULT 'trial'
        CHECK (subscription_status IN ('trial', 'active', 'past_due', 'canceled', 'suspended'));
    END IF;

    -- Add trial_ends_at if not present (Default 14-day B2B trial window)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'trial_ends_at'
    ) THEN
        ALTER TABLE public.organizations 
        ADD COLUMN trial_ends_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days');
    END IF;

    -- Add current_period_ends_at for billing cycles
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'current_period_ends_at'
    ) THEN
        ALTER TABLE public.organizations 
        ADD COLUMN current_period_ends_at TIMESTAMPTZ;
    END IF;

    -- Add stripe_customer_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'stripe_customer_id'
    ) THEN
        ALTER TABLE public.organizations 
        ADD COLUMN stripe_customer_id TEXT UNIQUE;
    END IF;

    -- Add stripe_subscription_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'stripe_subscription_id'
    ) THEN
        ALTER TABLE public.organizations 
        ADD COLUMN stripe_subscription_id TEXT UNIQUE;
    END IF;

    -- Add max_staff_seats for org-based tiered capacity ceiling
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'max_staff_seats'
    ) THEN
        ALTER TABLE public.organizations 
        ADD COLUMN max_staff_seats INT NOT NULL DEFAULT 5;
    END IF;

    -- Migrate legacy data if the decorative 'plan' column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'plan'
    ) THEN
        UPDATE public.organizations 
        SET plan_tier = CASE 
            WHEN plan = 'starter' THEN 'starter'
            WHEN plan = 'standard' THEN 'standard'
            ELSE 'enterprise'
        END,
        subscription_status = 'active',
        max_staff_seats = CASE 
            WHEN plan = 'starter' THEN 5
            WHEN plan = 'standard' THEN 20
            ELSE 9999
        END;

        ALTER TABLE public.organizations DROP COLUMN plan;
    END IF;
END $$;

-- Guarantee default organization has permanent active enterprise status
UPDATE public.organizations 
SET plan_tier = 'enterprise',
    subscription_status = 'active',
    max_staff_seats = 9999,
    trial_ends_at = NOW() + INTERVAL '100 years'
WHERE id = '00000000-0000-0000-0000-000000000001';

-- ----------------------------------------------------------------------------
-- 2. Stripe Webhook Idempotency Store
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
    id TEXT PRIMARY KEY, -- Stripe evt_xxx identifier
    event_type TEXT NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
-- Lock down stripe_webhook_events so only service_role (or security definer RPCs) can access it
DROP POLICY IF EXISTS "stripe_webhook_events_deny_all" ON public.stripe_webhook_events;
CREATE POLICY "stripe_webhook_events_deny_all" ON public.stripe_webhook_events
FOR ALL TO authenticated
USING (FALSE);

-- ----------------------------------------------------------------------------
-- 3. Licensing Access Functions: Read vs. Write Access Evaluation
-- ----------------------------------------------------------------------------

-- Read Access:
-- Returns TRUE if the organization has an active subscription, is in an active trial,
-- or is in the 14-day 'past_due' grace period (so HACCP audit & traceability logs remain accessible).
CREATE OR REPLACE FUNCTION public.org_has_read_access()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.organizations o
        WHERE o.id = public.current_org_id()
          AND (
            (o.subscription_status = 'trial' AND o.trial_ends_at > NOW())
            OR o.subscription_status IN ('active', 'past_due')
          )
    );
$$;

-- Write Access:
-- Returns TRUE if the organization is in an active trial or has an active subscription.
-- Returns FALSE when 'past_due' (grace period read-only), 'suspended', or 'canceled'.
CREATE OR REPLACE FUNCTION public.org_has_write_access()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.organizations o
        WHERE o.id = public.current_org_id()
          AND (
            (o.subscription_status = 'trial' AND o.trial_ends_at > NOW())
            OR o.subscription_status = 'active'
          )
    );
$$;

-- ----------------------------------------------------------------------------
-- 4. Update create_organization_and_admin (No more free Enterprise)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_organization_and_admin(
    p_org_name TEXT,
    p_admin_full_name TEXT DEFAULT NULL,
    p_admin_department TEXT DEFAULT 'Executive'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID;
    v_email TEXT;
    v_org_id UUID;
    v_existing_profile RECORD;
    v_org_name_clean TEXT;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required: User must be logged in to create an organization.';
    END IF;

    v_org_name_clean := trim(p_org_name);
    IF v_org_name_clean IS NULL OR length(v_org_name_clean) < 2 THEN
        RAISE EXCEPTION 'Organization name must be at least 2 characters.';
    END IF;

    -- Verify this user does not already have a staff profile
    SELECT id, organization_id INTO v_existing_profile
    FROM public.staff_profiles
    WHERE id = v_uid;

    IF FOUND THEN
        RAISE EXCEPTION 'User % is already registered with an organization.', v_uid;
    END IF;

    -- Fetch user email from auth.users
    SELECT email INTO v_email
    FROM auth.users
    WHERE id = v_uid;

    IF v_email IS NULL THEN
        v_email := 'staff_' || substr(v_uid::TEXT, 1, 8) || '@frostly.internal';
    END IF;

    -- 1. Create Organization: Default to 14-day trial on Starter tier with 5 staff seats
    INSERT INTO public.organizations (
        name,
        plan_tier,
        subscription_status,
        trial_ends_at,
        max_staff_seats
    )
    VALUES (
        v_org_name_clean,
        'starter',
        'trial',
        NOW() + INTERVAL '14 days',
        5
    )
    RETURNING id INTO v_org_id;

    -- 2. Create Staff Profile as Admin
    INSERT INTO public.staff_profiles (
        id,
        organization_id,
        email,
        full_name,
        role,
        department,
        is_active
    ) VALUES (
        v_uid,
        v_org_id,
        v_email,
        COALESCE(NULLIF(trim(p_admin_full_name), ''), split_part(v_email, '@', 1)),
        'admin',
        COALESCE(NULLIF(trim(p_admin_department), ''), 'Executive'),
        TRUE
    );

    -- 3. Seed default organization app settings
    INSERT INTO public.app_settings (
        id,
        organization_id,
        company_name,
        facility_code,
        fda_registration_number,
        eu_approval_number,
        tax_rate,
        currency
    ) VALUES (
        1,
        v_org_id,
        v_org_name_clean,
        'FAC-' || upper(substr(md5(v_org_id::TEXT), 1, 6)),
        'FDA-REG-' || upper(substr(md5(v_org_id::TEXT), 7, 7)),
        'EU-APPR-' || upper(substr(md5(v_org_id::TEXT), 14, 6)),
        15.00,
        'GHS'
    ) ON CONFLICT (organization_id, id) DO NOTHING;

    RETURN jsonb_build_object(
        'success', TRUE,
        'organization_id', v_org_id,
        'organization_name', v_org_name_clean,
        'plan_tier', 'starter',
        'subscription_status', 'trial',
        'trial_ends_at', NOW() + INTERVAL '14 days',
        'role', 'admin',
        'message', 'Organization provisioned on 14-day Starter trial.'
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. Update create_invite to Enforce Tiered Staff Seat Limits
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_invite(
    p_email TEXT,
    p_role public.staff_role DEFAULT 'viewer',
    p_validity_days INT DEFAULT 7
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_org_id UUID;
    v_token TEXT;
    v_invite_id UUID;
    v_expires_at TIMESTAMPTZ;
    v_max_seats INT;
    v_current_seats INT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access Denied: Only organization administrators can issue staff invites.';
    END IF;

    v_org_id := public.current_org_id();
    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'Context Error: Administrator has no active organization.';
    END IF;

    -- Verify write access (cannot invite new staff if subscription is past_due or suspended)
    IF NOT public.org_has_write_access() THEN
        RAISE EXCEPTION 'Licensing Restriction: Cannot issue staff invitations while organization subscription is in read-only or suspended status.';
    END IF;

    IF p_email IS NULL OR trim(p_email) = '' OR p_email NOT LIKE '%@%.%' THEN
        RAISE EXCEPTION 'A valid email address is required.';
    END IF;

    -- Enforce Tiered Staff Seat Capacity
    SELECT max_staff_seats INTO v_max_seats
    FROM public.organizations
    WHERE id = v_org_id;

    SELECT COUNT(*) INTO v_current_seats
    FROM (
        SELECT id FROM public.staff_profiles 
        WHERE organization_id = v_org_id AND is_active = TRUE
        UNION ALL
        SELECT id FROM public.invites 
        WHERE organization_id = v_org_id AND used_at IS NULL AND expires_at > NOW()
    ) active_and_pending;

    IF v_current_seats >= COALESCE(v_max_seats, 5) THEN
        RAISE EXCEPTION 'Seat limit reached: Organization has reached its maximum capacity of % staff seats. Please upgrade your subscription tier in billing settings.', v_max_seats;
    END IF;

    v_token := replace(gen_random_uuid()::TEXT, '-', '') || substr(replace(gen_random_uuid()::TEXT, '-', ''), 1, 16);
    v_expires_at := NOW() + (GREATEST(1, LEAST(p_validity_days, 90)) || ' days')::INTERVAL;

    INSERT INTO public.invites (
        organization_id,
        email,
        role,
        token,
        expires_at
    ) VALUES (
        v_org_id,
        lower(trim(p_email)),
        COALESCE(p_role, 'viewer'),
        v_token,
        v_expires_at
    )
    RETURNING id INTO v_invite_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'invite_id', v_invite_id,
        'token', v_token,
        'email', lower(trim(p_email)),
        'role', COALESCE(p_role, 'viewer'),
        'expires_at', v_expires_at,
        'seats_used', v_current_seats + 1,
        'max_seats', v_max_seats
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. Server-Side Stripe Webhook Processor (Idempotent)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.apply_stripe_subscription_update(
    p_event_id TEXT,
    p_event_type TEXT,
    p_stripe_customer_id TEXT,
    p_stripe_sub_id TEXT,
    p_status TEXT,
    p_plan_tier TEXT,
    p_period_end TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_org_id UUID;
    v_new_seats INT;
    v_normalized_status TEXT;
    v_normalized_tier TEXT;
BEGIN
    -- Idempotency Check: Don't process the same Stripe webhook event twice
    IF EXISTS (SELECT 1 FROM public.stripe_webhook_events WHERE id = p_event_id) THEN
        RETURN jsonb_build_object('status', 'already_processed', 'event_id', p_event_id);
    END IF;

    -- Map Stripe subscription status to internal subscription_status
    v_normalized_status := CASE 
        WHEN p_status IN ('active') THEN 'active'
        WHEN p_status IN ('trialing') THEN 'trial'
        WHEN p_status IN ('past_due') THEN 'past_due'
        WHEN p_status IN ('canceled', 'unpaid') THEN 'suspended'
        ELSE 'suspended'
    END;

    -- Map plan tier & seat ceilings
    v_normalized_tier := CASE 
        WHEN p_plan_tier IN ('standard') THEN 'standard'
        WHEN p_plan_tier IN ('enterprise') THEN 'enterprise'
        ELSE 'starter'
    END;

    v_new_seats := CASE 
        WHEN v_normalized_tier = 'standard' THEN 20
        WHEN v_normalized_tier = 'enterprise' THEN 9999
        ELSE 5
    END;

    -- Find organization by stripe_customer_id or stripe_subscription_id
    SELECT id INTO v_org_id
    FROM public.organizations
    WHERE stripe_customer_id = p_stripe_customer_id
       OR stripe_subscription_id = p_stripe_sub_id;

    IF v_org_id IS NULL THEN
        -- Record the event anyway so we don't spin on unknown customers
        INSERT INTO public.stripe_webhook_events (id, event_type)
        VALUES (p_event_id, p_event_type);

        RETURN jsonb_build_object(
            'status', 'ignored_unknown_customer',
            'customer_id', p_stripe_customer_id
        );
    END IF;

    -- Update organization licensing state
    UPDATE public.organizations
    SET subscription_status = v_normalized_status,
        plan_tier = v_normalized_tier,
        max_staff_seats = v_new_seats,
        current_period_ends_at = p_period_end,
        stripe_subscription_id = COALESCE(p_stripe_sub_id, stripe_subscription_id)
    WHERE id = v_org_id;

    -- Record event in idempotency journal
    INSERT INTO public.stripe_webhook_events (id, event_type)
    VALUES (p_event_id, p_event_type);

    RETURN jsonb_build_object(
        'status', 'updated',
        'organization_id', v_org_id,
        'subscription_status', v_normalized_status,
        'plan_tier', v_normalized_tier,
        'max_staff_seats', v_new_seats
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. Update Row-Level Security Policies with Read/Write Licensing Predicates
-- ----------------------------------------------------------------------------

DO $$
BEGIN
    -- 7.1 Species
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'species') THEN
        EXECUTE 'DROP POLICY IF EXISTS "species_select" ON public.species;';
        EXECUTE 'CREATE POLICY "species_select" ON public.species FOR SELECT TO authenticated USING (public.is_staff() AND organization_id = public.current_org_id() AND public.org_has_read_access());';
        EXECUTE 'DROP POLICY IF EXISTS "species_insert" ON public.species;';
        EXECUTE 'CREATE POLICY "species_insert" ON public.species FOR INSERT TO authenticated WITH CHECK ((public.is_admin() OR public.is_ops_or_admin()) AND organization_id = public.current_org_id() AND public.org_has_write_access());';
        EXECUTE 'DROP POLICY IF EXISTS "species_update" ON public.species;';
        EXECUTE 'CREATE POLICY "species_update" ON public.species FOR UPDATE TO authenticated USING (public.is_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access()) WITH CHECK (public.is_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
    END IF;

    -- 7.2 Customers
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customers') THEN
        EXECUTE 'DROP POLICY IF EXISTS "customers_select" ON public.customers;';
        EXECUTE 'CREATE POLICY "customers_select" ON public.customers FOR SELECT TO authenticated USING (public.is_staff() AND organization_id = public.current_org_id() AND public.org_has_read_access());';
        EXECUTE 'DROP POLICY IF EXISTS "customers_insert" ON public.customers;';
        EXECUTE 'CREATE POLICY "customers_insert" ON public.customers FOR INSERT TO authenticated WITH CHECK (public.is_sales_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
        EXECUTE 'DROP POLICY IF EXISTS "customers_update" ON public.customers;';
        EXECUTE 'CREATE POLICY "customers_update" ON public.customers FOR UPDATE TO authenticated USING (public.is_sales_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access()) WITH CHECK (public.is_sales_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
        EXECUTE 'DROP POLICY IF EXISTS "customers_delete" ON public.customers;';
        EXECUTE 'CREATE POLICY "customers_delete" ON public.customers FOR DELETE TO authenticated USING (public.is_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
    END IF;

    -- 7.3 Suppliers
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'suppliers') THEN
        EXECUTE 'DROP POLICY IF EXISTS "suppliers_select" ON public.suppliers;';
        EXECUTE 'CREATE POLICY "suppliers_select" ON public.suppliers FOR SELECT TO authenticated USING (public.is_staff() AND organization_id = public.current_org_id() AND public.org_has_read_access());';
        EXECUTE 'DROP POLICY IF EXISTS "suppliers_insert" ON public.suppliers;';
        EXECUTE 'CREATE POLICY "suppliers_insert" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (public.is_ops_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
        EXECUTE 'DROP POLICY IF EXISTS "suppliers_update" ON public.suppliers;';
        EXECUTE 'CREATE POLICY "suppliers_update" ON public.suppliers FOR UPDATE TO authenticated USING (public.is_ops_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access()) WITH CHECK (public.is_ops_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
    END IF;

    -- 7.4 Inventory Batches
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_batches') THEN
        EXECUTE 'DROP POLICY IF EXISTS "inventory_select" ON public.inventory_batches;';
        EXECUTE 'CREATE POLICY "inventory_select" ON public.inventory_batches FOR SELECT TO authenticated USING (public.is_staff() AND organization_id = public.current_org_id() AND public.org_has_read_access());';
        EXECUTE 'DROP POLICY IF EXISTS "inventory_insert" ON public.inventory_batches;';
        EXECUTE 'CREATE POLICY "inventory_insert" ON public.inventory_batches FOR INSERT TO authenticated WITH CHECK (public.is_ops_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
        EXECUTE 'DROP POLICY IF EXISTS "inventory_update" ON public.inventory_batches;';
        EXECUTE 'CREATE POLICY "inventory_update" ON public.inventory_batches FOR UPDATE TO authenticated USING (public.is_ops_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access()) WITH CHECK (public.is_ops_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
        EXECUTE 'DROP POLICY IF EXISTS "inventory_delete" ON public.inventory_batches;';
        EXECUTE 'CREATE POLICY "inventory_delete" ON public.inventory_batches FOR DELETE TO authenticated USING (public.is_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
    END IF;

    -- 7.5 Client Orders
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'client_orders') THEN
        EXECUTE 'DROP POLICY IF EXISTS "client_orders_select" ON public.client_orders;';
        EXECUTE 'CREATE POLICY "client_orders_select" ON public.client_orders FOR SELECT TO authenticated USING (public.is_staff() AND organization_id = public.current_org_id() AND public.org_has_read_access());';
        EXECUTE 'DROP POLICY IF EXISTS "client_orders_insert" ON public.client_orders;';
        EXECUTE 'CREATE POLICY "client_orders_insert" ON public.client_orders FOR INSERT TO authenticated WITH CHECK (public.is_sales_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
        EXECUTE 'DROP POLICY IF EXISTS "client_orders_update" ON public.client_orders;';
        EXECUTE 'CREATE POLICY "client_orders_update" ON public.client_orders FOR UPDATE TO authenticated USING (public.is_sales_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access()) WITH CHECK (public.is_sales_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
    END IF;

    -- 7.6 Order Line Items
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_line_items') THEN
        EXECUTE 'DROP POLICY IF EXISTS "order_items_select" ON public.order_line_items;';
        EXECUTE 'CREATE POLICY "order_items_select" ON public.order_line_items FOR SELECT TO authenticated USING (public.is_staff() AND organization_id = public.current_org_id() AND public.org_has_read_access());';
        EXECUTE 'DROP POLICY IF EXISTS "order_items_insert" ON public.order_line_items;';
        EXECUTE 'CREATE POLICY "order_items_insert" ON public.order_line_items FOR INSERT TO authenticated WITH CHECK (public.is_sales_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
        EXECUTE 'DROP POLICY IF EXISTS "order_items_update" ON public.order_line_items;';
        EXECUTE 'CREATE POLICY "order_items_update" ON public.order_line_items FOR UPDATE TO authenticated USING (public.is_sales_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access()) WITH CHECK (public.is_sales_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
    END IF;

    -- 7.7 HACCP Audit Records
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'haccp_audit_records') THEN
        EXECUTE 'DROP POLICY IF EXISTS "haccp_audit_select" ON public.haccp_audit_records;';
        EXECUTE 'CREATE POLICY "haccp_audit_select" ON public.haccp_audit_records FOR SELECT TO authenticated USING (public.is_staff() AND organization_id = public.current_org_id() AND public.org_has_read_access());';
        EXECUTE 'DROP POLICY IF EXISTS "haccp_audit_insert" ON public.haccp_audit_records;';
        EXECUTE 'CREATE POLICY "haccp_audit_insert" ON public.haccp_audit_records FOR INSERT TO authenticated WITH CHECK (public.is_ops_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
    END IF;

    -- 7.8 Financial Ledger Entries
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'financial_ledger_entries') THEN
        EXECUTE 'DROP POLICY IF EXISTS "financial_ledger_select" ON public.financial_ledger_entries;';
        EXECUTE 'CREATE POLICY "financial_ledger_select" ON public.financial_ledger_entries FOR SELECT TO authenticated USING (public.is_staff() AND organization_id = public.current_org_id() AND public.org_has_read_access());';
        EXECUTE 'DROP POLICY IF EXISTS "financial_ledger_insert" ON public.financial_ledger_entries;';
        EXECUTE 'CREATE POLICY "financial_ledger_insert" ON public.financial_ledger_entries FOR INSERT TO authenticated WITH CHECK (public.is_staff() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
    END IF;

    -- 7.9 Reefer Sensor Readings (Telemetry)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reefer_sensor_readings') THEN
        EXECUTE 'DROP POLICY IF EXISTS "reefer_telemetry_select" ON public.reefer_sensor_readings;';
        EXECUTE 'CREATE POLICY "reefer_telemetry_select" ON public.reefer_sensor_readings FOR SELECT TO authenticated USING (public.is_staff() AND organization_id = public.current_org_id() AND public.org_has_read_access());';
        EXECUTE 'DROP POLICY IF EXISTS "reefer_telemetry_insert" ON public.reefer_sensor_readings;';
        EXECUTE 'CREATE POLICY "reefer_telemetry_insert" ON public.reefer_sensor_readings FOR INSERT TO authenticated WITH CHECK ((public.is_ops_or_admin() OR public.is_dispatch_or_admin()) AND organization_id = public.current_org_id() AND public.org_has_write_access());';
    END IF;

    -- 7.10 Fleet Vessels
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fleet_vessels') THEN
        EXECUTE 'DROP POLICY IF EXISTS "fleet_vessels_select" ON public.fleet_vessels;';
        EXECUTE 'CREATE POLICY "fleet_vessels_select" ON public.fleet_vessels FOR SELECT TO authenticated USING (public.is_staff() AND organization_id = public.current_org_id() AND public.org_has_read_access());';
        EXECUTE 'DROP POLICY IF EXISTS "fleet_vessels_insert" ON public.fleet_vessels;';
        EXECUTE 'CREATE POLICY "fleet_vessels_insert" ON public.fleet_vessels FOR INSERT TO authenticated WITH CHECK (public.is_ops_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
        EXECUTE 'DROP POLICY IF EXISTS "fleet_vessels_update" ON public.fleet_vessels;';
        EXECUTE 'CREATE POLICY "fleet_vessels_update" ON public.fleet_vessels FOR UPDATE TO authenticated USING (public.is_ops_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access()) WITH CHECK (public.is_ops_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
    END IF;

    -- 7.11 Reefer Vehicles
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reefer_vehicles') THEN
        EXECUTE 'DROP POLICY IF EXISTS "reefer_vehicles_select" ON public.reefer_vehicles;';
        EXECUTE 'CREATE POLICY "reefer_vehicles_select" ON public.reefer_vehicles FOR SELECT TO authenticated USING (public.is_staff() AND organization_id = public.current_org_id() AND public.org_has_read_access());';
        EXECUTE 'DROP POLICY IF EXISTS "reefer_vehicles_insert" ON public.reefer_vehicles;';
        EXECUTE 'CREATE POLICY "reefer_vehicles_insert" ON public.reefer_vehicles FOR INSERT TO authenticated WITH CHECK ((public.is_ops_or_admin() OR public.is_dispatch_or_admin()) AND organization_id = public.current_org_id() AND public.org_has_write_access());';
        EXECUTE 'DROP POLICY IF EXISTS "reefer_vehicles_update" ON public.reefer_vehicles;';
        EXECUTE 'CREATE POLICY "reefer_vehicles_update" ON public.reefer_vehicles FOR UPDATE TO authenticated USING ((public.is_ops_or_admin() OR public.is_dispatch_or_admin()) AND organization_id = public.current_org_id() AND public.org_has_write_access()) WITH CHECK ((public.is_ops_or_admin() OR public.is_dispatch_or_admin()) AND organization_id = public.current_org_id() AND public.org_has_write_access());';
    END IF;

    -- 7.12 Retail Transactions & Sale Items
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'retail_transactions') THEN
        EXECUTE 'DROP POLICY IF EXISTS "retail_transactions_select" ON public.retail_transactions;';
        EXECUTE 'CREATE POLICY "retail_transactions_select" ON public.retail_transactions FOR SELECT TO authenticated USING (public.is_staff() AND organization_id = public.current_org_id() AND public.org_has_read_access());';
        EXECUTE 'DROP POLICY IF EXISTS "retail_transactions_insert" ON public.retail_transactions;';
        EXECUTE 'CREATE POLICY "retail_transactions_insert" ON public.retail_transactions FOR INSERT TO authenticated WITH CHECK (public.is_sales_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'retail_sale_items') THEN
        EXECUTE 'DROP POLICY IF EXISTS "retail_sale_items_select" ON public.retail_sale_items;';
        EXECUTE 'CREATE POLICY "retail_sale_items_select" ON public.retail_sale_items FOR SELECT TO authenticated USING (public.is_staff() AND organization_id = public.current_org_id() AND public.org_has_read_access());';
        EXECUTE 'DROP POLICY IF EXISTS "retail_sale_items_insert" ON public.retail_sale_items;';
        EXECUTE 'CREATE POLICY "retail_sale_items_insert" ON public.retail_sale_items FOR INSERT TO authenticated WITH CHECK (public.is_sales_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
    END IF;

    -- 7.13 Purchase Orders
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'purchase_order_landings') THEN
        EXECUTE 'DROP POLICY IF EXISTS "purchase_landings_select" ON public.purchase_order_landings;';
        EXECUTE 'CREATE POLICY "purchase_landings_select" ON public.purchase_order_landings FOR SELECT TO authenticated USING (public.is_staff() AND organization_id = public.current_org_id() AND public.org_has_read_access());';
        EXECUTE 'DROP POLICY IF EXISTS "purchase_landings_insert" ON public.purchase_order_landings;';
        EXECUTE 'CREATE POLICY "purchase_landings_insert" ON public.purchase_order_landings FOR INSERT TO authenticated WITH CHECK (public.is_ops_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
        EXECUTE 'DROP POLICY IF EXISTS "purchase_landings_update" ON public.purchase_order_landings;';
        EXECUTE 'CREATE POLICY "purchase_landings_update" ON public.purchase_order_landings FOR UPDATE TO authenticated USING (public.is_ops_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access()) WITH CHECK (public.is_ops_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'purchase_order_items') THEN
        EXECUTE 'DROP POLICY IF EXISTS "purchase_items_select" ON public.purchase_order_items;';
        EXECUTE 'CREATE POLICY "purchase_items_select" ON public.purchase_order_items FOR SELECT TO authenticated USING (public.is_staff() AND organization_id = public.current_org_id() AND public.org_has_read_access());';
        EXECUTE 'DROP POLICY IF EXISTS "purchase_items_insert" ON public.purchase_order_items;';
        EXECUTE 'CREATE POLICY "purchase_items_insert" ON public.purchase_order_items FOR INSERT TO authenticated WITH CHECK (public.is_ops_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
    END IF;

    -- 7.14 Market Price Index
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'market_price_index') THEN
        EXECUTE 'DROP POLICY IF EXISTS "market_price_select" ON public.market_price_index;';
        EXECUTE 'CREATE POLICY "market_price_select" ON public.market_price_index FOR SELECT TO authenticated USING (public.is_staff() AND organization_id = public.current_org_id() AND public.org_has_read_access());';
        EXECUTE 'DROP POLICY IF EXISTS "market_price_insert" ON public.market_price_index;';
        EXECUTE 'CREATE POLICY "market_price_insert" ON public.market_price_index FOR INSERT TO authenticated WITH CHECK (public.is_ops_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
    END IF;

    -- 7.15 Retail Products
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'retail_wholesale_products') THEN
        EXECUTE 'DROP POLICY IF EXISTS "retail_products_select" ON public.retail_wholesale_products;';
        EXECUTE 'CREATE POLICY "retail_products_select" ON public.retail_wholesale_products FOR SELECT TO authenticated USING (public.is_staff() AND organization_id = public.current_org_id() AND public.org_has_read_access());';
        EXECUTE 'DROP POLICY IF EXISTS "retail_products_insert" ON public.retail_wholesale_products;';
        EXECUTE 'CREATE POLICY "retail_products_insert" ON public.retail_wholesale_products FOR INSERT TO authenticated WITH CHECK ((public.is_ops_or_admin() OR public.is_sales_or_admin()) AND organization_id = public.current_org_id() AND public.org_has_write_access());';
        EXECUTE 'DROP POLICY IF EXISTS "retail_products_update" ON public.retail_wholesale_products;';
        EXECUTE 'CREATE POLICY "retail_products_update" ON public.retail_wholesale_products FOR UPDATE TO authenticated USING ((public.is_ops_or_admin() OR public.is_sales_or_admin()) AND organization_id = public.current_org_id() AND public.org_has_write_access()) WITH CHECK ((public.is_ops_or_admin() OR public.is_sales_or_admin()) AND organization_id = public.current_org_id() AND public.org_has_write_access());';
    END IF;

    -- 7.16 System Notifications
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'system_notifications') THEN
        EXECUTE 'DROP POLICY IF EXISTS "system_notifications_select" ON public.system_notifications;';
        EXECUTE 'CREATE POLICY "system_notifications_select" ON public.system_notifications FOR SELECT TO authenticated USING (public.is_staff() AND organization_id = public.current_org_id() AND public.org_has_read_access());';
        EXECUTE 'DROP POLICY IF EXISTS "system_notifications_insert" ON public.system_notifications;';
        EXECUTE 'CREATE POLICY "system_notifications_insert" ON public.system_notifications FOR INSERT TO authenticated WITH CHECK (public.is_staff() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
        EXECUTE 'DROP POLICY IF EXISTS "system_notifications_update" ON public.system_notifications;';
        EXECUTE 'CREATE POLICY "system_notifications_update" ON public.system_notifications FOR UPDATE TO authenticated USING (public.is_staff() AND organization_id = public.current_org_id() AND public.org_has_write_access()) WITH CHECK (public.is_staff() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
    END IF;

    -- 7.17 App Settings
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'app_settings') THEN
        EXECUTE 'DROP POLICY IF EXISTS "app_settings_select" ON public.app_settings;';
        EXECUTE 'CREATE POLICY "app_settings_select" ON public.app_settings FOR SELECT TO authenticated USING (public.is_staff() AND organization_id = public.current_org_id() AND public.org_has_read_access());';
        EXECUTE 'DROP POLICY IF EXISTS "app_settings_update" ON public.app_settings;';
        EXECUTE 'CREATE POLICY "app_settings_update" ON public.app_settings FOR UPDATE TO authenticated USING (public.is_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access()) WITH CHECK (public.is_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
    END IF;

    -- 7.18 Staff Role Audit Logs
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'staff_role_audit_logs') THEN
        EXECUTE 'DROP POLICY IF EXISTS "staff_role_audit_select" ON public.staff_role_audit_logs;';
        EXECUTE 'CREATE POLICY "staff_role_audit_select" ON public.staff_role_audit_logs FOR SELECT TO authenticated USING (public.is_admin() AND organization_id = public.current_org_id() AND public.org_has_read_access());';
    END IF;
END $$;



-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- START OF 013_paystack_dual_billing.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ============================================================================
-- FROSTLY SEAFOOD COLD-CHAIN ERP
-- Migration 013: Dual-Gateway Billing - Paystack GHS (MoMo) + Stripe USD
-- ============================================================================

DO $$
BEGIN
    -- Add paystack_customer_code to organizations
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'paystack_customer_code'
    ) THEN
        ALTER TABLE public.organizations 
        ADD COLUMN paystack_customer_code TEXT UNIQUE;
    END IF;

    -- Add paystack_subscription_code to organizations
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'paystack_subscription_code'
    ) THEN
        ALTER TABLE public.organizations 
        ADD COLUMN paystack_subscription_code TEXT UNIQUE;
    END IF;

    -- Add billing_provider: 'stripe', 'paystack', or 'none' (trial)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'billing_provider'
    ) THEN
        ALTER TABLE public.organizations 
        ADD COLUMN billing_provider TEXT NOT NULL DEFAULT 'none'
        CHECK (billing_provider IN ('none', 'stripe', 'paystack'));
    END IF;

    -- Add billing_currency: 'USD', 'GHS', or 'EUR'
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'billing_currency'
    ) THEN
        ALTER TABLE public.organizations 
        ADD COLUMN billing_currency TEXT NOT NULL DEFAULT 'GHS';
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 1. Paystack Webhook Idempotency Journal
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.paystack_webhook_events (
    id TEXT PRIMARY KEY, -- Paystack event reference or ID
    event_type TEXT NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.paystack_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "paystack_webhook_events_deny_all" ON public.paystack_webhook_events;
CREATE POLICY "paystack_webhook_events_deny_all" ON public.paystack_webhook_events
FOR ALL TO authenticated
USING (FALSE);

-- ----------------------------------------------------------------------------
-- 2. Paystack Webhook Processor RPC Function
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.apply_paystack_subscription_update(
    p_event_id TEXT,
    p_event_type TEXT,
    p_customer_code TEXT,
    p_subscription_code TEXT,
    p_status TEXT,
    p_plan_tier TEXT,
    p_period_end TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_org_id UUID;
    v_new_seats INT;
    v_normalized_status TEXT;
    v_normalized_tier TEXT;
BEGIN
    -- 1. Idempotency Check: Don't process duplicate Paystack webhook deliveries
    IF EXISTS (SELECT 1 FROM public.paystack_webhook_events WHERE id = p_event_id) THEN
        RETURN jsonb_build_object('status', 'already_processed', 'event_id', p_event_id);
    END IF;

    -- 2. Normalize Paystack Status to Internal subscription_status
    -- Paystack subscription statuses: 'active', 'attention', 'non-renewing', 'cancelled'
    -- Paystack charge status: 'success', 'failed'
    v_normalized_status := CASE 
        WHEN p_status IN ('active', 'success') THEN 'active'
        WHEN p_status IN ('attention', 'past_due') THEN 'past_due'
        WHEN p_status IN ('non-renewing', 'cancelled', 'disabled', 'failed') THEN 'suspended'
        ELSE 'suspended'
    END;

    -- 3. Normalize Tier & Seat Ceilings
    v_normalized_tier := CASE 
        WHEN p_plan_tier IN ('standard') THEN 'standard'
        WHEN p_plan_tier IN ('enterprise') THEN 'enterprise'
        ELSE 'starter'
    END;

    v_new_seats := CASE 
        WHEN v_normalized_tier = 'standard' THEN 20
        WHEN v_normalized_tier = 'enterprise' THEN 9999
        ELSE 5
    END;

    -- 4. Locate Organization by paystack_customer_code, paystack_subscription_code, or email
    SELECT id INTO v_org_id
    FROM public.organizations
    WHERE paystack_customer_code = p_customer_code
       OR paystack_subscription_code = p_subscription_code;

    IF v_org_id IS NULL THEN
        -- Record event in journal to avoid redundant retries
        INSERT INTO public.paystack_webhook_events (id, event_type)
        VALUES (p_event_id, p_event_type);

        RETURN jsonb_build_object(
            'status', 'ignored_unknown_customer',
            'customer_code', p_customer_code
        );
    END IF;

    -- 5. Apply Updates to Organization
    UPDATE public.organizations
    SET subscription_status = v_normalized_status,
        plan_tier = v_normalized_tier,
        max_staff_seats = v_new_seats,
        billing_provider = 'paystack',
        billing_currency = 'GHS',
        current_period_ends_at = COALESCE(p_period_end, current_period_ends_at),
        paystack_subscription_code = COALESCE(p_subscription_code, paystack_subscription_code)
    WHERE id = v_org_id;

    -- 6. Journal the processed event
    INSERT INTO public.paystack_webhook_events (id, event_type)
    VALUES (p_event_id, p_event_type);

    RETURN jsonb_build_object(
        'status', 'updated',
        'organization_id', v_org_id,
        'subscription_status', v_normalized_status,
        'plan_tier', v_normalized_tier,
        'max_staff_seats', v_new_seats,
        'billing_provider', 'paystack'
    );
END;
$$;



-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- START OF 014_platform_admin_console.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ============================================================================
-- FROSTLY SEAFOOD COLD-CHAIN ERP
-- Migration 014: Platform Owner Role, Audit Logging & Creator Console Access
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Ensure organizations has updated_at column
-- ----------------------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.organizations ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Platform Admins Table (Completely outside the tenant model)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.platform_admins (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    notes TEXT
);

-- Strict RLS: Zero INSERT, UPDATE, or DELETE policies for authenticated/anon roles.
-- Platform admin assignments must be explicitly inserted by service-role or direct SQL console.
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_admins_self_select" ON public.platform_admins;
CREATE POLICY "platform_admins_self_select" ON public.platform_admins
FOR SELECT TO authenticated
USING (user_id = auth.uid());

GRANT SELECT ON public.platform_admins TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. Security Definer Helper Function
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE user_id = auth.uid()
  );
$$;

-- ----------------------------------------------------------------------------
-- 3. Platform Creator Audit Log Table
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.platform_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID NOT NULL REFERENCES auth.users(id),
    action TEXT NOT NULL,
    target_organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    previous_state JSONB,
    new_state JSONB,
    reason TEXT NOT NULL,
    client_ip TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.platform_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_audit_logs_select" ON public.platform_audit_logs;
CREATE POLICY "platform_audit_logs_select" ON public.platform_audit_logs
FOR SELECT TO authenticated
USING (public.is_platform_admin());

GRANT SELECT ON public.platform_audit_logs TO authenticated;

-- Deny all client direct writes to platform_audit_logs
DROP POLICY IF EXISTS "platform_audit_logs_deny_write" ON public.platform_audit_logs;
CREATE POLICY "platform_audit_logs_deny_write" ON public.platform_audit_logs
FOR ALL TO authenticated
USING (FALSE);

-- ----------------------------------------------------------------------------
-- 4. RLS Policy Updates on Organizations and Invites
-- ----------------------------------------------------------------------------

-- A. Organizations: Platform admins can discover all tenants; tenant staff see only their own
DROP POLICY IF EXISTS "organizations_select" ON public.organizations;
CREATE POLICY "organizations_select" ON public.organizations
FOR SELECT TO authenticated
USING (
    id = public.current_org_id() 
    OR public.is_platform_admin()
);

-- B. Invites: Platform admins can view and revoke pending invites across all organizations
DROP POLICY IF EXISTS "invites_select" ON public.invites;
CREATE POLICY "invites_select" ON public.invites
FOR SELECT TO authenticated
USING (
    (organization_id = public.current_org_id() AND public.is_admin())
    OR public.is_platform_admin()
);

DROP POLICY IF EXISTS "invites_delete" ON public.invites;
CREATE POLICY "invites_delete" ON public.invites
FOR DELETE TO authenticated
USING (
    (organization_id = public.current_org_id() AND public.is_admin())
    OR public.is_platform_admin()
);

-- NOTE ON LEAST-PRIVILEGE ISOLATION:
-- The 20 operational business tables (customers, client_orders, inventory_batches,
-- financial_ledger_entries, haccp_audit_records, etc.) DO NOT receive OR public.is_platform_admin().
-- They remain strictly partitioned to organization_id = public.current_org_id().

-- ----------------------------------------------------------------------------
-- 5. Platform Admin Management RPC Functions
-- ----------------------------------------------------------------------------

-- RPC: List all tenants with enriched metrics
CREATE OR REPLACE FUNCTION public.platform_list_organizations()
RETURNS TABLE (
    id UUID,
    name TEXT,
    company_name TEXT,
    subscription_status TEXT,
    plan_tier TEXT,
    billing_provider TEXT,
    billing_currency TEXT,
    max_staff_seats INT,
    staff_count BIGINT,
    pending_invites_count BIGINT,
    trial_ends_at TIMESTAMPTZ,
    current_period_ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_platform_admin() THEN
        RAISE EXCEPTION 'Access denied: caller is not a verified platform administrator';
    END IF;

    RETURN QUERY
    SELECT 
        o.id,
        o.name,
        COALESCE(s.company_name, o.name) AS company_name,
        o.subscription_status,
        o.plan_tier,
        o.billing_provider,
        o.billing_currency,
        o.max_staff_seats,
        (SELECT COUNT(*) FROM public.staff_profiles sp WHERE sp.organization_id = o.id AND sp.is_active = TRUE) AS staff_count,
        (SELECT COUNT(*) FROM public.invites inv WHERE inv.organization_id = o.id AND inv.used_at IS NULL AND inv.expires_at > NOW()) AS pending_invites_count,
        o.trial_ends_at,
        o.current_period_ends_at,
        o.created_at
    FROM public.organizations o
    LEFT JOIN public.app_settings s ON s.organization_id = o.id
    ORDER BY o.created_at DESC;
END;
$$;

-- RPC: Update Tenant Subscription with Mandatory Audit Trail
CREATE OR REPLACE FUNCTION public.platform_update_organization_subscription(
    p_org_id UUID,
    p_status TEXT,          -- 'active', 'trial', 'past_due', 'suspended'
    p_plan_tier TEXT,       -- 'starter', 'standard', 'enterprise'
    p_max_seats INT DEFAULT NULL,
    p_trial_ends_at TIMESTAMPTZ DEFAULT NULL,
    p_reason TEXT DEFAULT 'Manual subscription update via Platform Console'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_old_org RECORD;
    v_new_org RECORD;
    v_seats INT;
BEGIN
    -- 1. Verify Caller is Platform Admin
    IF NOT public.is_platform_admin() THEN
        RAISE EXCEPTION 'Access denied: caller is not a verified platform administrator';
    END IF;

    -- 2. Fetch Existing Organization
    SELECT * INTO v_old_org FROM public.organizations WHERE id = p_org_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Organization % not found', p_org_id;
    END IF;

    -- 3. Calculate Seats (use provided or tier default)
    v_seats := COALESCE(p_max_seats, CASE 
        WHEN p_plan_tier = 'standard' THEN 20
        WHEN p_plan_tier = 'enterprise' THEN 9999
        ELSE 5
    END);

    -- 4. Apply State Update
    UPDATE public.organizations
    SET 
        subscription_status = COALESCE(p_status, subscription_status),
        plan_tier = COALESCE(p_plan_tier, plan_tier),
        max_staff_seats = v_seats,
        trial_ends_at = COALESCE(p_trial_ends_at, trial_ends_at),
        updated_at = NOW()
    WHERE id = p_org_id
    RETURNING * INTO v_new_org;

    -- 5. Record Immutable Platform Audit Entry
    INSERT INTO public.platform_audit_logs (
        actor_id,
        action,
        target_organization_id,
        previous_state,
        new_state,
        reason
    ) VALUES (
        auth.uid(),
        'manual_subscription_update',
        p_org_id,
        to_jsonb(v_old_org),
        to_jsonb(v_new_org),
        COALESCE(p_reason, 'Manual subscription adjustment via Platform Console')
    );

    RETURN jsonb_build_object(
        'success', true,
        'organization_id', p_org_id,
        'subscription_status', v_new_org.subscription_status,
        'plan_tier', v_new_org.plan_tier,
        'max_staff_seats', v_new_org.max_staff_seats,
        'reason', p_reason
    );
END;
$$;



-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- START OF 015_creator_bootstrap.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ============================================================================
-- FROSTLY SEAFOOD COLD-CHAIN ERP
-- Migration 015: Platform Creator Credentials & Backend Identity Bootstrapping
-- ============================================================================

-- Ensure pgcrypto extension is available for cryptographic password hashing
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- ----------------------------------------------------------------------------
-- 1. Backend RPC: Bootstrap or Reset Platform Creator Credentials Out-of-Band
-- ----------------------------------------------------------------------------
-- Note: In accordance with security mandates, NO plaintext credentials or passwords
-- are committed to migration scripts. Initial creator setup is executed out-of-band
-- by the database administrator or deployment pipeline calling this procedure with
-- securely supplied credentials (e.g. from environment variables).

CREATE OR REPLACE FUNCTION public.bootstrap_platform_creator(
    p_email TEXT,
    p_password TEXT,
    p_notes TEXT DEFAULT 'Platform Creator & Multi-Tenant Operator'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_user_id UUID;
    v_hashed_pw TEXT;
BEGIN
    -- Validation: Email and Password must be provided
    IF p_email IS NULL OR TRIM(p_email) = '' THEN
        RAISE EXCEPTION 'Platform creator email must not be empty';
    END IF;

    IF p_password IS NULL OR LENGTH(p_password) < 8 THEN
        RAISE EXCEPTION 'Password must be provided and be at least 8 characters in length';
    END IF;

    -- Compute cryptographic bcrypt hash using standard PostgreSQL Blowfish salt (from extensions schema)
    BEGIN
        v_hashed_pw := extensions.crypt(p_password, extensions.gen_salt('bf', 10));
    EXCEPTION WHEN OTHERS THEN
        v_hashed_pw := crypt(p_password, gen_salt('bf', 10));
    END;

    -- Check if user identity already exists in Supabase auth.users
    SELECT id INTO v_user_id 
    FROM auth.users 
    WHERE LOWER(email) = LOWER(TRIM(p_email));

    IF v_user_id IS NULL THEN
        v_user_id := gen_random_uuid();
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            v_user_id,
            'authenticated',
            'authenticated',
            LOWER(TRIM(p_email)),
            v_hashed_pw,
            NOW(),
            '{"provider":"email","providers":["email"],"role":"platform_creator"}'::jsonb,
            jsonb_build_object('full_name', 'Platform Creator', 'platform_owner', true, 'role', 'platform_creator'),
            NOW(),
            NOW()
        );
    ELSE
        UPDATE auth.users
        SET 
            encrypted_password = v_hashed_pw,
            email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
            raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role":"platform_creator"}'::jsonb,
            raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"platform_owner":true,"role":"platform_creator"}'::jsonb,
            updated_at = NOW()
        WHERE id = v_user_id;
    END IF;

    -- Ensure platform_admins entry is present
    INSERT INTO public.platform_admins (user_id, created_at, created_by, notes)
    VALUES (v_user_id, NOW(), v_user_id, p_notes)
    ON CONFLICT (user_id) DO UPDATE
    SET notes = p_notes;

    RETURN jsonb_build_object(
        'success', true,
        'user_id', v_user_id,
        'email', LOWER(TRIM(p_email)),
        'is_platform_admin', true,
        'stored_at_backend', true,
        'updated_at', NOW()
    );
END;
$$;

-- Security note: revoke public execute, grant only to authenticated (if creator) and service_role
REVOKE ALL ON FUNCTION public.bootstrap_platform_creator(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bootstrap_platform_creator(TEXT, TEXT, TEXT) TO authenticated, service_role;



