import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PurchaseOrderLanding } from '../types';

const mockUpdate = vi.fn();
const mockInsert = vi.fn();
const mockDelete = vi.fn();
const mockSelect = vi.fn();
const mockUpsert = vi.fn();

let existingItemRows: Array<{ id: string }> = [];

vi.mock('../data/auth', () => ({
  getSession: async () => ({ user: { id: 'user-1', email: 'ops@tenant.com' } }),
  getStaffProfile: async () => ({ id: 'user-1', organization_id: 'org-tenant-123', role: 'admin' }),
  getCurrentOrganizationId: () => 'org-tenant-123',
}));

vi.mock('../utils/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: 'user-1', email: 'ops@tenant.com' } } },
        error: null,
      }),
    },
    from: (table: string) => {
      if (table === 'purchase_order_landings') {
        return {
          upsert: (payload: any, opts: any) => {
            mockUpsert(payload, opts);
            return Promise.resolve({ data: payload, error: null });
          },
        };
      }

      if (table === 'purchase_order_items') {
        return {
          select: (cols: string) => {
            mockSelect(cols);
            const builder: any = {
              eq: () => builder,
              order: () => builder,
              then: (resolve: any) => resolve({ data: existingItemRows, error: null }),
            };
            return builder;
          },
          update: (payload: any) => {
            mockUpdate(payload);
            const builder: any = {
              eq: () => builder,
              then: (resolve: any) => resolve({ data: payload, error: null }),
            };
            return builder;
          },
          insert: (payload: any) => {
            mockInsert(payload);
            return Promise.resolve({ data: payload, error: null });
          },
          delete: () => {
            mockDelete();
            return { eq: async () => ({ error: null }) };
          },
        };
      }

      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      };
    },
  },
}));

describe('PurchaseOrderRepository savePurchaseOrderWithItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    existingItemRows = [];
    vi.stubGlobal('navigator', { onLine: true });
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = String(v);
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        Object.keys(store).forEach(k => delete store[k]);
      },
    });
  });

  const samplePO: PurchaseOrderLanding = {
    id: 'PO-9001',
    supplierId: 'SUP-201',
    supplierName: 'Atlantic Fleet',
    vesselName: 'F/V North Star',
    portLocation: 'Tema Fishing Harbour',
    orderDate: '2026-11-17',
    deliveryDate: '2026-11-17',
    speciesItems: [
      {
        speciesName: 'Yellowfin Tuna',
        weightKg: 250,
        costPerKg: 14.5,
        totalCost: 3625,
        grade: 'Sashimi AAA',
        storageZone: 'Super-Cryo Deep Freeze (-60°C)',
      },
    ],
    totalCostUSD: 3625,
    paymentStatus: 'Pending Settlement',
    paymentDueDate: '2026-12-02',
    receivedBy: 'Dock Master',
    lotAssignedId: 'LOT-2026-YFT-1001',
    status: 'Received & In Stock',
    notes: 'Grade A dock catch',
  };

  it('inserts purchase_order_items with organization_id when creating a new PO', async () => {
    const { purchaseOrderRepository } = await import('../repositories/purchaseOrderRepository');
    await purchaseOrderRepository.savePurchaseOrderWithItems(samplePO, true);

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockDelete).not.toHaveBeenCalled();
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockInsert.mock.calls[0][0]).toMatchObject({
      po_id: 'PO-9001',
      species_name: 'Yellowfin Tuna',
      weight_kg: 250,
      cost_per_kg: 14.5,
      total_cost: 3625,
      organization_id: 'org-tenant-123',
    });
  });

  it('updates existing purchase_order_items in-place with organization_id when editing a PO without calling delete', async () => {
    existingItemRows = [{ id: 'item-uuid-1' }];
    const { purchaseOrderRepository } = await import('../repositories/purchaseOrderRepository');

    const editedPO: PurchaseOrderLanding = {
      ...samplePO,
      vesselName: 'F/V North Star II',
      totalCostUSD: 4200,
      speciesItems: [
        {
          ...samplePO.speciesItems[0],
          weightKg: 300,
          costPerKg: 14.0,
          totalCost: 4200,
        },
      ],
    };

    await purchaseOrderRepository.savePurchaseOrderWithItems(editedPO, false);

    expect(mockDelete).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate.mock.calls[0][0]).toMatchObject({
      po_id: 'PO-9001',
      weight_kg: 300,
      cost_per_kg: 14.0,
      total_cost: 4200,
      organization_id: 'org-tenant-123',
    });
  });
});
