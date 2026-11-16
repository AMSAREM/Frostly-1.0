import { BaseRepository } from './base';
import { FinancialLedgerEntry } from '../types';
import { financialMapper, DatabaseFinancialEntryRow } from '../mappers/financialMapper';
import { supabase } from '../utils/supabase';
import { syncQueue } from '../sync/queue';

export function isReversalLedgerEntry(entry: FinancialLedgerEntry): boolean {
  const id = (entry.id || '').toUpperCase();
  const ref = (entry.referenceId || '').toUpperCase();
  const desc = (entry.description || '').toLowerCase();
  return (
    id.startsWith('FIN-REV-') ||
    ref.startsWith('REV-') ||
    desc.startsWith('payment reversal / void') ||
    desc.startsWith('disbursement reversal / void') ||
    desc.includes('[reversed:')
  );
}

export class FinancialRepository extends BaseRepository<FinancialLedgerEntry, DatabaseFinancialEntryRow> {
  constructor() {
    super({
      tableName: 'financial_ledger_entries',
      storageKey: 'frostly_financial_entries_v3',
      toDomain: financialMapper.toDomain,
      toDatabase: financialMapper.toDatabase,
      getId: (entry) => entry.id,
      onConflict: 'organization_id,id',
    });

    // Pre-register known optional columns pending database migration 017
    BaseRepository.registerMissingColumn('financial_ledger_entries', 'customer_id');
    BaseRepository.registerMissingColumn('financial_ledger_entries', 'notes');
  }

  public async getEntries(fallback: FinancialLedgerEntry[] = []): Promise<FinancialLedgerEntry[]> {
    return this.getAll(fallback);
  }

  /**
   * Save entry to the insert-only financial_ledger_entries table
   */
  public async addEntry(entry: FinancialLedgerEntry): Promise<FinancialLedgerEntry> {
    const orgId = await this.getOrganizationId();
    const canQuery = await this.canAccessSupabase();
    if (canQuery) {
      try {
        const payload: any = this.toDatabase(entry);
        if (orgId) {
          payload.organization_id = orgId;
        }
        delete payload.customer_id;
        delete payload.notes;
        const { data, error } = await supabase
          .from(this.tableName)
          .insert(payload)
          .select()
          .single();

        if (!error && data) {
          const created = this.toDomain(data);
          const current = this.getLocalCache([], orgId);
          this.setLocalCache([created, ...current], orgId);
          return created;
        } else if (error) {
          console.warn('[FinancialRepository] Insert error:', error.message);
        }
      } catch (err) {
        console.warn('[FinancialRepository] Direct insert error:', err);
      }
    }

    return this.save(entry);
  }

  /**
   * Clear all reversal entries from Supabase financial_ledger_entries (via authorized RPC),
   * purge any pending reversal items from offline syncQueue, and refresh tenant local cache.
   */
  public async clearReversalEntries(): Promise<{
    deletedCount: number;
    source: 'supabase_rpc' | 'local_only';
    requiresSqlMigration?: boolean;
    error?: string;
  }> {
    const orgId = await this.getOrganizationId();

    // 1. Purge any queued reversal entries in syncQueue so they cannot re-sync
    const queuedItems = syncQueue.getByTable(this.tableName, orgId);
    queuedItems.forEach((item) => {
      const ref = String(item.payload?.reference_id || '').toUpperCase();
      const desc = String(item.payload?.description || '').toLowerCase();
      const recId = String(item.recordId || '').toUpperCase();
      if (
        recId.startsWith('FIN-REV-') ||
        ref.startsWith('REV-') ||
        desc.startsWith('payment reversal / void') ||
        desc.startsWith('disbursement reversal / void') ||
        desc.includes('[reversed:')
      ) {
        syncQueue.dequeue(item.id);
      }
    });

    // 2. Attempt authorized Supabase RPC cleanup
    const canQuery = await this.canAccessSupabase();
    if (canQuery) {
      try {
        const { data, error } = await supabase.rpc('clear_financial_ledger_reversals');
        if (!error) {
          const cached = this.getLocalCache([], orgId);
          this.setLocalCache(cached.filter((e) => !isReversalLedgerEntry(e)), orgId);
          return {
            deletedCount: Number(data ?? 0),
            source: 'supabase_rpc',
          };
        }

        const msg = error.message || '';
        const isMissingRpc =
          msg.includes('could not find the function') ||
          msg.includes('does not exist') ||
          error.code === '42883' ||
          error.code === 'PGRST202';

        return {
          deletedCount: 0,
          source: 'supabase_rpc',
          requiresSqlMigration: isMissingRpc || msg.toLowerCase().includes('insert-only'),
          error: msg,
        };
      } catch (err: any) {
        return {
          deletedCount: 0,
          source: 'supabase_rpc',
          requiresSqlMigration: true,
          error: err?.message || 'Failed to invoke clear_financial_ledger_reversals RPC',
        };
      }
    }

    // 3. Offline / unauthenticated local cache cleanup
    const cached = this.getLocalCache([], orgId);
    const remaining = cached.filter((e) => !isReversalLedgerEntry(e));
    const removed = cached.length - remaining.length;
    this.setLocalCache(remaining, orgId);
    return {
      deletedCount: removed,
      source: 'local_only',
    };
  }

  /**
   * Delete specific financial ledger entries by ID from Supabase (via authorized RPC),
   * purge matching pending items from offline syncQueue, and update tenant local cache.
   */
  public async deleteEntriesByIds(entryIds: string[]): Promise<{
    deletedCount: number;
    source: 'supabase_rpc' | 'local_only';
    requiresSqlMigration?: boolean;
    error?: string;
  }> {
    if (!entryIds.length) {
      return { deletedCount: 0, source: 'local_only' };
    }

    const idSet = new Set(entryIds);
    const orgId = await this.getOrganizationId();

    // 1. Purge matching pending mutations in syncQueue
    const queuedItems = syncQueue.getByTable(this.tableName, orgId);
    queuedItems.forEach((item) => {
      if (idSet.has(String(item.recordId)) || idSet.has(String(item.payload?.id || ''))) {
        syncQueue.dequeue(item.id);
      }
    });

    // 2. Attempt authorized Supabase RPC deletion
    const canQuery = await this.canAccessSupabase();
    if (canQuery) {
      try {
        const { data, error } = await supabase.rpc('delete_financial_ledger_entries_by_ids', {
          p_entry_ids: entryIds,
        });
        if (!error) {
          const cached = this.getLocalCache([], orgId);
          this.setLocalCache(cached.filter((e) => !idSet.has(e.id)), orgId);
          return {
            deletedCount: Number(data ?? 0),
            source: 'supabase_rpc',
          };
        }

        const msg = error.message || '';
        const isMissingRpc =
          msg.includes('could not find the function') ||
          msg.includes('does not exist') ||
          error.code === '42883' ||
          error.code === 'PGRST202';

        return {
          deletedCount: 0,
          source: 'supabase_rpc',
          requiresSqlMigration: isMissingRpc || msg.toLowerCase().includes('insert-only'),
          error: msg,
        };
      } catch (err: any) {
        return {
          deletedCount: 0,
          source: 'supabase_rpc',
          requiresSqlMigration: true,
          error: err?.message || 'Failed to invoke delete_financial_ledger_entries_by_ids RPC',
        };
      }
    }

    // 3. Offline / unauthenticated local cache cleanup
    const cached = this.getLocalCache([], orgId);
    const remaining = cached.filter((e) => !idSet.has(e.id));
    const removed = cached.length - remaining.length;
    this.setLocalCache(remaining, orgId);
    return {
      deletedCount: removed,
      source: 'local_only',
    };
  }

  /**
   * Edit/update an operating expense entry in Supabase financial_ledger_entries via authorized RPC,
   * updating any matching pending queue item and tenant local cache.
   */
  public async updateExpenseEntry(entry: FinancialLedgerEntry): Promise<{
    updatedEntry: FinancialLedgerEntry;
    source: 'supabase_rpc' | 'local_only';
    requiresSqlMigration?: boolean;
    error?: string;
  }> {
    const orgId = await this.getOrganizationId();

    // Update pending queued entry if it hasn't synced yet
    const queuedItems = syncQueue.getByTable(this.tableName, orgId);
    let updatedQueuedOnly = false;
    queuedItems.forEach((item) => {
      if (String(item.recordId) === entry.id || String(item.payload?.id || '') === entry.id) {
        syncQueue.updateItem(item.id, {
          payload: {
            ...item.payload,
            entry_date: entry.date,
            type: entry.type,
            category: entry.category,
            description: entry.description,
            reference_id: entry.referenceId,
            entity_name: entry.entityName,
            amount: entry.amount,
            payment_method: entry.paymentMethod,
            status: entry.status,
          },
        });
        updatedQueuedOnly = true;
      }
    });

    const canQuery = await this.canAccessSupabase();
    if (canQuery) {
      try {
        const { data, error } = await supabase.rpc('update_financial_ledger_expense', {
          p_entry_id: entry.id,
          p_entry_date: entry.date,
          p_category: entry.category,
          p_description: entry.description,
          p_reference_id: entry.referenceId,
          p_entity_name: entry.entityName,
          p_amount: entry.amount,
          p_payment_method: entry.paymentMethod,
          p_status: entry.status,
          p_notes: entry.notes || null,
          p_voucher_number: entry.voucherNumber || null,
        });

        if (!error) {
          const updated = data ? this.toDomain(data as DatabaseFinancialEntryRow) : entry;
          const cached = this.getLocalCache([], orgId);
          const nextCache = cached.some((e) => e.id === entry.id)
            ? cached.map((e) => (e.id === entry.id ? updated : e))
            : [updated, ...cached];
          this.setLocalCache(nextCache, orgId);
          return {
            updatedEntry: updated,
            source: 'supabase_rpc',
          };
        }

        const msg = error.message || '';
        const isMissingRpc =
          msg.includes('could not find the function') ||
          msg.includes('does not exist') ||
          error.code === '42883' ||
          error.code === 'PGRST202';

        return {
          updatedEntry: entry,
          source: 'supabase_rpc',
          requiresSqlMigration: isMissingRpc || msg.toLowerCase().includes('insert-only'),
          error: msg,
        };
      } catch (err: any) {
        return {
          updatedEntry: entry,
          source: 'supabase_rpc',
          requiresSqlMigration: true,
          error: err?.message || 'Failed to invoke update_financial_ledger_expense RPC',
        };
      }
    }

    // Offline / unauthenticated local cache update
    const cached = this.getLocalCache([], orgId);
    const nextCache = cached.some((e) => e.id === entry.id)
      ? cached.map((e) => (e.id === entry.id ? entry : e))
      : [entry, ...cached];
    this.setLocalCache(nextCache, orgId);

    return {
      updatedEntry: entry,
      source: updatedQueuedOnly ? 'local_only' : 'local_only',
    };
  }
}

export const financialRepository = new FinancialRepository();
