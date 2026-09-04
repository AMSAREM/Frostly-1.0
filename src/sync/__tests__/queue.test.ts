import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { syncQueue } from '../queue';

// Lightweight in-memory localStorage mock for node test runner
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

describe('SyncQueue Unit Tests', () => {
  beforeEach(() => {
    localStorageMock.clear();
    syncQueue.clear();
  });

  it('enqueues a new operation and assigns unique id and timestamp', () => {
    const item = syncQueue.enqueue({
      tableName: 'inventory_batches',
      operation: 'INSERT',
      recordId: 'LOT-TEST-001',
      payload: { available_weight_kg: 500, grade: 'A' },
    });

    expect(item).toBeDefined();
    expect(item.id).toContain('sync_');
    expect(item.recordId).toBe('LOT-TEST-001');
    expect(item.operation).toBe('INSERT');
    expect(item.retryCount).toBe(0);
    expect(syncQueue.size()).toBe(1);
  });

  it('persists queued items to localStorage', () => {
    syncQueue.enqueue({
      tableName: 'inventory_batches',
      operation: 'INSERT',
      recordId: 'LOT-TEST-002',
      payload: { available_weight_kg: 250 },
    });

    const storedRaw = localStorage.getItem('frostly_sync_queue_v1');
    expect(storedRaw).not.toBeNull();
    const parsed = JSON.parse(storedRaw!);
    expect(parsed.length).toBe(1);
    expect(parsed[0].recordId).toBe('LOT-TEST-002');
  });

  it('consolidates INSERT followed by UPDATE on the same record', () => {
    syncQueue.enqueue({
      tableName: 'inventory_batches',
      operation: 'INSERT',
      recordId: 'LOT-TEST-003',
      payload: { initial_weight_kg: 1000, available_weight_kg: 1000 },
    });

    // Offline update before sync
    syncQueue.enqueue({
      tableName: 'inventory_batches',
      operation: 'UPDATE',
      recordId: 'LOT-TEST-003',
      payload: { available_weight_kg: 850, notes: 'Allocated 150kg' },
    });

    expect(syncQueue.size()).toBe(1);
    const item = syncQueue.getAll()[0];
    expect(item.operation).toBe('INSERT');
    expect(item.payload.initial_weight_kg).toBe(1000);
    expect(item.payload.available_weight_kg).toBe(850);
    expect(item.payload.notes).toBe('Allocated 150kg');
  });

  it('removes pending un-synced INSERT when subsequently DELETED', () => {
    syncQueue.enqueue({
      tableName: 'inventory_batches',
      operation: 'INSERT',
      recordId: 'LOT-TEST-004',
      payload: { grade: 'B' },
    });

    expect(syncQueue.size()).toBe(1);

    // Delete before it ever synced to remote DB
    syncQueue.enqueue({
      tableName: 'inventory_batches',
      operation: 'DELETE',
      recordId: 'LOT-TEST-004',
      payload: {},
    });

    // Should be completely purged from queue since server never knew about it
    expect(syncQueue.size()).toBe(0);
  });

  it('converts UPDATE to DELETE when an existing server record is deleted', () => {
    syncQueue.enqueue({
      tableName: 'inventory_batches',
      operation: 'UPDATE',
      recordId: 'LOT-EXISTING-005',
      payload: { available_weight_kg: 100 },
    });

    syncQueue.enqueue({
      tableName: 'inventory_batches',
      operation: 'DELETE',
      recordId: 'LOT-EXISTING-005',
      payload: {},
    });

    expect(syncQueue.size()).toBe(1);
    const item = syncQueue.getAll()[0];
    expect(item.operation).toBe('DELETE');
  });

  it('dequeues processed items by id', () => {
    const item = syncQueue.enqueue({
      tableName: 'inventory_batches',
      operation: 'UPDATE',
      recordId: 'LOT-TEST-006',
      payload: { available_weight_kg: 400 },
    });

    expect(syncQueue.size()).toBe(1);
    syncQueue.dequeue(item.id);
    expect(syncQueue.size()).toBe(0);
  });

  it('flushes queue and replays operations with mock processor', async () => {
    syncQueue.enqueue({
      tableName: 'inventory_batches',
      operation: 'INSERT',
      recordId: 'LOT-SYNC-007',
      payload: { available_weight_kg: 600 },
    });

    const mockProcessor = vi.fn().mockResolvedValue(true);

    const result = await syncQueue.flush(mockProcessor);

    expect(mockProcessor).toHaveBeenCalledTimes(1);
    expect(result.successCount).toBe(1);
    expect(result.failCount).toBe(0);
    expect(syncQueue.size()).toBe(0);
  });

  it('increments retryCount on processor failure and preserves queue item', async () => {
    syncQueue.enqueue({
      tableName: 'inventory_batches',
      operation: 'UPDATE',
      recordId: 'LOT-FAIL-008',
      payload: { available_weight_kg: 300 },
    });

    const failingProcessor = vi.fn().mockResolvedValue(false);

    const result = await syncQueue.flush(failingProcessor);

    expect(result.successCount).toBe(0);
    expect(result.failCount).toBe(1);
    expect(syncQueue.size()).toBe(1);

    const item = syncQueue.getAll()[0];
    expect(item.retryCount).toBe(1);
    expect(item.lastError).toBe('Processor returned false');
  });
});
