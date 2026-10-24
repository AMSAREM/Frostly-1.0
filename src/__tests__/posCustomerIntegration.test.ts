import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import crypto from 'crypto';
import { createExpressApp } from '../../server';
import {
  activatePosCustomerKioskLock,
  isPosCustomerKioskLocked,
  preparePosSecurityExitToLogin,
  isPosSecurityReauthActive,
  clearPosSecurityReauth,
  consumePosPostLoginTab,
} from '../services/posCustomerService';

/**
 * Stateful in-memory Supabase Admin Mock for POS Customer View & Dual-Channel Counter Kiosk verification.
 */
function createPosCustomerStatefulMock() {
  const ORG_ID = '35a94c6e-e230-4b7c-8404-a4f0ae06b798';
  const ORG_NAME = 'Amans  Ocean  Seafoods and Coldstore';

  const tables: Record<string, any[]> = {
    organizations: [
      {
        id: ORG_ID,
        name: ORG_NAME,
        is_active: true,
        plan_tier: 'enterprise',
        max_staff_seats: 25,
        created_at: new Date().toISOString(),
      },
    ],
    staff_profiles: [
      {
        id: 'cashier-user-id',
        organization_id: ORG_ID,
        role: 'manager',
        is_active: true,
        full_name: 'Anna Vance',
        email: 'anna@amansocean.com',
      },
    ],
    species: [],
    retail_wholesale_products: [],
    inventory_batches: [],
    customers: [
      {
        id: 'CUST-B2B-101',
        organization_id: ORG_ID,
        name: 'Kwame Mensah',
        company_name: 'Labadi Beach Resort Kitchens',
        type: 'Hotel & Resort',
        tier: 'Tier 1 (VIP Wholesale -15%)',
        contact_person: 'Kwame Mensah',
        email: 'procurement@labadireef.com',
        phone: '+233 24 888 1001',
        address: '1 La Bypass, Accra',
        city: 'Accra',
        credit_limit_usd: 2000,
        outstanding_balance_usd: 450,
        payment_terms: 'Net-30',
        total_orders_count: 3,
        total_spend_usd: 2150,
        status: 'Active',
        is_active: true,
      },
      {
        id: 'CUST-B2B-HOLD',
        organization_id: ORG_ID,
        name: 'Harbor Bistro',
        company_name: 'Harbor Bistro Ltd',
        type: 'Wholesale Restaurant',
        tier: 'Tier 2 (Standard Wholesale)',
        contact_person: 'Harbor Chef',
        email: 'ap@harborbistro.com',
        phone: '+233 20 999 4400',
        address: 'Tema Community 1',
        city: 'Tema',
        credit_limit_usd: 2000,
        outstanding_balance_usd: 1950,
        payment_terms: 'Net-15',
        total_orders_count: 5,
        total_spend_usd: 4800,
        status: 'Credit Hold',
        is_active: true,
      },
    ],
    client_orders: [],
    order_line_items: [],
    retail_transactions: [],
    retail_sale_items: [],
    financial_ledger_entries: [
      {
        id: 'FIN-OPEN-1',
        organization_id: ORG_ID,
        customer_id: 'CUST-B2B-101',
        entry_date: '2026-10-01',
        type: 'Income',
        category: 'Revenue (Wholesale)',
        description: 'Wholesale Invoice ORD-10001',
        reference_id: 'ORD-10001',
        entity_name: 'Labadi Beach Resort Kitchens',
        amount: 650,
        payment_method: 'Net-30 Credit',
        status: 'Pending',
      },
      {
        id: 'FIN-PAY-1',
        organization_id: ORG_ID,
        customer_id: 'CUST-B2B-101',
        entry_date: '2026-10-10',
        type: 'Income',
        category: 'AR Payment',
        description: 'Payment received on ORD-10001',
        reference_id: 'PAY-9001',
        entity_name: 'Labadi Beach Resort Kitchens',
        amount: 250,
        payment_method: 'Bank Wire',
        status: 'Settled',
      },
    ],
    system_notifications: [],
    storefront_analytics_events: [],
    user_feature_usage_logs: [],
  };

  function makeQueryBuilder(table: string) {
    if (!tables[table]) tables[table] = [];
    const predicates: Array<(r: any) => boolean> = [];
    let pendingAction: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select';
    let mutationPayload: any = null;
    let conflictCols: string[] = [];
    let sortCol: string | null = null;
    let sortAsc = true;
    let rowLimit: number | null = null;

    const execute = async (): Promise<{ data: any; error: any }> => {
      const store = tables[table];

      if (pendingAction === 'insert') {
        const rowsToInsert = Array.isArray(mutationPayload) ? mutationPayload : [mutationPayload];
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
        matched.forEach((row) => {
          Object.assign(row, mutationPayload);
        });
        return { data: matched, error: null };
      }

      if (pendingAction === 'delete') {
        tables[table] = store.filter((r) => !predicates.every((fn) => fn(r)));
        return { data: matched, error: null };
      }

      let output = [...matched];
      if (sortCol) {
        const col = sortCol;
        output.sort((a, b) => {
          const av = a[col] ?? '';
          const bv = b[col] ?? '';
          if (av < bv) return sortAsc ? -1 : 1;
          if (av > bv) return sortAsc ? 1 : -1;
          return 0;
        });
      }
      if (rowLimit !== null) {
        output = output.slice(0, rowLimit);
      }
      return { data: output, error: null };
    };

    const builder: any = {
      select: () => {
        if (pendingAction !== 'insert' && pendingAction !== 'upsert') {
          pendingAction = 'select';
        }
        return builder;
      },
      insert: (payload: any) => {
        pendingAction = 'insert';
        mutationPayload = payload;
        return builder;
      },
      upsert: (payload: any, opts?: { onConflict?: string }) => {
        pendingAction = 'upsert';
        mutationPayload = payload;
        conflictCols = opts?.onConflict ? opts.onConflict.split(',').map((s) => s.trim()) : [];
        return builder;
      },
      update: (payload: any) => {
        pendingAction = 'update';
        mutationPayload = payload;
        return builder;
      },
      delete: () => {
        pendingAction = 'delete';
        return builder;
      },
      eq: (col: string, val: any) => {
        predicates.push((r) => r[col] === val);
        return builder;
      },
      neq: (col: string, val: any) => {
        predicates.push((r) => r[col] !== val);
        return builder;
      },
      in: (col: string, vals: any[]) => {
        predicates.push((r) => vals.includes(r[col]));
        return builder;
      },
      like: (col: string, pattern: string) => {
        const prefix = pattern.replace(/%/g, '');
        predicates.push((r) => String(r[col] || '').startsWith(prefix));
        return builder;
      },
      ilike: (col: string, pattern: string) => {
        const clean = pattern.replace(/%/g, '').toLowerCase();
        predicates.push((r) => String(r[col] || '').toLowerCase().includes(clean));
        return builder;
      },
      gte: (col: string, val: any) => {
        predicates.push((r) => String(r[col] || '') >= String(val));
        return builder;
      },
      or: (expr: string) => {
        const parts = expr.split(',').map((s) => s.trim());
        predicates.push((r) =>
          parts.some((p) => {
            const [col, op, val] = p.split('.');
            if (op === 'eq') return String(r[col]) === val;
            return false;
          })
        );
        return builder;
      },
      order: (col: string, opts?: { ascending?: boolean }) => {
        sortCol = col;
        sortAsc = opts?.ascending !== false;
        return builder;
      },
      limit: (n: number) => {
        rowLimit = n;
        return builder;
      },
      maybeSingle: async () => {
        const res = await execute();
        if (Array.isArray(res.data)) {
          return { data: res.data[0] ?? null, error: res.error };
        }
        return { data: res.data ?? null, error: res.error };
      },
      single: async () => {
        const res = await execute();
        if (Array.isArray(res.data)) {
          return { data: res.data[0] ?? null, error: res.error };
        }
        return { data: res.data ?? null, error: res.error };
      },
      then: (onFulfilled: any, onRejected?: any) => execute().then(onFulfilled, onRejected),
    };

    return builder;
  }

  return {
    ORG_ID,
    tables,
    adminClient: {
      auth: {
        getUser: async (token: string) => {
          if (token === 'cashier-token') {
            return {
              data: { user: { id: 'cashier-user-id', email: 'anna@amansocean.com' } },
              error: null,
            };
          }
          return { data: { user: null }, error: new Error('Invalid token') };
        },
      },
      from: (table: string) => makeQueryBuilder(table),
    },
  };
}

describe('POS Customer View & Dual-Channel Counter Kiosk Integration', () => {
  let server: http.Server;
  let baseUrl: string;
  const mockDb = createPosCustomerStatefulMock();
  let sampleProduct: any = null;
  let b2bOrderNumber = '';

  beforeAll(async () => {
    const app = await createExpressApp({ withVite: false, adminClient: mockDb.adminClient });
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('1. serves live dual-tier POS customer catalog with all 32 official GH₵ items and bulk wholesale rates', async () => {
    const res = await fetch(`${baseUrl}/api/pos/customer-catalog`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.source).toBe('supabase');
    expect(Array.isArray(body.products)).toBe(true);
    expect(body.products).toHaveLength(32);

    sampleProduct = body.products.find((p: any) => p.id === 'ao-squid') || body.products[0];
    expect(sampleProduct.retailPricePerUnit).toBe(150);
    expect(sampleProduct.wholesalePricePerUnit).toBe(130);
    expect(sampleProduct.wholesalePricePerUnit).toBeLessThan(sampleProduct.retailPricePerUnit);
    expect(sampleProduct.stockKg).toBeGreaterThan(0);
  });

  it('2. synchronizes Cashier POS register state and customer self-service basket actions with tier repricing', async () => {
    // Initial empty register session
    const initRes = await fetch(`${baseUrl}/api/pos/register-session?registerId=REG-1`);
    expect(initRes.status).toBe(200);
    const initData = await initRes.json();
    expect(initData.session.registerId).toBe('REG-1');
    expect(initData.session.items).toHaveLength(0);

    // Customer adds 2 packs from the counter display
    const addRes = await fetch(`${baseUrl}/api/pos/register-session/customer-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        registerId: 'REG-1',
        action: 'add_item',
        productId: sampleProduct.id,
        quantity: 2,
        pricingMode: 'retail',
        sourceId: 'kiosk-tablet-1',
      }),
    });
    expect(addRes.status).toBe(200);
    const addBody = await addRes.json();
    expect(addBody.session.items).toHaveLength(1);
    expect(addBody.session.items[0].quantity).toBe(2);
    expect(addBody.session.items[0].unitPrice).toBe(sampleProduct.retailPricePerUnit);

    // Switch active register session to Wholesale B2B Tier and verify automatic repricing
    const tierRes = await fetch(`${baseUrl}/api/pos/register-session/customer-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        registerId: 'REG-1',
        action: 'set_pricing_mode',
        pricingMode: 'wholesale',
      }),
    });
    expect(tierRes.status).toBe(200);
    const tierBody = await tierRes.json();
    expect(tierBody.session.pricingMode).toBe('wholesale');
    expect(tierBody.session.items[0].unitPrice).toBe(sampleProduct.wholesalePricePerUnit);

    // Cashier locks basket edits during tender -> customer kiosk edits must return 403
    const lockRes = await fetch(`${baseUrl}/api/pos/register-session`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        registerId: 'REG-1',
        pricingMode: 'wholesale',
        customerName: 'Labadi Beach Resort Kitchens',
        items: tierBody.session.items,
        discountPct: 5,
        allowCustomerBasketEdits: false,
      }),
    });
    expect(lockRes.status).toBe(200);

    const blockedRes = await fetch(`${baseUrl}/api/pos/register-session/customer-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        registerId: 'REG-1',
        action: 'add_item',
        productId: sampleProduct.id,
        quantity: 1,
      }),
    });
    expect(blockedRes.status).toBe(403);

    // Unlock basket edits again
    await fetch(`${baseUrl}/api/pos/register-session`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        registerId: 'REG-1',
        pricingMode: 'wholesale',
        customerName: 'Walk-in Customer',
        items: [],
        discountPct: 0,
        allowCustomerBasketEdits: true,
      }),
    });
  });

  it('3. enforces B2B Net-Terms credit hold and credit limits, then persists valid wholesale credit orders with live stock deduction', async () => {
    const initialStock = Number(
      mockDb.tables.retail_wholesale_products.find((p) => p.id === sampleProduct.id)?.stock_kg || 0
    );

    // 3A. Reject Credit Hold account
    const holdRes = await fetch(`${baseUrl}/api/pos/customer-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        registerId: 'REG-1',
        orderMode: 'wholesale',
        customerName: 'Harbor Bistro Ltd',
        customerEmail: 'ap@harborbistro.com',
        paymentMethod: 'B2B Net-Terms Credit Account',
        items: [{ productId: sampleProduct.id, quantity: 2 }],
      }),
    });
    expect(holdRes.status).toBe(409);
    const holdBody = await holdRes.json();
    expect(holdBody.code).toBe('CREDIT_HOLD');

    // 3B. Reject order exceeding available credit (GH₵ 2,000 limit - GH₵ 450 balance = GH₵ 1,550 available)
    const exceedRes = await fetch(`${baseUrl}/api/pos/customer-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        registerId: 'REG-1',
        orderMode: 'wholesale',
        customerName: 'Labadi Beach Resort Kitchens',
        customerEmail: 'procurement@labadireef.com',
        paymentMethod: 'B2B Net-Terms Credit Account',
        items: [{ productId: sampleProduct.id, quantity: 15 }],
      }),
    });
    expect(exceedRes.status).toBe(409);
    const exceedBody = await exceedRes.json();
    expect(exceedBody.code).toBe('CREDIT_LIMIT_EXCEEDED');

    // Confirm rejected orders did NOT mutate stock
    const stockAfterRejections = Number(
      mockDb.tables.retail_wholesale_products.find((p) => p.id === sampleProduct.id)?.stock_kg || 0
    );
    expect(stockAfterRejections).toBeCloseTo(initialStock, 2);

    // 3C. Valid Wholesale B2B Net-30 order deducts stock, updates AR balance, and generates receipt + ORD-XXXXX invoice
    const orderQty = 5;
    const validRes = await fetch(`${baseUrl}/api/pos/customer-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        registerId: 'REG-1',
        orderMode: 'wholesale',
        customerName: 'Labadi Beach Resort Kitchens',
        customerPhone: '+233 24 888 1001',
        customerEmail: 'procurement@labadireef.com',
        deliveryAddress: '1 La Bypass, Accra',
        paymentMethod: 'B2B Net-Terms Credit Account',
        items: [{ productId: sampleProduct.id, quantity: orderQty }],
      }),
    });
    expect(validRes.status).toBe(201);
    const validBody = await validRes.json();
    expect(validBody.orderNumber).toMatch(/^ORD-\d+$/);
    expect(validBody.receiptNumber).toMatch(/^POS-\d{4}-\d+$/);
    expect(validBody.paymentStatus).toBe('Pending Net-30');
    b2bOrderNumber = validBody.orderNumber;

    // Verify product stock deducted in Supabase table
    const updatedProduct = mockDb.tables.retail_wholesale_products.find(
      (p) => p.id === sampleProduct.id
    );
    expect(Number(updatedProduct.stock_kg)).toBeCloseTo(initialStock - orderQty, 2);

    // Verify B2B customer AR balance increased by order total
    const updatedCustomer = mockDb.tables.customers.find((c) => c.id === 'CUST-B2B-101');
    expect(Number(updatedCustomer.outstanding_balance_usd)).toBeCloseTo(
      450 + Number(validBody.receipt.totalAmount),
      2
    );
  });

  it('4. gates customer account lookup by contact and returns receipts, wholesale invoices, credit ledger, tracking, and one-click reorder', async () => {
    // Missing contact -> 400
    const unverifiedRes = await fetch(`${baseUrl}/api/pos/customer-account`);
    expect(unverifiedRes.status).toBe(400);

    // Verified lookup by phone
    const acctRes = await fetch(
      `${baseUrl}/api/pos/customer-account?contact=${encodeURIComponent('0248881001')}`
    );
    expect(acctRes.status).toBe(200);
    const acctBody = await acctRes.json();
    expect(acctBody.account.id).toBe('CUST-B2B-101');
    expect(acctBody.account.isWholesaleB2B).toBe(true);
    expect(acctBody.invoices.length).toBeGreaterThanOrEqual(1);
    expect(acctBody.receipts.length).toBeGreaterThanOrEqual(1);
    expect(acctBody.creditLedger.length).toBeGreaterThanOrEqual(3);

    const latestInvoice = acctBody.invoices.find((inv: any) => inv.orderNumber === b2bOrderNumber);
    expect(latestInvoice).toBeDefined();
    expect(latestInvoice.items.length).toBe(1);

    // Track wholesale dispatch via /api/storefront/orders/track
    const trackRes = await fetch(
      `${baseUrl}/api/storefront/orders/track?orderNumber=${encodeURIComponent(
        b2bOrderNumber
      )}&contact=${encodeURIComponent('procurement@labadireef.com')}`
    );
    expect(trackRes.status).toBe(200);
    const trackBody = await trackRes.json();
    expect(trackBody.order.orderNumber).toBe(b2bOrderNumber);
    expect(trackBody.order.orderChannel).toBe('wholesale');
    expect(trackBody.order.packagingRequirement).toContain('Dry Ice');

    // One-click reorder from past invoice into active POS register session
    const reorderRes = await fetch(`${baseUrl}/api/pos/register-session/customer-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        registerId: 'REG-1',
        action: 'load_reorder',
        pricingMode: 'wholesale',
        customerName: acctBody.account.companyName,
        items: latestInvoice.items.map((it: any) => ({
          productId: it.productId,
          productName: it.productName,
          quantity: it.quantity,
        })),
      }),
    });
    expect(reorderRes.status).toBe(200);
    const reorderBody = await reorderRes.json();
    expect(reorderBody.session.items).toHaveLength(1);
    expect(reorderBody.session.items[0].productId).toBe(sampleProduct.id);
    expect(reorderBody.session.items[0].quantity).toBe(5);
  });

  it('7. Enforces secure exit from POS Customer View to blank Staff Login and returns directly to Retail & Wholesale POS after login', () => {
    const storeMap = new Map<string, string>();
    const mockStorage = {
      getItem: (k: string) => (storeMap.has(k) ? storeMap.get(k)! : null),
      setItem: (k: string, v: string) => {
        storeMap.set(k, v);
      },
      removeItem: (k: string) => {
        storeMap.delete(k);
      },
    };

    let lastReplacedUrl = '';
    const mockWin = {
      location: {
        pathname: '/',
        search: '?view=pos-customer&register=REG-1&email=anna%40amansocean.com&activated=true',
        hash: '',
      },
      history: {
        replaceState: (_data: any, _unused: string, url: string) => {
          lastReplacedUrl = url;
          const hashIdx = url.indexOf('#');
          const queryIdx = url.indexOf('?');
          mockWin.location.hash = hashIdx >= 0 ? url.slice(hashIdx) : '';
          mockWin.location.search =
            queryIdx >= 0
              ? url.slice(queryIdx, hashIdx >= 0 ? hashIdx : undefined)
              : '';
        },
      },
    } as unknown as Window;

    // 1. Entering Customer View locks the terminal to #pos-customer
    activatePosCustomerKioskLock(mockStorage, mockWin);
    expect(isPosCustomerKioskLocked(mockStorage)).toBe(true);
    expect(mockWin.location.hash).toBe('#pos-customer');

    // 2. Exiting Customer View clears kiosk lock, strips view/email query params, routes to #login, and flags blank staff re-auth
    preparePosSecurityExitToLogin(mockStorage, mockWin);
    expect(isPosCustomerKioskLocked(mockStorage)).toBe(false);
    expect(isPosSecurityReauthActive(mockStorage)).toBe(true);
    expect(lastReplacedUrl).toBe('/#login');
    expect(mockWin.location.search).toBe('');
    expect(mockWin.location.hash).toBe('#login');

    // 3. Upon successful staff login, consuming post-login tab returns 'retail_wholesale' once and clears re-auth flag
    const postLoginTab = consumePosPostLoginTab(mockStorage);
    expect(postLoginTab).toBe('retail_wholesale');
    expect(isPosSecurityReauthActive(mockStorage)).toBe(false);
    expect(consumePosPostLoginTab(mockStorage)).toBeNull();

    // 4. Explicit clear helper also resets re-auth flag if user navigates back to public landing
    preparePosSecurityExitToLogin(mockStorage, mockWin);
    expect(isPosSecurityReauthActive(mockStorage)).toBe(true);
    clearPosSecurityReauth(mockStorage);
    expect(isPosSecurityReauthActive(mockStorage)).toBe(false);
  });
});
