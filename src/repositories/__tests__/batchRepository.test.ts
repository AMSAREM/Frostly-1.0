import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { batchRepository } from '../batchRepository';
import { syncQueue } from '../../sync/queue';
import { InventoryBatch } from '../../types';

// Lightweight in-memory localStorage mock
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

const sampleBatch: InventoryBatch = {
  id: 'LOT-2026-TEST-01',
  speciesId: 'sp-1',
  speciesName: 'Atlantic Cod',
  scientificName: 'Gadus morhua',
  category: 'Groundfish',
  harvestDate: '2026-03-01',
  landingPort: 'Port of Tromsø',
  vesselName: 'Nordic Explorer',
  vesselRegistration: 'NOR-77492',
  captainName: 'Capt. Erik Dahl',
  faoArea: 'FAO 27.2.a (Norwegian Sea)',
  coordinates: {
    lat: 69.6492,
    lng: 18.9553,
    description: 'Offshore Tromsø Banks',
  },
  gearType: 'Longline (Demersal)',
  grade: 'Grade #1',
  initialWeightKg: 400,
  availableWeightKg: 400,
  allocatedWeightKg: 0,
  storageZone: 'Commercial Cold Storage (-22°C)',
  currentTempCelsius: -22.1,
  targetTempCelsius: -22.0,
  costPerKg: 10.5,
  wholesalePricePerKg: 14.5,
  receivedDate: '2026-03-01',
  expiryDate: '2026-03-12',
  inspectionStatus: 'Passed',
  coreTempCelsius: -21.8,
  certifications: ['MSC Certified', 'FDA HACCP'],
  qrCodeSeed: 'QR-TEST-01',
  notes: 'Cold storage verified',
};

describe('BatchRepository & Data Flow Tests', () => {
  beforeEach(() => {
    localStorageMock.clear();
    syncQueue.clear();
  });

  it('returns fallback data when local cache is empty', async () => {
    const batches = await batchRepository.getBatches([sampleBatch]);
    expect(batches).toHaveLength(1);
    expect(batches[0].id).toBe('LOT-2026-TEST-01');
  });

  it('saves a batch: updates local storage cache and enqueues to syncQueue', async () => {
    await batchRepository.save(sampleBatch, true);

    // Verify local cache is updated
    const cached = batchRepository.getLocalCache();
    expect(cached).toHaveLength(1);
    expect(cached[0].id).toBe('LOT-2026-TEST-01');

    // Verify syncQueue received the insert mutation
    expect(syncQueue.size()).toBe(1);
    const queueItems = syncQueue.getAll();
    expect(queueItems[0].tableName).toBe('inventory_batches');
    expect(queueItems[0].recordId).toBe('LOT-2026-TEST-01');
    expect(queueItems[0].operation).toBe('INSERT');
    expect(queueItems[0].payload.available_weight_kg).toBe(400);
  });

  it('updateWeights deducts available weight and enqueues UPDATE mutation to syncQueue', async () => {
    // Save initial batch first
    await batchRepository.save(sampleBatch, true);
    syncQueue.clear();

    // Order allocation: 50kg allocated, 350kg available
    const updated = await batchRepository.updateWeights(sampleBatch.id, 350, 50);

    expect(updated).not.toBeNull();
    expect(updated!.availableWeightKg).toBe(350);
    expect(updated!.allocatedWeightKg).toBe(50);

    // Verify local cache reflects new weights
    const cached = batchRepository.getLocalCache();
    expect(cached[0].availableWeightKg).toBe(350);
    expect(cached[0].allocatedWeightKg).toBe(50);

    // Verify syncQueue received an UPDATE mutation
    expect(syncQueue.size()).toBe(1);
    const queueItems = syncQueue.getAll();
    expect(queueItems[0].recordId).toBe('LOT-2026-TEST-01');
    expect(queueItems[0].operation).toBe('UPDATE');
    expect(queueItems[0].payload.available_weight_kg).toBe(350);
    expect(queueItems[0].payload.allocated_weight_kg).toBe(50);
  });

  it('consolidates rapid sequential updates to the same batch in syncQueue', async () => {
    await batchRepository.save(sampleBatch, true);

    // First allocation
    await batchRepository.updateWeights(sampleBatch.id, 300, 100);
    // Second allocation
    await batchRepository.updateWeights(sampleBatch.id, 250, 150);

    // SyncQueue should consolidate entries for the same record
    expect(syncQueue.size()).toBe(1);
    const queueItem = syncQueue.getAll()[0];
    expect(queueItem.recordId).toBe('LOT-2026-TEST-01');
    expect(queueItem.payload.available_weight_kg).toBe(250);
    expect(queueItem.payload.allocated_weight_kg).toBe(150);
  });

  it('resetCache cleanly replaces the local cache', () => {
    batchRepository.save(sampleBatch, true);
    expect(batchRepository.getLocalCache()).toHaveLength(1);

    batchRepository.resetCache([]);
    expect(batchRepository.getLocalCache()).toHaveLength(0);
  });
});
