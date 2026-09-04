import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

/**
 * Live PostgreSQL In-Engine Multi-Tenant RLS Integration Test
 * 
 * Verifies with actual SQL execution against PostgreSQL that:
 * 1. An authenticated user from Organization A CANNOT see or query data from Organization B.
 * 2. An authenticated user from Organization B CANNOT update, overwrite, or delete records from Organization A.
 * 3. The `stamp_organization_id()` trigger prevents tenant-spoofing on INSERT.
 * 4. RLS policies with `organization_id = public.current_org_id()` strictly isolate all business queries.
 * 5. Deactivated staff users immediately lose access to all tenant data.
 */
describe('PostgreSQL Runtime Multi-Tenant RLS & Isolation Integration Test', () => {
  let db: PGlite;

  const ORG_A_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const ORG_B_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  const USER_A_ID = '11111111-1111-1111-1111-111111111111';
  const USER_B_ID = '22222222-2222-2222-2222-222222222222';

  const CUST_A_ID = 'c1111111-1111-1111-1111-111111111111';
  const CUST_B_ID = 'c2222222-2222-2222-2222-222222222222';

  const BATCH_A_ID = 'b1111111-1111-1111-1111-111111111111';
  const BATCH_B_ID = 'b2222222-2222-2222-2222-222222222222';

  beforeAll(async () => {
    db = new PGlite();

    // 1. Setup Supabase auth mock schema and auth.uid() function
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
      END
      $$;

      -- 2. Organizations and staff profiles
      CREATE TABLE public.organizations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        plan TEXT NOT NULL DEFAULT 'standard',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (organization_id, id)
      );

      -- 3. Business tables: Customers & Inventory Batches
      CREATE TABLE public.customers (
        organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
        id UUID NOT NULL,
        name TEXT NOT NULL,
        email TEXT,
        balance NUMERIC NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (organization_id, id)
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

      -- 4. Current org helper function
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

      -- 5. Tenant auto-stamping trigger
      CREATE OR REPLACE FUNCTION public.stamp_organization_id()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      AS $$
      DECLARE
        v_org_id UUID;
      BEGIN
        v_org_id := public.current_org_id();
        IF v_org_id IS NULL THEN
          RAISE EXCEPTION 'Tenant security violation: No active organization associated with authenticated user';
        END IF;
        NEW.organization_id := v_org_id;
        RETURN NEW;
      END;
      $$;

      CREATE TRIGGER trg_stamp_org_customers
      BEFORE INSERT ON public.customers
      FOR EACH ROW EXECUTE FUNCTION public.stamp_organization_id();

      CREATE TRIGGER trg_stamp_org_inventory
      BEFORE INSERT ON public.inventory_batches
      FOR EACH ROW EXECUTE FUNCTION public.stamp_organization_id();

      -- 6. Enable and Force Row-Level Security
      ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.organizations FORCE ROW LEVEL SECURITY;

      ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.staff_profiles FORCE ROW LEVEL SECURITY;

      ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.customers FORCE ROW LEVEL SECURITY;

      ALTER TABLE public.inventory_batches ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.inventory_batches FORCE ROW LEVEL SECURITY;

      -- 7. Define RLS Policies
      CREATE POLICY "organizations_isolation" ON public.organizations
      FOR ALL TO authenticated
      USING (id = public.current_org_id());

      CREATE POLICY "staff_profiles_isolation" ON public.staff_profiles
      FOR SELECT TO authenticated
      USING (organization_id = public.current_org_id());

      CREATE POLICY "customers_tenant_isolation" ON public.customers
      FOR ALL TO authenticated
      USING (organization_id = public.current_org_id())
      WITH CHECK (organization_id = public.current_org_id());

      CREATE POLICY "inventory_tenant_isolation" ON public.inventory_batches
      FOR ALL TO authenticated
      USING (organization_id = public.current_org_id())
      WITH CHECK (organization_id = public.current_org_id());

      -- Grant permissions to authenticated role
      GRANT USAGE ON SCHEMA public TO authenticated;
      GRANT SELECT ON public.organizations TO authenticated;
      GRANT SELECT ON public.staff_profiles TO authenticated;
      GRANT ALL ON public.customers TO authenticated;
      GRANT ALL ON public.inventory_batches TO authenticated;
    `);

    // Superuser setup: Seed 2 independent organizations and staff profiles
    await db.exec(`
      INSERT INTO public.organizations (id, name, plan)
      VALUES 
        ('${ORG_A_ID}', 'Atlantic Deep Sea Fisheries Ltd', 'enterprise'),
        ('${ORG_B_ID}', 'Pacific Polar Cold Storage Corp', 'standard');

      INSERT INTO public.staff_profiles (id, organization_id, email, full_name, role)
      VALUES
        ('${USER_A_ID}', '${ORG_A_ID}', 'kwame@atlantic.com', 'Kwame Mensah', 'admin'),
        ('${USER_B_ID}', '${ORG_B_ID}', 'elena@pacific.com', 'Elena Rostova', 'admin');
    `);
  });

  afterAll(async () => {
    if (db) {
      await db.close();
    }
  });

  // Helper to run queries as a specific authenticated user
  async function asUser<T = any>(userId: string, callback: () => Promise<T>): Promise<T> {
    await db.exec(`
      SET ROLE authenticated;
      SET request.jwt.claim.sub = '${userId}';
    `);
    try {
      return await callback();
    } finally {
      await db.exec(`
        RESET ROLE;
        RESET request.jwt.claim.sub;
      `);
    }
  }

  it('proves User A inserts records that are automatically stamped with Org A ID', async () => {
    await asUser(USER_A_ID, async () => {
      // Notice: we pass a dummy organization_id in INSERT; the trigger should overwrite it with Org A ID
      await db.exec(`
        INSERT INTO public.customers (organization_id, id, name, email, balance)
        VALUES ('00000000-0000-0000-0000-000000000000', '${CUST_A_ID}', 'Tema Harbor Market', 'tema@market.gh', 1250.00);

        INSERT INTO public.inventory_batches (organization_id, id, lot_number, species_name, weight_kg)
        VALUES ('00000000-0000-0000-0000-000000000000', '${BATCH_A_ID}', 'LOT-ATL-001', 'Yellowfin Tuna', 450.5);
      `);

      const resCustomers = await db.query<{ id: string; organization_id: string; name: string }>(
        'SELECT id, organization_id, name FROM public.customers;'
      );
      expect(resCustomers.rows.length).toBe(1);
      expect(resCustomers.rows[0].id).toBe(CUST_A_ID);
      expect(resCustomers.rows[0].organization_id).toBe(ORG_A_ID);
      expect(resCustomers.rows[0].name).toBe('Tema Harbor Market');

      const resInventory = await db.query<{ id: string; organization_id: string; species_name: string }>(
        'SELECT id, organization_id, species_name FROM public.inventory_batches;'
      );
      expect(resInventory.rows.length).toBe(1);
      expect(resInventory.rows[0].id).toBe(BATCH_A_ID);
      expect(resInventory.rows[0].organization_id).toBe(ORG_A_ID);
    });
  });

  it('proves User B cannot see any data created by Organization A (Zero Read Leakage)', async () => {
    await asUser(USER_B_ID, async () => {
      // User B queries customers and inventory batches
      const custRes = await db.query('SELECT * FROM public.customers;');
      expect(custRes.rows.length).toBe(0);

      const batchRes = await db.query('SELECT * FROM public.inventory_batches;');
      expect(batchRes.rows.length).toBe(0);

      // Direct ID lookup on User A's customer returns empty
      const directCust = await db.query('SELECT * FROM public.customers WHERE id = $1;', [CUST_A_ID]);
      expect(directCust.rows.length).toBe(0);

      // Staff profiles lookup returns only User B's profile, hiding User A
      const staffRes = await db.query<{ id: string; email: string }>('SELECT id, email FROM public.staff_profiles;');
      expect(staffRes.rows.length).toBe(1);
      expect(staffRes.rows[0].id).toBe(USER_B_ID);
      expect(staffRes.rows[0].email).toBe('elena@pacific.com');
    });
  });

  it('proves User B inserts their own data and both tenants remain isolated', async () => {
    await asUser(USER_B_ID, async () => {
      await db.exec(`
        INSERT INTO public.customers (organization_id, id, name, email, balance)
        VALUES ('${ORG_B_ID}', '${CUST_B_ID}', 'Vancouver Seafood Bistro', 'bistro@van.ca', 820.00);

        INSERT INTO public.inventory_batches (organization_id, id, lot_number, species_name, weight_kg)
        VALUES ('${ORG_B_ID}', '${BATCH_B_ID}', 'LOT-PAC-099', 'Sockeye Salmon', 890.0);
      `);

      const custRes = await db.query<{ id: string; name: string }>('SELECT id, name FROM public.customers;');
      expect(custRes.rows.length).toBe(1);
      expect(custRes.rows[0].id).toBe(CUST_B_ID);
      expect(custRes.rows[0].name).toBe('Vancouver Seafood Bistro');
    });

    // Verify User A still only sees Org A's data
    await asUser(USER_A_ID, async () => {
      const custRes = await db.query<{ id: string; name: string }>('SELECT id, name FROM public.customers;');
      expect(custRes.rows.length).toBe(1);
      expect(custRes.rows[0].id).toBe(CUST_A_ID);
      expect(custRes.rows[0].name).toBe('Tema Harbor Market');

      // User A querying User B's customer ID returns empty
      const queryOther = await db.query('SELECT * FROM public.customers WHERE id = $1;', [CUST_B_ID]);
      expect(queryOther.rows.length).toBe(0);
    });
  });

  it('proves User B cannot UPDATE, OVERWRITE, or MUTATE Organization A records', async () => {
    await asUser(USER_B_ID, async () => {
      // User B attempts to overwrite User A's customer balance and name
      const updateRes = await db.query(
        "UPDATE public.customers SET name = 'MALICIOUS TAKEOVER', balance = 999999 WHERE id = $1;",
        [CUST_A_ID]
      );
      // RLS policy prevents match; 0 rows affected
      expect(updateRes.affectedRows).toBe(0);
    });

    // Check User A's data was not touched
    await asUser(USER_A_ID, async () => {
      const checkRes = await db.query<{ name: string; balance: string }>(
        'SELECT name, balance FROM public.customers WHERE id = $1;',
        [CUST_A_ID]
      );
      expect(checkRes.rows[0].name).toBe('Tema Harbor Market');
      expect(Number(checkRes.rows[0].balance)).toBe(1250);
    });
  });

  it('proves User B cannot DELETE Organization A records', async () => {
    await asUser(USER_B_ID, async () => {
      // User B attempts to delete User A's inventory batch
      const deleteRes = await db.query(
        'DELETE FROM public.inventory_batches WHERE id = $1;',
        [BATCH_A_ID]
      );
      expect(deleteRes.affectedRows).toBe(0);
    });

    // Verify User A's batch is intact
    await asUser(USER_A_ID, async () => {
      const batchRes = await db.query<{ id: string; lot_number: string }>(
        'SELECT id, lot_number FROM public.inventory_batches WHERE id = $1;',
        [BATCH_A_ID]
      );
      expect(batchRes.rows.length).toBe(1);
      expect(batchRes.rows[0].id).toBe(BATCH_A_ID);
    });
  });

  it('proves deactivated staff members immediately lose all tenant access', async () => {
    // Admin deactivates User A
    await db.exec(`
      UPDATE public.staff_profiles SET is_active = FALSE WHERE id = '${USER_A_ID}';
    `);

    await asUser(USER_A_ID, async () => {
      // Querying returns 0 rows because current_org_id() evaluates to NULL
      const custRes = await db.query('SELECT * FROM public.customers;');
      expect(custRes.rows.length).toBe(0);

      // Attempting to insert throws tenant security violation
      await expect(
        db.exec(`
          INSERT INTO public.customers (organization_id, id, name)
          VALUES ('${ORG_A_ID}', gen_random_uuid(), 'Illegal Insert');
        `)
      ).rejects.toThrow('Tenant security violation: No active organization associated with authenticated user');
    });

    // Re-activate User A
    await db.exec(`
      UPDATE public.staff_profiles SET is_active = TRUE WHERE id = '${USER_A_ID}';
    `);

    // Verify access restored
    await asUser(USER_A_ID, async () => {
      const custRes = await db.query('SELECT * FROM public.customers;');
      expect(custRes.rows.length).toBe(1);
    });
  });
});
