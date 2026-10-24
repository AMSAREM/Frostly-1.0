import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import crypto from 'crypto';
import { createExpressApp } from '../../server';

/**
 * Stateful in-memory Supabase Admin Mock for end-to-end Storefront <-> ERP <-> Creator HTTP verification.
 */
function createStatefulStorefrontMock() {
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
        id: 'creator-user-id',
        organization_id: ORG_ID,
        role: 'creator',
        is_active: true,
        full_name: 'Amansocean Creator',
        email: 'creator@amansocean.com',
      },
      {
        id: 'other-org-staff-id',
        organization_id: '99999999-9999-4999-8999-999999999999',
        role: 'admin',
        is_active: true,
        full_name: 'Other Tenant Admin',
        email: 'admin@other.com',
      },
    ],
    species: [],
    retail_wholesale_products: [],
    inventory_batches: [],
    customers: [],
    client_orders: [],
    order_line_items: [],
    retail_transactions: [],
    retail_sale_items: [],
    financial_ledger_entries: [],
    system_notifications: [],
    storefront_orders: [],
    storefront_order_items: [],
    storefront_favorites: [],
    newsletter_subscribers: [],
    feedbacks: [],
    storefront_analytics_events: [],
    user_feature_usage_logs: [],
  };

  function matchCondition(row: any, cond: (r: any) => boolean) {
    return cond(row);
  }

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

      const matched = store.filter((r) => predicates.every((fn) => matchCondition(r, fn)));

      if (pendingAction === 'update') {
        matched.forEach((row) => {
          Object.assign(row, mutationPayload);
        });
        return { data: matched, error: null };
      }

      if (pendingAction === 'delete') {
        tables[table] = store.filter((r) => !predicates.every((fn) => matchCondition(r, fn)));
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
      select: (_cols?: string) => {
        if (
          pendingAction !== 'insert' &&
          pendingAction !== 'upsert' &&
          pendingAction !== 'update' &&
          pendingAction !== 'delete'
        ) {
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
          if (token === 'creator-token') {
            return {
              data: { user: { id: 'creator-user-id', email: 'creator@amansocean.com' } },
              error: null,
            };
          }
          if (token === 'other-org-token') {
            return {
              data: { user: { id: 'other-org-staff-id', email: 'admin@other.com' } },
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

describe('Amansocean Storefront <-> Supabase ERP & Creator Integration', () => {
  let server: http.Server;
  let baseUrl: string;
  const mockDb = createStatefulStorefrontMock();
  let placedOrderNumber = '';

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

  it('deactivates legacy demo rows and seeds all 32 official Amans Ocean GH₵ products on first catalog request', async () => {
    mockDb.tables.retail_wholesale_products.push({
      id: 'prod-salmon-fillet-600g',
      organization_id: mockDb.ORG_ID,
      sku: 'AO-SALM-600G',
      name: 'Norwegian Salmon Portions 600g',
      retail_price_per_unit: 18.5,
      wholesale_price_per_unit: 15.2,
      stock_kg: 90,
      is_active: true,
    });

    const res = await fetch(`${baseUrl}/api/storefront/catalog`);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.source).toBe('supabase');
    expect(body.organizationId).toBe(mockDb.ORG_ID);
    expect(body.products).toHaveLength(32);
    expect(body.products[0].inStock).toBe(true);
    expect(mockDb.tables.inventory_batches.length).toBe(32);

    const legacyRow = mockDb.tables.retail_wholesale_products.find(
      (p) => p.id === 'prod-salmon-fillet-600g'
    );
    expect(legacyRow?.is_active).toBe(false);
    expect(body.products.some((p: any) => p.id === 'prod-salmon-fillet-600g')).toBe(false);

    const redSnapper = body.products.find((p: any) => p.id === 'ao-red-snapper');
    expect(redSnapper?.price).toBe(90);

    const peeledShrimps = body.products.find((p: any) => p.id === 'ao-peeled-shrimps');
    expect(peeledShrimps?.price).toBe(220);
    expect(peeledShrimps?.wholesalePrice).toBe(200);
    expect(peeledShrimps?.wholesaleMinQty).toBe(10);

    const squid = body.products.find((p: any) => p.id === 'ao-squid');
    expect(squid?.price).toBe(150);
    expect(squid?.wholesalePrice).toBe(130);
    expect(squid?.wholesaleMinQty).toBe(10);

    const fishPowderReg = body.products.find((p: any) => p.id === 'ao-fish-powder-regular');
    const fishPowderLrg = body.products.find((p: any) => p.id === 'ao-fish-powder-large');
    expect(fishPowderReg?.price).toBe(50);
    expect(fishPowderLrg?.price).toBe(100);
  });

  it('persists dual-ledger storefront + ERP records and deducts live coldstore stock on GH₵ checkout', async () => {
    const targetProduct = mockDb.tables.retail_wholesale_products.find(
      (p) => p.id === 'ao-red-snapper'
    );
    expect(targetProduct).toBeDefined();
    const initialStock = Number(targetProduct.stock_kg);

    const res = await fetch(`${baseUrl}/api/storefront/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Ama Mensah',
        customerPhone: '+233 24 555 0199',
        customerEmail: 'ama.mensah@example.com',
        deliveryAddress: '14 Harbour Road, Tema Community 1',
        deliveryNotes: 'Call at security gate',
        paymentMethod: 'Mobile Money on Delivery',
        visitorId: 'visitor-ama-01',
        items: [{ productId: 'ao-red-snapper', quantity: 3 }],
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.order.orderNumber).toMatch(/^AO-\d{5}$/);
    expect(body.order.fulfillmentStatus).toBe('confirmed');
    expect(body.order.subtotal).toBe(270);
    expect(body.order.deliveryFee).toBe(25);
    expect(body.order.totalAmount).toBe(295);
    placedOrderNumber = body.order.orderNumber;

    // Verify stock deducted in retail_wholesale_products & inventory_batches
    const updatedProduct = mockDb.tables.retail_wholesale_products.find(
      (p) => p.id === 'ao-red-snapper'
    );
    expect(Number(updatedProduct.stock_kg)).toBe(initialStock - 3);

    // Verify dual-ledger ERP persistence
    expect(mockDb.tables.customers.length).toBe(1);
    expect(mockDb.tables.client_orders.some((o) => o.id === placedOrderNumber)).toBe(true);
    expect(mockDb.tables.retail_transactions.some((t) => t.receipt_number === placedOrderNumber)).toBe(true);
    expect(mockDb.tables.financial_ledger_entries.some((f) => f.reference_id === placedOrderNumber)).toBe(true);
    expect(mockDb.tables.storefront_orders.some((s) => s.order_number === placedOrderNumber)).toBe(true);
  });

  it('blocks overselling with 409 INSUFFICIENT_STOCK without mutating remaining stock', async () => {
    const prodBefore = mockDb.tables.retail_wholesale_products.find(
      (p) => p.id === 'ao-red-snapper'
    );
    const stockBefore = Number(prodBefore.stock_kg);

    const res = await fetch(`${baseUrl}/api/storefront/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Bulk Buyer',
        customerPhone: '+233 20 111 2222',
        deliveryAddress: 'East Legon, Accra',
        items: [{ productId: 'ao-red-snapper', quantity: stockBefore + 50 }],
      }),
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('INSUFFICIENT_STOCK');
    expect(body.availableStockKg).toBe(stockBefore);

    const prodAfter = mockDb.tables.retail_wholesale_products.find(
      (p) => p.id === 'ao-red-snapper'
    );
    expect(Number(prodAfter.stock_kg)).toBe(stockBefore);
  });

  it('verifies contact phone/email on public order tracking and rejects mismatched contact', async () => {
    // Wrong phone/email -> 404
    const wrongRes = await fetch(
      `${baseUrl}/api/storefront/orders/track?orderNumber=${placedOrderNumber}&contact=wrong@example.com`
    );
    expect(wrongRes.status).toBe(404);

    // Matching phone -> 200
    const validRes = await fetch(
      `${baseUrl}/api/storefront/orders/track?orderNumber=${placedOrderNumber}&contact=${encodeURIComponent('0245550199')}`
    );
    expect(validRes.status).toBe(200);
    const body = await validRes.json();
    expect(body.order.orderNumber).toBe(placedOrderNumber);
    expect(body.order.fulfillmentStatus).toBe('confirmed');
    expect(body.order.items).toHaveLength(1);
  });

  it('enforces tenant auth on ERP storefront queue and syncs fulfillment stage updates back to customer tracking', async () => {
    const unauth = await fetch(`${baseUrl}/api/erp/storefront-orders`);
    expect(unauth.status).toBe(401);

    const crossTenant = await fetch(
      `${baseUrl}/api/erp/storefront-orders?organizationId=${mockDb.ORG_ID}`,
      { headers: { Authorization: 'Bearer other-org-token' } }
    );
    expect(crossTenant.status).toBe(403);

    const queueRes = await fetch(`${baseUrl}/api/erp/storefront-orders`, {
      headers: { Authorization: 'Bearer creator-token' },
    });
    expect(queueRes.status).toBe(200);
    const queueBody = await queueRes.json();
    expect(queueBody.orders.some((o: any) => o.orderNumber === placedOrderNumber)).toBe(true);

    const patchRes = await fetch(
      `${baseUrl}/api/erp/storefront-orders/${placedOrderNumber}/status`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer creator-token',
        },
        body: JSON.stringify({ fulfillmentStatus: 'out_for_delivery' }),
      }
    );
    expect(patchRes.status).toBe(200);
    const patchBody = await patchRes.json();
    expect(patchBody.fulfillmentStatus).toBe('out_for_delivery');
    expect(patchBody.erpStatus).toBe('In Reefer Transit');

    // Customer tracking immediately reflects updated cold-fleet transit stage
    const trackRes = await fetch(
      `${baseUrl}/api/storefront/orders/track?orderNumber=${placedOrderNumber}&contact=ama.mensah@example.com`
    );
    const trackBody = await trackRes.json();
    expect(trackBody.order.fulfillmentStatus).toBe('out_for_delivery');
  });

  it('toggles saved favorites, deduplicates newsletter signups, persists feedback, and aggregates Creator storefront analytics', async () => {
    // 1. Toggle Favorite ON
    const favOn = await fetch(`${baseUrl}/api/storefront/favorites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorId: 'visitor-ama-01',
        productId: 'ao-prawns-jumbo',
        productName: 'Prawns Jumbo',
      }),
    });
    expect((await favOn.json()).favorited).toBe(true);

    const favList = await fetch(`${baseUrl}/api/storefront/favorites?visitorId=visitor-ama-01`);
    expect((await favList.json()).productIds).toContain('ao-prawns-jumbo');

    // 2. Newsletter idempotency
    const subFirst = await fetch(`${baseUrl}/api/storefront/newsletter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'freshcatch@example.com', visitorId: 'visitor-ama-01' }),
    });
    expect((await subFirst.json()).alreadySubscribed).toBe(false);

    const subSecond = await fetch(`${baseUrl}/api/storefront/newsletter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'freshcatch@example.com', visitorId: 'visitor-ama-01' }),
    });
    expect((await subSecond.json()).alreadySubscribed).toBe(true);

    // 3. Feedback persistence
    const fbRes = await fetch(`${baseUrl}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rating: 5,
        category: 'Product Quality',
        message: 'Flash-frozen red snapper arrived rock solid at -18C!',
        name: 'Ama Mensah',
        email: 'ama.mensah@example.com',
      }),
    });
    expect(fbRes.status).toBe(200);

    // 4. Storefront funnel beacon
    await fetch(`${baseUrl}/api/storefront/analytics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorId: 'visitor-ama-01',
        eventType: 'page_view',
      }),
    });
    await fetch(`${baseUrl}/api/storefront/analytics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorId: 'visitor-ama-01',
        eventType: 'add_to_cart',
        productId: 'ao-red-snapper',
        productName: 'Red Snapper',
      }),
    });

    // 5. Creator Storefront Analytics summary
    const analyticsRes = await fetch(`${baseUrl}/api/creator/storefront-analytics?days=30`, {
      headers: { Authorization: 'Bearer creator-token' },
    });
    expect(analyticsRes.status).toBe(200);
    const analytics = await analyticsRes.json();

    expect(analytics.metrics.uniqueVisitors).toBeGreaterThanOrEqual(1);
    expect(analytics.metrics.cartAdditions).toBeGreaterThanOrEqual(1);
    expect(analytics.metrics.ordersCompleted).toBeGreaterThanOrEqual(1);
    expect(analytics.metrics.onlineRevenue).toBeGreaterThan(0);
    expect(analytics.metrics.newsletterSubscribersCount).toBe(1);
    expect(analytics.metrics.feedbackCount).toBe(1);
    expect(analytics.metrics.averageRating).toBe(5);
    expect(analytics.topProducts.length).toBeGreaterThanOrEqual(1);
  });

  it('supports Admin Amans Products GH₵ inline price edits, custom SKU creation, soft-deletion, and flyer price sync', async () => {
    const unauth = await fetch(`${baseUrl}/api/erp/amansocean-products`);
    expect(unauth.status).toBe(401);

    const listRes = await fetch(`${baseUrl}/api/erp/amansocean-products`, {
      headers: { Authorization: 'Bearer creator-token' },
    });
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();
    expect(listBody.products).toHaveLength(32);

    // Negotiate custom wholesale rate on Tilapia (printed GH₵ 85 -> negotiated GH₵ 78 wholesale)
    const patchRes = await fetch(`${baseUrl}/api/erp/amansocean-products/ao-tilapia`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer creator-token',
      },
      body: JSON.stringify({
        retailPricePerUnit: 88,
        wholesalePricePerUnit: 78,
        wholesaleMinQty: 10,
      }),
    });
    expect(patchRes.status).toBe(200);
    const patchBody = await patchRes.json();
    expect(patchBody.product.retailPricePerUnit).toBe(88);
    expect(patchBody.product.wholesalePricePerUnit).toBe(78);
    expect(patchBody.product.wholesaleMinQty).toBe(10);

    // Public storefront immediately reflects the admin's updated GH₵ price
    const publicCatalogRes = await fetch(`${baseUrl}/api/storefront/catalog`);
    const publicCatalog = await publicCatalogRes.json();
    const updatedTilapia = publicCatalog.products.find((p: any) => p.id === 'ao-tilapia');
    expect(updatedTilapia.price).toBe(88);
    expect(updatedTilapia.wholesalePrice).toBe(78);

    // Sync official flyer prices with forceResetPrices=true restores Tilapia back to GH₵ 80
    const syncRes = await fetch(`${baseUrl}/api/erp/amansocean-products/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer creator-token',
      },
      body: JSON.stringify({ forceResetPrices: true }),
    });
    expect(syncRes.status).toBe(200);
    const syncBody = await syncRes.json();
    const restoredTilapia = syncBody.products.find((p: any) => p.id === 'ao-tilapia');
    expect(restoredTilapia.retailPricePerUnit).toBe(80);
    expect(restoredTilapia.wholesalePricePerUnit).toBe(80);

    // Create a new custom seafood item and then soft-deactivate it
    const createRes = await fetch(`${baseUrl}/api/erp/amansocean-products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer creator-token',
      },
      body: JSON.stringify({
        name: 'Smoked Barracuda Special',
        sku: 'AO-BARR-SMK',
        category: 'Pelagic',
        unit: '1 kg',
        retailPricePerUnit: 115,
        wholesalePricePerUnit: 105,
        wholesaleMinQty: 5,
        stockKg: 60,
      }),
    });
    expect(createRes.status).toBe(201);
    const createdBody = await createRes.json();
    const customId = createdBody.product.id;
    expect(createdBody.product.retailPricePerUnit).toBe(115);

    const delRes = await fetch(`${baseUrl}/api/erp/amansocean-products/${customId}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer creator-token' },
    });
    expect(delRes.status).toBe(200);
  });
});
