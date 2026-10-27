import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { productRepository, retailTransactionRepository } from '../retailRepository';
import { syncQueue } from '../../sync/queue';
import { RetailWholesaleProduct, RetailTransaction } from '../../types';

const mockStorage: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, value: string) => {
    mockStorage[key] = String(value);
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
  clear: () => {
    for (const key in mockStorage) {
      delete mockStorage[key];
    }
  },
};

beforeAll(() => {
  vi.stubGlobal('localStorage', localStorageMock);
});

const sampleProduct: RetailWholesaleProduct = {
  id: 'prod-1789581325011',
  speciesId: 'spec-yellowfin',
  name: 'Yellowfin Tuna Saku Block',
  cutType: 'Skinless Sashimi Saku Block',
  category: 'Pelagic',
  grade: 'Sashimi AAA',
  stockKg: 45,
  unit: 'kg',
  costPricePerUnit: 18,
  wholesalePricePerUnit: 28,
  retailPricePerUnit: 38,
  wholesaleMinQty: 5,
  sku: 'SKU-YFT-SAKU-01',
  imageUrl: 'https://images.unsplash.com/photo-1534483509719-3feaee7c30da',
  origin: 'Tema, Ghana',
  isAvailableForRetail: true,
  isAvailableForWholesale: true,
};

describe('ProductRepository & Retail Sync Tests', () => {
  beforeEach(() => {
    localStorageMock.clear();
    localStorageMock.setItem('frostly_active_org_id', 'org-test-retail');
    syncQueue.clear();
    vi.spyOn(productRepository, 'canAccessSupabase').mockResolvedValue(false);
    vi.spyOn(retailTransactionRepository, 'canAccessSupabase').mockResolvedValue(false);
  });

  it('saves product optimistically with organization_id and enqueues for background sync', async () => {
    await productRepository.save(sampleProduct, true);

    const cached = productRepository.getLocalCache();
    expect(cached).toHaveLength(1);
    expect(cached[0].id).toBe('prod-1789581325011');
    expect(cached[0].name).toBe('Yellowfin Tuna Saku Block');

    expect(syncQueue.size()).toBe(1);
    const queued = syncQueue.getAll()[0];
    expect(queued.tableName).toBe('retail_wholesale_products');
    expect(queued.recordId).toBe('prod-1789581325011');
    expect(queued.payload.organization_id).toBeDefined();
    expect(queued.payload.sku).toBe('SKU-YFT-SAKU-01');
  });

  it('handles updates to existing products without duplicating queue items', async () => {
    await productRepository.save(sampleProduct, true);
    expect(syncQueue.size()).toBe(1);

    const updatedProduct = { ...sampleProduct, stockKg: 40 };
    await productRepository.save(updatedProduct, false);

    expect(syncQueue.size()).toBe(1);
    const queued = syncQueue.getAll()[0];
    expect(queued.payload.stock_kg).toBe(40);
  });
});
