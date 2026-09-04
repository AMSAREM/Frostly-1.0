-- ============================================================================
-- FROSTLY SEAFOOD COLD-CHAIN ERP
-- Migration 012: Subscription Licensing, Tiered Quotas & RLS Grace Period
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Split organizations.plan into plan_tier and subscription_status
-- ----------------------------------------------------------------------------

DO $$
BEGIN
    -- Add plan_tier if not present
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'plan_tier'
    ) THEN
        ALTER TABLE public.organizations 
        ADD COLUMN plan_tier TEXT NOT NULL DEFAULT 'starter'
        CHECK (plan_tier IN ('starter', 'standard', 'enterprise'));
    END IF;

    -- Add subscription_status if not present
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'subscription_status'
    ) THEN
        ALTER TABLE public.organizations 
        ADD COLUMN subscription_status TEXT NOT NULL DEFAULT 'trial'
        CHECK (subscription_status IN ('trial', 'active', 'past_due', 'canceled', 'suspended'));
    END IF;

    -- Add trial_ends_at if not present (Default 14-day B2B trial window)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'trial_ends_at'
    ) THEN
        ALTER TABLE public.organizations 
        ADD COLUMN trial_ends_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days');
    END IF;

    -- Add current_period_ends_at for billing cycles
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'current_period_ends_at'
    ) THEN
        ALTER TABLE public.organizations 
        ADD COLUMN current_period_ends_at TIMESTAMPTZ;
    END IF;

    -- Add stripe_customer_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'stripe_customer_id'
    ) THEN
        ALTER TABLE public.organizations 
        ADD COLUMN stripe_customer_id TEXT UNIQUE;
    END IF;

    -- Add stripe_subscription_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'stripe_subscription_id'
    ) THEN
        ALTER TABLE public.organizations 
        ADD COLUMN stripe_subscription_id TEXT UNIQUE;
    END IF;

    -- Add max_staff_seats for org-based tiered capacity ceiling
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'max_staff_seats'
    ) THEN
        ALTER TABLE public.organizations 
        ADD COLUMN max_staff_seats INT NOT NULL DEFAULT 5;
    END IF;

    -- Migrate legacy data if the decorative 'plan' column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'plan'
    ) THEN
        UPDATE public.organizations 
        SET plan_tier = CASE 
            WHEN plan = 'starter' THEN 'starter'
            WHEN plan = 'standard' THEN 'standard'
            ELSE 'enterprise'
        END,
        subscription_status = 'active',
        max_staff_seats = CASE 
            WHEN plan = 'starter' THEN 5
            WHEN plan = 'standard' THEN 20
            ELSE 9999
        END;

        ALTER TABLE public.organizations DROP COLUMN plan;
    END IF;
END $$;

-- Guarantee default organization has permanent active enterprise status
UPDATE public.organizations 
SET plan_tier = 'enterprise',
    subscription_status = 'active',
    max_staff_seats = 9999,
    trial_ends_at = NOW() + INTERVAL '100 years'
WHERE id = '00000000-0000-0000-0000-000000000001';

-- ----------------------------------------------------------------------------
-- 2. Stripe Webhook Idempotency Store
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
    id TEXT PRIMARY KEY, -- Stripe evt_xxx identifier
    event_type TEXT NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
-- Lock down stripe_webhook_events so only service_role (or security definer RPCs) can access it
DROP POLICY IF EXISTS "stripe_webhook_events_deny_all" ON public.stripe_webhook_events;
CREATE POLICY "stripe_webhook_events_deny_all" ON public.stripe_webhook_events
FOR ALL TO authenticated
USING (FALSE);

-- ----------------------------------------------------------------------------
-- 3. Licensing Access Functions: Read vs. Write Access Evaluation
-- ----------------------------------------------------------------------------

-- Read Access:
-- Returns TRUE if the organization has an active subscription, is in an active trial,
-- or is in the 14-day 'past_due' grace period (so HACCP audit & traceability logs remain accessible).
CREATE OR REPLACE FUNCTION public.org_has_read_access()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.organizations o
        WHERE o.id = public.current_org_id()
          AND (
            (o.subscription_status = 'trial' AND o.trial_ends_at > NOW())
            OR o.subscription_status IN ('active', 'past_due')
          )
    );
$$;

-- Write Access:
-- Returns TRUE if the organization is in an active trial or has an active subscription.
-- Returns FALSE when 'past_due' (grace period read-only), 'suspended', or 'canceled'.
CREATE OR REPLACE FUNCTION public.org_has_write_access()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.organizations o
        WHERE o.id = public.current_org_id()
          AND (
            (o.subscription_status = 'trial' AND o.trial_ends_at > NOW())
            OR o.subscription_status = 'active'
          )
    );
$$;

-- ----------------------------------------------------------------------------
-- 4. Update create_organization_and_admin (No more free Enterprise)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_organization_and_admin(
    p_org_name TEXT,
    p_admin_full_name TEXT DEFAULT NULL,
    p_admin_department TEXT DEFAULT 'Executive'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID;
    v_email TEXT;
    v_org_id UUID;
    v_existing_profile RECORD;
    v_org_name_clean TEXT;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required: User must be logged in to create an organization.';
    END IF;

    v_org_name_clean := trim(p_org_name);
    IF v_org_name_clean IS NULL OR length(v_org_name_clean) < 2 THEN
        RAISE EXCEPTION 'Organization name must be at least 2 characters.';
    END IF;

    -- Verify this user does not already have a staff profile
    SELECT id, organization_id INTO v_existing_profile
    FROM public.staff_profiles
    WHERE id = v_uid;

    IF FOUND THEN
        RAISE EXCEPTION 'User % is already registered with an organization.', v_uid;
    END IF;

    -- Fetch user email from auth.users
    SELECT email INTO v_email
    FROM auth.users
    WHERE id = v_uid;

    IF v_email IS NULL THEN
        v_email := 'staff_' || substr(v_uid::TEXT, 1, 8) || '@frostly.internal';
    END IF;

    -- 1. Create Organization: Default to 14-day trial on Starter tier with 5 staff seats
    INSERT INTO public.organizations (
        name,
        plan_tier,
        subscription_status,
        trial_ends_at,
        max_staff_seats
    )
    VALUES (
        v_org_name_clean,
        'starter',
        'trial',
        NOW() + INTERVAL '14 days',
        5
    )
    RETURNING id INTO v_org_id;

    -- 2. Create Staff Profile as Admin
    INSERT INTO public.staff_profiles (
        id,
        organization_id,
        email,
        full_name,
        role,
        department,
        is_active
    ) VALUES (
        v_uid,
        v_org_id,
        v_email,
        COALESCE(NULLIF(trim(p_admin_full_name), ''), split_part(v_email, '@', 1)),
        'admin',
        COALESCE(NULLIF(trim(p_admin_department), ''), 'Executive'),
        TRUE
    );

    -- 3. Seed default organization app settings
    INSERT INTO public.app_settings (
        id,
        organization_id,
        company_name,
        facility_code,
        fda_registration_number,
        eu_approval_number,
        tax_rate,
        currency
    ) VALUES (
        1,
        v_org_id,
        v_org_name_clean,
        'FAC-' || upper(substr(md5(v_org_id::TEXT), 1, 6)),
        'FDA-REG-' || upper(substr(md5(v_org_id::TEXT), 7, 7)),
        'EU-APPR-' || upper(substr(md5(v_org_id::TEXT), 14, 6)),
        15.00,
        'GHS'
    ) ON CONFLICT (organization_id, id) DO NOTHING;

    RETURN jsonb_build_object(
        'success', TRUE,
        'organization_id', v_org_id,
        'organization_name', v_org_name_clean,
        'plan_tier', 'starter',
        'subscription_status', 'trial',
        'trial_ends_at', NOW() + INTERVAL '14 days',
        'role', 'admin',
        'message', 'Organization provisioned on 14-day Starter trial.'
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. Update create_invite to Enforce Tiered Staff Seat Limits
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_invite(
    p_email TEXT,
    p_role public.staff_role DEFAULT 'viewer',
    p_validity_days INT DEFAULT 7
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_org_id UUID;
    v_token TEXT;
    v_invite_id UUID;
    v_expires_at TIMESTAMPTZ;
    v_max_seats INT;
    v_current_seats INT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access Denied: Only organization administrators can issue staff invites.';
    END IF;

    v_org_id := public.current_org_id();
    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'Context Error: Administrator has no active organization.';
    END IF;

    -- Verify write access (cannot invite new staff if subscription is past_due or suspended)
    IF NOT public.org_has_write_access() THEN
        RAISE EXCEPTION 'Licensing Restriction: Cannot issue staff invitations while organization subscription is in read-only or suspended status.';
    END IF;

    IF p_email IS NULL OR trim(p_email) = '' OR p_email NOT LIKE '%@%.%' THEN
        RAISE EXCEPTION 'A valid email address is required.';
    END IF;

    -- Enforce Tiered Staff Seat Capacity
    SELECT max_staff_seats INTO v_max_seats
    FROM public.organizations
    WHERE id = v_org_id;

    SELECT COUNT(*) INTO v_current_seats
    FROM (
        SELECT id FROM public.staff_profiles 
        WHERE organization_id = v_org_id AND is_active = TRUE
        UNION ALL
        SELECT id FROM public.invites 
        WHERE organization_id = v_org_id AND used_at IS NULL AND expires_at > NOW()
    ) active_and_pending;

    IF v_current_seats >= COALESCE(v_max_seats, 5) THEN
        RAISE EXCEPTION 'Seat limit reached: Organization has reached its maximum capacity of % staff seats. Please upgrade your subscription tier in billing settings.', v_max_seats;
    END IF;

    v_token := replace(gen_random_uuid()::TEXT, '-', '') || substr(replace(gen_random_uuid()::TEXT, '-', ''), 1, 16);
    v_expires_at := NOW() + (GREATEST(1, LEAST(p_validity_days, 90)) || ' days')::INTERVAL;

    INSERT INTO public.invites (
        organization_id,
        email,
        role,
        token,
        expires_at
    ) VALUES (
        v_org_id,
        lower(trim(p_email)),
        COALESCE(p_role, 'viewer'),
        v_token,
        v_expires_at
    )
    RETURNING id INTO v_invite_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'invite_id', v_invite_id,
        'token', v_token,
        'email', lower(trim(p_email)),
        'role', COALESCE(p_role, 'viewer'),
        'expires_at', v_expires_at,
        'seats_used', v_current_seats + 1,
        'max_seats', v_max_seats
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. Server-Side Stripe Webhook Processor (Idempotent)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.apply_stripe_subscription_update(
    p_event_id TEXT,
    p_event_type TEXT,
    p_stripe_customer_id TEXT,
    p_stripe_sub_id TEXT,
    p_status TEXT,
    p_plan_tier TEXT,
    p_period_end TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_org_id UUID;
    v_new_seats INT;
    v_normalized_status TEXT;
    v_normalized_tier TEXT;
BEGIN
    -- Idempotency Check: Don't process the same Stripe webhook event twice
    IF EXISTS (SELECT 1 FROM public.stripe_webhook_events WHERE id = p_event_id) THEN
        RETURN jsonb_build_object('status', 'already_processed', 'event_id', p_event_id);
    END IF;

    -- Map Stripe subscription status to internal subscription_status
    v_normalized_status := CASE 
        WHEN p_status IN ('active') THEN 'active'
        WHEN p_status IN ('trialing') THEN 'trial'
        WHEN p_status IN ('past_due') THEN 'past_due'
        WHEN p_status IN ('canceled', 'unpaid') THEN 'suspended'
        ELSE 'suspended'
    END;

    -- Map plan tier & seat ceilings
    v_normalized_tier := CASE 
        WHEN p_plan_tier IN ('standard') THEN 'standard'
        WHEN p_plan_tier IN ('enterprise') THEN 'enterprise'
        ELSE 'starter'
    END;

    v_new_seats := CASE 
        WHEN v_normalized_tier = 'standard' THEN 20
        WHEN v_normalized_tier = 'enterprise' THEN 9999
        ELSE 5
    END;

    -- Find organization by stripe_customer_id or stripe_subscription_id
    SELECT id INTO v_org_id
    FROM public.organizations
    WHERE stripe_customer_id = p_stripe_customer_id
       OR stripe_subscription_id = p_stripe_sub_id;

    IF v_org_id IS NULL THEN
        -- Record the event anyway so we don't spin on unknown customers
        INSERT INTO public.stripe_webhook_events (id, event_type)
        VALUES (p_event_id, p_event_type);

        RETURN jsonb_build_object(
            'status', 'ignored_unknown_customer',
            'customer_id', p_stripe_customer_id
        );
    END IF;

    -- Update organization licensing state
    UPDATE public.organizations
    SET subscription_status = v_normalized_status,
        plan_tier = v_normalized_tier,
        max_staff_seats = v_new_seats,
        current_period_ends_at = p_period_end,
        stripe_subscription_id = COALESCE(p_stripe_sub_id, stripe_subscription_id)
    WHERE id = v_org_id;

    -- Record event in idempotency journal
    INSERT INTO public.stripe_webhook_events (id, event_type)
    VALUES (p_event_id, p_event_type);

    RETURN jsonb_build_object(
        'status', 'updated',
        'organization_id', v_org_id,
        'subscription_status', v_normalized_status,
        'plan_tier', v_normalized_tier,
        'max_staff_seats', v_new_seats
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. Update Row-Level Security Policies with Read/Write Licensing Predicates
-- ----------------------------------------------------------------------------

DO $$
BEGIN
    -- 7.1 Species
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'species') THEN
        EXECUTE 'DROP POLICY IF EXISTS "species_select" ON public.species;';
        EXECUTE 'CREATE POLICY "species_select" ON public.species FOR SELECT TO authenticated USING (public.is_staff() AND organization_id = public.current_org_id() AND public.org_has_read_access());';
        EXECUTE 'DROP POLICY IF EXISTS "species_insert" ON public.species;';
        EXECUTE 'CREATE POLICY "species_insert" ON public.species FOR INSERT TO authenticated WITH CHECK ((public.is_admin() OR public.is_ops_or_admin()) AND organization_id = public.current_org_id() AND public.org_has_write_access());';
        EXECUTE 'DROP POLICY IF EXISTS "species_update" ON public.species;';
        EXECUTE 'CREATE POLICY "species_update" ON public.species FOR UPDATE TO authenticated USING (public.is_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access()) WITH CHECK (public.is_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
    END IF;

    -- 7.2 Customers
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customers') THEN
        EXECUTE 'DROP POLICY IF EXISTS "customers_select" ON public.customers;';
        EXECUTE 'CREATE POLICY "customers_select" ON public.customers FOR SELECT TO authenticated USING (public.is_staff() AND organization_id = public.current_org_id() AND public.org_has_read_access());';
        EXECUTE 'DROP POLICY IF EXISTS "customers_insert" ON public.customers;';
        EXECUTE 'CREATE POLICY "customers_insert" ON public.customers FOR INSERT TO authenticated WITH CHECK (public.is_sales_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
        EXECUTE 'DROP POLICY IF EXISTS "customers_update" ON public.customers;';
        EXECUTE 'CREATE POLICY "customers_update" ON public.customers FOR UPDATE TO authenticated USING (public.is_sales_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access()) WITH CHECK (public.is_sales_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
        EXECUTE 'DROP POLICY IF EXISTS "customers_delete" ON public.customers;';
        EXECUTE 'CREATE POLICY "customers_delete" ON public.customers FOR DELETE TO authenticated USING (public.is_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
    END IF;

    -- 7.3 Suppliers
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'suppliers') THEN
        EXECUTE 'DROP POLICY IF EXISTS "suppliers_select" ON public.suppliers;';
        EXECUTE 'CREATE POLICY "suppliers_select" ON public.suppliers FOR SELECT TO authenticated USING (public.is_staff() AND organization_id = public.current_org_id() AND public.org_has_read_access());';
        EXECUTE 'DROP POLICY IF EXISTS "suppliers_insert" ON public.suppliers;';
        EXECUTE 'CREATE POLICY "suppliers_insert" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (public.is_ops_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
        EXECUTE 'DROP POLICY IF EXISTS "suppliers_update" ON public.suppliers;';
        EXECUTE 'CREATE POLICY "suppliers_update" ON public.suppliers FOR UPDATE TO authenticated USING (public.is_ops_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access()) WITH CHECK (public.is_ops_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
    END IF;

    -- 7.4 Inventory Batches
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_batches') THEN
        EXECUTE 'DROP POLICY IF EXISTS "inventory_select" ON public.inventory_batches;';
        EXECUTE 'CREATE POLICY "inventory_select" ON public.inventory_batches FOR SELECT TO authenticated USING (public.is_staff() AND organization_id = public.current_org_id() AND public.org_has_read_access());';
        EXECUTE 'DROP POLICY IF EXISTS "inventory_insert" ON public.inventory_batches;';
        EXECUTE 'CREATE POLICY "inventory_insert" ON public.inventory_batches FOR INSERT TO authenticated WITH CHECK (public.is_ops_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
        EXECUTE 'DROP POLICY IF EXISTS "inventory_update" ON public.inventory_batches;';
        EXECUTE 'CREATE POLICY "inventory_update" ON public.inventory_batches FOR UPDATE TO authenticated USING (public.is_ops_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access()) WITH CHECK (public.is_ops_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
        EXECUTE 'DROP POLICY IF EXISTS "inventory_delete" ON public.inventory_batches;';
        EXECUTE 'CREATE POLICY "inventory_delete" ON public.inventory_batches FOR DELETE TO authenticated USING (public.is_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
    END IF;

    -- 7.5 Client Orders
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'client_orders') THEN
        EXECUTE 'DROP POLICY IF EXISTS "client_orders_select" ON public.client_orders;';
        EXECUTE 'CREATE POLICY "client_orders_select" ON public.client_orders FOR SELECT TO authenticated USING (public.is_staff() AND organization_id = public.current_org_id() AND public.org_has_read_access());';
        EXECUTE 'DROP POLICY IF EXISTS "client_orders_insert" ON public.client_orders;';
        EXECUTE 'CREATE POLICY "client_orders_insert" ON public.client_orders FOR INSERT TO authenticated WITH CHECK (public.is_sales_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
        EXECUTE 'DROP POLICY IF EXISTS "client_orders_update" ON public.client_orders;';
        EXECUTE 'CREATE POLICY "client_orders_update" ON public.client_orders FOR UPDATE TO authenticated USING (public.is_sales_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access()) WITH CHECK (public.is_sales_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
    END IF;

    -- 7.6 Order Line Items
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_line_items') THEN
        EXECUTE 'DROP POLICY IF EXISTS "order_items_select" ON public.order_line_items;';
        EXECUTE 'CREATE POLICY "order_items_select" ON public.order_line_items FOR SELECT TO authenticated USING (public.is_staff() AND organization_id = public.current_org_id() AND public.org_has_read_access());';
        EXECUTE 'DROP POLICY IF EXISTS "order_items_insert" ON public.order_line_items;';
        EXECUTE 'CREATE POLICY "order_items_insert" ON public.order_line_items FOR INSERT TO authenticated WITH CHECK (public.is_sales_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
        EXECUTE 'DROP POLICY IF EXISTS "order_items_update" ON public.order_line_items;';
        EXECUTE 'CREATE POLICY "order_items_update" ON public.order_line_items FOR UPDATE TO authenticated USING (public.is_sales_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access()) WITH CHECK (public.is_sales_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
    END IF;

    -- 7.7 HACCP Audit Records
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'haccp_audit_records') THEN
        EXECUTE 'DROP POLICY IF EXISTS "haccp_audit_select" ON public.haccp_audit_records;';
        EXECUTE 'CREATE POLICY "haccp_audit_select" ON public.haccp_audit_records FOR SELECT TO authenticated USING (public.is_staff() AND organization_id = public.current_org_id() AND public.org_has_read_access());';
        EXECUTE 'DROP POLICY IF EXISTS "haccp_audit_insert" ON public.haccp_audit_records;';
        EXECUTE 'CREATE POLICY "haccp_audit_insert" ON public.haccp_audit_records FOR INSERT TO authenticated WITH CHECK (public.is_ops_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
    END IF;

    -- 7.8 Financial Ledger Entries
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'financial_ledger_entries') THEN
        EXECUTE 'DROP POLICY IF EXISTS "financial_ledger_select" ON public.financial_ledger_entries;';
        EXECUTE 'CREATE POLICY "financial_ledger_select" ON public.financial_ledger_entries FOR SELECT TO authenticated USING (public.is_staff() AND organization_id = public.current_org_id() AND public.org_has_read_access());';
        EXECUTE 'DROP POLICY IF EXISTS "financial_ledger_insert" ON public.financial_ledger_entries;';
        EXECUTE 'CREATE POLICY "financial_ledger_insert" ON public.financial_ledger_entries FOR INSERT TO authenticated WITH CHECK (public.is_staff() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
    END IF;

    -- 7.9 Reefer Sensor Readings (Telemetry)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reefer_sensor_readings') THEN
        EXECUTE 'DROP POLICY IF EXISTS "reefer_telemetry_select" ON public.reefer_sensor_readings;';
        EXECUTE 'CREATE POLICY "reefer_telemetry_select" ON public.reefer_sensor_readings FOR SELECT TO authenticated USING (public.is_staff() AND organization_id = public.current_org_id() AND public.org_has_read_access());';
        EXECUTE 'DROP POLICY IF EXISTS "reefer_telemetry_insert" ON public.reefer_sensor_readings;';
        EXECUTE 'CREATE POLICY "reefer_telemetry_insert" ON public.reefer_sensor_readings FOR INSERT TO authenticated WITH CHECK ((public.is_ops_or_admin() OR public.is_dispatch_or_admin()) AND organization_id = public.current_org_id() AND public.org_has_write_access());';
    END IF;

    -- 7.10 Fleet Vessels
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fleet_vessels') THEN
        EXECUTE 'DROP POLICY IF EXISTS "fleet_vessels_select" ON public.fleet_vessels;';
        EXECUTE 'CREATE POLICY "fleet_vessels_select" ON public.fleet_vessels FOR SELECT TO authenticated USING (public.is_staff() AND organization_id = public.current_org_id() AND public.org_has_read_access());';
        EXECUTE 'DROP POLICY IF EXISTS "fleet_vessels_insert" ON public.fleet_vessels;';
        EXECUTE 'CREATE POLICY "fleet_vessels_insert" ON public.fleet_vessels FOR INSERT TO authenticated WITH CHECK (public.is_ops_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
        EXECUTE 'DROP POLICY IF EXISTS "fleet_vessels_update" ON public.fleet_vessels;';
        EXECUTE 'CREATE POLICY "fleet_vessels_update" ON public.fleet_vessels FOR UPDATE TO authenticated USING (public.is_ops_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access()) WITH CHECK (public.is_ops_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
    END IF;

    -- 7.11 Reefer Vehicles
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reefer_vehicles') THEN
        EXECUTE 'DROP POLICY IF EXISTS "reefer_vehicles_select" ON public.reefer_vehicles;';
        EXECUTE 'CREATE POLICY "reefer_vehicles_select" ON public.reefer_vehicles FOR SELECT TO authenticated USING (public.is_staff() AND organization_id = public.current_org_id() AND public.org_has_read_access());';
        EXECUTE 'DROP POLICY IF EXISTS "reefer_vehicles_insert" ON public.reefer_vehicles;';
        EXECUTE 'CREATE POLICY "reefer_vehicles_insert" ON public.reefer_vehicles FOR INSERT TO authenticated WITH CHECK ((public.is_ops_or_admin() OR public.is_dispatch_or_admin()) AND organization_id = public.current_org_id() AND public.org_has_write_access());';
        EXECUTE 'DROP POLICY IF EXISTS "reefer_vehicles_update" ON public.reefer_vehicles;';
        EXECUTE 'CREATE POLICY "reefer_vehicles_update" ON public.reefer_vehicles FOR UPDATE TO authenticated USING ((public.is_ops_or_admin() OR public.is_dispatch_or_admin()) AND organization_id = public.current_org_id() AND public.org_has_write_access()) WITH CHECK ((public.is_ops_or_admin() OR public.is_dispatch_or_admin()) AND organization_id = public.current_org_id() AND public.org_has_write_access());';
    END IF;

    -- 7.12 Retail Transactions & Sale Items
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'retail_transactions') THEN
        EXECUTE 'DROP POLICY IF EXISTS "retail_transactions_select" ON public.retail_transactions;';
        EXECUTE 'CREATE POLICY "retail_transactions_select" ON public.retail_transactions FOR SELECT TO authenticated USING (public.is_staff() AND organization_id = public.current_org_id() AND public.org_has_read_access());';
        EXECUTE 'DROP POLICY IF EXISTS "retail_transactions_insert" ON public.retail_transactions;';
        EXECUTE 'CREATE POLICY "retail_transactions_insert" ON public.retail_transactions FOR INSERT TO authenticated WITH CHECK (public.is_sales_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'retail_sale_items') THEN
        EXECUTE 'DROP POLICY IF EXISTS "retail_sale_items_select" ON public.retail_sale_items;';
        EXECUTE 'CREATE POLICY "retail_sale_items_select" ON public.retail_sale_items FOR SELECT TO authenticated USING (public.is_staff() AND organization_id = public.current_org_id() AND public.org_has_read_access());';
        EXECUTE 'DROP POLICY IF EXISTS "retail_sale_items_insert" ON public.retail_sale_items;';
        EXECUTE 'CREATE POLICY "retail_sale_items_insert" ON public.retail_sale_items FOR INSERT TO authenticated WITH CHECK (public.is_sales_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
    END IF;

    -- 7.13 Purchase Orders
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'purchase_order_landings') THEN
        EXECUTE 'DROP POLICY IF EXISTS "purchase_landings_select" ON public.purchase_order_landings;';
        EXECUTE 'CREATE POLICY "purchase_landings_select" ON public.purchase_order_landings FOR SELECT TO authenticated USING (public.is_staff() AND organization_id = public.current_org_id() AND public.org_has_read_access());';
        EXECUTE 'DROP POLICY IF EXISTS "purchase_landings_insert" ON public.purchase_order_landings;';
        EXECUTE 'CREATE POLICY "purchase_landings_insert" ON public.purchase_order_landings FOR INSERT TO authenticated WITH CHECK (public.is_ops_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
        EXECUTE 'DROP POLICY IF EXISTS "purchase_landings_update" ON public.purchase_order_landings;';
        EXECUTE 'CREATE POLICY "purchase_landings_update" ON public.purchase_order_landings FOR UPDATE TO authenticated USING (public.is_ops_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access()) WITH CHECK (public.is_ops_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'purchase_order_items') THEN
        EXECUTE 'DROP POLICY IF EXISTS "purchase_items_select" ON public.purchase_order_items;';
        EXECUTE 'CREATE POLICY "purchase_items_select" ON public.purchase_order_items FOR SELECT TO authenticated USING (public.is_staff() AND organization_id = public.current_org_id() AND public.org_has_read_access());';
        EXECUTE 'DROP POLICY IF EXISTS "purchase_items_insert" ON public.purchase_order_items;';
        EXECUTE 'CREATE POLICY "purchase_items_insert" ON public.purchase_order_items FOR INSERT TO authenticated WITH CHECK (public.is_ops_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
    END IF;

    -- 7.14 Market Price Index
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'market_price_index') THEN
        EXECUTE 'DROP POLICY IF EXISTS "market_price_select" ON public.market_price_index;';
        EXECUTE 'CREATE POLICY "market_price_select" ON public.market_price_index FOR SELECT TO authenticated USING (public.is_staff() AND organization_id = public.current_org_id() AND public.org_has_read_access());';
        EXECUTE 'DROP POLICY IF EXISTS "market_price_insert" ON public.market_price_index;';
        EXECUTE 'CREATE POLICY "market_price_insert" ON public.market_price_index FOR INSERT TO authenticated WITH CHECK (public.is_ops_or_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
    END IF;

    -- 7.15 Retail Products
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'retail_wholesale_products') THEN
        EXECUTE 'DROP POLICY IF EXISTS "retail_products_select" ON public.retail_wholesale_products;';
        EXECUTE 'CREATE POLICY "retail_products_select" ON public.retail_wholesale_products FOR SELECT TO authenticated USING (public.is_staff() AND organization_id = public.current_org_id() AND public.org_has_read_access());';
        EXECUTE 'DROP POLICY IF EXISTS "retail_products_insert" ON public.retail_wholesale_products;';
        EXECUTE 'CREATE POLICY "retail_products_insert" ON public.retail_wholesale_products FOR INSERT TO authenticated WITH CHECK ((public.is_ops_or_admin() OR public.is_sales_or_admin()) AND organization_id = public.current_org_id() AND public.org_has_write_access());';
        EXECUTE 'DROP POLICY IF EXISTS "retail_products_update" ON public.retail_wholesale_products;';
        EXECUTE 'CREATE POLICY "retail_products_update" ON public.retail_wholesale_products FOR UPDATE TO authenticated USING ((public.is_ops_or_admin() OR public.is_sales_or_admin()) AND organization_id = public.current_org_id() AND public.org_has_write_access()) WITH CHECK ((public.is_ops_or_admin() OR public.is_sales_or_admin()) AND organization_id = public.current_org_id() AND public.org_has_write_access());';
    END IF;

    -- 7.16 System Notifications
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'system_notifications') THEN
        EXECUTE 'DROP POLICY IF EXISTS "system_notifications_select" ON public.system_notifications;';
        EXECUTE 'CREATE POLICY "system_notifications_select" ON public.system_notifications FOR SELECT TO authenticated USING (public.is_staff() AND organization_id = public.current_org_id() AND public.org_has_read_access());';
        EXECUTE 'DROP POLICY IF EXISTS "system_notifications_insert" ON public.system_notifications;';
        EXECUTE 'CREATE POLICY "system_notifications_insert" ON public.system_notifications FOR INSERT TO authenticated WITH CHECK (public.is_staff() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
        EXECUTE 'DROP POLICY IF EXISTS "system_notifications_update" ON public.system_notifications;';
        EXECUTE 'CREATE POLICY "system_notifications_update" ON public.system_notifications FOR UPDATE TO authenticated USING (public.is_staff() AND organization_id = public.current_org_id() AND public.org_has_write_access()) WITH CHECK (public.is_staff() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
    END IF;

    -- 7.17 App Settings
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'app_settings') THEN
        EXECUTE 'DROP POLICY IF EXISTS "app_settings_select" ON public.app_settings;';
        EXECUTE 'CREATE POLICY "app_settings_select" ON public.app_settings FOR SELECT TO authenticated USING (public.is_staff() AND organization_id = public.current_org_id() AND public.org_has_read_access());';
        EXECUTE 'DROP POLICY IF EXISTS "app_settings_update" ON public.app_settings;';
        EXECUTE 'CREATE POLICY "app_settings_update" ON public.app_settings FOR UPDATE TO authenticated USING (public.is_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access()) WITH CHECK (public.is_admin() AND organization_id = public.current_org_id() AND public.org_has_write_access());';
    END IF;

    -- 7.18 Staff Role Audit Logs
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'staff_role_audit_logs') THEN
        EXECUTE 'DROP POLICY IF EXISTS "staff_role_audit_select" ON public.staff_role_audit_logs;';
        EXECUTE 'CREATE POLICY "staff_role_audit_select" ON public.staff_role_audit_logs FOR SELECT TO authenticated USING (public.is_admin() AND organization_id = public.current_org_id() AND public.org_has_read_access());';
    END IF;
END $$;
