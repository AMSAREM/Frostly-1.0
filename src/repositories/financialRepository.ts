import { BaseRepository } from './base';
import { FinancialLedgerEntry } from '../types';
import { financialMapper, DatabaseFinancialEntryRow } from '../mappers/financialMapper';
import { supabase } from '../utils/supabase';

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
}

export const financialRepository = new FinancialRepository();
