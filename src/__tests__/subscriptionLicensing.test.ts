import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import * as fs from 'fs';
import * as path from 'path';
import { extractSubscriptionParamsFromEvent } from '../services/stripeWebhook';

describe('Subscription Licensing, Tiered Quotas & RLS Grace Period Contract & Runtime Tests', () => {
  let db: PGlite;

  const MIGRATION_PATH = path.resolve(process.cwd(), 'supabase/migrations/012_subscription_licensing.sql');
  const migrationSql = fs.readFileSync(MIGRATION_PATH, 'utf-8');

  const ORG_TRIAL_ID = '10000000-0000-0000-0000-000000000001';
  const ORG_ACTIVE_ID = '20000000-0000-0000-0000-000000000002';
  const ORG_PASTDUE_ID = '30000000-0000-0000-0000-000000000003';
  const ORG_SUSPENDED_ID = '40000000-0000-0000-0000-000000000004';
  const ORG_EXPIRED_TRIAL_ID = '50000000-0000-0000-0000-000000000005';

  const USER_TRIAL_ADMIN = 'a1000000-0000-0000-0000-000000000001';
  const USER_ACTIVE_ADMIN = 'a2000000-0000-0000-0000-000000000002';
  const USER_PASTDUE_STAFF = 'a3000000-0000-0000-0000-000000000003';
  const USER_SUSPENDED_STAFF = 'a4000000-0000-0000-0000-000000000004';
  const USER_EXPIRED_STAFF = 'a5000000-0000-0000-0000-000000000005';

  beforeAll(async () => {
    db = new PGlite();

    // 1. Setup mock Supabase auth environment
    await db.exec(`
      CREATE SCHEMA IF NOT EXISTS auth;

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

      -- Schema: Organizations
      CREATE TABLE public.organizations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        plan TEXT DEFAULT 'enterprise',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- Schema: App Settings
      CREATE TABLE public.app_settings (
        id INT NOT NULL DEFAULT 1,
        organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
        company_name TEXT,
        facility_code TEXT,
        fda_registration_number TEXT,
        eu_approval_number TEXT,
        tax_rate NUMERIC,
        currency TEXT,
        PRIMARY KEY (organization_id, id)
      );

      -- Schema: Staff Profiles
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

      -- Schema: Invites
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

      -- Schema: Inventory Batches (representative business table)
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

      -- Helper functions
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

    // 2. Apply Migration 012 directly to the database
    await db.exec(migrationSql);

    // 3. Configure RLS on inventory_batches with licensing predicates
    await db.exec(`
      ALTER TABLE public.inventory_batches ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.inventory_batches FORCE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS "inventory_select_licensing" ON public.inventory_batches;
      CREATE POLICY "inventory_select_licensing" ON public.inventory_batches
      FOR SELECT TO authenticated
      USING (organization_id = public.current_org_id() AND public.org_has_read_access());

      DROP POLICY IF EXISTS "inventory_insert_licensing" ON public.inventory_batches;
      CREATE POLICY "inventory_insert_licensing" ON public.inventory_batches
      FOR INSERT TO authenticated
      WITH CHECK (organization_id = public.current_org_id() AND public.org_has_write_access());

      DROP POLICY IF EXISTS "inventory_update_licensing" ON public.inventory_batches;
      CREATE POLICY "inventory_update_licensing" ON public.inventory_batches
      FOR UPDATE TO authenticated
      USING (organization_id = public.current_org_id() AND public.org_has_write_access())
      WITH CHECK (organization_id = public.current_org_id() AND public.org_has_write_access());

      GRANT USAGE ON SCHEMA public TO authenticated;
      GRANT ALL ON public.inventory_batches TO authenticated;
      GRANT ALL ON public.organizations TO authenticated;
      GRANT ALL ON public.staff_profiles TO authenticated;
      GRANT ALL ON public.invites TO authenticated;
    `);

    // 4. Seed test organizations with various licensing states
    await db.exec(`
      -- A: Active 14-day Trial (Starter)
      INSERT INTO public.organizations (id, name, plan_tier, subscription_status, trial_ends_at, max_staff_seats)
      VALUES ('${ORG_TRIAL_ID}', 'Trial Seafood Co', 'starter', 'trial', NOW() + INTERVAL '10 days', 5);

      -- B: Active Paid Subscription (Standard)
      INSERT INTO public.organizations (id, name, plan_tier, subscription_status, current_period_ends_at, max_staff_seats, stripe_customer_id)
      VALUES ('${ORG_ACTIVE_ID}', 'Active Tuna Exporters', 'standard', 'active', NOW() + INTERVAL '30 days', 20, 'cus_active_123');

      -- C: Past Due (14-day read-only audit grace period)
      INSERT INTO public.organizations (id, name, plan_tier, subscription_status, current_period_ends_at, max_staff_seats, stripe_customer_id)
      VALUES ('${ORG_PASTDUE_ID}', 'Past Due Cold Storage', 'standard', 'past_due', NOW() - INTERVAL '2 days', 20, 'cus_pastdue_123');

      -- D: Suspended / Locked out
      INSERT INTO public.organizations (id, name, plan_tier, subscription_status, max_staff_seats, stripe_customer_id)
      VALUES ('${ORG_SUSPENDED_ID}', 'Suspended Logistics', 'starter', 'suspended', 5, 'cus_suspended_123');

      -- E: Expired Trial
      INSERT INTO public.organizations (id, name, plan_tier, subscription_status, trial_ends_at, max_staff_seats)
      VALUES ('${ORG_EXPIRED_TRIAL_ID}', 'Expired Trial Co', 'starter', 'trial', NOW() - INTERVAL '1 day', 5);

      -- Seed Staff Members
      INSERT INTO public.staff_profiles (id, organization_id, email, full_name, role)
      VALUES
        ('${USER_TRIAL_ADMIN}', '${ORG_TRIAL_ID}', 'admin@trial.com', 'Trial Admin', 'admin'),
        ('${USER_ACTIVE_ADMIN}', '${ORG_ACTIVE_ID}', 'admin@active.com', 'Active Admin', 'admin'),
        ('${USER_PASTDUE_STAFF}', '${ORG_PASTDUE_ID}', 'staff@pastdue.com', 'Past Due Staff', 'ops_staff'),
        ('${USER_SUSPENDED_STAFF}', '${ORG_SUSPENDED_ID}', 'staff@suspended.com', 'Suspended Staff', 'ops_staff'),
        ('${USER_EXPIRED_STAFF}', '${ORG_EXPIRED_TRIAL_ID}', 'staff@expired.com', 'Expired Staff', 'ops_staff');

      -- Seed existing batches for Past Due and Suspended orgs to test read-only vs lockout
      INSERT INTO public.inventory_batches (organization_id, id, lot_number, species_name, weight_kg)
      VALUES
        ('${ORG_PASTDUE_ID}', 'b3333333-3333-3333-3333-333333333333', 'LOT-PASTDUE-01', 'Yellowfin Tuna', 450),
        ('${ORG_SUSPENDED_ID}', 'b4444444-4444-4444-4444-444444444444', 'LOT-SUSPENDED-01', 'Atlantic Salmon', 800);
    `);
  });

  afterAll(async () => {
    if (db) {
      await db.close();
    }
  });

  const asUser = async <T>(userId: string, fn: () => Promise<T>): Promise<T> => {
    await db.exec(`
      SET ROLE authenticated;
      SET request.jwt.claim.sub = '${userId}';
    `);
    try {
      return await fn();
    } finally {
      await db.exec(`
        RESET ROLE;
        RESET request.jwt.claim.sub;
      `);
    }
  };

  describe('Part 1: Static DDL & Migration Contract Verification', () => {
    it('migration 012 specifies required columns on organizations', () => {
      expect(migrationSql).toContain('plan_tier');
      expect(migrationSql).toContain('subscription_status');
      expect(migrationSql).toContain('trial_ends_at');
      expect(migrationSql).toContain('max_staff_seats');
      expect(migrationSql).toContain('stripe_customer_id');
      expect(migrationSql).toContain('stripe_subscription_id');
    });

    it('migration 012 creates stripe_webhook_events idempotency journal', () => {
      expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS public.stripe_webhook_events');
      expect(migrationSql).toContain('processed_at');
    });

    it('migration 012 defines org_has_read_access and org_has_write_access predicates', () => {
      expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.org_has_read_access()');
      expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.org_has_write_access()');
    });

    it('migration 012 updates create_organization_and_admin to 14-day starter trial with 5 seats', () => {
      expect(migrationSql).toContain("'starter'");
      expect(migrationSql).toContain("'trial'");
      expect(migrationSql).toContain("INTERVAL '14 days'");
    });

    it('migration 012 enforces seat ceilings in create_invite', () => {
      expect(migrationSql).toContain('Seat limit reached');
      expect(migrationSql).toContain('max_staff_seats');
    });
  });

  describe('Part 2: Runtime RLS Read vs Write Licensing Enforcement', () => {
    it('active trial tenant: can perform both read and write queries', async () => {
      await asUser(USER_TRIAL_ADMIN, async () => {
        // Can insert batch
        await db.exec(`
          INSERT INTO public.inventory_batches (organization_id, id, lot_number, species_name, weight_kg)
          VALUES ('${ORG_TRIAL_ID}', 'b1111111-0000-0000-0000-000000000001', 'LOT-TRIAL-01', 'Skipjack Tuna', 250);
        `);

        // Can read batch
        const res = await db.query<{ lot_number: string }>(
          'SELECT lot_number FROM public.inventory_batches WHERE lot_number = $1;',
          ['LOT-TRIAL-01']
        );
        expect(res.rows.length).toBe(1);
        expect(res.rows[0].lot_number).toBe('LOT-TRIAL-01');
      });
    });

    it('active paid tenant: can perform both read and write queries', async () => {
      await asUser(USER_ACTIVE_ADMIN, async () => {
        // Can insert batch
        await db.exec(`
          INSERT INTO public.inventory_batches (organization_id, id, lot_number, species_name, weight_kg)
          VALUES ('${ORG_ACTIVE_ID}', 'b2222222-0000-0000-0000-000000000002', 'LOT-ACTIVE-01', 'Bigeye Tuna', 700);
        `);

        // Can read batch
        const res = await db.query<{ lot_number: string }>(
          'SELECT lot_number FROM public.inventory_batches WHERE lot_number = $1;',
          ['LOT-ACTIVE-01']
        );
        expect(res.rows.length).toBe(1);
        expect(res.rows[0].lot_number).toBe('LOT-ACTIVE-01');
      });
    });

    it('past_due tenant (grace period): CAN read existing records for audit/HACCP, but CANNOT write/insert new records', async () => {
      await asUser(USER_PASTDUE_STAFF, async () => {
        // 1. READ: Can read the existing lot for FDA/HACCP audit compliance
        const readRes = await db.query<{ lot_number: string; weight_kg: string }>(
          'SELECT lot_number, weight_kg FROM public.inventory_batches WHERE lot_number = $1;',
          ['LOT-PASTDUE-01']
        );
        expect(readRes.rows.length).toBe(1);
        expect(readRes.rows[0].lot_number).toBe('LOT-PASTDUE-01');

        // 2. WRITE: Attempt to insert a new batch MUST be rejected by RLS write predicate
        await expect(
          db.exec(`
            INSERT INTO public.inventory_batches (organization_id, id, lot_number, species_name, weight_kg)
            VALUES ('${ORG_PASTDUE_ID}', 'b3333333-9999-9999-9999-999999999999', 'LOT-PASTDUE-NEW', 'Black Tiger Shrimp', 100);
          `)
        ).rejects.toThrow(/violates row-level security policy/);

        // 3. UPDATE: Attempt to update existing batch MUST be rejected by RLS write predicate
        const updateRes = await db.query(
          "UPDATE public.inventory_batches SET weight_kg = 999 WHERE lot_number = 'LOT-PASTDUE-01';"
        );
        expect(updateRes.affectedRows).toBe(0);
      });
    });

    it('suspended tenant: completely locked out (zero reads, zero writes)', async () => {
      await asUser(USER_SUSPENDED_STAFF, async () => {
        // 1. READ: Blocked - returns 0 rows even though record exists in database
        const readRes = await db.query(
          'SELECT * FROM public.inventory_batches WHERE lot_number = $1;',
          ['LOT-SUSPENDED-01']
        );
        expect(readRes.rows.length).toBe(0);

        // 2. WRITE: Blocked by RLS
        await expect(
          db.exec(`
            INSERT INTO public.inventory_batches (organization_id, id, lot_number, species_name, weight_kg)
            VALUES ('${ORG_SUSPENDED_ID}', 'b4444444-9999-9999-9999-999999999999', 'LOT-SUSPENDED-NEW', 'Mackerel', 50);
          `)
        ).rejects.toThrow(/violates row-level security policy/);
      });
    });

    it('expired trial tenant: completely locked out once trial_ends_at is in the past', async () => {
      await asUser(USER_EXPIRED_STAFF, async () => {
        // 1. READ: Blocked
        const readRes = await db.query('SELECT * FROM public.inventory_batches;');
        expect(readRes.rows.length).toBe(0);

        // 2. WRITE: Blocked
        await expect(
          db.exec(`
            INSERT INTO public.inventory_batches (organization_id, id, lot_number, species_name, weight_kg)
            VALUES ('${ORG_EXPIRED_TRIAL_ID}', 'b5555555-9999-9999-9999-999999999999', 'LOT-EXPIRED-NEW', 'Octopus', 80);
          `)
        ).rejects.toThrow(/violates row-level security policy/);
      });
    });
  });

  describe('Part 3: Staff Seat Ceiling Enforcement in create_invite', () => {
    it('blocks issuing invites when organization reaches max_staff_seats', async () => {
      // Setup an org with max_staff_seats = 2
      const ORG_TINY_ID = '90000000-0000-0000-0000-000000000009';
      const USER_TINY_ADMIN = 'a9000000-0000-0000-0000-000000000009';

      await db.exec(`
        INSERT INTO public.organizations (id, name, plan_tier, subscription_status, max_staff_seats)
        VALUES ('${ORG_TINY_ID}', 'Tiny Wharf Co', 'starter', 'active', 2);

        INSERT INTO public.staff_profiles (id, organization_id, email, full_name, role)
        VALUES ('${USER_TINY_ADMIN}', '${ORG_TINY_ID}', 'admin@tinywharf.com', 'Tiny Admin', 'admin');
      `);

      await asUser(USER_TINY_ADMIN, async () => {
        // Seat 1 is Tiny Admin. Seat 2: Invite first staff member (should succeed)
        const invite1 = await db.query<{ create_invite: { success: boolean; seats_used: number } }>(
          "SELECT public.create_invite('staff1@tinywharf.com', 'ops_staff', 7) AS create_invite;"
        );
        expect(invite1.rows[0].create_invite.success).toBe(true);

        // Seat 3: Attempt to invite another staff member when capacity is 2 (should fail!)
        await expect(
          db.query("SELECT public.create_invite('staff2@tinywharf.com', 'ops_staff', 7);")
        ).rejects.toThrow(/Seat limit reached: Organization has reached its maximum capacity of 2 staff seats/);
      });
    });
  });

  describe('Part 4: Stripe Webhook Idempotency & Lifecycle State Transitions', () => {
    it('correctly maps subscription parameters from Stripe event', () => {
      const sampleEvent = {
        id: 'evt_test_123',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_xyz123',
            customer: 'cus_active_123',
            status: 'past_due',
            current_period_end: 1780000000,
            items: {
              data: [
                {
                  price: {
                    id: 'price_standard_monthly',
                    metadata: { tier: 'standard' },
                  },
                },
              ],
            },
          },
        },
      };

      const params = extractSubscriptionParamsFromEvent(sampleEvent);
      expect(params).not.toBeNull();
      expect(params?.customerId).toBe('cus_active_123');
      expect(params?.status).toBe('past_due');
      expect(params?.planTier).toBe('standard');
    });

    it('webhook processing is strictly idempotent (duplicate events do not re-process)', async () => {
      const eventId = 'evt_idempotency_proof_001';

      // First delivery: processes and updates
      const res1 = await db.query<{ apply_stripe_subscription_update: any }>(
        `SELECT public.apply_stripe_subscription_update(
          $1, 'customer.subscription.updated', 'cus_active_123', 'sub_active_123', 'past_due', 'standard', NOW() + INTERVAL '30 days'
        ) AS apply_stripe_subscription_update;`,
        [eventId]
      );
      expect(res1.rows[0].apply_stripe_subscription_update.status).toBe('updated');
      expect(res1.rows[0].apply_stripe_subscription_update.subscription_status).toBe('past_due');

      // Second delivery (Stripe retry): returns already_processed without error
      const res2 = await db.query<{ apply_stripe_subscription_update: any }>(
        `SELECT public.apply_stripe_subscription_update(
          $1, 'customer.subscription.updated', 'cus_active_123', 'sub_active_123', 'past_due', 'standard', NOW() + INTERVAL '30 days'
        ) AS apply_stripe_subscription_update;`,
        [eventId]
      );
      expect(res2.rows[0].apply_stripe_subscription_update.status).toBe('already_processed');
      expect(res2.rows[0].apply_stripe_subscription_update.event_id).toBe(eventId);

      // Verify org status is past_due
      const orgCheck = await db.query<{ subscription_status: string }>(
        'SELECT subscription_status FROM public.organizations WHERE stripe_customer_id = $1;',
        ['cus_active_123']
      );
      expect(orgCheck.rows[0].subscription_status).toBe('past_due');
    });

    it('invoice.payment_succeeded webhook restores past_due organization back to active', async () => {
      const eventId = 'evt_payment_success_002';

      const res = await db.query<{ apply_stripe_subscription_update: any }>(
        `SELECT public.apply_stripe_subscription_update(
          $1, 'invoice.payment_succeeded', 'cus_active_123', 'sub_active_123', 'active', 'standard', NOW() + INTERVAL '30 days'
        ) AS apply_stripe_subscription_update;`,
        [eventId]
      );
      expect(res.rows[0].apply_stripe_subscription_update.status).toBe('updated');
      expect(res.rows[0].apply_stripe_subscription_update.subscription_status).toBe('active');

      const orgCheck = await db.query<{ subscription_status: string }>(
        'SELECT subscription_status FROM public.organizations WHERE stripe_customer_id = $1;',
        ['cus_active_123']
      );
      expect(orgCheck.rows[0].subscription_status).toBe('active');
    });
  });
});
