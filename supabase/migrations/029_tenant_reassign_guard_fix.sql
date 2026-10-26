-- Migration: 029_tenant_reassign_guard_fix.sql
-- Description: Redefine audit_staff_role_change() trigger function so legitimate onboarding
-- moves out of placeholder organizations (e.g., Salvation, Frostly default, zero UUIDs, or unonboarded profiles)
-- are allowed, while cross-organization reassignment between two distinct real tenant workspaces remains strictly blocked.

CREATE OR REPLACE FUNCTION public.audit_staff_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_old_org_name text;
    v_is_placeholder boolean := false;
BEGIN
    -- Only evaluate reassignment if organization_id is changing
    IF (OLD.organization_id IS NOT NULL AND NEW.organization_id IS DISTINCT FROM OLD.organization_id) THEN
        -- Check if OLD organization is a placeholder / default / initial onboarding organization
        IF (
            OLD.organization_id IN (
                '00000000-0000-0000-0000-000000000000'::uuid,
                '00000000-0000-0000-0000-000000000001'::uuid
            )
            OR OLD.needs_onboarding IS TRUE
        ) THEN
            v_is_placeholder := true;
        ELSE
            SELECT name INTO v_old_org_name
            FROM public.organizations
            WHERE id = OLD.organization_id;

            IF (
                v_old_org_name ILIKE '%salvation%'
                OR v_old_org_name ILIKE '%placeholder%'
                OR v_old_org_name ILIKE '%default%'
                OR v_old_org_name ILIKE '%frostly cold-chain operations%'
            ) THEN
                v_is_placeholder := true;
            END IF;
        END IF;

        -- If moving between two distinct, real tenant organizations, block the reassignment
        IF NOT v_is_placeholder THEN
            RAISE EXCEPTION 'Tenant security violation: Cannot reassign staff profile across organizations';
        END IF;
    END IF;

    -- Audit role changes
    IF (OLD.role IS DISTINCT FROM NEW.role) THEN
        INSERT INTO public.staff_role_audit_logs (
            organization_id,
            target_staff_id,
            previous_role,
            new_role,
            changed_by,
            reason
        ) VALUES (
            NEW.organization_id,
            NEW.id,
            OLD.role,
            NEW.role,
            COALESCE(auth.uid(), NEW.id),
            'Role updated via administrative interface'
        );
    END IF;

    RETURN NEW;
END;
$$;
