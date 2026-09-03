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
