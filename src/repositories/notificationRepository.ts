import { BaseRepository } from './base';
import { SystemNotification } from '../types';
import { notificationMapper, DatabaseNotificationRow } from '../mappers/notificationMapper';
import { supabase } from '../utils/supabase';

export class NotificationRepository extends BaseRepository<SystemNotification, DatabaseNotificationRow> {
  constructor() {
    super({
      tableName: 'system_notifications',
      storageKey: 'frostly_notifications_v3',
      toDomain: notificationMapper.toDomain,
      toDatabase: notificationMapper.toDatabase,
      getId: (n) => n.id,
    });
  }

  public async getNotifications(fallback: SystemNotification[] = []): Promise<SystemNotification[]> {
    const canQuery = await this.canAccessSupabase();
    if (canQuery) {
      try {
        const { data, error } = await supabase
          .from('system_notifications')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);

        if (!error && data && data.length > 0) {
          const domainItems = data.map((row: any) => this.toDomain(row));
          this.setLocalCache(domainItems);
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
        await supabase
          .from('system_notifications')
          .update({ read: true })
          .eq('id', notificationId);
      } catch (e) {
        console.warn('[NotificationRepository] Error updating read state on Supabase:', e);
      }
    }
  }
}

export const notificationRepository = new NotificationRepository();
