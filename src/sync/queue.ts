import { SyncQueueItem, SyncQueueListener, SyncOperationType } from './types';

const QUEUE_STORAGE_KEY = 'frostly_sync_queue_v1';
const MAX_RETRIES = 5;

class SyncQueue {
  private queue: SyncQueueItem[] = [];
  private listeners: Set<SyncQueueListener> = new Set();
  private isProcessing = false;

  constructor() {
    this.loadFromStorage();
    this.initNetworkListeners();
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(QUEUE_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          this.queue = parsed;
        }
      }
    } catch (e) {
      console.warn('[SyncQueue] Failed to load queue from storage:', e);
      this.queue = [];
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
      this.notifyListeners();
    } catch (e) {
      console.warn('[SyncQueue] Failed to persist queue to storage:', e);
    }
  }

  private notifyListeners(): void {
    const snapshot = [...this.queue];
    this.listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (err) {
        console.error('[SyncQueue] Error in listener callback:', err);
      }
    });
  }

  private initNetworkListeners(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      console.log('[SyncQueue] Network back online. Auto-flush may be triggered by handlers.');
    });
  }

  public enqueue(
    item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retryCount'>
  ): SyncQueueItem {
    // Check if an entry for the same table and record already exists
    const existingIndex = this.queue.findIndex(
      (q) => q.tableName === item.tableName && q.recordId === item.recordId
    );

    if (existingIndex >= 0) {
      const existing = this.queue[existingIndex];

      // Consolidate operations if possible
      if (existing.operation === 'INSERT' && item.operation === 'UPDATE') {
        // Keep as INSERT, but merge payload
        existing.payload = { ...existing.payload, ...item.payload };
        existing.timestamp = Date.now();
        this.saveToStorage();
        return existing;
      } else if (item.operation === 'DELETE') {
        if (existing.operation === 'INSERT') {
          // It was never synced to server, just remove from queue
          this.queue.splice(existingIndex, 1);
          this.saveToStorage();
          return {
            id: existing.id,
            tableName: item.tableName,
            operation: 'DELETE',
            recordId: item.recordId,
            payload: {},
            timestamp: Date.now(),
            retryCount: 0,
          };
        } else {
          // Replace with DELETE
          existing.operation = 'DELETE';
          existing.payload = {};
          existing.timestamp = Date.now();
          this.saveToStorage();
          return existing;
        }
      } else {
        // Replace existing item
        existing.operation = item.operation;
        existing.payload = { ...existing.payload, ...item.payload };
        existing.timestamp = Date.now();
        this.saveToStorage();
        return existing;
      }
    }

    const newItem: SyncQueueItem = {
      id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      tableName: item.tableName,
      operation: item.operation,
      recordId: item.recordId,
      payload: item.payload,
      timestamp: Date.now(),
      retryCount: 0,
    };

    this.queue.push(newItem);
    this.saveToStorage();
    return newItem;
  }

  public dequeue(id: string): void {
    const index = this.queue.findIndex((item) => item.id === id);
    if (index !== -1) {
      this.queue.splice(index, 1);
      this.saveToStorage();
    }
  }

  public updateItem(id: string, updates: Partial<SyncQueueItem>): void {
    const index = this.queue.findIndex((item) => item.id === id);
    if (index !== -1) {
      this.queue[index] = { ...this.queue[index], ...updates };
      this.saveToStorage();
    }
  }

  public getAll(): SyncQueueItem[] {
    return [...this.queue];
  }

  public getByTable(tableName: string): SyncQueueItem[] {
    return this.queue.filter((q) => q.tableName === tableName);
  }

  public size(): number {
    return this.queue.length;
  }

  public clear(): void {
    this.queue = [];
    this.saveToStorage();
  }

  public subscribe(listener: SyncQueueListener): () => void {
    this.listeners.add(listener);
    listener([...this.queue]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public async flush(
    processor: (item: SyncQueueItem) => Promise<boolean>
  ): Promise<{ successCount: number; failCount: number }> {
    if (this.isProcessing) {
      return { successCount: 0, failCount: 0 };
    }

    this.isProcessing = true;
    let successCount = 0;
    let failCount = 0;

    try {
      const itemsToProcess = [...this.queue];

      for (const item of itemsToProcess) {
        try {
          const success = await processor(item);
          if (success) {
            this.dequeue(item.id);
            successCount++;
          } else {
            const nextRetry = item.retryCount + 1;
            if (nextRetry > MAX_RETRIES) {
              console.error(
                `[SyncQueue] Max retries (${MAX_RETRIES}) reached for item ${item.id} on table ${item.tableName}`
              );
              this.updateItem(item.id, {
                retryCount: nextRetry,
                lastError: 'Max retries exceeded',
              });
            } else {
              this.updateItem(item.id, {
                retryCount: nextRetry,
                lastError: 'Processor returned false',
              });
            }
            failCount++;
          }
        } catch (err: any) {
          console.error(`[SyncQueue] Error processing item ${item.id}:`, err);
          const nextRetry = item.retryCount + 1;
          this.updateItem(item.id, {
            retryCount: nextRetry,
            lastError: err?.message || String(err),
          });
          failCount++;
        }
      }
    } finally {
      this.isProcessing = false;
    }

    return { successCount, failCount };
  }
}

export const syncQueue = new SyncQueue();
