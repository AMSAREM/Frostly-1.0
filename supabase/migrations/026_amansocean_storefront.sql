-- ============================================================================
-- FROSTLY SEAFOOD COLD-CHAIN ERP & AMANSOCEAN D2C STOREFRONT
-- Migration 026: Public Storefront Orders, Favorites, Newsletter, Feedbacks & Funnel Telemetry
-- ============================================================================

-- 1. Online Storefront Orders (Customer-Facing Cold-Chain Fulfillment & Tracking)
CREATE TABLE IF NOT EXISTS public.storefront_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT NOT NULL UNIQUE, -- e.g. 'AO-10482'
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    customer_email TEXT,
    delivery_address TEXT NOT NULL,
    delivery_notes TEXT,
    subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
    delivery_fee NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
    total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
    payment_method TEXT NOT NULL DEFAULT 'Cash / Mobile Money on Delivery',
    fulfillment_status TEXT NOT NULL DEFAULT 'confirmed'
        CHECK (fulfillment_status IN ('confirmed', 'packing', 'out_for_delivery', 'delivered', 'canceled')),
    linked_erp_order_id TEXT,
    linked_retail_tx_id TEXT,
    visitor_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_storefront_orders_org ON public.storefront_orders(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_storefront_orders_number ON public.storefront_orders(order_number);

-- 2. Online Storefront Order Line Items
CREATE TABLE IF NOT EXISTS public.storefront_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storefront_order_id UUID NOT NULL REFERENCES public.storefront_orders(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
    line_total NUMERIC(12, 2) NOT NULL CHECK (line_total >= 0),
    weight_label TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_storefront_order_items_order ON public.storefront_order_items(storefront_order_id);

-- 3. Persistent Storefront Favorites (Visitor UUID + Optional Authenticated User Link)
CREATE TABLE IF NOT EXISTS public.storefront_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    visitor_id TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    product_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_storefront_favorites_visitor_product UNIQUE (organization_id, visitor_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_storefront_favorites_visitor ON public.storefront_favorites(organization_id, visitor_id);
CREATE INDEX IF NOT EXISTS idx_storefront_favorites_user ON public.storefront_favorites(user_id) WHERE user_id IS NOT NULL;

-- 4. Storefront Fresh Catch Alerts Newsletter Subscribers
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'storefront_footer',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    subscribed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_newsletter_org_email UNIQUE (organization_id, email)
);

CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_org ON public.newsletter_subscribers(organization_id, subscribed_at DESC);

-- 5. Customer & Operator Feedbacks Table
CREATE TABLE IF NOT EXISTS public.feedbacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    rating INT NOT NULL DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
    category TEXT NOT NULL DEFAULT 'General',
    message TEXT NOT NULL,
    name TEXT,
    email TEXT,
    user_agent TEXT,
    ip TEXT,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'resolved')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedbacks_created_at ON public.feedbacks(created_at DESC);

-- 6. Storefront Visitor & Conversion Funnel Telemetry Events
CREATE TABLE IF NOT EXISTS public.storefront_analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    visitor_id TEXT NOT NULL,
    session_id TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'page_view',
        'product_search',
        'favorite_toggle',
        'add_to_cart',
        'begin_checkout',
        'order_completed',
        'newsletter_signup'
    )),
    product_id TEXT,
    product_name TEXT,
    cart_value NUMERIC(12, 2),
    device_type TEXT NOT NULL DEFAULT 'desktop',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_storefront_events_org_created ON public.storefront_analytics_events(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_storefront_events_type ON public.storefront_analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_storefront_events_visitor ON public.storefront_analytics_events(visitor_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Public storefront mutations execute via server-validated endpoints using service_role.
-- Authenticated tenant operators and platform administrators receive scoped access.
-- ============================================================================

ALTER TABLE public.storefront_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storefront_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storefront_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storefront_analytics_events ENABLE ROW LEVEL SECURITY;

-- Storefront Orders: Tenant staff read/update own org; Platform Admin reads all
DROP POLICY IF EXISTS "storefront_orders_select" ON public.storefront_orders;
CREATE POLICY "storefront_orders_select" ON public.storefront_orders
FOR SELECT TO authenticated
USING (organization_id = public.current_org_id() OR public.is_platform_admin());

DROP POLICY IF EXISTS "storefront_orders_update" ON public.storefront_orders;
CREATE POLICY "storefront_orders_update" ON public.storefront_orders
FOR UPDATE TO authenticated
USING (organization_id = public.current_org_id() OR public.is_platform_admin())
WITH CHECK (organization_id = public.current_org_id() OR public.is_platform_admin());

-- Storefront Order Items: Tenant staff read own org; Platform Admin reads all
DROP POLICY IF EXISTS "storefront_order_items_select" ON public.storefront_order_items;
CREATE POLICY "storefront_order_items_select" ON public.storefront_order_items
FOR SELECT TO authenticated
USING (organization_id = public.current_org_id() OR public.is_platform_admin());

-- Storefront Favorites: Tenant staff & Platform Admin read
DROP POLICY IF EXISTS "storefront_favorites_select" ON public.storefront_favorites;
CREATE POLICY "storefront_favorites_select" ON public.storefront_favorites
FOR SELECT TO authenticated
USING (organization_id = public.current_org_id() OR public.is_platform_admin() OR user_id = auth.uid());

-- Newsletter Subscribers: Tenant staff & Platform Admin read
DROP POLICY IF EXISTS "newsletter_subscribers_select" ON public.newsletter_subscribers;
CREATE POLICY "newsletter_subscribers_select" ON public.newsletter_subscribers
FOR SELECT TO authenticated
USING (organization_id = public.current_org_id() OR public.is_platform_admin());

-- Feedbacks: Platform Admin & Tenant Admin read
DROP POLICY IF EXISTS "feedbacks_select" ON public.feedbacks;
CREATE POLICY "feedbacks_select" ON public.feedbacks
FOR SELECT TO authenticated
USING (public.is_platform_admin() OR organization_id = public.current_org_id());

-- Storefront Analytics Events: Platform Admin & Tenant staff read
DROP POLICY IF EXISTS "storefront_analytics_select" ON public.storefront_analytics_events;
CREATE POLICY "storefront_analytics_select" ON public.storefront_analytics_events
FOR SELECT TO authenticated
USING (public.is_platform_admin() OR organization_id = public.current_org_id());

GRANT SELECT, UPDATE ON public.storefront_orders TO authenticated;
GRANT SELECT ON public.storefront_order_items TO authenticated;
GRANT SELECT ON public.storefront_favorites TO authenticated;
GRANT SELECT ON public.newsletter_subscribers TO authenticated;
GRANT SELECT ON public.feedbacks TO authenticated;
GRANT SELECT ON public.storefront_analytics_events TO authenticated;
