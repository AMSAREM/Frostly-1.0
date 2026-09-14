import { BaseRepository } from './base';
import { HaccpAuditRecord } from '../types';
import { haccpMapper, DatabaseHaccpRow } from '../mappers/haccpMapper';
import { supabase } from '../utils/supabase';

export class HaccpRepository extends BaseRepository<HaccpAuditRecord, DatabaseHaccpRow> {
  constructor() {
    super({
      tableName: 'haccp_audit_records',
      storageKey: 'frostly_haccp_records_v3',
      toDomain: haccpMapper.toDomain,
      toDatabase: haccpMapper.toDatabase,
      getId: (record) => record.id,
    });
  }

  public async getRecords(fallback: HaccpAuditRecord[] = []): Promise<HaccpAuditRecord[]> {
    return this.getAll(fallback);
  }

  /**
   * Save record to insert-only haccp_audit_records table
   */
  public async addRecord(record: HaccpAuditRecord): Promise<HaccpAuditRecord> {
    const canQuery = await this.canAccessSupabase();
    if (canQuery) {
      try {
        const payload = this.toDatabase(record);
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
          console.warn('[HaccpRepository] Insert error:', error.message);
        }
      } catch (err) {
        console.warn('[HaccpRepository] Direct insert error:', err);
      }
    }

    return this.save(record);
  }
}

export const haccpRepository = new HaccpRepository();
