import { BaseRepository } from './base';
import { SystemNotification } from '../types';
import { notificationMapper, DatabaseNotificationRow, ensureValidUuid } from '../mappers/notificationMapper';
import { supabase } from '../utils/supabase';

export class NotificationRepository extends BaseRepository<SystemNotification, DatabaseNotificationRow> {
  constructor() {
    super({
      tableName: 'system_notifications',
      storageKey: 'frostly_notifications_v3',
      toDomain: notificationMapper.toDomain,
      toDatabase: notificationMapper.toDatabase,
      getId: (n) => n.id,
      onConflict: 'organization_id,id',
    });
  }

  public async getNotifications(fallback: SystemNotification[] = []): Promise<SystemNotification[]> {
    const canQuery = await this.canAccessSupabase();
    if (canQuery) {
      try {
        let query = supabase
          .from('system_notifications')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);

        const orgId = await this.getOrganizationId();
        if (orgId) {
          query = query.eq('organization_id', orgId);
        }

        const { data, error } = await query;

        if (!error && data) {
          const domainItems = data.map((row: any) => this.toDomain(row));
          this.setLocalCache(domainItems, orgId);
          return domainItems;
        }
      } catch (e) {
        console.warn('[NotificationRepository] Fallback to base getAll:', e);
      }
    }
    return this.getAll(fallback);
  }

  public async markAsRead(notificationId: string): Promise<void> {
    const cached = this.getLocalCache();
    const updated = cached.map((n) => (n.id === notificationId ? { ...n, read: true } : n));
    this.setLocalCache(updated);

    const canQuery = await this.canAccessSupabase();
    if (canQuery) {
      try {
        const uuid = ensureValidUuid(notificationId);
        let query = supabase
          .from('system_notifications')
          .update({ read: true })
          .eq('id', uuid);

        const orgId = await this.getOrganizationId();
        if (orgId) {
          query = query.eq('organization_id', orgId);
        }

        await query;
      } catch (e) {
        console.warn('[NotificationRepository] Error updating read state on Supabase:', e);
      }
    }
  }
}

export const notificationRepository = new NotificationRepository();
