import { supabase, isSupabaseConfigured } from '../utils/supabase';
import { getSession } from '../data/auth';
import { syncQueue } from '../sync/queue';
import { SyncOperationType } from '../sync/types';

export interface RepositoryOptions<TDomain, TDatabaseRow> {
  tableName: string;
  storageKey: string;
  toDomain: (row: TDatabaseRow) => TDomain;
  toDatabase: (entity: TDomain) => Record<string, any>;
  getId: (entity: TDomain) => string;
}

export class BaseRepository<TDomain, TDatabaseRow> {
  protected tableName: string;
  protected storageKey: string;
  protected toDomain: (row: TDatabaseRow) => TDomain;
  protected toDatabase: (entity: TDomain) => Record<string, any>;
  protected getId: (entity: TDomain) => string;

  constructor(options: RepositoryOptions<TDomain, TDatabaseRow>) {
    this.tableName = options.tableName;
    this.storageKey = options.storageKey;
    this.toDomain = options.toDomain;
    this.toDatabase = options.toDatabase;
    this.getId = options.getId;
  }

  /**
   * Determine if we can safely execute live Supabase calls.
   * Checks:
   * 1. Supabase configured
   * 2. Browser online
   * 3. Valid authenticated session (required by RLS)
   */
  public async canAccessSupabase(): Promise<boolean> {
    if (!isSupabaseConfigured) {
      return false;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return false;
    }

    try {
      const session = await getSession();
      return session !== null;
    } catch (err) {
      console.warn(`[BaseRepository:${this.tableName}] Session check failed:`, err);
      return false;
    }
  }

  /**
   * Read entities from local storage cache
   */
  public getLocalCache(fallback: TDomain[] = []): TDomain[] {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn(`[BaseRepository:${this.tableName}] Error reading localStorage:`, e);
    }
    return fallback;
  }

  /**
   * Update entities in local storage cache
   */
  public setLocalCache(items: TDomain[]): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(items));
    } catch (e) {
      console.warn(`[BaseRepository:${this.tableName}] Error saving to localStorage:`, e);
    }
  }

  /**
   * Fetch all records:
   * 1. Attempts Supabase query if session is valid and online
   * 2. Automatically syncs result into localStorage
   * 3. Cleanly falls through to localStorage when unauthenticated or offline
   */
  public async getAll(fallback: TDomain[] = []): Promise<TDomain[]> {
    const canQuery = await this.canAccessSupabase();

    if (canQuery) {
      try {
        const { data, error } = await supabase
          .from(this.tableName)
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.warn(`[BaseRepository:${this.tableName}] Live query error:`, error.message);
          return this.getLocalCache(fallback);
        }

        if (data && Array.isArray(data)) {
          const domainItems = data.map((row) => this.toDomain(row as unknown as TDatabaseRow));
          this.setLocalCache(domainItems);
          return domainItems;
        }
      } catch (err) {
        console.warn(`[BaseRepository:${this.tableName}] Live fetch failed, using cache:`, err);
      }
    }

    return this.getLocalCache(fallback);
  }

  /**
   * Get single record by ID
   */
  public async getById(id: string, fallback: TDomain[] = []): Promise<TDomain | null> {
    const canQuery = await this.canAccessSupabase();

    if (canQuery) {
      try {
        const { data, error } = await supabase
          .from(this.tableName)
          .select('*')
          .eq('id', id)
          .single();

        if (!error && data) {
          return this.toDomain(data as unknown as TDatabaseRow);
        }
      } catch (err) {
        console.warn(`[BaseRepository:${this.tableName}] getById failed:`, err);
      }
    }

    const cached = this.getLocalCache(fallback);
    return cached.find((item) => this.getId(item) === id) || null;
  }

  /**
   * Save (insert or update) an entity:
   * 1. Immediately updates local cache (optimistic response)
   * 2. Attempts Supabase upsert if authenticated
   * 3. If unauthenticated, offline, or request fails: enqueues into syncQueue
   */
  public async save(entity: TDomain, isInsert = false): Promise<TDomain> {
    const id = this.getId(entity);
    const dbPayload = this.toDatabase(entity);

    // 1. Optimistic Local Cache Update
    const current = this.getLocalCache();
    const existingIndex = current.findIndex((item) => this.getId(item) === id);

    let updated: TDomain[];
    if (existingIndex >= 0) {
      updated = [...current];
      updated[existingIndex] = entity;
    } else {
      updated = [entity, ...current];
    }
    this.setLocalCache(updated);

    // 2. Try Live Supabase
    const canQuery = await this.canAccessSupabase();
    if (canQuery) {
      try {
        const { error } = await supabase
          .from(this.tableName)
          .upsert(dbPayload, { onConflict: 'id' });

        if (!error) {
          return entity;
        }
        console.warn(`[BaseRepository:${this.tableName}] Supabase save returned error:`, error.message);
      } catch (err) {
        console.warn(`[BaseRepository:${this.tableName}] Supabase save exception:`, err);
      }
    }

    // 3. Queue to offline sync queue if offline, unauthenticated, or Supabase call failed
    const operation: SyncOperationType = isInsert || existingIndex < 0 ? 'INSERT' : 'UPDATE';
    syncQueue.enqueue({
      tableName: this.tableName,
      operation,
      recordId: id,
      payload: dbPayload,
    });

    return entity;
  }

  /**
   * Delete an entity by ID
   */
  public async delete(id: string): Promise<void> {
    // 1. Remove from local cache
    const current = this.getLocalCache();
    const filtered = current.filter((item) => this.getId(item) !== id);
    this.setLocalCache(filtered);

    // 2. Try Live Supabase
    const canQuery = await this.canAccessSupabase();
    if (canQuery) {
      try {
        const { error } = await supabase
          .from(this.tableName)
          .delete()
          .eq('id', id);

        if (!error) {
          return;
        }
        console.warn(`[BaseRepository:${this.tableName}] Supabase delete returned error:`, error.message);
      } catch (err) {
        console.warn(`[BaseRepository:${this.tableName}] Supabase delete exception:`, err);
      }
    }

    // 3. Queue to offline sync queue
    syncQueue.enqueue({
      tableName: this.tableName,
      operation: 'DELETE',
      recordId: id,
      payload: {},
    });
  }

  /**
   * Flush pending queued items for this table to Supabase
   */
  public async flushTableQueue(): Promise<{ processed: number; failed: number }> {
    const canQuery = await this.canAccessSupabase();
    if (!canQuery) {
      return { processed: 0, failed: 0 };
    }

    const items = syncQueue.getByTable(this.tableName);
    let processed = 0;
    let failed = 0;

    for (const item of items) {
      try {
        let error: any = null;

        if (item.operation === 'INSERT' || item.operation === 'UPDATE') {
          const res = await supabase
            .from(this.tableName)
            .upsert(item.payload, { onConflict: 'id' });
          error = res.error;
        } else if (item.operation === 'DELETE') {
          const res = await supabase
            .from(this.tableName)
            .delete()
            .eq('id', item.recordId);
          error = res.error;
        }

        if (!error) {
          syncQueue.dequeue(item.id);
          processed++;
        } else {
          console.warn(`[BaseRepository:${this.tableName}] Sync error for ${item.recordId}:`, error.message);
          failed++;
        }
      } catch (err) {
        console.error(`[BaseRepository:${this.tableName}] Sync exception:`, err);
        failed++;
      }
    }

    return { processed, failed };
  }
}
