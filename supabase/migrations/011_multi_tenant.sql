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
