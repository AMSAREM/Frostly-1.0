import { supabase, isSupabaseConfigured } from '../utils/supabase';
import { getSession, getStaffProfile, getCurrentOrganizationId } from '../data/auth';
import { syncQueue } from '../sync/queue';
import { SyncOperationType } from '../sync/types';
import { ensureValidUuid } from '../mappers/notificationMapper';
import { encodeFinancialDescriptionMeta } from '../mappers/financialMapper';
import {
  erpServerQuery,
  erpServerUpsert,
  erpServerDelete,
} from '../services/erpPersistenceClient';

const UUID_PK_TABLES = new Set([
  'system_notifications',
  'financial_ledger_entries',
  'haccp_audit_records',
  'inventory_adjustments',
]);

const INSERT_ONLY_TABLES = new Set([
  'financial_ledger_entries',
  'haccp_audit_records',
  'inventory_adjustments',
]);

const SOFT_DELETE_TABLES = new Set([
  'retail_wholesale_products',
  'customers',
  'suppliers',
  'inventory_adjustment_accounts',
]);

export const INVALID_ORG_IDS = new Set([
  'org-frostly-hq',
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000001',
]);

export function isInvalidOrgId(orgId?: string | null): boolean {
  if (!orgId) return true;
  return INVALID_ORG_IDS.has(orgId) || /^00000000-0000-0000-0000-00000000000[01]$/.test(orgId);
}

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
    ['retail_wholesale_products', new Set(['linked_batch_id', 'storage_zone'])],
  ]);

  public static registerMissingColumn(tableName: string, columnName: string) {
    let set = BaseRepository.unknownColumnsByTable.get(tableName);
    if (!set) {
      set = new Set<string>();
      BaseRepository.unknownColumnsByTable.set(tableName, set);
    }
    set.add(columnName);
  }

  public static getMissingColumns(tableName: string): Set<string> | undefined {
    return BaseRepository.unknownColumnsByTable.get(tableName);
  }

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
      if (profile?.organization_id && !isInvalidOrgId(profile.organization_id)) {
        return profile.organization_id;
      }
      if (profile?.organization?.id && !isInvalidOrgId(profile.organization.id)) {
        return profile.organization.id;
      }
    } catch {
      // ignore
    }

    const current = getCurrentOrganizationId();
    if (current && !isInvalidOrgId(current)) {
      return current;
    }

    try {
      const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('frostly_active_org_id') : null;
      if (stored && !isInvalidOrgId(stored)) {
        return stored;
      }
    } catch {}

    return '';
  }

  /**
   * Synchronously compute the scoped localStorage key for a tenant.
   * Fails closed: returns null if the organization cannot be resolved,
   * preventing cross-tenant leakage or fallback into a shared demo namespace.
   */
  public getScopedStorageKey(orgId?: string): string | null {
    const activeOrg = orgId || getCurrentOrganizationId();
    if (!isInvalidOrgId(activeOrg)) {
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
      // If session is a local mock or offline test token, do not attempt remote Supabase operations
      if (
        session?.access_token &&
        (session.access_token.startsWith('local-token-') || session.access_token.startsWith('test-token-'))
      ) {
        return false;
      }
      return true;
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
          if (parsed.length > 0) {
            return parsed;
          }
          if (fallback && fallback.length > 0) {
            return fallback;
          }
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
        const serverRes = await erpServerQuery<any>({
          tableName: this.tableName,
          organizationId: orgId,
        });

        if (serverRes.handled && !serverRes.error && Array.isArray(serverRes.rows)) {
          const domainItems = serverRes.rows
            .filter((row: any) => row?.is_active !== false)
            .map((row: any) => this.toDomain(row as unknown as TDatabaseRow));
          this.setLocalCache(domainItems, orgId);
          return domainItems;
        }

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
          const domainItems = data
            .filter((row: any) => row?.is_active !== false)
            .map((row) => this.toDomain(row as unknown as TDatabaseRow));
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
        if (UUID_PK_TABLES.has(this.tableName)) {
          lookupId = ensureValidUuid(id);
        }

        const serverRes = await erpServerQuery<any>({
          tableName: this.tableName,
          organizationId: orgId,
          recordId: lookupId,
        });

        if (serverRes.handled && !serverRes.error) {
          if (!serverRes.row || serverRes.row.is_active === false) {
            return null;
          }
          return this.toDomain(serverRes.row as unknown as TDatabaseRow);
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

        if (!error && data && (data as any).is_active !== false) {
          return this.toDomain(data as unknown as TDatabaseRow);
        }
      } catch (err) {
        console.warn(`[BaseRepository:${this.tableName}] getById failed:`, err);
      }
    }

    const cached = this.getLocalCache(fallback, orgId);
    return cached.find((item) => this.getId(item) === id) || null;
  }

  protected updateLocalCacheItem(entity: TDomain, orgId: string): void {
    const id = this.getId(entity);
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
  }

  protected removeLocalCacheItem(id: string, orgId: string): void {
    const current = this.getLocalCache([], orgId);
    const filtered = current.filter((item) => this.getId(item) !== id);
    this.setLocalCache(filtered, orgId);
  }

  /**
   * Save (insert or update) an entity:
   * Single authoritative persistence path:
   * - When authenticated, routes to the verified server persistence endpoint.
   * - If server endpoint returns an error, throws immediately — never ignores or double-writes.
   * - Only if server endpoint is unhandled does it execute direct Supabase client write.
   * - In offline mode, queues to syncQueue for eventual replay.
   */
  public async save(entity: TDomain, isInsert = false, targetOrgId?: string): Promise<TDomain> {
    const orgId = targetOrgId || (await this.getOrganizationId());
    if (isInvalidOrgId(orgId)) {
      throw new OrganizationNotResolvedError('save', this.tableName);
    }
    const id = this.getId(entity);
    const rawPayload = this.toDatabase(entity);
    const dbPayload: Record<string, any> = { ...rawPayload };

    // Sanitize special types for Postgres compliance
    if (UUID_PK_TABLES.has(this.tableName) && dbPayload.id) {
      dbPayload.id = ensureValidUuid(dbPayload.id);
    }
    if (this.tableName === 'system_notifications') {
      if (!dbPayload.created_at || isNaN(Date.parse(dbPayload.created_at))) {
        dbPayload.created_at = new Date().toISOString();
      }
    }

    if (this.onConflict.includes('organization_id') || orgId) {
      dbPayload.organization_id = orgId;
    }

    const canQuery = await this.canAccessSupabase();
    if (canQuery) {
      // 1. Authoritative Server Persistence Route
      const serverUpsert = await erpServerUpsert({
        tableName: this.tableName,
        payload: dbPayload,
        onConflict: this.onConflict,
        organizationId: orgId,
      });

      if (serverUpsert.handled) {
        if (serverUpsert.error) {
          throw new Error(`[BaseRepository:${this.tableName}] Persistence error: ${serverUpsert.error}`);
        }
        this.updateLocalCacheItem(entity, orgId);
        return entity;
      }

      // 2. Direct Supabase write only if server persistence endpoint was unhandled
      const { error } = await this.executeUpsertWithRecovery(dbPayload, this.onConflict);
      if (error) {
        throw new Error(`[BaseRepository:${this.tableName}] Direct save error: ${error.message || error}`);
      }
      this.updateLocalCacheItem(entity, orgId);
      return entity;
    }

    // 3. Offline fallback
    this.updateLocalCacheItem(entity, orgId);
    const current = this.getLocalCache([], orgId);
    const existingIndex = current.findIndex((item) => this.getId(item) === id);
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
   * Delete an entity by ID scoped to active tenant organization_id:
   * Single authoritative delete path:
   * - When authenticated, routes to the verified server persistence delete endpoint.
   * - If server endpoint returns an error, throws immediately.
   * - Only if server endpoint is unhandled does it execute direct Supabase client delete.
   */
  public async delete(id: string, targetOrgId?: string): Promise<void> {
    const orgId = targetOrgId || (await this.getOrganizationId());
    if (isInvalidOrgId(orgId)) {
      throw new OrganizationNotResolvedError('delete', this.tableName);
    }

    const canQuery = await this.canAccessSupabase();
    if (canQuery) {
      let lookupId = id;
      if (UUID_PK_TABLES.has(this.tableName)) {
        lookupId = ensureValidUuid(id);
      }

      // 1. Authoritative Server Persistence Delete
      const serverDel = await erpServerDelete({
        tableName: this.tableName,
        recordId: lookupId,
        organizationId: orgId,
      });

      if (serverDel.handled) {
        if (serverDel.error) {
          throw new Error(`[BaseRepository:${this.tableName}] Delete error: ${serverDel.error}`);
        }
        this.removeLocalCacheItem(id, orgId);
        return;
      }

      // 2. Direct Supabase delete only if server delete route was unhandled
      let query = supabase
        .from(this.tableName)
        .delete()
        .eq('id', lookupId);

      if (this.onConflict.includes('organization_id') || orgId) {
        query = query.eq('organization_id', orgId);
      }

      const { error } = await query;
      if (error) {
        if (SOFT_DELETE_TABLES.has(this.tableName)) {
          let softQuery = supabase
            .from(this.tableName)
            .update({ is_active: false })
            .eq('id', lookupId);
          if (orgId) {
            softQuery = softQuery.eq('organization_id', orgId);
          }
          const softRes = await softQuery;
          if (softRes.error) {
            throw new Error(`[BaseRepository:${this.tableName}] Direct delete error: ${softRes.error.message}`);
          }
        } else {
          throw new Error(`[BaseRepository:${this.tableName}] Direct delete error: ${error.message}`);
        }
      }
      this.removeLocalCacheItem(id, orgId);
      return;
    }

    // 3. Offline fallback
    this.removeLocalCacheItem(id, orgId);
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
   * Helper to perform an upsert directly against Supabase with resilient fallback for schema differences
   */
  private async executeUpsertWithRecovery(
    payload: Record<string, any>,
    initialConflictTarget: string
  ): Promise<{ error: any; cleanPayload: Record<string, any> }> {
    let conflictTarget = initialConflictTarget;
    const cleanPayload = { ...payload };

    // 0A. Migrate any legacy retail_wholesale_products payload fields into origin metadata before pruning
    if (
      this.tableName === 'retail_wholesale_products' &&
      ('linked_batch_id' in cleanPayload || 'storage_zone' in cleanPayload)
    ) {
      const legacyBatch = cleanPayload.linked_batch_id;
      const legacyZone = cleanPayload.storage_zone;
      if ((legacyBatch || legacyZone) && typeof cleanPayload.origin === 'string' && !cleanPayload.origin.includes('<!--frostly_lot:')) {
        const meta = JSON.stringify({
          linkedBatchId: legacyBatch || null,
          storageZone: legacyZone || null,
        });
        cleanPayload.origin = cleanPayload.origin
          ? `${cleanPayload.origin} <!--frostly_lot:${meta}-->`
          : `<!--frostly_lot:${meta}-->`;
      }
      delete cleanPayload.linked_batch_id;
      delete cleanPayload.storage_zone;
    }

    // 1. Prune known missing schema cache columns before sending
    const knownMissing = BaseRepository.unknownColumnsByTable.get(this.tableName);
    if (knownMissing && knownMissing.size > 0) {
      for (const col of knownMissing) {
        delete cleanPayload[col];
      }
    }

    // 2. Direct Supabase write
    let res: any = null;
    let error: any = null;
    try {
      res = INSERT_ONLY_TABLES.has(this.tableName)
        ? await supabase.from(this.tableName).insert(cleanPayload)
        : await supabase.from(this.tableName).upsert(cleanPayload, { onConflict: conflictTarget });
      error = res?.error || null;
    } catch (fetchErr: any) {
      return { error: fetchErr || new Error('Network unavailable'), cleanPayload };
    }

    if (error && INSERT_ONLY_TABLES.has(this.tableName) && error.code === '23505') {
      return { error: null, cleanPayload };
    }

    // Retry loop for any missing columns or constraint mismatches (up to 5 iterations)
    for (let attempt = 0; attempt < 5 && error; attempt++) {
      let recovered = false;

      // Handle missing schema cache columns
      if (error.message?.includes('in the schema cache') && error.message?.includes("Could not find the '")) {
        const match = error.message.match(/Could not find the '([^']+)' column of/);
        if (match && match[1]) {
          const missingCol = match[1];
          console.warn(
            `[BaseRepository:${this.tableName}] Optional column '${missingCol}' is not present in remote schema cache; omitting from write payload.`
          );
          BaseRepository.registerMissingColumn(this.tableName, missingCol);
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

      try {
        const retryRes = INSERT_ONLY_TABLES.has(this.tableName)
          ? await supabase.from(this.tableName).insert(cleanPayload)
          : await supabase.from(this.tableName).upsert(cleanPayload, { onConflict: conflictTarget });
        error = retryRes?.error || null;
        if (error && INSERT_ONLY_TABLES.has(this.tableName) && error.code === '23505') {
          error = null;
        }
      } catch (fetchErr: any) {
        return { error: fetchErr || new Error('Network unavailable'), cleanPayload };
      }
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
          if (UUID_PK_TABLES.has(this.tableName) && payload.id) {
            payload.id = ensureValidUuid(payload.id);
          }
          if (this.tableName === 'system_notifications') {
            if (!payload.created_at || isNaN(Date.parse(payload.created_at))) {
              payload.created_at = new Date().toISOString();
            }
          }

          // Populate organization_id for multi-tenant composite key
          if (this.onConflict.includes('organization_id') || orgId) {
            const queueOrg = item.organizationId || orgId || (await this.getOrganizationId());
            if (isInvalidOrgId(queueOrg)) {
              throw new OrganizationNotResolvedError('flushQueue', this.tableName);
            }
            payload.organization_id = queueOrg;
          }

          // 1. Authoritative Server Persistence Route
          const serverUpsert = await erpServerUpsert({
            tableName: this.tableName,
            payload,
            onConflict: this.onConflict,
            organizationId: orgId,
          });

          if (serverUpsert.handled) {
            if (serverUpsert.error) {
              error = { message: serverUpsert.error };
            } else {
              error = null;
            }
          } else {
            const upsertResult = await this.executeUpsertWithRecovery(payload, this.onConflict);
            error = upsertResult.error;

            if (upsertResult.cleanPayload) {
              syncQueue.updateItem(item.id, { payload: upsertResult.cleanPayload });
            }
          }
        } else if (item.operation === 'DELETE') {
          let lookupId = item.recordId;
          if (UUID_PK_TABLES.has(this.tableName)) {
            lookupId = ensureValidUuid(item.recordId);
          }

          const serverDel = await erpServerDelete({
            tableName: this.tableName,
            recordId: lookupId,
            organizationId: orgId,
          });

          if (!serverDel.handled || serverDel.error) {
            let query = supabase
              .from(this.tableName)
              .delete()
              .eq('id', lookupId);

            if (this.onConflict.includes('organization_id') && orgId) {
              query = query.eq('organization_id', orgId);
            }

            const res = await query;
            error = res.error;

            if (error && SOFT_DELETE_TABLES.has(this.tableName)) {
              let softQuery = supabase
                .from(this.tableName)
                .update({ is_active: false })
                .eq('id', lookupId);
              if (orgId) {
                softQuery = softQuery.eq('organization_id', orgId);
              }
              const softRes = await softQuery;
              if (!softRes.error) {
                error = null;
              }
            }
          }
        }

        if (!error) {
          syncQueue.dequeue(item.id);
          processed++;
        } else {
          const errMsg = error.message || String(error);
          const isNetworkError =
            errMsg.includes('Failed to fetch') ||
            errMsg.includes('NetworkError') ||
            errMsg.includes('network') ||
            errMsg.includes('abort');

          if (isNetworkError) {
            syncQueue.updateItem(item.id, {
              lastError: 'Network offline, waiting for connection',
            });
            failed++;
            break;
          }

          console.warn(`[BaseRepository:${this.tableName}] Sync error for ${item.recordId}:`, errMsg);
          failed++;
          syncQueue.updateItem(item.id, {
            retryCount: (item.retryCount || 0) + 1,
            lastError: errMsg,
          });
        }
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        const isNetworkErr =
          errMsg.includes('Failed to fetch') ||
          errMsg.includes('NetworkError') ||
          errMsg.includes('network') ||
          errMsg.includes('abort');

        if (isNetworkErr) {
          syncQueue.updateItem(item.id, {
            lastError: 'Network offline, waiting for connection',
          });
          failed++;
          break;
        }

        console.error(`[BaseRepository:${this.tableName}] Sync exception:`, err);
        failed++;
      }
    }

    return { processed, failed };
  }
}
