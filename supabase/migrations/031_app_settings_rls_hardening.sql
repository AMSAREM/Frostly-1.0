-- ============================================================================
-- Migration 031: App Settings Row-Level Security Hardening & INSERT Permissions
-- ============================================================================
-- Ensures organization administrators have complete, tenant-isolated permissions
-- to both INSERT and UPDATE their organization's configuration row in app_settings.

-- 1. Explicitly grant INSERT privilege on app_settings to authenticated role
GRANT SELECT, INSERT, UPDATE ON public.app_settings TO authenticated;

-- 2. Row Level Security: INSERT policy for tenant administrators
-- Deny-by-default: only active admins can insert, strictly scoped to their own tenant
DROP POLICY IF EXISTS "app_settings_insert" ON public.app_settings;
CREATE POLICY "app_settings_insert" ON public.app_settings
FOR INSERT TO authenticated
WITH CHECK (
    (public.is_admin() OR public.is_platform_admin())
    AND organization_id = public.current_org_id()
    AND public.org_has_write_access()
);

-- 3. Row Level Security: UPDATE policy for tenant administrators
-- Confines mutations strictly to the user's active tenant row
DROP POLICY IF EXISTS "app_settings_update" ON public.app_settings;
CREATE POLICY "app_settings_update" ON public.app_settings
FOR UPDATE TO authenticated
USING (
    (public.is_admin() OR public.is_platform_admin())
    AND organization_id = public.current_org_id()
    AND public.org_has_write_access()
)
WITH CHECK (
    (public.is_admin() OR public.is_platform_admin())
    AND organization_id = public.current_org_id()
    AND public.org_has_write_access()
);
