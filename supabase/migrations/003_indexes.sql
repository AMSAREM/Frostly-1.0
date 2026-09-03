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
