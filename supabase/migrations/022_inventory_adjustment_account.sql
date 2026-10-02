-- ============================================================================
-- FROSTLY SEAFOOD COLD-CHAIN ERP
-- Migration 022: Inventory Adjustment Accounts & Inventory Valuation Adjustments
-- Connects inventory stock adjustments directly to the Supabase database
-- and financial chart of accounts.
-- ============================================================================

-- 1. Extend financial_entry_category ENUM to include Inventory Adjustment
DO $$
BEGIN
    ALTER TYPE public.financial_entry_category ADD VALUE IF NOT EXISTS 'Inventory Adjustment';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create inventory_adjustment_accounts table
-- Represents ledger accounts dedicated to tracking inventory discrepancies,
-- trimming/yield loss, shrinkage, spoilage write-offs, and count reconciliations.
CREATE TABLE IF NOT EXISTS public.inventory_adjustment_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    account_code TEXT NOT NULL,
    account_name TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK (account_type IN ('COGS', 'OpEx', 'Contra-Asset', 'Income')),
    description TEXT,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    balance_usd NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_org_adjustment_account_code UNIQUE (organization_id, account_code)
);

-- 3. Create inventory_adjustments audit and transaction log table
-- Records every weight/valuation change made to an inventory lot,
-- linked to the specific adjustment account and financial ledger.
CREATE TABLE IF NOT EXISTS public.inventory_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    batch_id TEXT NOT NULL REFERENCES public.inventory_batches(id) ON DELETE CASCADE,
    species_name TEXT NOT NULL,
    previous_weight_kg NUMERIC(10, 2) NOT NULL CHECK (previous_weight_kg >= 0),
    new_weight_kg NUMERIC(10, 2) NOT NULL CHECK (new_weight_kg >= 0),
    delta_weight_kg NUMERIC(10, 2) NOT NULL,
    unit_cost_usd NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (unit_cost_usd >= 0),
    valuation_variance_usd NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    reason TEXT NOT NULL,
    adjustment_account_id UUID REFERENCES public.inventory_adjustment_accounts(id) ON DELETE SET NULL,
    adjustment_account_code TEXT NOT NULL,
    adjustment_account_name TEXT NOT NULL,
    financial_ledger_id UUID REFERENCES public.financial_ledger_entries(id) ON DELETE SET NULL,
    notes TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Create Indexes for High Performance
CREATE INDEX IF NOT EXISTS idx_adj_accounts_org ON public.inventory_adjustment_accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_adj_accounts_code ON public.inventory_adjustment_accounts(organization_id, account_code);
CREATE INDEX IF NOT EXISTS idx_inv_adjustments_org ON public.inventory_adjustments(organization_id);
CREATE INDEX IF NOT EXISTS idx_inv_adjustments_batch ON public.inventory_adjustments(batch_id);
CREATE INDEX IF NOT EXISTS idx_inv_adjustments_account ON public.inventory_adjustments(adjustment_account_id);
CREATE INDEX IF NOT EXISTS idx_inv_adjustments_date ON public.inventory_adjustments(created_at DESC);

-- 5. Enable Row-Level Security (RLS) for Multi-Tenant Isolation
ALTER TABLE public.inventory_adjustment_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_adjustments ENABLE ROW LEVEL SECURITY;

-- 5a. Policies for inventory_adjustment_accounts
DROP POLICY IF EXISTS "adjustment_accounts_select" ON public.inventory_adjustment_accounts;
CREATE POLICY "adjustment_accounts_select" ON public.inventory_adjustment_accounts
    FOR SELECT TO authenticated
    USING (
        organization_id = public.current_org_id()
        OR public.is_platform_admin()
    );

DROP POLICY IF EXISTS "adjustment_accounts_insert" ON public.inventory_adjustment_accounts;
CREATE POLICY "adjustment_accounts_insert" ON public.inventory_adjustment_accounts
    FOR INSERT TO authenticated
    WITH CHECK (
        organization_id = public.current_org_id()
        OR public.is_platform_admin()
    );

DROP POLICY IF EXISTS "adjustment_accounts_update" ON public.inventory_adjustment_accounts;
CREATE POLICY "adjustment_accounts_update" ON public.inventory_adjustment_accounts
    FOR UPDATE TO authenticated
    USING (
        organization_id = public.current_org_id()
        OR public.is_platform_admin()
    )
    WITH CHECK (
        organization_id = public.current_org_id()
        OR public.is_platform_admin()
    );

DROP POLICY IF EXISTS "adjustment_accounts_delete" ON public.inventory_adjustment_accounts;
CREATE POLICY "adjustment_accounts_delete" ON public.inventory_adjustment_accounts
    FOR DELETE TO authenticated
    USING (
        (organization_id = public.current_org_id() AND public.is_org_admin())
        OR public.is_platform_admin()
    );

-- 5b. Policies for inventory_adjustments
DROP POLICY IF EXISTS "inventory_adjustments_select" ON public.inventory_adjustments;
CREATE POLICY "inventory_adjustments_select" ON public.inventory_adjustments
    FOR SELECT TO authenticated
    USING (
        organization_id = public.current_org_id()
        OR public.is_platform_admin()
    );

DROP POLICY IF EXISTS "inventory_adjustments_insert" ON public.inventory_adjustments;
CREATE POLICY "inventory_adjustments_insert" ON public.inventory_adjustments
    FOR INSERT TO authenticated
    WITH CHECK (
        organization_id = public.current_org_id()
        OR public.is_platform_admin()
    );

-- 6. Seed Default Standard Cold-Chain Seafood Adjustment Accounts for All Existing Organizations
DO $$
DECLARE
    org_rec RECORD;
BEGIN
    FOR org_rec IN SELECT id FROM public.organizations LOOP
        -- Account 5150: Inventory Shrinkage & Spoilage
        INSERT INTO public.inventory_adjustment_accounts (
            organization_id, account_code, account_name, account_type, description, is_default, is_active
        ) VALUES (
            org_rec.id, '5150', 'Inventory Shrinkage & Spoilage', 'COGS',
            'Unavoidable drip loss, physical shrinkage, freezer burn, or spoilage write-down.', TRUE, TRUE
        ) ON CONFLICT (organization_id, account_code) DO NOTHING;

        -- Account 5155: Processing Trimming & Yield Loss
        INSERT INTO public.inventory_adjustment_accounts (
            organization_id, account_code, account_name, account_type, description, is_default, is_active
        ) VALUES (
            org_rec.id, '5155', 'Processing Yield & Trimming Loss', 'COGS',
            'Biomass reduction from head removal, gutting, loin deboning, and sashimi trimming.', FALSE, TRUE
        ) ON CONFLICT (organization_id, account_code) DO NOTHING;

        -- Account 5160: Certified Scale & Audit Variance
        INSERT INTO public.inventory_adjustment_accounts (
            organization_id, account_code, account_name, account_type, description, is_default, is_active
        ) VALUES (
            org_rec.id, '5160', 'Scale Calibration & Count Variance', 'COGS',
            'Adjustments following periodic certified physical floor counts and crane scale recalibration.', FALSE, TRUE
        ) ON CONFLICT (organization_id, account_code) DO NOTHING;

        -- Account 1420: Retail Display Reallocation Offset
        INSERT INTO public.inventory_adjustment_accounts (
            organization_id, account_code, account_name, account_type, description, is_default, is_active
        ) VALUES (
            org_rec.id, '1420', 'Retail Counter Stock Reallocation', 'Contra-Asset',
            'Bulk cold-storage inventory allocated and transferred directly to retail fresh counter display.', FALSE, TRUE
        ) ON CONFLICT (organization_id, account_code) DO NOTHING;

        -- Account 4190: Inventory Count Surplus / Recovery
        INSERT INTO public.inventory_adjustment_accounts (
            organization_id, account_code, account_name, account_type, description, is_default, is_active
        ) VALUES (
            org_rec.id, '4190', 'Inventory Count Recovery Surplus', 'Income',
            'Positive stock adjustments from physical audit surplus or weight recovery.', FALSE, TRUE
        ) ON CONFLICT (organization_id, account_code) DO NOTHING;
    END LOOP;
END $$;

-- 7. Grant Permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_adjustment_accounts TO authenticated;
GRANT SELECT, INSERT ON public.inventory_adjustments TO authenticated;

-- 8. Add to Realtime Publication if available
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' AND tablename = 'inventory_adjustment_accounts'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_adjustment_accounts;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' AND tablename = 'inventory_adjustments'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_adjustments;
        END IF;
    END IF;
END $$;
