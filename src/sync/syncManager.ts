import { syncQueue } from './queue';
import { batchRepository } from '../repositories/batchRepository';
import { customerRepository } from '../repositories/customerRepository';
import { getSession } from '../data/auth';

type FlushHandler = () => Promise<{ processed: number; failed: number }>;

export interface SyncState {
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: number | null;
  lastError: string | null;
}

export type SyncStateListener = (state: SyncState) => void;

class SyncManager {
  private flushHandlers: Map<string, FlushHandler> = new Map();
  private isSyncing = false;
  private autoFlushTimeout: any = null;
  private lastSyncTime: number | null = null;
  private lastError: string | null = null;
  private listeners: Set<SyncStateListener> = new Set();

  constructor() {
    // Register core entity flush handlers
    this.registerHandler('inventory_batches', () => batchRepository.flushTableQueue());
    this.registerHandler('customers', () => customerRepository.flushTableQueue());

    // Listen for online events to automatically flush all queued changes
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('[SyncManager] Browser online event detected. Flushing pending queue...');
        this.flushAll().catch((err) => {
          console.warn('[SyncManager] Online flush failed:', err);
        });
      });
    }

    // Subscribe to syncQueue mutations so new items automatically schedule flush if online & authed
    syncQueue.subscribe((items) => {
      this.notifyListeners();
      if (items.length > 0 && typeof navigator !== 'undefined' && navigator.onLine) {
        this.scheduleAutoFlush(1000);
      }
    });
  }

  public registerHandler(tableName: string, handler: FlushHandler): void {
    this.flushHandlers.set(tableName, handler);
  }

  public subscribe(listener: SyncStateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getState(): SyncState {
    return {
      isSyncing: this.isSyncing,
      pendingCount: syncQueue.size(),
      lastSyncTime: this.lastSyncTime,
      lastError: this.lastError,
    };
  }

  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (err) {
        console.error('[SyncManager] Listener error:', err);
      }
    });
  }

  public scheduleAutoFlush(delayMs = 1500): void {
    if (this.autoFlushTimeout) {
      clearTimeout(this.autoFlushTimeout);
    }
    this.autoFlushTimeout = setTimeout(() => {
      this.flushAll().catch((err) => {
        console.warn('[SyncManager] Auto-flush error:', err);
      });
    }, delayMs);
  }

  public async flushAll(): Promise<{ totalProcessed: number; totalFailed: number }> {
    if (this.isSyncing) {
      return { totalProcessed: 0, totalFailed: 0 };
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { totalProcessed: 0, totalFailed: 0 };
    }

    const session = await getSession();
    if (!session) {
      // Unauthenticated - RLS would reject live requests
      return { totalProcessed: 0, totalFailed: 0 };
    }

    this.isSyncing = true;
    this.lastError = null;
    this.notifyListeners();

    let totalProcessed = 0;
    let totalFailed = 0;

    try {
      for (const [table, handler] of this.flushHandlers.entries()) {
        try {
          const res = await handler();
          totalProcessed += res.processed;
          totalFailed += res.failed;
        } catch (err: any) {
          console.error(`[SyncManager] Failed flushing table ${table}:`, err);
          this.lastError = err?.message || String(err);
          totalFailed++;
        }
      }
      this.lastSyncTime = Date.now();
    } finally {
      this.isSyncing = false;
      this.notifyListeners();
    }

    return { totalProcessed, totalFailed };
  }

  public getPendingCount(): number {
    return syncQueue.size();
  }

  public getPendingItems() {
    return syncQueue.getAll();
  }
}

export const syncManager = new SyncManager();
