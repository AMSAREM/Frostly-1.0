import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';

const AMANS = '35a94c6e-e230-4b7c-8404-a4f0ae06b798';
const OTHER = '11111111-1111-4111-8111-111111111111';
const HQ = '00000000-0000-0000-0000-000000000001';

const h = vi.hoisted(() => ({
  session: null as any,
  profiles: {} as Record<string, any>,
  orgs: {} as Record<string, any>,
  admins: new Set<string>(),
}));

vi.mock('../utils/supabase', () => {
  const makeBuilder = (table: string) => {
    const filters: Record<string, any> = {};
    const builder: any = {
      select: () => builder,
      eq: (col: string, val: any) => {
        filters[col] = val;
        return builder;
      },
      maybeSingle: async () => {
        if (table === 'staff_profiles') {
          const row = h.profiles[filters.id];
          return { data: row ? { ...row, organizations: h.orgs[row.organization_id] ?? null } : null, error: null };
        }
        if (table === 'platform_admins') {
          return { data: h.admins.has(filters.user_id) ? { user_id: filters.user_id } : null, error: null };
        }
        if (table === 'organizations') {
          return { data: h.orgs[filters.id] ?? null, error: null };
        }
        return { data: null, error: null };
      },
    };
    return builder;
  };
  return {
    isSupabaseConfigured: true,
    supabase: {
      auth: {
        getSession: async () => ({ data: { session: h.session }, error: null }),
        signInWithPassword: async () => ({ data: { session: h.session }, error: h.session ? null : { message: 'Invalid login credentials' } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signOut: async () => ({ error: null }),
      },
      from: (table: string) => makeBuilder(table),
    },
  };
});

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (k: string) => (k in store ? store[k] : null),
  setItem: (k: string, v: string) => {
    store[k] = String(v);
  },
  removeItem: (k: string) => {
    delete store[k];
  },
  clear: () => Object.keys(store).forEach((k) => delete store[k]),
};

function signedInAs(id: string, email: string, appRole?: string) {
  h.session = {
    access_token: 'jwt',
    refresh_token: 'r',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id, email, app_metadata: appRole ? { role: appRole } : {}, user_metadata: {} },
  };
}

const orgRow = (name: string) => ({
  name,
  plan_tier: 'enterprise',
  subscription_status: 'active',
  trial_ends_at: '2027-01-01T00:00:00Z',
  max_staff_seats: 50,
});

beforeAll(() => {
  vi.stubGlobal('localStorage', localStorageMock);
});

beforeEach(() => {
  localStorageMock.clear();
  vi.resetModules();
  h.session = null;
  h.profiles = {};
  h.orgs = { [AMANS]: orgRow('Amansocean'), [OTHER]: orgRow('Other Tenant') };
  h.admins = new Set();
});

describe('tenancy comes only from the database', () => {
  it('keeps Amansocean staff (e.g. a sales_staff gmail user) in Amansocean with the stored role', async () => {
    signedInAs('u-edmund', 'edmund@gmail.com');
    h.profiles['u-edmund'] = { id: 'u-edmund', organization_id: AMANS, email: 'edmund@gmail.com', full_name: 'Edmund', role: 'sales_staff', is_active: true };
    const { getStaffProfile } = await import('../data/auth');
    const p = await getStaffProfile(true);
    expect(p?.organization_id).toBe(AMANS);
    expect(p?.role).toBe('sales_staff'); // never upgraded to admin
    expect(p?.needs_onboarding).toBe(false);
  });

  it('does NOT force an @amansocean.com email into Amansocean when the profile says another tenant', async () => {
    signedInAs('u-x', 'someone@amansocean.com');
    h.profiles['u-x'] = { id: 'u-x', organization_id: OTHER, email: 'someone@amansocean.com', full_name: 'X', role: 'ops_staff', is_active: true };
    const { getStaffProfile } = await import('../data/auth');
    const p = await getStaffProfile(true);
    expect(p?.organization_id).toBe(OTHER);
    expect(p?.organization_name).toBe('Other Tenant');
  });

  it('sends users with no profile to onboarding with the least-privileged role, never to Amansocean', async () => {
    signedInAs('u-new', 'amoakoemmanuel2020@gmail.com');
    const { getStaffProfile } = await import('../data/auth');
    const p = await getStaffProfile(true);
    expect(p?.needs_onboarding).toBe(true);
    expect(p?.organization_id).toBe('');
    expect(p?.role).toBe('viewer');
  });

  it('treats a platform placeholder organization as unassigned for normal users', async () => {
    signedInAs('u-hq', 'parked@example.com');
    h.profiles['u-hq'] = { id: 'u-hq', organization_id: HQ, email: 'parked@example.com', full_name: 'P', role: 'admin', is_active: true };
    const { getStaffProfile } = await import('../data/auth');
    const p = await getStaffProfile(true);
    expect(p?.needs_onboarding).toBe(true);
    expect(p?.organization_id).not.toBe(AMANS);
  });

  it('reports deactivated accounts as inactive, not as needing onboarding', async () => {
    signedInAs('u-off', 'off@example.com');
    h.profiles['u-off'] = { id: 'u-off', organization_id: OTHER, email: 'off@example.com', full_name: 'Off', role: 'ops_staff', is_active: false };
    const { getStaffProfile } = await import('../data/auth');
    const p = await getStaffProfile(true);
    expect(p?.is_active).toBe(false);
    expect(p?.needs_onboarding).toBe(false);
  });

  it('recognises platform operators only through platform_admins or server-set app_metadata', async () => {
    signedInAs('u-pa', 'ops@example.com');
    h.admins.add('u-pa');
    let mod = await import('../data/auth');
    expect((await mod.getStaffProfile(true))?.organization_id).toBe(HQ);

    vi.resetModules();
    signedInAs('u-meta', 'meta@example.com', 'platform_creator');
    mod = await import('../data/auth');
    expect((await mod.getStaffProfile(true))?.organization_id).toBe(HQ);

    // user-editable metadata must never grant creator access
    vi.resetModules();
    h.session = {
      access_token: 'jwt',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: 'u-fake', email: 'fake@example.com', app_metadata: {}, user_metadata: { role: 'platform_creator' } },
    };
    mod = await import('../data/auth');
    const p = await mod.getStaffProfile(true);
    expect(p?.organization_id).not.toBe(HQ);
    expect(p?.needs_onboarding).toBe(true);
  });
});
