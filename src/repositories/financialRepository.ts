import { BaseRepository } from './base';
import { FinancialLedgerEntry } from '../types';
import { financialMapper, DatabaseFinancialEntryRow } from '../mappers/financialMapper';
import { supabase } from '../utils/supabase';
import { erpServerUpsert } from '../services/erpPersistenceClient';

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

        const serverRes = await erpServerUpsert<DatabaseFinancialEntryRow>({
          tableName: this.tableName,
          payload,
          organizationId: orgId,
        });

        if (serverRes.handled && !serverRes.error) {
          const created = serverRes.row ? this.toDomain(serverRes.row) : this.toDomain(payload);
          const current = this.getLocalCache([], orgId);
          this.setLocalCache([created, ...current.filter((item) => item.id !== created.id)], orgId);
          return created;
        }

        const { data, error } = await supabase
          .from(this.tableName)
          .insert(payload)
          .select()
          .single();

        if (!error && data) {
          const created = this.toDomain(data);
          const current = this.getLocalCache([], orgId);
          this.setLocalCache([created, ...current.filter((item) => item.id !== created.id)], orgId);
          return created;
        } else if (error) {
          console.warn('[FinancialRepository] Insert error:', error.message);
        }
      } catch (err) {
        console.warn('[FinancialRepository] Direct insert error:', err);
      }
    }

    return this.save(entry, true);
  }
}

export const financialRepository = new FinancialRepository();
