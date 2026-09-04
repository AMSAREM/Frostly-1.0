import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import * as fs from 'fs';
import * as path from 'path';

describe('Platform Owner / Creator Console Role & RLS Isolation Tests', () => {
  let db: PGlite;

  const MIGRATION_012_PATH = path.resolve(process.cwd(), 'supabase/migrations/012_subscription_licensing.sql');
  const MIGRATION_013_PATH = path.resolve(process.cwd(), 'supabase/migrations/013_paystack_dual_billing.sql');
  const MIGRATION_014_PATH = path.resolve(process.cwd(), 'supabase/migrations/014_platform_admin_console.sql');

  const migration012Sql = fs.readFileSync(MIGRATION_012_PATH, 'utf-8');
  const migration013Sql = fs.readFileSync(MIGRATION_013_PATH, 'utf-8');
  const migration014Sql = fs.readFileSync(MIGRATION_014_PATH, 'utf-8');

  // Test identities
  const PLATFORM_OWNER_ID = '11111111-1111-1111-1111-111111111111';
  const TENANT_A_ADMIN_ID = '22222222-2222-2222-2222-222222222222';
  const TENANT_B_ADMIN_ID = '33333333-3333-3333-3333-333333333333';

  const ORG_A_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const ORG_B_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  const setActor = async (userId: string | null) => {
    if (userId) {
      await db.exec(`SET request.jwt.claim.sub = '${userId}';`);
    } else {
      await db.exec(`SET request.jwt.claim.sub = '';`);
    }
  };

  beforeAll(async () => {
    db = new PGlite();

    // 1. Base auth & schema setup matching Supabase multi-tenant environment
    await db.exec(`
      CREATE SCHEMA IF NOT EXISTS auth;

      CREATE TABLE IF NOT EXISTS auth.users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      INSERT INTO auth.users (id, email) VALUES
        ('${PLATFORM_OWNER_ID}', 'owner@frostly.io'),
        ('${TENANT_A_ADMIN_ID}', 'admin@tema-fisheries.gh'),
        ('${TENANT_B_ADMIN_ID}', 'admin@atlantic-cold.com');

      CREATE OR REPLACE FUNCTION auth.uid()
      RETURNS UUID
      LANGUAGE sql
      STABLE
      AS $$
        SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;

      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
          CREATE ROLE authenticated NOLOGIN;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'staff_role') THEN
          CREATE TYPE public.staff_role AS ENUM ('admin', 'ops_staff', 'sales_staff', 'dispatch_staff', 'viewer');
        END IF;
      END
      $$;

      CREATE TABLE public.organizations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        plan TEXT DEFAULT 'enterprise',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE public.app_settings (
        id INT NOT NULL DEFAULT 1,
        organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
        company_name TEXT,
        currency TEXT NOT NULL DEFAULT 'GHS',
        PRIMARY KEY (organization_id, id)
      );

      CREATE TABLE public.staff_profiles (
        id UUID NOT NULL,
        organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'ops_staff',
        department TEXT NOT NULL DEFAULT 'Operations',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (organization_id, id)
      );

      CREATE TABLE public.invites (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'viewer',
        token TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE public.customers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
        company_name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE public.inventory_batches (
        organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
        id UUID NOT NULL,
        lot_number TEXT NOT NULL,
        species_name TEXT NOT NULL,
        weight_kg NUMERIC NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'in_storage',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (organization_id, id)
      );

      CREATE OR REPLACE FUNCTION public.current_org_id()
      RETURNS UUID
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      AS $$
        SELECT organization_id FROM public.staff_profiles
        WHERE id = auth.uid() AND is_active = TRUE
        LIMIT 1;
      $$;

      CREATE OR REPLACE FUNCTION public.is_admin()
      RETURNS BOOLEAN
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      AS $$
        SELECT EXISTS (
          SELECT 1 FROM public.staff_profiles
          WHERE id = auth.uid() AND is_active = TRUE AND role = 'admin'
        );
      $$;

      CREATE OR REPLACE FUNCTION public.is_ops_or_admin()
      RETURNS BOOLEAN
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      AS $$
        SELECT EXISTS (
          SELECT 1 FROM public.staff_profiles
          WHERE id = auth.uid() AND is_active = TRUE AND role IN ('admin', 'ops_staff')
        );
      $$;

      CREATE OR REPLACE FUNCTION public.is_sales_or_admin()
      RETURNS BOOLEAN
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      AS $$
        SELECT EXISTS (
          SELECT 1 FROM public.staff_profiles
          WHERE id = auth.uid() AND is_active = TRUE AND role IN ('admin', 'sales_staff')
        );
      $$;

      CREATE OR REPLACE FUNCTION public.is_dispatch_or_admin()
      RETURNS BOOLEAN
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      AS $$
        SELECT EXISTS (
          SELECT 1 FROM public.staff_profiles
          WHERE id = auth.uid() AND is_active = TRUE AND role IN ('admin', 'dispatch_staff')
        );
      $$;

      CREATE OR REPLACE FUNCTION public.is_staff()
      RETURNS BOOLEAN
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      AS $$
        SELECT EXISTS (
          SELECT 1 FROM public.staff_profiles
          WHERE id = auth.uid() AND is_active = TRUE
        );
      $$;

      CREATE OR REPLACE FUNCTION public.stamp_organization_id()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      AS $$
      DECLARE
        v_org_id UUID;
      BEGIN
        v_org_id := public.current_org_id();
        IF v_org_id IS NOT NULL THEN
          NEW.organization_id := v_org_id;
        ELSIF NEW.organization_id IS NULL THEN
          RAISE EXCEPTION 'Tenant security violation: No active organization associated with authenticated user';
        END IF;
        RETURN NEW;
      END;
      $$;

      CREATE TRIGGER trg_stamp_org_inventory
      BEFORE INSERT ON public.inventory_batches
      FOR EACH ROW EXECUTE FUNCTION public.stamp_organization_id();
    `);

    // 2. Execute Migrations 012, 013, 014
    await db.exec(migration012Sql);
    await db.exec(migration013Sql);
    await db.exec(migration014Sql);

    // Grant public schema privileges to authenticated role (mirrors Supabase default grants in migration 006)
    await db.exec(`
      GRANT USAGE ON SCHEMA public TO authenticated;
      GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
      GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

      ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.organizations FORCE ROW LEVEL SECURITY;

      ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.customers FORCE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS "customers_select" ON public.customers;
      CREATE POLICY "customers_select" ON public.customers
      FOR SELECT TO authenticated
      USING (public.is_staff() AND organization_id = public.current_org_id());

      ALTER TABLE public.inventory_batches ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.inventory_batches FORCE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS "inventory_select" ON public.inventory_batches;
      CREATE POLICY "inventory_select" ON public.inventory_batches
      FOR SELECT TO authenticated
      USING (public.is_staff() AND organization_id = public.current_org_id());
    `);

    // 3. Seed Organizations & Staff
    await db.exec(`
      -- Org A
      INSERT INTO public.organizations (id, name, subscription_status, plan_tier, max_staff_seats, billing_provider, billing_currency)
      VALUES ('${ORG_A_ID}', 'Tema Coastal Wharf', 'trial', 'starter', 5, 'none', 'GHS');

      INSERT INTO public.app_settings (id, organization_id, company_name, currency)
      VALUES (1, '${ORG_A_ID}', 'Tema Coastal Wharf Ltd', 'GHS');

      INSERT INTO public.staff_profiles (id, organization_id, email, full_name, role, is_active)
      VALUES ('${TENANT_A_ADMIN_ID}', '${ORG_A_ID}', 'admin@tema-fisheries.gh', 'Kofi Mensah', 'admin', true);

      -- Org B
      INSERT INTO public.organizations (id, name, subscription_status, plan_tier, max_staff_seats, billing_provider, billing_currency)
      VALUES ('${ORG_B_ID}', 'Atlantic Cold Chain', 'active', 'standard', 20, 'stripe', 'USD');

      INSERT INTO public.app_settings (id, organization_id, company_name, currency)
      VALUES (1, '${ORG_B_ID}', 'Atlantic Cold Chain Inc', 'USD');

      INSERT INTO public.staff_profiles (id, organization_id, email, full_name, role, is_active)
      VALUES ('${TENANT_B_ADMIN_ID}', '${ORG_B_ID}', 'admin@atlantic-cold.com', 'Sarah Connor', 'admin', true);

      -- Seed tenant operational data (Customers and Batches)
      INSERT INTO public.customers (id, organization_id, company_name)
      VALUES ('ca000000-0000-0000-0000-000000000001', '${ORG_A_ID}', 'Secret Tuna Buyer GH');

      INSERT INTO public.inventory_batches (id, organization_id, lot_number, species_name, weight_kg, status)
      VALUES ('ba000000-0000-0000-0000-000000000001', '${ORG_A_ID}', 'LOT-TEMA-001', 'Yellowfin Tuna', 4500, 'in_storage');

      -- 4. Seed Platform Admin (Manual insertion as required by Senior DevOps specification)
      INSERT INTO public.platform_admins (user_id, notes)
      VALUES ('${PLATFORM_OWNER_ID}', 'Chief Platform Operator');
    `);
  });

  afterAll(async () => {
    if (db) {
      await db.close();
    }
  });

  // --------------------------------------------------------------------------
  // SECTION 1: Privilege Escalation & Access Control
  // --------------------------------------------------------------------------
  describe('Security & Privilege Escalation Protection', () => {
    it('verifies is_platform_admin() returns true ONLY for platform admins', async () => {
      await setActor(PLATFORM_OWNER_ID);
      const resOwner = await db.query<{ is_platform_admin: boolean }>(`SELECT public.is_platform_admin();`);
      expect(resOwner.rows[0].is_platform_admin).toBe(true);

      await setActor(TENANT_A_ADMIN_ID);
      const resTenant = await db.query<{ is_platform_admin: boolean }>(`SELECT public.is_platform_admin();`);
      expect(resTenant.rows[0].is_platform_admin).toBe(false);
    });

    it('rejects client direct INSERT into platform_admins (no RLS insert policy)', async () => {
      await setActor(TENANT_A_ADMIN_ID);
      await db.exec(`SET ROLE authenticated;`);

      // Attempt privilege escalation: tenant admin tries to insert themselves into platform_admins
      await expect(
        db.exec(`INSERT INTO public.platform_admins (user_id, notes) VALUES ('${TENANT_A_ADMIN_ID}', 'Hacked');`)
      ).rejects.toThrow(/violates row-level security policy/i);

      await db.exec(`RESET ROLE;`);
    });

    it('denies non-platform-admin from calling platform_update_organization_subscription', async () => {
      await setActor(TENANT_A_ADMIN_ID);

      await expect(
        db.query(`
          SELECT public.platform_update_organization_subscription(
            '${ORG_A_ID}',
            'active',
            'enterprise',
            9999,
            NULL,
            'Attempted unauthorized self-upgrade'
          );
        `)
      ).rejects.toThrow(/Access denied: caller is not a verified platform administrator/i);
    });

    it('denies non-platform-admin from calling platform_list_organizations', async () => {
      await setActor(TENANT_A_ADMIN_ID);

      await expect(
        db.query(`SELECT * FROM public.platform_list_organizations();`)
      ).rejects.toThrow(/Access denied: caller is not a verified platform administrator/i);
    });

    it('ensures tenant admin sees ONLY their own organization in public.organizations', async () => {
      await setActor(TENANT_A_ADMIN_ID);
      await db.exec(`SET ROLE authenticated;`);

      const res = await db.query<any>(`SELECT id, name FROM public.organizations;`);
      expect(res.rows.length).toBe(1);
      expect(res.rows[0].id).toBe(ORG_A_ID);

      await db.exec(`RESET ROLE;`);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 2: Platform Admin Super-Visibility on Organizations
  // --------------------------------------------------------------------------
  describe('Platform Creator Console Discovery & Multi-Tenant Visibility', () => {
    it('allows platform admin to see ALL tenant organizations via RLS', async () => {
      await setActor(PLATFORM_OWNER_ID);
      await db.exec(`SET ROLE authenticated;`);

      const res = await db.query<any>(`SELECT id, name FROM public.organizations ORDER BY name ASC;`);
      expect(res.rows.length).toBe(2);
      const ids = res.rows.map(r => r.id);
      expect(ids).toContain(ORG_A_ID);
      expect(ids).toContain(ORG_B_ID);

      await db.exec(`RESET ROLE;`);
    });

    it('executes platform_list_organizations RPC and returns enriched metrics', async () => {
      await setActor(PLATFORM_OWNER_ID);

      const res = await db.query<any>(`SELECT * FROM public.platform_list_organizations();`);
      expect(res.rows.length).toBe(2);

      const orgA = res.rows.find(r => r.id === ORG_A_ID);
      expect(orgA).toBeDefined();
      expect(orgA.company_name).toBe('Tema Coastal Wharf Ltd');
      expect(orgA.subscription_status).toBe('trial');
      expect(orgA.plan_tier).toBe('starter');
      expect(Number(orgA.staff_count)).toBe(1); // Kofi Mensah
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 3: Least-Privilege Isolation Barrier (Zero Ambient Operational Leak)
  // --------------------------------------------------------------------------
  describe('Strict Least-Privilege Isolation on Operational Business Data', () => {
    it('CONFIRMS platform owner CANNOT read tenant customers or inventory batches', async () => {
      // Platform owner has NO staff_profile in Org A or Org B
      await setActor(PLATFORM_OWNER_ID);
      await db.exec(`SET ROLE authenticated;`);

      // 1. Querying customers
      const custRes = await db.query<any>(`SELECT * FROM public.customers;`);
      expect(custRes.rows.length).toBe(0); // Zero ambient leak!

      // 2. Querying inventory batches
      const batchRes = await db.query<any>(`SELECT * FROM public.inventory_batches;`);
      expect(batchRes.rows.length).toBe(0); // Zero ambient leak!

      await db.exec(`RESET ROLE;`);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 4: Manual Billing Activation & Audit Logging
  // --------------------------------------------------------------------------
  describe('Manual Billing Updates & Immutable Platform Audit Logging', () => {
    it('allows platform admin to manually activate an organization and upgrade plan tier', async () => {
      await setActor(PLATFORM_OWNER_ID);

      const res = await db.query<{ platform_update_organization_subscription: any }>(`
        SELECT public.platform_update_organization_subscription(
          '${ORG_A_ID}',
          'active',
          'standard',
          20,
          NULL,
          'Direct MoMo payment of GH₵3,800 received from Managing Director'
        ) as platform_update_organization_subscription;
      `);

      const result = res.rows[0].platform_update_organization_subscription;
      expect(result.success).toBe(true);
      expect(result.subscription_status).toBe('active');
      expect(result.plan_tier).toBe('standard');
      expect(result.max_staff_seats).toBe(20);

      // Verify org in DB
      const checkOrg = await db.query<any>(`
        SELECT subscription_status, plan_tier, max_staff_seats FROM public.organizations WHERE id = '${ORG_A_ID}';
      `);
      expect(checkOrg.rows[0].subscription_status).toBe('active');
      expect(checkOrg.rows[0].plan_tier).toBe('standard');
      expect(checkOrg.rows[0].max_staff_seats).toBe(20);
    });

    it('verifies immutable audit entry written to platform_audit_logs with before & after state diff', async () => {
      await setActor(PLATFORM_OWNER_ID);
      await db.exec(`SET ROLE authenticated;`);

      const auditRes = await db.query<any>(`
        SELECT actor_id, action, target_organization_id, previous_state, new_state, reason
        FROM public.platform_audit_logs
        WHERE target_organization_id = '${ORG_A_ID}';
      `);

      expect(auditRes.rows.length).toBe(1);
      const entry = auditRes.rows[0];
      expect(entry.actor_id).toBe(PLATFORM_OWNER_ID);
      expect(entry.action).toBe('manual_subscription_update');
      expect(entry.reason).toContain('Direct MoMo payment');
      expect(entry.previous_state.subscription_status).toBe('trial');
      expect(entry.previous_state.plan_tier).toBe('starter');
      expect(entry.new_state.subscription_status).toBe('active');
      expect(entry.new_state.plan_tier).toBe('standard');

      await db.exec(`RESET ROLE;`);
    });

    it('denies client direct tampering or insertion into platform_audit_logs', async () => {
      await setActor(TENANT_A_ADMIN_ID);
      await db.exec(`SET ROLE authenticated;`);

      await expect(
        db.exec(`
          INSERT INTO public.platform_audit_logs (actor_id, action, reason)
          VALUES ('${TENANT_A_ADMIN_ID}', 'forged_action', 'illegal tampering');
        `)
      ).rejects.toThrow(/violates row-level security policy|permission denied/i);

      await db.exec(`RESET ROLE;`);
    });

    it('allows platform admin to suspend an organization', async () => {
      await setActor(PLATFORM_OWNER_ID);

      const res = await db.query<{ platform_update_organization_subscription: any }>(`
        SELECT public.platform_update_organization_subscription(
          '${ORG_A_ID}',
          'suspended',
          'standard',
          20,
          NULL,
          'Account suspended pending proof of fisheries license renewal'
        ) as platform_update_organization_subscription;
      `);

      const result = res.rows[0].platform_update_organization_subscription;
      expect(result.subscription_status).toBe('suspended');

      const checkOrg = await db.query<any>(`
        SELECT subscription_status FROM public.organizations WHERE id = '${ORG_A_ID}';
      `);
      expect(checkOrg.rows[0].subscription_status).toBe('suspended');
    });
  });
});
