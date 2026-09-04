-- ============================================================================
-- FROSTLY SEAFOOD COLD-CHAIN ERP
-- Migration 013: Dual-Gateway Billing - Paystack GHS (MoMo) + Stripe USD
-- ============================================================================

DO $$
BEGIN
    -- Add paystack_customer_code to organizations
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'paystack_customer_code'
    ) THEN
        ALTER TABLE public.organizations 
        ADD COLUMN paystack_customer_code TEXT UNIQUE;
    END IF;

    -- Add paystack_subscription_code to organizations
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'paystack_subscription_code'
    ) THEN
        ALTER TABLE public.organizations 
        ADD COLUMN paystack_subscription_code TEXT UNIQUE;
    END IF;

    -- Add billing_provider: 'stripe', 'paystack', or 'none' (trial)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'billing_provider'
    ) THEN
        ALTER TABLE public.organizations 
        ADD COLUMN billing_provider TEXT NOT NULL DEFAULT 'none'
        CHECK (billing_provider IN ('none', 'stripe', 'paystack'));
    END IF;

    -- Add billing_currency: 'USD', 'GHS', or 'EUR'
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'billing_currency'
    ) THEN
        ALTER TABLE public.organizations 
        ADD COLUMN billing_currency TEXT NOT NULL DEFAULT 'GHS';
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 1. Paystack Webhook Idempotency Journal
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.paystack_webhook_events (
    id TEXT PRIMARY KEY, -- Paystack event reference or ID
    event_type TEXT NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.paystack_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "paystack_webhook_events_deny_all" ON public.paystack_webhook_events;
CREATE POLICY "paystack_webhook_events_deny_all" ON public.paystack_webhook_events
FOR ALL TO authenticated
USING (FALSE);

-- ----------------------------------------------------------------------------
-- 2. Paystack Webhook Processor RPC Function
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.apply_paystack_subscription_update(
    p_event_id TEXT,
    p_event_type TEXT,
    p_customer_code TEXT,
    p_subscription_code TEXT,
    p_status TEXT,
    p_plan_tier TEXT,
    p_period_end TIMESTAMPTZ DEFAULT NULL
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
    -- 1. Idempotency Check: Don't process duplicate Paystack webhook deliveries
    IF EXISTS (SELECT 1 FROM public.paystack_webhook_events WHERE id = p_event_id) THEN
        RETURN jsonb_build_object('status', 'already_processed', 'event_id', p_event_id);
    END IF;

    -- 2. Normalize Paystack Status to Internal subscription_status
    -- Paystack subscription statuses: 'active', 'attention', 'non-renewing', 'cancelled'
    -- Paystack charge status: 'success', 'failed'
    v_normalized_status := CASE 
        WHEN p_status IN ('active', 'success') THEN 'active'
        WHEN p_status IN ('attention', 'past_due') THEN 'past_due'
        WHEN p_status IN ('non-renewing', 'cancelled', 'disabled', 'failed') THEN 'suspended'
        ELSE 'suspended'
    END;

    -- 3. Normalize Tier & Seat Ceilings
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

    -- 4. Locate Organization by paystack_customer_code, paystack_subscription_code, or email
    SELECT id INTO v_org_id
    FROM public.organizations
    WHERE paystack_customer_code = p_customer_code
       OR paystack_subscription_code = p_subscription_code;

    IF v_org_id IS NULL THEN
        -- Record event in journal to avoid redundant retries
        INSERT INTO public.paystack_webhook_events (id, event_type)
        VALUES (p_event_id, p_event_type);

        RETURN jsonb_build_object(
            'status', 'ignored_unknown_customer',
            'customer_code', p_customer_code
        );
    END IF;

    -- 5. Apply Updates to Organization
    UPDATE public.organizations
    SET subscription_status = v_normalized_status,
        plan_tier = v_normalized_tier,
        max_staff_seats = v_new_seats,
        billing_provider = 'paystack',
        billing_currency = 'GHS',
        current_period_ends_at = COALESCE(p_period_end, current_period_ends_at),
        paystack_subscription_code = COALESCE(p_subscription_code, paystack_subscription_code)
    WHERE id = v_org_id;

    -- 6. Journal the processed event
    INSERT INTO public.paystack_webhook_events (id, event_type)
    VALUES (p_event_id, p_event_type);

    RETURN jsonb_build_object(
        'status', 'updated',
        'organization_id', v_org_id,
        'subscription_status', v_normalized_status,
        'plan_tier', v_normalized_tier,
        'max_staff_seats', v_new_seats,
        'billing_provider', 'paystack'
    );
END;
$$;
