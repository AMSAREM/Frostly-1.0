-- Migration: 030_fix_reassign_guard_ids_only.sql
-- Fixes 029, which is currently live and broken in two ways:
--   1. It reads OLD.needs_onboarding, but staff_profiles has no such column (it is a client-side computed flag).
--      PL/pgSQL therefore raises 'record "old" has no field "needs_onboarding"' on EVERY organization change,
--      so even legitimate onboarding out of a placeholder organization fails.
--   2. It decided "placeholder" by tenant-controlled organization NAME (ILIKE '%default%', '%salvation%', ...).
--      Tenant admins can rename their own organization, and real companies can legitimately contain those words,
--      so security must never depend on a name. Placeholder status is decided by fixed sentinel IDs only.

CREATE OR REPLACE FUNCTION public.audit_staff_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF (
        OLD.organization_id IS NOT NULL
        AND NEW.organization_id IS DISTINCT FROM OLD.organization_id
        AND OLD.organization_id NOT IN (
            '00000000-0000-0000-0000-000000000000'::uuid,
            '00000000-0000-0000-0000-000000000001'::uuid
        )
    ) THEN
        RAISE EXCEPTION 'Tenant security violation: Cannot reassign staff profile across organizations';
    END IF;

    IF (OLD.role IS DISTINCT FROM NEW.role) THEN
        INSERT INTO public.staff_role_audit_logs (
            organization_id, target_staff_id, previous_role, new_role, changed_by, reason
        ) VALUES (
            NEW.organization_id, NEW.id, OLD.role, NEW.role,
            COALESCE(auth.uid(), NEW.id),
            'Role updated via administrative interface'
        );
    END IF;
    RETURN NEW;
END;
$$;

-- Trigger functions are never called through the public API.
REVOKE EXECUTE ON FUNCTION public.audit_staff_role_change() FROM public, anon, authenticated;

-- 028 section 2 has not reached the live database: anon can still call platform_* RPCs. Close that here too.
DO $$
DECLARE
  f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'platform\_%' ESCAPE '\'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM public, anon', f.sig);
  END LOOP;

  IF to_regprocedure('public.purge_tenant_data_except_users(text,text)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.purge_tenant_data_except_users(text,text) FROM public, anon;
  END IF;
END;
$$;
