-- ============================================================================
-- FROSTLY SEAFOOD COLD-CHAIN ERP
-- Migration 020: User Login Tracking & Feature Usage Telemetry
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. User Login Activity Log Table
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_login_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer',
    organization_name TEXT,
    login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_agent TEXT,
    client_ip TEXT,
    device_type TEXT DEFAULT 'desktop',
    session_status TEXT DEFAULT 'active'
);

-- Index for fast user activity lookups
CREATE INDEX IF NOT EXISTS idx_user_login_logs_org_id ON public.user_login_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_login_logs_user_id ON public.user_login_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_login_logs_login_at ON public.user_login_logs(login_at DESC);

-- Enable RLS
ALTER TABLE public.user_login_logs ENABLE ROW LEVEL SECURITY;

-- Platform admins can view all logins; Tenant staff can view their organization's logins
DROP POLICY IF EXISTS "user_login_logs_select" ON public.user_login_logs;
CREATE POLICY "user_login_logs_select" ON public.user_login_logs
FOR SELECT TO authenticated
USING (
    public.is_platform_admin() 
    OR organization_id = public.current_org_id()
);

-- Authenticated users can insert their own login records
DROP POLICY IF EXISTS "user_login_logs_insert" ON public.user_login_logs;
CREATE POLICY "user_login_logs_insert" ON public.user_login_logs
FOR INSERT TO authenticated
WITH CHECK (
    user_id = auth.uid() 
    OR public.is_platform_admin()
);

GRANT SELECT, INSERT ON public.user_login_logs TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. Feature Usage Telemetry Table
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_feature_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_email TEXT NOT NULL,
    user_name TEXT NOT NULL,
    organization_name TEXT,
    feature_key TEXT NOT NULL,
    feature_name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'operations',
    action_type TEXT NOT NULL DEFAULT 'view',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feature_usage_logs_org ON public.user_feature_usage_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_feature_usage_logs_feature ON public.user_feature_usage_logs(feature_key);
CREATE INDEX IF NOT EXISTS idx_feature_usage_logs_created ON public.user_feature_usage_logs(created_at DESC);

ALTER TABLE public.user_feature_usage_logs ENABLE ROW LEVEL SECURITY;

-- Platform admins can view all feature telemetry; Tenant staff can view their organization's telemetry
DROP POLICY IF EXISTS "user_feature_usage_select" ON public.user_feature_usage_logs;
CREATE POLICY "user_feature_usage_select" ON public.user_feature_usage_logs
FOR SELECT TO authenticated
USING (
    public.is_platform_admin() 
    OR organization_id = public.current_org_id()
);

DROP POLICY IF EXISTS "user_feature_usage_insert" ON public.user_feature_usage_logs;
CREATE POLICY "user_feature_usage_insert" ON public.user_feature_usage_logs
FOR INSERT TO authenticated
WITH CHECK (
    user_id = auth.uid() 
    OR public.is_platform_admin()
);

GRANT SELECT, INSERT ON public.user_feature_usage_logs TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. Platform Admin RPC: Get User Logins
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.platform_get_user_logins(p_limit INT DEFAULT 100)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    organization_id UUID,
    organization_name TEXT,
    email TEXT,
    full_name TEXT,
    role TEXT,
    login_at TIMESTAMPTZ,
    device_type TEXT,
    user_agent TEXT,
    session_status TEXT
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
        l.id,
        l.user_id,
        l.organization_id,
        COALESCE(l.organization_name, o.name, 'Independent Dock') AS organization_name,
        l.email,
        l.full_name,
        l.role,
        l.login_at,
        l.device_type,
        l.user_agent,
        l.session_status
    FROM public.user_login_logs l
    LEFT JOIN public.organizations o ON o.id = l.organization_id
    ORDER BY l.login_at DESC
    LIMIT p_limit;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Platform Admin RPC: Feature Usage Aggregates
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.platform_get_feature_usage_analytics(p_days INT DEFAULT 30)
RETURNS TABLE (
    feature_key TEXT,
    feature_name TEXT,
    category TEXT,
    total_uses BIGINT,
    unique_users_count BIGINT,
    last_used_at TIMESTAMPTZ
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
        f.feature_key,
        f.feature_name,
        f.category,
        COUNT(*)::BIGINT AS total_uses,
        COUNT(DISTINCT f.user_id)::BIGINT AS unique_users_count,
        MAX(f.created_at) AS last_used_at
    FROM public.user_feature_usage_logs f
    WHERE f.created_at >= (NOW() - (p_days || ' days')::INTERVAL)
    GROUP BY f.feature_key, f.feature_name, f.category
    ORDER BY total_uses DESC;
END;
$$;
