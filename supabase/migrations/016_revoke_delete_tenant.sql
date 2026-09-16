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
