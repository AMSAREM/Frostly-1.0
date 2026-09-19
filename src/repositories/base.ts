import { supabase, isSupabaseConfigured } from '../utils/supabase';
import { getSession, getStaffProfile, getCurrentOrganizationId } from '../data/auth';
import { syncQueue } from '../sync/queue';
import { SyncOperationType } from '../sync/types';
import { ensureValidUuid } from '../mappers/notificationMapper';

export class OrganizationNotResolvedError extends Error {
  constructor(action: string, tableName: string) {
    super(`[BaseRepository:${tableName}] Organization ID could not be resolved for action '${action}'. Operation aborted to prevent cross-tenant data leakage.`);
    this.name = 'OrganizationNotResolvedError';
  }
}

export interface RepositoryOptions<TDomain, TDatabaseRow> {
  tableName: string;
  storageKey: string;
  toDomain: (row: TDatabaseRow) => TDomain;
  toDatabase: (entity: TDomain) => Record<string, any>;
  getId: (entity: TDomain) => string;
  onConflict?: string;
}

export class BaseRepository<TDomain, TDatabaseRow> {
  protected static unknownColumnsByTable: Map<string, Set<string>> = new Map([
    ['inventory_batches', new Set(['is_retail_cut_lot', 'linked_product_id', 'product_sku'])],
  ]);

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
   * Synchronously compute the scoped localStorage key for a tenant.
   * Fails closed: returns null if the organization cannot be resolved,
   * preventing cross-tenant leakage or fallback into a shared demo namespace.
   */
  public getScopedStorageKey(orgId?: string): string | null {
    const activeOrg = orgId || getCurrentOrganizationId();
    if (activeOrg && activeOrg !== 'org-frostly-hq' && activeOrg !== '00000000-0000-0000-0000-000000000001') {
      return `${this.storageKey}__tenant_${activeOrg}`;
    }
    return null;
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
   * Read entities from tenant-scoped local storage cache.
   * Fails closed: returns fallback if organization is not resolved.
   */
  public getLocalCache(fallback: TDomain[] = [], orgId?: string): TDomain[] {
    const key = this.getScopedStorageKey(orgId);
    if (!key) {
      return fallback;
    }
    try {
      const stored = localStorage.getItem(key);
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
   * Update entities in tenant-scoped local storage cache.
   * Fails closed: rejects writes if organization cannot be resolved.
   */
  public setLocalCache(items: TDomain[], orgId?: string): void {
    const key = this.getScopedStorageKey(orgId);
    if (!key) {
      console.warn(`[BaseRepository:${this.tableName}] setLocalCache rejected: organization could not be resolved.`);
      return;
    }
    try {
      localStorage.setItem(key, JSON.stringify(items));
    } catch (e) {
      console.warn(`[BaseRepository:${this.tableName}] Error saving to localStorage:`, e);
    }
  }

  /**
   * Explicitly purge local storage cache for a given tenant or active tenant
   */
  public clearTenantCache(orgId?: string): void {
    const key = this.getScopedStorageKey(orgId);
    if (!key) return;
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`[BaseRepository:${this.tableName}] Error clearing tenant cache:`, e);
    }
  }

  /**
   * Fetch all records:
   * 1. Attempts Supabase query scoped to active tenant organization_id
   * 2. Automatically syncs result into tenant-scoped localStorage
   * 3. Cleanly falls through to tenant-scoped localStorage when unauthenticated or offline
   */
  public async getAll(fallback: TDomain[] = []): Promise<TDomain[]> {
    const orgId = await this.getOrganizationId();
    const canQuery = await this.canAccessSupabase();

    if (canQuery) {
      try {
        let query = supabase
          .from(this.tableName)
          .select('*')
          .order('created_at', { ascending: false });

        if (this.onConflict.includes('organization_id') || orgId) {
          if (orgId) {
            query = query.eq('organization_id', orgId);
          }
        }

        const { data, error } = await query;

        if (error) {
          console.warn(`[BaseRepository:${this.tableName}] Live query error:`, error.message);
          return this.getLocalCache(fallback, orgId);
        }

        if (data && Array.isArray(data)) {
          const domainItems = data.map((row) => this.toDomain(row as unknown as TDatabaseRow));
          this.setLocalCache(domainItems, orgId);
          return domainItems;
        }
      } catch (err) {
        console.warn(`[BaseRepository:${this.tableName}] Live fetch failed, using cache:`, err);
      }
    }

    return this.getLocalCache(fallback, orgId);
  }

  /**
   * Get single record by ID scoped to active tenant organization_id
   */
  public async getById(id: string, fallback: TDomain[] = []): Promise<TDomain | null> {
    const orgId = await this.getOrganizationId();
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

        if (this.onConflict.includes('organization_id') || orgId) {
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

    const cached = this.getLocalCache(fallback, orgId);
    return cached.find((item) => this.getId(item) === id) || null;
  }

  /**
   * Save (insert or update) an entity:
   * 1. Immediately updates tenant-scoped local cache (optimistic response)
   * 2. Attempts Supabase upsert with active organization_id if authenticated
   * 3. If unauthenticated, offline, or request fails: enqueues into syncQueue with organizationId
   */
  public async save(entity: TDomain, isInsert = false): Promise<TDomain> {
    const orgId = await this.getOrganizationId();
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

    // Populate organization_id for multi-tenant composite key and complete isolation
    if (this.onConflict.includes('organization_id') || orgId) {
      const resolvedOrg = orgId || (await this.getOrganizationId());
      if (!resolvedOrg || resolvedOrg === '00000000-0000-0000-0000-000000000001' || resolvedOrg === 'org-frostly-hq') {
        throw new OrganizationNotResolvedError('save', this.tableName);
      }
      dbPayload.organization_id = resolvedOrg;
    }

    // 1. Optimistic Tenant-Scoped Local Cache Update
    const current = this.getLocalCache([], orgId);
    const existingIndex = current.findIndex((item) => this.getId(item) === id);

    let updated: TDomain[];
    if (existingIndex >= 0) {
      updated = [...current];
      updated[existingIndex] = entity;
    } else {
      updated = [entity, ...current];
    }
    this.setLocalCache(updated, orgId);

    // 2. Try Live Supabase
    const canQuery = await this.canAccessSupabase();
    if (canQuery) {
      try {
        const { error } = await this.executeUpsertWithRecovery(dbPayload, this.onConflict);
        if (!error) {
          return entity;
        }
        console.warn(`[BaseRepository:${this.tableName}] Supabase save returned error:`, error.message);
      } catch (err) {
        console.warn(`[BaseRepository:${this.tableName}] Supabase save exception:`, err);
      }
    }

    // 3. Queue to offline sync queue with organizationId
    const operation: SyncOperationType = isInsert || existingIndex < 0 ? 'INSERT' : 'UPDATE';
    syncQueue.enqueue({
      tableName: this.tableName,
      operation,
      recordId: id,
      organizationId: orgId,
      payload: dbPayload,
    });

    return entity;
  }

  /**
   * Delete an entity by ID scoped to active tenant organization_id
   */
  public async delete(id: string): Promise<void> {
    const orgId = await this.getOrganizationId();

    // 1. Remove from tenant-scoped local cache
    const current = this.getLocalCache([], orgId);
    const filtered = current.filter((item) => this.getId(item) !== id);
    this.setLocalCache(filtered, orgId);

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

        if (this.onConflict.includes('organization_id') || orgId) {
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

    // 3. Queue to offline sync queue with organizationId
    syncQueue.enqueue({
      tableName: this.tableName,
      operation: 'DELETE',
      recordId: id,
      organizationId: orgId,
      payload: {},
    });
  }

  /**
   * Reset the local cache directly (e.g., during full reset)
   */
  public resetCache(entities: TDomain[], orgId?: string): void {
    this.setLocalCache(entities, orgId);
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
   * Helper to perform an upsert with resilient fallback for schema differences and ON CONFLICT targets
   */
  private async executeUpsertWithRecovery(
    payload: Record<string, any>,
    initialConflictTarget: string
  ): Promise<{ error: any; cleanPayload: Record<string, any> }> {
    let conflictTarget = initialConflictTarget;
    const cleanPayload = { ...payload };

    // 1. Prune known missing schema cache columns before sending
    const knownMissing = BaseRepository.unknownColumnsByTable.get(this.tableName);
    if (knownMissing && knownMissing.size > 0) {
      for (const col of knownMissing) {
        delete cleanPayload[col];
      }
    }

    let res = await supabase
      .from(this.tableName)
      .upsert(cleanPayload, { onConflict: conflictTarget });
    let error = res.error;

    // Retry loop for any missing columns or constraint mismatches (up to 5 iterations)
    for (let attempt = 0; attempt < 5 && error; attempt++) {
      let recovered = false;

      // Handle missing schema cache columns
      if (error.message?.includes('in the schema cache') && error.message?.includes("Could not find the '")) {
        const match = error.message.match(/Could not find the '([^']+)' column of/);
        if (match && match[1]) {
          const missingCol = match[1];
          console.error(
            `[CRITICAL SCHEMA DRIFT ALERT] Database table '${this.tableName}' is missing expected column '${missingCol}'. ` +
            `Please run pending database migrations (e.g. 017_inventory_retail_linking.sql). Dropping column from write payload as temporary runtime fallback.`
          );
          let set = BaseRepository.unknownColumnsByTable.get(this.tableName);
          if (!set) {
            set = new Set<string>();
            BaseRepository.unknownColumnsByTable.set(this.tableName, set);
          }
          set.add(missingCol);
          delete cleanPayload[missingCol];
          recovered = true;
        }
      }

      // Handle ON CONFLICT specification mismatch
      if (error.message?.includes('there is no unique or exclusion constraint matching the ON CONFLICT specification')) {
        conflictTarget = conflictTarget.includes('organization_id') ? 'id' : 'organization_id,id';
        this.onConflict = conflictTarget;
        recovered = true;
      }

      if (!recovered) break;

      const retryRes = await supabase
        .from(this.tableName)
        .upsert(cleanPayload, { onConflict: conflictTarget });
      error = retryRes.error;
    }

    return { error, cleanPayload };
  }

  /**
   * Flush pending queued items for this table to Supabase
   */
  public async flushTableQueue(): Promise<{ processed: number; failed: number }> {
    const canQuery = await this.canAccessSupabase();
    if (!canQuery) {
      return { processed: 0, failed: 0 };
    }

    const orgId = await this.getOrganizationId();
    const items = syncQueue.getByTable(this.tableName, orgId);
    let processed = 0;
    let failed = 0;

    for (const item of items) {
      // Security guard: ensure queued item belongs to current organization
      if (item.organizationId && orgId && item.organizationId !== orgId) {
        continue;
      }
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
          if (this.onConflict.includes('organization_id') || orgId) {
            const queueOrg = item.organizationId || orgId || (await this.getOrganizationId());
            if (!queueOrg || queueOrg === '00000000-0000-0000-0000-000000000001' || queueOrg === 'org-frostly-hq') {
              throw new OrganizationNotResolvedError('flushQueue', this.tableName);
            }
            payload.organization_id = queueOrg;
          }

          const upsertResult = await this.executeUpsertWithRecovery(payload, this.onConflict);
          error = upsertResult.error;

          if (upsertResult.cleanPayload) {
            syncQueue.updateItem(item.id, { payload: upsertResult.cleanPayload });
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
