-- Migration: 028_security_hardening.sql
-- Description: Security hardening for Supabase:
-- 1. Restrict dangerous functions to service_role only
-- 2. Revoke anon execution on all platform_* functions
-- 3. Allow authenticated users to view their own staff profile even when inactive

-- 1. Revoke public/anon/authenticated execution on dangerous bootstrap and billing functions
revoke execute on function public.bootstrap_platform_creator(text,text,text) from public, anon, authenticated;
revoke execute on function public.apply_stripe_subscription_update(text,text,text,text,text,text,timestamptz) from public, anon, authenticated;
revoke execute on function public.apply_paystack_subscription_update(text,text,text,text,text,text,timestamptz) from public, anon, authenticated;

grant execute on function public.bootstrap_platform_creator(text,text,text) to service_role;
grant execute on function public.apply_stripe_subscription_update(text,text,text,text,text,text,timestamptz) to service_role;
grant execute on function public.apply_paystack_subscription_update(text,text,text,text,text,text,timestamptz) to service_role;

-- 2. Revoke execute from anon on all platform_* functions dynamically based on actual schema signatures
do $$
declare
  func_rec record;
begin
  for func_rec in (
    select r.routine_schema, r.routine_name,
           pg_catalog.pg_get_function_identity_arguments(p.oid) as args
    from information_schema.routines r
    join pg_catalog.pg_namespace n on n.nspname = r.routine_schema
    join pg_catalog.pg_proc p on p.proname = r.routine_name and p.pronamespace = n.oid
    where r.routine_schema = 'public' and r.routine_name like 'platform_%'
  ) loop
    begin
      execute format('revoke execute on function %I.%I(%s) from anon;', 
        func_rec.routine_schema, func_rec.routine_name, func_rec.args);
    exception when others then
      raise notice 'Could not revoke execute on %.%(%): %',
        func_rec.routine_schema, func_rec.routine_name, func_rec.args, sqlerrm;
    end;
  end loop;
end;
$$;

-- 3. Add select policy so authenticated users can read their own staff profile even when inactive
drop policy if exists staff_profiles_select_self on public.staff_profiles;
create policy staff_profiles_select_self on public.staff_profiles
for select to authenticated using (id = auth.uid());
