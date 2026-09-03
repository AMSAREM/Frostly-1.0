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
