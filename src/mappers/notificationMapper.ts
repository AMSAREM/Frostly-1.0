import { SystemNotification } from '../types';

export function ensureValidUuid(id: string): string {
  if (!id) {
    return '00000000-0000-4000-8000-000000000000';
  }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return id;
  }
  let hex = '';
  for (let i = 0; i < id.length; i++) {
    hex += id.charCodeAt(i).toString(16);
  }
  hex = hex.padEnd(32, '0').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

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
    const validCreatedAt = domain.timestamp && !isNaN(Date.parse(domain.timestamp))
      ? new Date(domain.timestamp).toISOString()
      : new Date().toISOString();

    return {
      id: ensureValidUuid(domain.id),
      type: domain.type,
      title: domain.title,
      message: domain.message,
      urgency: domain.urgency,
      read: Boolean(domain.read),
      created_at: validCreatedAt,
    };
  },
};
