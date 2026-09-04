import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';
import { 
  verifyPaystackSignature, 
  extractPaystackSubscriptionEvent,
  mapPaystackPlanToTier,
  PaystackWebhookPayload 
} from '../services/paystackWebhook';

describe('Paystack Mobile Money & Card Licensing Integration Tests', () => {
  let db: PGlite;

  const MIGRATION_012_PATH = path.resolve(process.cwd(), 'supabase/migrations/012_subscription_licensing.sql');
  const MIGRATION_013_PATH = path.resolve(process.cwd(), 'supabase/migrations/013_paystack_dual_billing.sql');

  const migration012Sql = fs.readFileSync(MIGRATION_012_PATH, 'utf-8');
  const migration013Sql = fs.readFileSync(MIGRATION_013_PATH, 'utf-8');

  const TEST_SECRET = 'sk_test_paystack_secret_key_12345';
  const ORG_GHANA_ID = '90000000-0000-0000-0000-000000000001';
  const CUSTOMER_CODE = 'CUS_ghana_wharf_01';
  const SUB_CODE = 'SUB_momo_recurring_01';

  beforeAll(async () => {
    db = new PGlite();

    // 1. Base auth & schema setup matching Supabase multi-tenant environment
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

    // 2. Execute Migration 012 & Migration 013
    await db.exec(migration012Sql);
    await db.exec(migration013Sql);

    // 3. Seed test Ghanaian organization
    await db.exec(`
      INSERT INTO public.organizations (
        id, name, subscription_status, plan_tier, max_staff_seats, paystack_customer_code, billing_provider, billing_currency
      ) VALUES (
        '${ORG_GHANA_ID}', 'Tema Coastal Fisheries Ltd', 'trial', 'starter', 5, '${CUSTOMER_CODE}', 'none', 'GHS'
      );
    `);
  });

  afterAll(async () => {
    if (db) {
      await db.close();
    }
  });

  // --------------------------------------------------------------------------
  // SECTION 1: Webhook Cryptographic Signature Verification
  // --------------------------------------------------------------------------
  describe('Paystack Webhook HMAC-SHA512 Verification', () => {
    it('accepts a valid HMAC-SHA512 signature', () => {
      const payload = JSON.stringify({ event: 'charge.success', data: { id: 12345 } });
      const validSignature = crypto
        .createHmac('sha512', TEST_SECRET)
        .update(payload)
        .digest('hex');

      const isValid = verifyPaystackSignature(payload, validSignature, TEST_SECRET);
      expect(isValid).toBe(true);
    });

    it('rejects tampered payload content', () => {
      const payload = JSON.stringify({ event: 'charge.success', data: { id: 12345 } });
      const tamperedPayload = JSON.stringify({ event: 'charge.success', data: { id: 99999 } });
      const signature = crypto
        .createHmac('sha512', TEST_SECRET)
        .update(payload)
        .digest('hex');

      const isValid = verifyPaystackSignature(tamperedPayload, signature, TEST_SECRET);
      expect(isValid).toBe(false);
    });

    it('rejects mismatched secret key', () => {
      const payload = JSON.stringify({ event: 'charge.success', data: { id: 12345 } });
      const signature = crypto
        .createHmac('sha512', 'wrong_secret_key')
        .update(payload)
        .digest('hex');

      const isValid = verifyPaystackSignature(payload, signature, TEST_SECRET);
      expect(isValid).toBe(false);
    });

    it('rejects missing or empty signature header', () => {
      const payload = JSON.stringify({ event: 'charge.success', data: { id: 12345 } });
      expect(verifyPaystackSignature(payload, '', TEST_SECRET)).toBe(false);
      expect(verifyPaystackSignature(payload, null, TEST_SECRET)).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 2: Payload Event Normalization & Tier Mapping
  // --------------------------------------------------------------------------
  describe('Payload Normalization & Plan Tier Mapping', () => {
    it('maps Ghanaian plan codes to internal tiers', () => {
      expect(mapPaystackPlanToTier('PLN_frostly_starter_ghs')).toBe('starter');
      expect(mapPaystackPlanToTier('PLN_frostly_standard_ghs')).toBe('standard');
      expect(mapPaystackPlanToTier('PLN_frostly_enterprise_ghs')).toBe('enterprise');
      expect(mapPaystackPlanToTier('Custom Plan', 'standard')).toBe('standard');
      expect(mapPaystackPlanToTier('Unknown Plan')).toBe('starter');
    });

    it('extracts active subscription on charge.success', () => {
      const payload: PaystackWebhookPayload = {
        event: 'charge.success',
        data: {
          reference: 'ref_momo_tx_101',
          customer: { customer_code: CUSTOMER_CODE, email: 'billing@temafish.gh' },
          plan: { plan_code: 'PLN_frostly_standard_ghs', name: 'Standard Processing' },
          subscription_code: SUB_CODE,
          channel: 'mobile_money',
          next_payment_date: '2026-10-04T00:00:00Z',
        },
      };

      const extracted = extractPaystackSubscriptionEvent(payload);
      expect(extracted).not.toBeNull();
      expect(extracted?.status).toBe('active');
      expect(extracted?.planTier).toBe('standard');
      expect(extracted?.customerCode).toBe(CUSTOMER_CODE);
      expect(extracted?.subscriptionCode).toBe(SUB_CODE);
    });

    it('extracts past_due grace status on invoice.payment_failed (Mobile Money debit failed)', () => {
      const payload: PaystackWebhookPayload = {
        event: 'invoice.payment_failed',
        data: {
          reference: 'ref_momo_fail_202',
          customer: { customer_code: CUSTOMER_CODE },
          plan: { plan_code: 'PLN_frostly_standard_ghs' },
          subscription_code: SUB_CODE,
        },
      };

      const extracted = extractPaystackSubscriptionEvent(payload);
      expect(extracted?.status).toBe('past_due');
    });

    it('extracts suspended status on subscription.disable', () => {
      const payload: PaystackWebhookPayload = {
        event: 'subscription.disable',
        data: {
          reference: 'ref_momo_disable_303',
          customer: { customer_code: CUSTOMER_CODE },
          subscription_code: SUB_CODE,
        },
      };

      const extracted = extractPaystackSubscriptionEvent(payload);
      expect(extracted?.status).toBe('suspended');
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 3: Database RPC Idempotency & State Synchronization
  // --------------------------------------------------------------------------
  describe('apply_paystack_subscription_update RPC Execution in PostgreSQL', () => {
    it('activates standard plan and updates seat quota to 20', async () => {
      const res = await db.query<{ apply_paystack_subscription_update: any }>(`
        SELECT public.apply_paystack_subscription_update(
          'evt_momo_success_001',
          'charge.success',
          '${CUSTOMER_CODE}',
          '${SUB_CODE}',
          'active',
          'standard',
          '2026-10-01 00:00:00+00'::TIMESTAMPTZ
        ) as apply_paystack_subscription_update;
      `);

      const result = res.rows[0].apply_paystack_subscription_update;
      expect(result.status).toBe('updated');
      expect(result.subscription_status).toBe('active');
      expect(result.plan_tier).toBe('standard');
      expect(result.max_staff_seats).toBe(20);
      expect(result.billing_provider).toBe('paystack');

      // Verify organization record in DB
      const orgRes = await db.query<any>(`
        SELECT subscription_status, plan_tier, max_staff_seats, billing_provider, billing_currency, paystack_subscription_code
        FROM public.organizations
        WHERE id = '${ORG_GHANA_ID}';
      `);

      const org = orgRes.rows[0];
      expect(org.subscription_status).toBe('active');
      expect(org.plan_tier).toBe('standard');
      expect(org.max_staff_seats).toBe(20);
      expect(org.billing_provider).toBe('paystack');
      expect(org.billing_currency).toBe('GHS');
      expect(org.paystack_subscription_code).toBe(SUB_CODE);
    });

    it('enforces idempotency on duplicate webhook events', async () => {
      // Re-send the exact same event ID
      const res = await db.query<{ apply_paystack_subscription_update: any }>(`
        SELECT public.apply_paystack_subscription_update(
          'evt_momo_success_001',
          'charge.success',
          '${CUSTOMER_CODE}',
          '${SUB_CODE}',
          'active',
          'standard'
        ) as apply_paystack_subscription_update;
      `);

      const result = res.rows[0].apply_paystack_subscription_update;
      expect(result.status).toBe('already_processed');
      expect(result.event_id).toBe('evt_momo_success_001');
    });

    it('transitions to past_due grace period on payment failure', async () => {
      const res = await db.query<{ apply_paystack_subscription_update: any }>(`
        SELECT public.apply_paystack_subscription_update(
          'evt_momo_failed_002',
          'invoice.payment_failed',
          '${CUSTOMER_CODE}',
          '${SUB_CODE}',
          'attention',
          'standard'
        ) as apply_paystack_subscription_update;
      `);

      const result = res.rows[0].apply_paystack_subscription_update;
      expect(result.status).toBe('updated');
      expect(result.subscription_status).toBe('past_due');

      const orgRes = await db.query<any>(`
        SELECT subscription_status FROM public.organizations WHERE id = '${ORG_GHANA_ID}';
      `);
      expect(orgRes.rows[0].subscription_status).toBe('past_due');
    });

    it('transitions to suspended status when subscription is disabled', async () => {
      const res = await db.query<{ apply_paystack_subscription_update: any }>(`
        SELECT public.apply_paystack_subscription_update(
          'evt_momo_disabled_003',
          'subscription.disable',
          '${CUSTOMER_CODE}',
          '${SUB_CODE}',
          'disabled',
          'standard'
        ) as apply_paystack_subscription_update;
      `);

      const result = res.rows[0].apply_paystack_subscription_update;
      expect(result.status).toBe('updated');
      expect(result.subscription_status).toBe('suspended');

      const orgRes = await db.query<any>(`
        SELECT subscription_status FROM public.organizations WHERE id = '${ORG_GHANA_ID}';
      `);
      expect(orgRes.rows[0].subscription_status).toBe('suspended');
    });

    it('safely journals and ignores unrecognized customer code', async () => {
      const res = await db.query<{ apply_paystack_subscription_update: any }>(`
        SELECT public.apply_paystack_subscription_update(
          'evt_unknown_999',
          'charge.success',
          'CUS_unknown_customer_code',
          'SUB_unknown',
          'active',
          'standard'
        ) as apply_paystack_subscription_update;
      `);

      const result = res.rows[0].apply_paystack_subscription_update;
      expect(result.status).toBe('ignored_unknown_customer');

      // Journal entry should exist
      const journalRes = await db.query<any>(`
        SELECT id, event_type FROM public.paystack_webhook_events WHERE id = 'evt_unknown_999';
      `);
      expect(journalRes.rows.length).toBe(1);
    });
  });
});
