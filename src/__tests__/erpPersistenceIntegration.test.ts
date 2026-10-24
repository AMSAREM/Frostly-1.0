import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import crypto from 'crypto';
import { createExpressApp } from '../../server';
import { financialMapper } from '../mappers/financialMapper';

function createErpPersistenceStatefulMock() {
  const ORG_A = '35a94c6e-e230-4b7c-8404-a4f0ae06b798';
  const ORG_B = '99999999-9999-4999-8999-999999999999';

  const STAFF_USER_ID = '11111111-1111-4111-8111-111111111111';
  const CREATOR_USER_ID = '22222222-2222-4222-8222-222222222222';

  // Enforce live Supabase schema columns for financial_ledger_entries, retail_wholesale_products, species & inventory_batches
  const FORBIDDEN_COLUMNS: Record<string, Set<string>> = {
    financial_ledger_entries: new Set([
      'customer_id',
      'supplier_id',
      'receipt_number',
      'voucher_number',
      'notes',
    ]),
    retail_wholesale_products: new Set(['linked_batch_id', 'storage_zone']),
    species: new Set([
      'common_name',
      'ideal_temp_min_c',
      'ideal_temp_max_c',
      'base_shelf_life_days',
      'average_market_price_per_kg',
    ]),
    inventory_batches: new Set([
      'catch_method',
      'catch_zone',
      'best_before_date',
      'current_temp_c',
      'target_temp_c',
      'haccp_inspector',
      'is_glaze_protected',
    ]),
  };

  const tables: Record<string, any[]> = {
    organizations: [
      {
        id: ORG_A,
        name: 'Amans Ocean Seafoods and Coldstore',
        company_name: 'Amans Ocean Seafoods',
        subscription_status: 'active',
        plan_tier: 'enterprise',
        max_staff_seats: 25,
        is_active: true,
        created_at: new Date().toISOString(),
      },
      {
        id: ORG_B,
        name: 'Secondary Coastal Tenant',
        company_name: 'Secondary Coastal Tenant',
        subscription_status: 'trial',
        plan_tier: 'starter',
        max_staff_seats: 5,
        is_active: true,
        created_at: new Date().toISOString(),
      },
    ],
    staff_profiles: [
      {
        id: STAFF_USER_ID,
        organization_id: ORG_A,
        role: 'ops_staff',
        is_active: true,
        full_name: 'Kwesi Boateng',
        email: 'kwesi@amansocean.com',
      },
      {
        id: CREATOR_USER_ID,
        organization_id: ORG_A,
        role: 'creator',
        is_active: true,
        full_name: 'Platform Creator',
        email: 'creator@amansocean.com',
      },
    ],
    platform_admins: [{ user_id: CREATOR_USER_ID, email: 'creator@amansocean.com' }],
    platform_audit_logs: [],
    invites: [],
    species: [],
    customers: [],
    suppliers: [],
    inventory_batches: [],
    inventory_adjustment_accounts: [],
    inventory_adjustments: [],
    client_orders: [],
    order_line_items: [],
    retail_wholesale_products: [],
    retail_transactions: [],
    retail_sale_items: [],
    purchase_order_landings: [],
    purchase_order_items: [],
    financial_ledger_entries: [],
    haccp_audit_records: [],
    system_notifications: [],
    app_settings: [],
    user_login_logs: [],
    user_feature_usage_logs: [],
  };

  // Simulate FK error on hard delete for referenced products
  const referencedProductIds = new Set<string>(['PROD-REFERENCED-1']);

  function validateSchemaColumns(table: string, row: Record<string, any>): any {
    const forbidden = FORBIDDEN_COLUMNS[table];
    if (forbidden) {
      for (const col of Object.keys(row)) {
        if (forbidden.has(col)) {
          return {
            message: `Could not find the '${col}' column of '${table}' in the schema cache`,
            code: 'PGRST204',
          };
        }
      }
    }
    return null;
  }

  function makeQueryBuilder(table: string) {
    if (!tables[table]) tables[table] = [];
    const predicates: Array<(r: any) => boolean> = [];
    let pendingAction: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select';
    let selectColumns = '*';
    let mutationPayload: any = null;
    let conflictCols: string[] = [];
    let sortCol: string | null = null;
    let sortAsc = true;
    let rowLimit: number | null = null;

    const attachChildren = (rows: any[]) => {
      if (selectColumns.includes('order_line_items')) {
        return rows.map((r) => ({
          ...r,
          order_line_items: tables.order_line_items.filter(
            (li) => li.order_id === r.id && li.organization_id === r.organization_id
          ),
        }));
      }
      if (selectColumns.includes('retail_sale_items')) {
        return rows.map((r) => ({
          ...r,
          retail_sale_items: tables.retail_sale_items.filter(
            (si) => si.transaction_id === r.id && si.organization_id === r.organization_id
          ),
        }));
      }
      if (selectColumns.includes('purchase_order_items')) {
        return rows.map((r) => ({
          ...r,
          purchase_order_items: tables.purchase_order_items.filter(
            (pi) => pi.po_id === r.id && pi.organization_id === r.organization_id
          ),
        }));
      }
      return rows;
    };

    const execute = async (): Promise<{ data: any; error: any }> => {
      const store = tables[table];

      if (pendingAction === 'insert') {
        const rowsToInsert = Array.isArray(mutationPayload) ? mutationPayload : [mutationPayload];
        for (const item of rowsToInsert) {
          const schemaErr = validateSchemaColumns(table, item);
          if (schemaErr) return { data: null, error: schemaErr };
        }
        const inserted = rowsToInsert.map((item) => {
          const record = {
            id: item.id || crypto.randomUUID(),
            created_at: item.created_at || new Date().toISOString(),
            updated_at: item.updated_at || new Date().toISOString(),
            ...item,
          };
          store.push(record);
          return record;
        });
        return { data: Array.isArray(mutationPayload) ? inserted : inserted[0], error: null };
      }

      if (pendingAction === 'upsert') {
        const rowsToUpsert = Array.isArray(mutationPayload) ? mutationPayload : [mutationPayload];
        for (const item of rowsToUpsert) {
          const schemaErr = validateSchemaColumns(table, item);
          if (schemaErr) return { data: null, error: schemaErr };
        }
        const results = rowsToUpsert.map((item) => {
          const existingIdx = store.findIndex((existing) =>
            conflictCols.length > 0
              ? conflictCols.every((c) => String(existing[c]) === String(item[c]))
              : existing.id && item.id && existing.id === item.id
          );
          if (existingIdx >= 0) {
            store[existingIdx] = {
              ...store[existingIdx],
              ...item,
              updated_at: new Date().toISOString(),
            };
            return store[existingIdx];
          }
          const created = {
            id: item.id || crypto.randomUUID(),
            created_at: item.created_at || new Date().toISOString(),
            updated_at: item.updated_at || new Date().toISOString(),
            ...item,
          };
          store.push(created);
          return created;
        });
        return { data: Array.isArray(mutationPayload) ? results : results[0], error: null };
      }

      const matched = store.filter((r) => predicates.every((fn) => fn(r)));

      if (pendingAction === 'update') {
        const updated = matched.map((r) => {
          Object.assign(r, mutationPayload, { updated_at: new Date().toISOString() });
          return r;
        });
        return { data: updated, error: null };
      }

      if (pendingAction === 'delete') {
        if (
          table === 'retail_wholesale_products' &&
          matched.some((r) => referencedProductIds.has(String(r.id)))
        ) {
          return {
            data: null,
            error: {
              code: '23503',
              message: 'update or delete on table violates foreign key constraint',
            },
          };
        }
        for (const m of matched) {
          const idx = store.indexOf(m);
          if (idx >= 0) store.splice(idx, 1);
        }
        return { data: matched, error: null };
      }

      let out = [...matched];
      if (sortCol) {
        const col = sortCol;
        out.sort((a, b) => {
          const va = a[col] ?? '';
          const vb = b[col] ?? '';
          if (va < vb) return sortAsc ? -1 : 1;
          if (va > vb) return sortAsc ? 1 : -1;
          return 0;
        });
      }
      if (rowLimit !== null) {
        out = out.slice(0, rowLimit);
      }
      return { data: attachChildren(out), error: null };
    };

    const builder: any = {
      select(cols?: string) {
        if (cols) selectColumns = cols;
        return builder;
      },
      insert(payload: any) {
        pendingAction = 'insert';
        mutationPayload = payload;
        return builder;
      },
      upsert(payload: any, opts?: { onConflict?: string }) {
        pendingAction = 'upsert';
        mutationPayload = payload;
        conflictCols = opts?.onConflict ? opts.onConflict.split(',').map((s) => s.trim()) : [];
        return builder;
      },
      update(payload: any) {
        pendingAction = 'update';
        mutationPayload = payload;
        return builder;
      },
      delete() {
        pendingAction = 'delete';
        return builder;
      },
      eq(col: string, val: any) {
        predicates.push((r) => r[col] === val);
        return builder;
      },
      neq(col: string, val: any) {
        predicates.push((r) => r[col] !== val);
        return builder;
      },
      is(col: string, val: any) {
        predicates.push((r) => (val === null ? r[col] == null : r[col] === val));
        return builder;
      },
      order(col: string, opts?: { ascending?: boolean }) {
        sortCol = col;
        sortAsc = opts?.ascending !== false;
        return builder;
      },
      limit(n: number) {
        rowLimit = n;
        return builder;
      },
      async maybeSingle() {
        const res = await execute();
        if (res.error) return res;
        const first = Array.isArray(res.data) ? res.data[0] || null : res.data || null;
        return { data: first, error: null };
      },
      async single() {
        const res = await execute();
        if (res.error) return res;
        const first = Array.isArray(res.data) ? res.data[0] || null : res.data || null;
        if (!first) return { data: null, error: { message: 'Row not found' } };
        return { data: first, error: null };
      },
      then(onFulfilled: any, onRejected: any) {
        return execute().then(onFulfilled, onRejected);
      },
    };
    return builder;
  }

  return {
    ORG_A,
    ORG_B,
    STAFF_USER_ID,
    CREATOR_USER_ID,
    tables,
    client: {
      from: (table: string) => makeQueryBuilder(table),
      auth: {
        getUser: async (token: string) => {
          if (token === 'valid-staff-token') {
            return {
              data: {
                user: { id: STAFF_USER_ID, email: 'kwesi@amansocean.com', user_metadata: {} },
              },
              error: null,
            };
          }
          if (token === 'valid-creator-token') {
            return {
              data: {
                user: {
                  id: CREATOR_USER_ID,
                  email: 'creator@amansocean.com',
                  user_metadata: { role: 'platform_creator' },
                },
              },
              error: null,
            };
          }
          return { data: { user: null }, error: { message: 'Invalid token' } };
        },
      },
    },
  };
}

describe('Unified Supabase ERP, POS Register, Platform & Activity Persistence', () => {
  const mockDb = createErpPersistenceStatefulMock();
  let server1: http.Server;
  let baseUrl1 = '';

  beforeAll(async () => {
    const app = await createExpressApp({ withVite: false, adminClient: mockDb.client });
    server1 = http.createServer(app);
    await new Promise<void>((resolve) => {
      server1.listen(0, '127.0.0.1', () => {
        const addr = server1.address() as any;
        baseUrl1 = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server1) {
      await new Promise<void>((resolve) => server1.close(() => resolve()));
    }
  });

  it('1. persists client_orders with child order_line_items and auto-provisions missing FK prerequisites in Supabase', async () => {
    const upsertRes = await fetch(`${baseUrl1}/api/erp/persistence/upsert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-staff-token',
      },
      body: JSON.stringify({
        tableName: 'client_orders',
        payload: {
          id: 'ORD-SUPA-901',
          customer_id: 'CUST-NEW-HOTEL',
          client_name: 'Kempinski Gold Coast Kitchens',
          client_category: 'Hotel & Resort',
          contact_person: 'Chef Ama',
          contact_email: 'kitchen@kempinski.gh',
          contact_phone: '+233 24 111 2222',
          destination_city: 'Accra',
          delivery_address: 'Ridge, Accra',
          order_date: '2026-10-24',
          required_delivery_date: '2026-10-25',
          status: 'Pending Confirmation',
          quoted_total_usd: 1500,
          adjusted_total_usd: 1500,
          payment_status: 'Pending Net-15',
          packaging_requirement: 'Dry Ice & Insulated Wax Carton',
          packing_slip_generated: false,
        },
        childItems: [
          {
            species_id: 'spec-grouper',
            species_name: 'Grouper (5kg Pack)',
            grade: 'Export Grade A',
            lot_id: 'LOT-GRP-901',
            requested_weight_kg: 10,
            actual_weighed_kg: 10,
            price_per_kg: 150,
          },
        ],
      }),
    });

    expect(upsertRes.status).toBe(200);
    // FK prerequisites auto-created
    expect(mockDb.tables.customers.some((c) => c.id === 'CUST-NEW-HOTEL')).toBe(true);
    expect(mockDb.tables.species.some((s) => s.id === 'spec-grouper')).toBe(true);
    expect(mockDb.tables.inventory_batches.some((b) => b.id === 'LOT-GRP-901')).toBe(true);

    // Query with includeChildren=true returns nested order_line_items
    const queryRes = await fetch(
      `${baseUrl1}/api/erp/persistence/query?table=client_orders&includeChildren=true`,
      {
        headers: { Authorization: 'Bearer valid-staff-token' },
      }
    );
    expect(queryRes.status).toBe(200);
    const queryBody = await queryRes.json();
    const savedOrder = queryBody.rows.find((o: any) => o.id === 'ORD-SUPA-901');
    expect(savedOrder).toBeDefined();
    expect(savedOrder.payment_status).toBe('Pending Net-30');
    expect(savedOrder.order_line_items).toHaveLength(1);
    expect(savedOrder.order_line_items[0].grade).toBe('Grade #1');
  });

  it('2. persists financial_ledger_entries without non-schema columns while preserving customer/supplier/receipt metadata', async () => {
    const finRes = await fetch(`${baseUrl1}/api/erp/persistence/upsert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-staff-token',
      },
      body: JSON.stringify({
        tableName: 'financial_ledger_entries',
        payload: {
          id: 'FIN-TEST-7788',
          entry_date: '2026-10-24',
          type: 'Income',
          category: 'Revenue (Wholesale)',
          description: 'Customer AR Settlement Received',
          reference_id: 'PMT-AR-901',
          entity_name: 'Kempinski Gold Coast Kitchens',
          amount: 1500,
          payment_method: 'Mobile Money',
          status: 'Settled',
          customer_id: 'CUST-NEW-HOTEL',
          receipt_number: 'RCPT-889900',
          notes: 'MTN MoMo instant settlement',
        },
      }),
    });

    expect(finRes.status).toBe(200);
    expect(mockDb.tables.financial_ledger_entries).toHaveLength(1);
    const rawRow = mockDb.tables.financial_ledger_entries[0];
    expect(rawRow.customer_id).toBeUndefined();
    expect(rawRow.receipt_number).toBeUndefined();

    const roundTripped = financialMapper.toDomain(rawRow);
    expect(roundTripped.description).toBe('Customer AR Settlement Received');
    expect(roundTripped.customerId).toBe('CUST-NEW-HOTEL');
    expect(roundTripped.receiptNumber).toBe('RCPT-889900');
    expect(roundTripped.notes).toBe('MTN MoMo instant settlement');
  });

  it('3. persists inventory_adjustments with auto-provisioned UUID adjustment_account_id and app_settings', async () => {
    const adjRes = await fetch(`${baseUrl1}/api/erp/persistence/upsert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-staff-token',
      },
      body: JSON.stringify({
        tableName: 'inventory_adjustments',
        payload: {
          id: 'ADJ-SHRINK-01',
          batch_id: 'LOT-GRP-901',
          species_name: 'Grouper (5kg Pack)',
          storage_zone: 'Commercial Cold Storage (-22°C)',
          previous_weight_kg: 100,
          new_weight_kg: 97.5,
          variance_weight_kg: -2.5,
          unit_cost_per_kg: 45,
          valuation_variance_usd: -112.5,
          adjustment_account_id: 'adj-acc-5120',
          adjustment_account_code: '5120-GLAZE-SHRINK',
          adjustment_account_name: 'Cryo-Glaze & Drip Loss',
          reason: 'Scheduled Weight Audit',
          authorized_by: 'Kwesi Boateng',
        },
      }),
    });
    expect(adjRes.status).toBe(200);
    expect(mockDb.tables.inventory_adjustment_accounts).toHaveLength(1);
    expect(mockDb.tables.inventory_adjustments).toHaveLength(1);
    expect(mockDb.tables.inventory_adjustments[0].adjustment_account_id).toBe(
      mockDb.tables.inventory_adjustment_accounts[0].id
    );

    const setRes = await fetch(`${baseUrl1}/api/erp/persistence/settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-staff-token',
      },
      body: JSON.stringify({
        payload: {
          company_name: 'Amans Ocean Coldstore HQ',
          currency: 'GHS',
          tax_rate: 5,
        },
      }),
    });
    expect(setRes.status).toBe(200);
    expect(mockDb.tables.app_settings[0].currency).toBe('GHS');
  });

  it('4. enforces cross-tenant isolation and performs soft-delete when products are FK-referenced', async () => {
    // Non-creator staff attempting to access ORG_B must receive 403
    const forbiddenRes = await fetch(
      `${baseUrl1}/api/erp/persistence/query?table=customers&organizationId=${mockDb.ORG_B}`,
      {
        headers: { Authorization: 'Bearer valid-staff-token' },
      }
    );
    expect(forbiddenRes.status).toBe(403);

    // Seed referenced product & verify soft-delete fallback sets is_active = false
    await fetch(`${baseUrl1}/api/erp/persistence/upsert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-staff-token',
      },
      body: JSON.stringify({
        tableName: 'retail_wholesale_products',
        payload: {
          id: 'PROD-REFERENCED-1',
          species_id: 'spec-grouper',
          name: 'Grouper Fillet Pack',
          cut_type: 'Portion Cut',
          category: 'Groundfish',
          grade: 'Grade #1',
          stock_kg: 40,
          unit: 'kg',
          cost_price_per_unit: 95,
          wholesale_price_per_unit: 150,
          retail_price_per_unit: 150,
          wholesale_min_qty: 1,
          sku: 'AO-GRP-01',
          image_url: '/images/products/grouper.jpg',
          origin: 'Ghana',
          linked_batch_id: 'LOT-GRP-901',
          storage_zone: 'Commercial Cold Storage (-22°C)',
          is_available_for_retail: true,
          is_available_for_wholesale: true,
        },
      }),
    });

    const delRes = await fetch(`${baseUrl1}/api/erp/persistence/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-staff-token',
      },
      body: JSON.stringify({
        tableName: 'retail_wholesale_products',
        recordId: 'PROD-REFERENCED-1',
      }),
    });
    expect(delRes.status).toBe(200);
    const delBody = await delRes.json();
    expect(delBody.softDeleted).toBe(true);
    expect(
      mockDb.tables.retail_wholesale_products.find((p) => p.id === 'PROD-REFERENCED-1')?.is_active
    ).toBe(false);
  });

  it('5. persists POS register sessions to Supabase and hydrates them across server restarts, plus Platform & Activity logs', async () => {
    const putSessionRes = await fetch(`${baseUrl1}/api/pos/register-session`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        registerId: 'REG-PERSIST',
        pricingMode: 'wholesale',
        customerName: 'Tema Harbour Hotel',
        discountPct: 10,
        items: [
          {
            productId: 'ao-red-fish-regular',
            sku: 'AO-013',
            name: 'Red Fish (Regular)',
            quantity: 4,
            retailPricePerUnit: 85,
            wholesalePricePerUnit: 85,
            unitPrice: 85,
          },
        ],
      }),
    });
    expect(putSessionRes.status).toBe(200);
    expect(
      mockDb.tables.user_feature_usage_logs.some(
        (r) => r.category === 'pos_register_internal' && r.feature_name === 'REG-PERSIST'
      )
    ).toBe(true);

    // Boot a brand-new Express server instance (empty in-memory Map) sharing the same Supabase store
    const app2 = await createExpressApp({ withVite: false, adminClient: mockDb.client });
    const server2 = http.createServer(app2);
    const baseUrl2 = await new Promise<string>((resolve) => {
      server2.listen(0, '127.0.0.1', () => {
        const addr = server2.address() as any;
        resolve(`http://127.0.0.1:${addr.port}`);
      });
    });

    try {
      const hydratedRes = await fetch(`${baseUrl2}/api/pos/register-session?registerId=REG-PERSIST`);
      expect(hydratedRes.status).toBe(200);
      const hydratedBody = await hydratedRes.json();
      expect(hydratedBody.session.customerName).toBe('Tema Harbour Hotel');
      expect(hydratedBody.session.pricingMode).toBe('wholesale');
      expect(hydratedBody.session.items).toHaveLength(1);
      expect(hydratedBody.session.items[0].quantity).toBe(4);
    } finally {
      await new Promise<void>((resolve) => server2.close(() => resolve()));
    }

    // Platform subscription update + audit log + Activity login log
    const subRes = await fetch(
      `${baseUrl1}/api/platform/organizations/${mockDb.ORG_B}/subscription`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-creator-token',
        },
        body: JSON.stringify({
          status: 'active',
          planTier: 'standard',
          maxSeats: 20,
          reason: 'Upgraded to Standard plan',
        }),
      }
    );
    expect(subRes.status).toBe(200);
    expect(mockDb.tables.platform_audit_logs).toHaveLength(1);

    const loginRes = await fetch(`${baseUrl1}/api/activity/logins`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-staff-token',
      },
      body: JSON.stringify({
        deviceType: 'desktop',
        userAgent: 'Vitest Verification Suite',
      }),
    });
    expect(loginRes.status).toBe(201);
    expect(mockDb.tables.user_login_logs).toHaveLength(1);
    expect(mockDb.tables.user_login_logs[0].email).toBe('kwesi@amansocean.com');
  });
});
