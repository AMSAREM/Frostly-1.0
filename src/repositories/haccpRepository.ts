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
      onConflict: 'organization_id,id',
    });
  }

  public async getRecords(fallback: HaccpAuditRecord[] = []): Promise<HaccpAuditRecord[]> {
    return this.getAll(fallback);
  }

  /**
   * Save record to insert-only haccp_audit_records table
   */
  public async addRecord(record: HaccpAuditRecord): Promise<HaccpAuditRecord> {
    const orgId = await this.getOrganizationId();
    const canQuery = await this.canAccessSupabase();
    if (canQuery) {
      try {
        const payload: any = this.toDatabase(record);
        if (orgId) {
          payload.organization_id = orgId;
        }
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
