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
