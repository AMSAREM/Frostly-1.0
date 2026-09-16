import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { notificationRepository } from '../notificationRepository';
import { syncQueue } from '../../sync/queue';
import { SystemNotification } from '../../types';
import { ensureValidUuid } from '../../mappers/notificationMapper';

const mockStorage: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, value: string) => {
    mockStorage[key] = String(value);
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
  clear: () => {
    for (const key in mockStorage) {
      delete mockStorage[key];
    }
  },
};

beforeAll(() => {
  vi.stubGlobal('localStorage', localStorageMock);
});

const sampleNotification: SystemNotification = {
  id: 'notif-1789581325778',
  type: 'system',
  title: 'HACCP Excursion Warning',
  message: 'Cold storage unit 2 exceeded -50C limit',
  timestamp: 'Just now',
  urgency: 'high',
  read: false,
};

describe('NotificationRepository & Multi-Tenant Sync Tests', () => {
  beforeEach(() => {
    localStorageMock.clear();
    syncQueue.clear();
    vi.spyOn(notificationRepository, 'canAccessSupabase').mockResolvedValue(false);
  });

  it('converts arbitrary notification string IDs to valid RFC UUIDs deterministically', () => {
    const rawId = 'notif-1789581325778';
    const uuid1 = ensureValidUuid(rawId);
    const uuid2 = ensureValidUuid(rawId);

    expect(uuid1).toBe(uuid2);
    expect(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid1)).toBe(true);

    const realUuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(ensureValidUuid(realUuid)).toBe(realUuid);
  });

  it('saves notification optimistically and prepares DB payload with UUID and valid timestamp', async () => {
    await notificationRepository.save(sampleNotification, true);

    const cached = notificationRepository.getLocalCache();
    expect(cached).toHaveLength(1);
    expect(cached[0].id).toBe('notif-1789581325778');

    // Verify queue payload has sanitized UUID and valid ISO timestamp
    expect(syncQueue.size()).toBe(1);
    const queued = syncQueue.getAll()[0];
    expect(queued.tableName).toBe('system_notifications');
    expect(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(queued.payload.id)).toBe(true);
    expect(queued.payload.organization_id).toBeDefined();
    expect(isNaN(Date.parse(queued.payload.created_at))).toBe(false);
  });

  it('marks notifications as read in local cache and handles non-UUID identifiers', async () => {
    await notificationRepository.save(sampleNotification, true);
    await notificationRepository.markAsRead('notif-1789581325778');

    const cached = notificationRepository.getLocalCache();
    expect(cached[0].read).toBe(true);
  });
});
