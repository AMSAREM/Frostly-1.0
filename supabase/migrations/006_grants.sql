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
