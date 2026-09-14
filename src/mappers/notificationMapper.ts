import { SystemNotification } from '../types';

export interface DatabaseNotificationRow {
  id: string;
  type: string;
  title: string;
  message: string;
  urgency: string;
  read: boolean;
  related_entity_id?: string | null;
  created_at?: string;
  organization_id?: string;
}

export const notificationMapper = {
  toDomain(row: DatabaseNotificationRow): SystemNotification {
    return {
      id: row.id,
      type: (row.type as any) || 'system',
      title: row.title,
      message: row.message,
      timestamp: row.created_at || new Date().toISOString(),
      read: Boolean(row.read),
      urgency: (row.urgency as any) || 'low',
    };
  },

  toDatabase(domain: SystemNotification): Partial<DatabaseNotificationRow> {
    return {
      id: domain.id,
      type: domain.type,
      title: domain.title,
      message: domain.message,
      urgency: domain.urgency,
      read: domain.read,
      created_at: domain.timestamp,
    };
  },
};
