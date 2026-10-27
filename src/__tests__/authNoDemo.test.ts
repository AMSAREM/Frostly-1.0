import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';

// In the test environment no Supabase credentials exist, i.e. the "unconfigured backend" case
// that previously fell back to a demo/offline login for ANY email and password.

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (k: string) => (k in store ? store[k] : null),
  setItem: (k: string, v: string) => {
    store[k] = String(v);
  },
  removeItem: (k: string) => {
    delete store[k];
  },
  clear: () => {
    Object.keys(store).forEach((k) => delete store[k]);
  },
};

vi.mock('../utils/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      signInWithPassword: async () => ({
        data: { session: null },
        error: { message: 'Authentication service is not configured. Please contact your administrator.' },
      }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: async () => ({ error: null }),
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    }),
  },
}));

beforeAll(() => {
  vi.stubGlobal('localStorage', localStorageMock);
});

beforeEach(() => {
  localStorageMock.clear();
  vi.resetModules();
});

describe('authentication has no demo, offline or test bypass', () => {
  it('rejects ANY email and password when the backend is not configured', async () => {
    const { signIn, getSession } = await import('../data/auth');
    const attempts: Array<[string, string]> = [
      ['kwesi@amansocean.com', 'seafood2026'],
      ['admin@amansocean.com', 'password123'],
      ['anyone@example.com', 'whatever'],
    ];
    for (const [email, password] of attempts) {
      const { session, error } = await signIn(email, password);
      expect(session).toBeNull();
      expect(error).toMatch(/not configured/i);
    }
    expect(await getSession()).toBeNull();
  });

  it('never creates fake sessions, accounts or organizations when unconfigured', async () => {
    const { signUpAndCreateOrganization, createOrganizationAndAdmin, changeCurrentUserPassword } = await import(
      '../data/auth'
    );

    const reg = await signUpAndCreateOrganization('sarah@atlanticcatch.com', 'SecurePass#2026!', 'Atlantic Catch Co', 'Sarah Connor', 'Operations');
    expect(reg.session).toBeNull();
    expect(reg.profile).toBeNull();
    expect(reg.error).toBeTruthy();

    const org = await createOrganizationAndAdmin('Fake Org');
    expect(org.success).toBe(false);

    const pw = await changeCurrentUserPassword('SecurePass#2026!');
    expect(pw.success).toBe(false);

    expect(localStorageMock.getItem('frostly_offline_users')).toBeNull();
    expect(localStorageMock.getItem('frostly_local_session')).toBeNull();
  });

  it('ignores and purges a planted fake local session', async () => {
    localStorageMock.setItem(
      'frostly_local_session',
      JSON.stringify({
        access_token: 'local-token-123',
        refresh_token: 'x',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: 'attacker', email: 'ceo@amansocean.com' },
      })
    );
    const { getSession, getLocalCachedSession } = await import('../data/auth');
    expect(await getSession()).toBeNull();
    expect(getLocalCachedSession()).toBeNull();
    expect(localStorageMock.getItem('frostly_local_session')).toBeNull();
  });

  it('keeps the decommissioned quick sign-in helpers disabled', async () => {
    const { signInAsTestUser, signInAsCreator } = await import('../data/auth');
    expect((await signInAsTestUser()).session).toBeNull();
    expect((await signInAsCreator()).session).toBeNull();
  });
});
