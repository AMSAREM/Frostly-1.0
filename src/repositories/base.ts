import { supabase, isSupabaseConfigured } from '../utils/supabase';
import { getSession, getStaffProfile, getCurrentOrganizationId } from '../data/auth';
import { syncQueue } from '../sync/queue';
import { SyncOperationType } from '../sync/types';
import { ensureValidUuid } from '../mappers/notificationMapper';

export interface RepositoryOptions<TDomain, TDatabaseRow> {
  tableName: string;
  storageKey: string;
  toDomain: (row: TDatabaseRow) => TDomain;
  toDatabase: (entity: TDomain) => Record<string, any>;
  getId: (entity: TDomain) => string;
  onConflict?: string;
}

export class BaseRepository<TDomain, TDatabaseRow> {
  protected tableName: string;
  protected storageKey: string;
  protected toDomain: (row: TDatabaseRow) => TDomain;
  protected toDatabase: (entity: TDomain) => Record<string, any>;
  protected getId: (entity: TDomain) => string;
  protected onConflict: string;

  constructor(options: RepositoryOptions<TDomain, TDatabaseRow>) {
    this.tableName = options.tableName;
    this.storageKey = options.storageKey;
    this.toDomain = options.toDomain;
    this.toDatabase = options.toDatabase;
    this.getId = options.getId;
    this.onConflict = options.onConflict || 'organization_id,id';
  }

  /**
   * Helper to retrieve active tenant organization ID
   */
  public async getOrganizationId(): Promise<string> {
    try {
      const profile = await getStaffProfile();
      if (profile?.organization_id && profile.organization_id !== 'org-frostly-hq') {
        return profile.organization_id;
      }
    } catch {
      // ignore
    }
    return getCurrentOrganizationId();
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
        let lookupId = id;
        if (this.tableName === 'system_notifications') {
          lookupId = ensureValidUuid(id);
        }

        let query = supabase
          .from(this.tableName)
          .select('*')
          .eq('id', lookupId);

        if (this.onConflict.includes('organization_id')) {
          const orgId = await this.getOrganizationId();
          if (orgId) {
            query = query.eq('organization_id', orgId);
          }
        }

        const { data, error } = await query.maybeSingle();

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
    const rawPayload = this.toDatabase(entity);
    const dbPayload: Record<string, any> = { ...rawPayload };

    // Sanitize special types for Postgres compliance
    if (this.tableName === 'system_notifications') {
      if (dbPayload.id) {
        dbPayload.id = ensureValidUuid(dbPayload.id);
      }
      if (!dbPayload.created_at || isNaN(Date.parse(dbPayload.created_at))) {
        dbPayload.created_at = new Date().toISOString();
      }
    }

    // Populate organization_id for multi-tenant composite key
    if ((!dbPayload.organization_id || dbPayload.organization_id === 'org-frostly-hq') && this.onConflict.includes('organization_id')) {
      const orgId = await this.getOrganizationId();
      dbPayload.organization_id = orgId || getCurrentOrganizationId() || '00000000-0000-0000-0000-000000000001';
    }

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
        let conflictTarget = this.onConflict;
        let { error } = await supabase
          .from(this.tableName)
          .upsert(dbPayload, { onConflict: conflictTarget });

        // Adaptive fallback if ON CONFLICT specification did not match table constraint
        if (error && error.message?.includes('there is no unique or exclusion constraint matching the ON CONFLICT specification')) {
          const alternateTarget = conflictTarget.includes('organization_id') ? 'id' : 'organization_id,id';
          console.warn(`[BaseRepository:${this.tableName}] Retrying upsert with alternate onConflict target: ${alternateTarget}`);
          const retryRes = await supabase
            .from(this.tableName)
            .upsert(dbPayload, { onConflict: alternateTarget });
          if (!retryRes.error) {
            this.onConflict = alternateTarget;
            return entity;
          }
          error = retryRes.error;
        }

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
        let lookupId = id;
        if (this.tableName === 'system_notifications') {
          lookupId = ensureValidUuid(id);
        }

        let query = supabase
          .from(this.tableName)
          .delete()
          .eq('id', lookupId);

        if (this.onConflict.includes('organization_id')) {
          const orgId = await this.getOrganizationId();
          if (orgId) {
            query = query.eq('organization_id', orgId);
          }
        }

        const { error } = await query;

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
   * Reset the local cache directly (e.g., during full reset)
   */
  public resetCache(entities: TDomain[]): void {
    this.setLocalCache(entities);
  }

  /**
   * Save multiple entities in batch
   */
  public async saveAll(entities: TDomain[], isInsert = false): Promise<TDomain[]> {
    for (const entity of entities) {
      await this.save(entity, isInsert);
    }
    return entities;
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
          const payload = { ...item.payload };

          // Sanitize special types for Postgres compliance
          if (this.tableName === 'system_notifications') {
            if (payload.id) {
              payload.id = ensureValidUuid(payload.id);
            }
            if (!payload.created_at || isNaN(Date.parse(payload.created_at))) {
              payload.created_at = new Date().toISOString();
            }
          }

          // Populate organization_id for multi-tenant composite key
          if ((!payload.organization_id || payload.organization_id === 'org-frostly-hq') && this.onConflict.includes('organization_id')) {
            const orgId = await this.getOrganizationId();
            payload.organization_id = orgId || getCurrentOrganizationId() || '00000000-0000-0000-0000-000000000001';
          }

          let conflictTarget = this.onConflict;
          let res = await supabase
            .from(this.tableName)
            .upsert(payload, { onConflict: conflictTarget });
          error = res.error;

          // Adaptive fallback if ON CONFLICT specification did not match table constraint
          if (error && error.message?.includes('there is no unique or exclusion constraint matching the ON CONFLICT specification')) {
            const alternateTarget = conflictTarget.includes('organization_id') ? 'id' : 'organization_id,id';
            console.warn(`[BaseRepository:${this.tableName}] Retrying flush with alternate onConflict target: ${alternateTarget}`);
            const retryRes = await supabase
              .from(this.tableName)
              .upsert(payload, { onConflict: alternateTarget });
            if (!retryRes.error) {
              this.onConflict = alternateTarget;
              error = null;
            } else {
              error = retryRes.error;
            }
          }
        } else if (item.operation === 'DELETE') {
          let lookupId = item.recordId;
          if (this.tableName === 'system_notifications') {
            lookupId = ensureValidUuid(item.recordId);
          }

          let query = supabase
            .from(this.tableName)
            .delete()
            .eq('id', lookupId);

          if (this.onConflict.includes('organization_id')) {
            const orgId = await this.getOrganizationId();
            if (orgId) {
              query = query.eq('organization_id', orgId);
            }
          }

          const res = await query;
          error = res.error;
        }

        if (!error) {
          syncQueue.dequeue(item.id);
          processed++;
        } else {
          console.warn(`[BaseRepository:${this.tableName}] Sync error for ${item.recordId}:`, error.message);
          failed++;
          syncQueue.updateItem(item.id, {
            retryCount: (item.retryCount || 0) + 1,
            lastError: error.message,
          });
        }
      } catch (err) {
        console.error(`[BaseRepository:${this.tableName}] Sync exception:`, err);
        failed++;
      }
    }

    return { processed, failed };
  }
}
