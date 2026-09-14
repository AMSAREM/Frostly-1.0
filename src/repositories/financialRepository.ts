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
    });
  }

  public async getEntries(fallback: FinancialLedgerEntry[] = []): Promise<FinancialLedgerEntry[]> {
    return this.getAll(fallback);
  }

  /**
   * Save entry to the insert-only financial_ledger_entries table
   */
  public async addEntry(entry: FinancialLedgerEntry): Promise<FinancialLedgerEntry> {
    const canQuery = await this.canAccessSupabase();
    if (canQuery) {
      try {
        const payload = this.toDatabase(entry);
        const { data, error } = await supabase
          .from(this.tableName)
          .insert(payload)
          .select()
          .single();

        if (!error && data) {
          const created = this.toDomain(data);
          const current = this.getLocalCache();
          this.setLocalCache([created, ...current]);
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
