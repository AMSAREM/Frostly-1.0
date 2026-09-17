-- ============================================================================
-- FROSTLY SEAFOOD COLD-CHAIN ERP
-- MULTI-TENANT & PLATFORM UPGRADE BUNDLE (Migrations 011 to 016)
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/xvlocfkkcnjopfzwobmg/sql
-- ============================================================================


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




-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- START OF 016_revoke_delete_tenant.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ============================================================================
-- FROSTLY SEAFOOD COLD-CHAIN ERP
-- Migration 016: Revoke Access & Delete Organization / Tenant Capabilities
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. RPC: Revoke Organization Access (Suspend Tenant)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.platform_revoke_organization_access(
    p_org_id UUID,
    p_reason TEXT DEFAULT 'Tenant access revoked by platform administrator'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_old_org RECORD;
    v_new_org RECORD;
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

    -- 3. Transition subscription status to suspended
    UPDATE public.organizations
    SET 
        subscription_status = 'suspended',
        updated_at = NOW()
    WHERE id = p_org_id
    RETURNING * INTO v_new_org;

    -- 4. Expire any active invites for this tenant immediately
    UPDATE public.invites
    SET expires_at = NOW()
    WHERE organization_id = p_org_id AND used_at IS NULL AND expires_at > NOW();

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
        'revoke_organization_access',
        p_org_id,
        to_jsonb(v_old_org),
        to_jsonb(v_new_org),
        COALESCE(p_reason, 'Access revoked: tenant suspended')
    );

    RETURN jsonb_build_object(
        'success', true,
        'organization_id', p_org_id,
        'subscription_status', 'suspended',
        'reason', p_reason
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. RPC: Reinstate Organization Access
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.platform_reinstate_organization_access(
    p_org_id UUID,
    p_reason TEXT DEFAULT 'Tenant access reinstated by platform administrator',
    p_target_status TEXT DEFAULT 'active'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_old_org RECORD;
    v_new_org RECORD;
    v_status TEXT;
BEGIN
    -- 1. Verify Caller is Platform Admin
    IF NOT public.is_platform_admin() THEN
        RAISE EXCEPTION 'Access denied: caller is not a verified platform administrator';
    END IF;

    -- 2. Validate target status
    v_status := CASE 
        WHEN p_target_status IN ('active', 'trial', 'past_due') THEN p_target_status 
        ELSE 'active' 
    END;

    -- 3. Fetch Existing Organization
    SELECT * INTO v_old_org FROM public.organizations WHERE id = p_org_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Organization % not found', p_org_id;
    END IF;

    -- 4. Transition subscription status to active/trial
    UPDATE public.organizations
    SET 
        subscription_status = v_status,
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
        'reinstate_organization_access',
        p_org_id,
        to_jsonb(v_old_org),
        to_jsonb(v_new_org),
        COALESCE(p_reason, 'Access reinstated')
    );

    RETURN jsonb_build_object(
        'success', true,
        'organization_id', p_org_id,
        'subscription_status', v_status,
        'reason', p_reason
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. RPC: Permanently Delete / Deprovision Organization
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.platform_delete_organization(
    p_org_id UUID,
    p_reason TEXT DEFAULT 'Organization permanently deleted',
    p_confirm_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_old_org RECORD;
    v_is_platform_owner BOOLEAN;
    v_is_tenant_admin BOOLEAN;
BEGIN
    -- 1. Check Caller Authorization: Must be Platform Owner OR Admin of this Organization
    v_is_platform_owner := public.is_platform_admin();
    
    SELECT EXISTS (
        SELECT 1 FROM public.staff_profiles 
        WHERE id = auth.uid() 
          AND organization_id = p_org_id 
          AND role = 'admin' 
          AND is_active = TRUE
    ) INTO v_is_tenant_admin;

    IF NOT (v_is_platform_owner OR v_is_tenant_admin) THEN
        RAISE EXCEPTION 'Access denied: only platform administrators or the tenant administrator can delete this organization';
    END IF;

    -- 2. Fetch Existing Organization
    SELECT * INTO v_old_org FROM public.organizations WHERE id = p_org_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Organization % not found', p_org_id;
    END IF;

    -- 3. Safety Check: Verify company name confirmation if provided
    IF p_confirm_name IS NOT NULL AND LOWER(TRIM(p_confirm_name)) <> LOWER(TRIM(v_old_org.name)) THEN
        RAISE EXCEPTION 'Confirmation name does not match organization name "%"', v_old_org.name;
    END IF;

    -- 4. Record Immutable Platform Audit Entry BEFORE deletion
    INSERT INTO public.platform_audit_logs (
        actor_id,
        action,
        target_organization_id,
        previous_state,
        new_state,
        reason
    ) VALUES (
        auth.uid(),
        'delete_organization',
        NULL,
        to_jsonb(v_old_org),
        jsonb_build_object('status', 'deleted', 'deleted_at', NOW()),
        COALESCE(p_reason, 'Organization permanently deprovisioned and deleted')
    );

    -- 5. Cascade deletion across operational tables (handles non-cascading FKs safely)
    DELETE FROM public.invites WHERE organization_id = p_org_id;
    DELETE FROM public.staff_profiles WHERE organization_id = p_org_id;
    DELETE FROM public.app_settings WHERE organization_id = p_org_id;
    DELETE FROM public.organizations WHERE id = p_org_id;

    RETURN jsonb_build_object(
        'success', true,
        'deleted_organization_id', p_org_id,
        'deleted_name', v_old_org.name,
        'reason', p_reason
    );
END;
$$;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- START OF 017_inventory_retail_linking.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

DO $$
BEGIN
    -- 1. linked_product_id (maps retail cut inventory lots to product catalogue items)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'inventory_batches' 
          AND column_name = 'linked_product_id'
    ) THEN
        ALTER TABLE public.inventory_batches ADD COLUMN linked_product_id TEXT;
        CREATE INDEX IF NOT EXISTS idx_inventory_linked_product ON public.inventory_batches(linked_product_id);
    END IF;

    -- 2. product_sku (maps retail cut lots to inventory SKU)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'inventory_batches' 
          AND column_name = 'product_sku'
    ) THEN
        ALTER TABLE public.inventory_batches ADD COLUMN product_sku TEXT;
        CREATE INDEX IF NOT EXISTS idx_inventory_product_sku ON public.inventory_batches(product_sku);
    END IF;

    -- 3. is_retail_cut_lot (boolean flag for retail cut lot filtering)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'inventory_batches' 
          AND column_name = 'is_retail_cut_lot'
    ) THEN
        ALTER TABLE public.inventory_batches ADD COLUMN is_retail_cut_lot BOOLEAN NOT NULL DEFAULT false;
        CREATE INDEX IF NOT EXISTS idx_inventory_is_retail_cut ON public.inventory_batches(is_retail_cut_lot);
    END IF;
END $$;



