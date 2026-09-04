import { syncQueue } from './queue';
import { batchRepository } from '../repositories/batchRepository';
import { getSession } from '../data/auth';

type FlushHandler = () => Promise<{ processed: number; failed: number }>;

class SyncManager {
  private flushHandlers: Map<string, FlushHandler> = new Map();
  private isSyncing = false;
  private autoFlushTimeout: any = null;

  constructor() {
    // Register core entity flush handlers
    this.registerHandler('inventory_batches', () => batchRepository.flushTableQueue());

    // Listen for online events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.scheduleAutoFlush(1500);
      });
    }
  }

  public registerHandler(tableName: string, handler: FlushHandler): void {
    this.flushHandlers.set(tableName, handler);
  }

  public scheduleAutoFlush(delayMs = 2000): void {
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
    let totalProcessed = 0;
    let totalFailed = 0;

    try {
      for (const [table, handler] of this.flushHandlers.entries()) {
        try {
          const res = await handler();
          totalProcessed += res.processed;
          totalFailed += res.failed;
        } catch (err) {
          console.error(`[SyncManager] Failed flushing table ${table}:`, err);
          totalFailed++;
        }
      }
    } finally {
      this.isSyncing = false;
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
