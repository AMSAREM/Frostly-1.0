export type SyncOperationType = 'INSERT' | 'UPDATE' | 'DELETE';

export interface SyncQueueItem {
  id: string;
  tableName: string;
  operation: SyncOperationType;
  recordId: string;
  payload: Record<string, any>;
  timestamp: number;
  retryCount: number;
  lastError?: string;
}

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error';

export interface SyncQueueSummary {
  pendingCount: number;
  status: SyncStatus;
  lastSyncTime: number | null;
}

export type SyncQueueListener = (queue: SyncQueueItem[]) => void;
