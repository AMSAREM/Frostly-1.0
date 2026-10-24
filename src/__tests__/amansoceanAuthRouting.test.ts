import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';

// In-memory localStorage mock for node test runner
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

beforeEach(() => {
  localStorageMock.clear();
});

import {
  signIn,
  getStaffProfile,
  signUpAndCreateOrganization,
  isAmansoceanEmail,
  AMANSOCEAN_TENANT_ID,
  AMANSOCEAN_TENANT_NAME,
  DEFAULT_TEST_USER_EMAIL,
} from '../data/auth';

describe('Amansocean Workspace Authentication & Tenant Routing', () => {
  it('correctly identifies Amansocean emails', () => {
    expect(isAmansoceanEmail('admin@amansocean.com')).toBe(true);
    expect(isAmansoceanEmail('kwesi@amansocean.com')).toBe(true);
    expect(isAmansoceanEmail('anna@amansocean.com')).toBe(true);
    expect(isAmansoceanEmail('sales@amansocean.store')).toBe(true);
    expect(isAmansoceanEmail('user@thirdparty.com')).toBe(false);
    expect(isAmansoceanEmail(null)).toBe(false);
  });

  it('routes Amansocean login credentials directly to Amansocean Seafoods workspace in offline/preview mode', async () => {
    const { session, error } = await signIn('kwesi@amansocean.com', 'seafood2026');
    expect(error).toBeNull();
    expect(session).not.toBeNull();

    const profile = await getStaffProfile();
    expect(profile).not.toBeNull();
    expect(profile?.organization_id).toBe(AMANSOCEAN_TENANT_ID);
    expect(profile?.organization_name).toBe(AMANSOCEAN_TENANT_NAME);
    expect(profile?.organization?.id).toBe(AMANSOCEAN_TENANT_ID);
    expect(profile?.full_name).toContain('Kwesi');
  });

  it('defaults preview and offline sessions to Amansocean Seafoods workspace without fallback to Frostly demo', async () => {
    const { session, error } = await signIn('operator@amansocean.com', 'password123');
    expect(error).toBeNull();
    expect(session).not.toBeNull();

    const profile = await getStaffProfile();
    expect(profile?.organization_id).toBe(AMANSOCEAN_TENANT_ID);
    expect(profile?.organization_name).toBe(AMANSOCEAN_TENANT_NAME);
    expect(profile?.organization_id).not.toBe('org-frostly-hq');
    expect(profile?.full_name).not.toBe('Captain Alex Mercer');
  });

  it('allows registered third-party tenant credentials to log in to their respective isolated workspaces', async () => {
    // 1. Third-party registers their organization
    const customOrgName = 'Atlantic Catch Co';
    const regResult = await signUpAndCreateOrganization(
      'sarah@atlanticcatch.com',
      'SecurePass#2026!',
      customOrgName,
      'Sarah Connor',
      'Operations'
    );

    expect(regResult.error).toBeNull();
    expect(regResult.profile?.organization_name).toBe(customOrgName);
    const assignedOrgId = regResult.profile?.organization_id;
    expect(assignedOrgId).toBeDefined();

    // 2. Sign in with the registered credentials
    const { session, error } = await signIn('sarah@atlanticcatch.com', 'SecurePass#2026!');
    expect(error).toBeNull();
    expect(session).not.toBeNull();

    const profile = await getStaffProfile(true);
    expect(profile?.organization_id).toBe(assignedOrgId);
    expect(profile?.organization_name).toBe(customOrgName);
    expect(profile?.full_name).toBe('Sarah Connor');
  });

  it('provides Amansocean admin email as default test user credential', () => {
    expect(DEFAULT_TEST_USER_EMAIL).toContain('amansocean');
  });
});
