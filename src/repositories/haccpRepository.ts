import { BaseRepository } from './base';
import { HaccpAuditRecord } from '../types';
import { haccpMapper, DatabaseHaccpRow } from '../mappers/haccpMapper';
import { supabase } from '../utils/supabase';
import { erpServerUpsert } from '../services/erpPersistenceClient';

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

        const serverRes = await erpServerUpsert<DatabaseHaccpRow>({
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
          console.warn('[HaccpRepository] Insert error:', error.message);
        }
      } catch (err) {
        console.warn('[HaccpRepository] Direct insert error:', err);
      }
    }

    return this.save(record, true);
  }
}

export const haccpRepository = new HaccpRepository();
