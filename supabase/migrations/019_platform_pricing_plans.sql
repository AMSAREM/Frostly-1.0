-- ============================================================================
-- FROSTLY SEAFOOD COLD-CHAIN ERP
-- Migration 019: Platform Pricing Plans & Dynamic Public Landing Page Pricing
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Create platform_pricing_plans table
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.platform_pricing_plans (
    id TEXT PRIMARY KEY,                       -- e.g. 'starter', 'standard', 'enterprise'
    tier_name TEXT NOT NULL,                  -- e.g. 'Starter Fishery', 'Commercial Fleet'
    tagline TEXT NOT NULL,
    monthly_price_usd NUMERIC NOT NULL,
    annual_price_usd NUMERIC NOT NULL,
    monthly_price_ghs NUMERIC NOT NULL DEFAULT 0,
    annual_price_ghs NUMERIC NOT NULL DEFAULT 0,
    max_staff_seats INTEGER NOT NULL DEFAULT 5,
    is_popular BOOLEAN NOT NULL DEFAULT FALSE,
    badge TEXT,
    features JSONB NOT NULL DEFAULT '[]'::jsonb,
    button_text TEXT NOT NULL DEFAULT 'Start 14-Day Free Trial',
    button_style TEXT NOT NULL DEFAULT 'bg-white text-slate-900 border border-slate-300 hover:bg-slate-50',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

-- Index for public landing page sort
CREATE INDEX IF NOT EXISTS idx_platform_pricing_plans_active_sort 
ON public.platform_pricing_plans(is_active, sort_order);

-- ----------------------------------------------------------------------------
-- 2. Seed Initial Pricing Plans
-- ----------------------------------------------------------------------------

INSERT INTO public.platform_pricing_plans (
    id,
    tier_name,
    tagline,
    monthly_price_usd,
    annual_price_usd,
    monthly_price_ghs,
    annual_price_ghs,
    max_staff_seats,
    is_popular,
    badge,
    features,
    button_text,
    button_style,
    sort_order,
    is_active
) VALUES 
(
    'starter',
    'Starter Fishery',
    'Ideal for independent fishing vessels & single cold-room docks.',
    49,
    39,
    650,
    520,
    5,
    FALSE,
    NULL,
    '[
        "Up to 2 fishing vessels or dock stations",
        "Catch Inward & Weighing with tare deduction",
        "Cold storage lot tracking with basic alerts",
        "Mobile PWA with offline logging",
        "Standard PDF invoices & receipts",
        "Email customer support"
    ]'::jsonb,
    'Start 14-Day Free Trial',
    'bg-white text-slate-900 border border-slate-300 hover:bg-slate-50',
    1,
    TRUE
),
(
    'standard',
    'Commercial Fleet',
    'For commercial seafood processors, wholesalers & fleet managers.',
    149,
    119,
    1950,
    1560,
    20,
    TRUE,
    'Most Popular',
    '[
        "Unlimited vessels, dock stations & staff accounts",
        "Full FSMA 204 & HACCP digital QR passports",
        "Dual fulfillment: Retail Touch POS + B2B Wholesale",
        "AI Catch Intelligence (Frostly Copilot)",
        "Yield recovery & dynamic HOG-to-fillet COGS",
        "Automated AR/AP ledger with customer credit aging",
        "Multi-zone IoT temperature continuous monitoring",
        "Priority 24/7 dockside support"
    ]'::jsonb,
    'Start Commercial Trial',
    'bg-blue-600 hover:bg-blue-700 text-white shadow-md',
    2,
    TRUE
),
(
    'enterprise',
    'Enterprise Processor',
    'Custom infrastructure for multi-terminal processing plants & exporters.',
    399,
    319,
    5200,
    4160,
    9999,
    FALSE,
    NULL,
    '[
        "Multi-facility & multi-port operational clustering",
        "Custom ERP / SAP / NetSuite API integrations",
        "Dedicated isolated database tenancy",
        "Custom hardware catch-weight scale driver protocols",
        "Custom HACCP hazard analysis workflows",
        "Dedicated Technical Account Manager",
        "99.99% uptime Service Level Agreement (SLA)"
    ]'::jsonb,
    'Contact Enterprise Sales',
    'bg-slate-900 hover:bg-slate-800 text-white',
    3,
    TRUE
)
ON CONFLICT (id) DO UPDATE SET
    tier_name = EXCLUDED.tier_name,
    tagline = EXCLUDED.tagline,
    monthly_price_usd = EXCLUDED.monthly_price_usd,
    annual_price_usd = EXCLUDED.annual_price_usd,
    monthly_price_ghs = EXCLUDED.monthly_price_ghs,
    annual_price_ghs = EXCLUDED.annual_price_ghs,
    max_staff_seats = EXCLUDED.max_staff_seats,
    is_popular = EXCLUDED.is_popular,
    badge = EXCLUDED.badge,
    features = EXCLUDED.features,
    button_text = EXCLUDED.button_text,
    button_style = EXCLUDED.button_style,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active;

-- ----------------------------------------------------------------------------
-- 3. Row Level Security & Access Grants
-- ----------------------------------------------------------------------------

ALTER TABLE public.platform_pricing_plans ENABLE ROW LEVEL SECURITY;

-- Anyone (unauthenticated public visitors and authenticated tenant users) can read active plans
DROP POLICY IF EXISTS "platform_pricing_plans_public_read" ON public.platform_pricing_plans;
CREATE POLICY "platform_pricing_plans_public_read" ON public.platform_pricing_plans
FOR SELECT TO anon, authenticated
USING (is_active = TRUE OR public.is_platform_admin());

-- Only platform creators / admins can insert, update or delete pricing plans
DROP POLICY IF EXISTS "platform_pricing_plans_creator_write" ON public.platform_pricing_plans;
CREATE POLICY "platform_pricing_plans_creator_write" ON public.platform_pricing_plans
FOR ALL TO authenticated
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

GRANT SELECT ON public.platform_pricing_plans TO anon, authenticated;
GRANT ALL ON public.platform_pricing_plans TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. RPC Function: Platform Creator Update Pricing Plan with Audit Log
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.platform_save_pricing_plan(
    p_id TEXT,
    p_tier_name TEXT,
    p_tagline TEXT,
    p_monthly_price_usd NUMERIC,
    p_annual_price_usd NUMERIC,
    p_monthly_price_ghs NUMERIC DEFAULT NULL,
    p_annual_price_ghs NUMERIC DEFAULT NULL,
    p_max_staff_seats INTEGER DEFAULT 5,
    p_is_popular BOOLEAN DEFAULT FALSE,
    p_badge TEXT DEFAULT NULL,
    p_features JSONB DEFAULT '[]'::jsonb,
    p_button_text TEXT DEFAULT 'Start 14-Day Free Trial',
    p_button_style TEXT DEFAULT 'bg-white text-slate-900 border border-slate-300 hover:bg-slate-50',
    p_reason TEXT DEFAULT 'Pricing plan updated via Creator Console'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_old_plan RECORD;
    v_new_plan RECORD;
BEGIN
    -- Verify caller is platform admin
    IF NOT public.is_platform_admin() THEN
        RAISE EXCEPTION 'Access Denied: Only verified platform creators may update pricing plans.';
    END IF;

    -- Fetch current state for audit logging
    SELECT * INTO v_old_plan 
    FROM public.platform_pricing_plans 
    WHERE id = p_id;

    -- Upsert plan
    INSERT INTO public.platform_pricing_plans (
        id,
        tier_name,
        tagline,
        monthly_price_usd,
        annual_price_usd,
        monthly_price_ghs,
        annual_price_ghs,
        max_staff_seats,
        is_popular,
        badge,
        features,
        button_text,
        button_style,
        updated_at,
        updated_by
    ) VALUES (
        p_id,
        p_tier_name,
        p_tagline,
        p_monthly_price_usd,
        p_annual_price_usd,
        COALESCE(p_monthly_price_ghs, p_monthly_price_usd * 13),
        COALESCE(p_annual_price_ghs, p_annual_price_usd * 13),
        p_max_staff_seats,
        p_is_popular,
        p_badge,
        p_features,
        p_button_text,
        p_button_style,
        NOW(),
        auth.uid()
    )
    ON CONFLICT (id) DO UPDATE SET
        tier_name = EXCLUDED.tier_name,
        tagline = EXCLUDED.tagline,
        monthly_price_usd = EXCLUDED.monthly_price_usd,
        annual_price_usd = EXCLUDED.annual_price_usd,
        monthly_price_ghs = EXCLUDED.monthly_price_ghs,
        annual_price_ghs = EXCLUDED.annual_price_ghs,
        max_staff_seats = EXCLUDED.max_staff_seats,
        is_popular = EXCLUDED.is_popular,
        badge = EXCLUDED.badge,
        features = EXCLUDED.features,
        button_text = EXCLUDED.button_text,
        button_style = EXCLUDED.button_style,
        updated_at = NOW(),
        updated_by = auth.uid()
    RETURNING * INTO v_new_plan;

    -- Record in platform audit logs
    INSERT INTO public.platform_audit_logs (
        actor_id,
        action,
        previous_state,
        new_state,
        reason,
        created_at
    ) VALUES (
        auth.uid(),
        'UPDATE_PRICING_PLAN',
        CASE WHEN v_old_plan.id IS NOT NULL THEN row_to_json(v_old_plan)::jsonb ELSE NULL END,
        row_to_json(v_new_plan)::jsonb,
        COALESCE(p_reason, 'Pricing updated from Platform Creator console'),
        NOW()
    );

    RETURN row_to_json(v_new_plan)::jsonb;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_save_pricing_plan(TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, INTEGER, BOOLEAN, TEXT, JSONB, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_save_pricing_plan(TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, INTEGER, BOOLEAN, TEXT, JSONB, TEXT, TEXT, TEXT) TO authenticated;
