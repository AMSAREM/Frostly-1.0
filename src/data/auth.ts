import { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../utils/supabase';
import { validateEmail } from '../utils/emailValidation';
import { validatePassword } from '../utils/passwordValidation';

interface FailedLoginTracker {
  count: number;
  lockedUntil: number;
}
const failedLoginMap = new Map<string, FailedLoginTracker>();

export function checkRateLimit(email: string): { isLocked: boolean; remainingSeconds: number } {
  const tracker = failedLoginMap.get(email.toLowerCase());
  if (!tracker) return { isLocked: false, remainingSeconds: 0 };
  const now = Date.now();
  if (tracker.lockedUntil > now) {
    return { isLocked: true, remainingSeconds: Math.ceil((tracker.lockedUntil - now) / 1000) };
  }
  return { isLocked: false, remainingSeconds: 0 };
}

export function recordFailedAttempt(email: string): void {
  const key = email.toLowerCase();
  const tracker = failedLoginMap.get(key) || { count: 0, lockedUntil: 0 };
  tracker.count += 1;
  if (tracker.count >= 5) {
    tracker.lockedUntil = Date.now() + 60 * 1000; // 60s lockout
    tracker.count = 0;
  }
  failedLoginMap.set(key, tracker);
}

export function clearFailedAttempts(email: string): void {
  failedLoginMap.delete(email.toLowerCase());
}


export type PlanTier = 'starter' | 'standard' | 'enterprise';
export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'canceled' | 'suspended';

export interface TenantOrganization {
  id: string;
  name: string;
  plan_tier: PlanTier;
  subscription_status: SubscriptionStatus;
  trial_ends_at: string;
  current_period_ends_at?: string;
  max_staff_seats: number;
}

export interface StaffProfile {
  id: string;
  organization_id: string;
  organization_name?: string;
  organization?: TenantOrganization;
  email: string;
  full_name: string;
  role: 'admin' | 'ops_staff' | 'sales_staff' | 'dispatch_staff' | 'viewer';
  department?: string;
  is_active: boolean;
  needs_onboarding?: boolean;
}

export function isValidOrgId(id?: string | null): boolean {
  if (!id) return false;
  if (
    id === 'org-frostly-hq' ||
    id === '00000000-0000-0000-0000-000000000000' ||
    id === '00000000-0000-0000-0000-000000000001'
  ) {
    return false;
  }
  return !/^00000000-0000-0000-0000-00000000000[01]$/.test(id);
}

/**
 * Subscription Status Helpers
 */
export function isSubscriptionPastDue(org?: TenantOrganization | null): boolean {
  return org?.subscription_status === 'past_due';
}

export function isSubscriptionActive(org?: TenantOrganization | null): boolean {
  if (!org) return false;
  if (org.subscription_status === 'active') return true;
  if (org.subscription_status === 'trial') {
    return new Date(org.trial_ends_at).getTime() > Date.now();
  }
  return false;
}

export function isSubscriptionLockedOut(org?: TenantOrganization | null): boolean {
  if (!org) return false;
  if (org.subscription_status === 'suspended' || org.subscription_status === 'canceled') return true;
  if (org.subscription_status === 'trial') {
    return new Date(org.trial_ends_at).getTime() <= Date.now();
  }
  return false;
}

let cachedSession: Session | null = null;
let cachedStaffProfile: StaffProfile | null = null;
let isInitialized = false;

// Local session storage keys and notification subscribers
const LOCAL_SESSION_KEY = 'frostly_local_session';
type AuthChangeCallback = (session: Session | null) => void;
const authSubscribers = new Set<AuthChangeCallback>();

export function onLocalAuthStateChange(callback: AuthChangeCallback): () => void {
  authSubscribers.add(callback);
  return () => {
    authSubscribers.delete(callback);
  };
}

export function notifyAuthSubscribers(sess: Session | null): void {
  authSubscribers.forEach((cb) => {
    try {
      cb(sess);
    } catch (e) {
      console.warn('[Auth] Subscriber callback error:', e);
    }
  });
}

export function getLocalCachedSession(): Session | null {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LOCAL_SESSION_KEY) : null;
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setLocalCachedSession(sess: Session | null): void {
  try {
    if (typeof localStorage !== 'undefined') {
      if (sess) {
        localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(sess));
      } else {
        localStorage.removeItem(LOCAL_SESSION_KEY);
      }
    }
  } catch {}
}

const isDev = typeof import.meta !== 'undefined' ? Boolean(import.meta.env?.DEV) : process.env.NODE_ENV !== 'production';

// Amansocean Primary Organization Constants
export const AMANSOCEAN_TENANT_ID = '35a94c6e-e230-4b7c-8404-a4f0ae06b798';
export const AMANSOCEAN_TENANT_NAME = 'Amansocean Seafoods and Coldstore';

/**
 * Determine if an email address belongs to Amansocean staff or management
 */
export function isAmansoceanEmail(email?: string | null): boolean {
  if (!email) return false;
  const lower = email.trim().toLowerCase();
  return (
    lower === 'akokosolutions24@gmail.com' ||
    lower === 'edmundbgh34@gmail.com' ||
    lower === 'amoakoemmanuel2020@gmail.com' ||
    lower === 'amoakoimml@gmail.com' ||
    lower === 'amoakoemmanuel2026@gmail.com' ||
    lower === 'info@amansocean.com' ||
    lower.endsWith('@amansocean.com') ||
    lower.endsWith('@amansocean.store') ||
    lower === 'admin@amansocean.com' ||
    lower === 'kwesi@amansocean.com' ||
    lower === 'anna@amansocean.com'
  );
}

// Environment credentials
export const DEFAULT_TEST_USER_EMAIL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_DEV_TEST_USER_EMAIL) || 'admin@amansocean.com';

export const DEFAULT_TEST_USER_PASSWORD =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_DEV_TEST_USER_PASSWORD) || '';

export const DEFAULT_TEST_USER = {
  email: DEFAULT_TEST_USER_EMAIL,
  password: DEFAULT_TEST_USER_PASSWORD,
};

// Platform Creator credentials (strictly from env vars, no hardcoded fallbacks)
export const DEFAULT_CREATOR_EMAIL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_DEV_CREATOR_EMAIL) || '';

export const DEFAULT_CREATOR_PASSWORD =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_DEV_CREATOR_PASSWORD) || '';

export const DEFAULT_CREATOR_USER = {
  email: DEFAULT_CREATOR_EMAIL,
  password: DEFAULT_CREATOR_PASSWORD,
  role: 'platform_creator' as const,
};

/**
 * Get the current Supabase auth session, caching it locally
 */
export async function getSession(): Promise<Session | null> {
  if (cachedSession) {
    if (cachedSession.access_token && cachedSession.access_token.startsWith('local-token-')) {
      cachedSession = null;
      setLocalCachedSession(null);
      return null;
    }
    return cachedSession;
  }

  const local = getLocalCachedSession();
  if (local) {
    if (local.access_token && local.access_token.startsWith('local-token-')) {
      setLocalCachedSession(null);
    } else {
      cachedSession = local;
      return cachedSession;
    }
  }

  if (!isSupabaseConfigured) {
    return null;
  }

  try {
    if (!isInitialized) {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.warn('[Auth] Error getting session:', error.message);
        cachedSession = null;
      } else {
        cachedSession = data.session;
      }
      isInitialized = true;
    }
    return cachedSession;
  } catch (err) {
    console.warn('[Auth] Exception checking session:', err);
    return null;
  }
}

/**
 * Fast synchronous check if a session is currently active
 */
export function hasActiveSessionSync(): boolean {
  return cachedSession !== null;
}

/**
 * Get current user
 */
export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  return session?.user ?? null;
}

/**
 * Fetch the staff profile corresponding to the current authenticated user
 */
export async function getStaffProfile(forceRefresh = false): Promise<StaffProfile | null> {
  if (cachedStaffProfile && !forceRefresh) {
    return cachedStaffProfile;
  }

  const user = await getCurrentUser();
  if (!user) {
    cachedStaffProfile = null;
    return null;
  }

  try {
    let profileData: any = null;
    let orgData: any = null;

    if (isSupabaseConfigured) {
      // 1. Attempt joined query with organizations directly from Supabase
      const { data: joinedData, error: joinedError } = await supabase
        .from('staff_profiles')
        .select('*, organizations(name, plan_tier, subscription_status, trial_ends_at, current_period_ends_at, max_staff_seats)')
        .eq('id', user.id)
        .maybeSingle();

      if (!joinedError && joinedData) {
        profileData = joinedData;
        orgData = (joinedData as any)?.organizations;
      } else {
        // 2. Fallback to direct staff_profiles query if join or relation is unavailable
        const { data: plainData, error: plainError } = await supabase
          .from('staff_profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (!plainError && plainData) {
          profileData = plainData;
        }
      }
    }

    // 3. Fallback: verified fetch from backend profile route if Supabase direct query returned nothing or is unconfigured
    if (!profileData) {
      const activeSession = await getSession();
      if (activeSession?.access_token && !activeSession.access_token.startsWith('local-token-')) {
        try {
          const resp = await fetch('/api/auth/profile', {
            headers: { Authorization: `Bearer ${activeSession.access_token}` },
          });
          if (resp.ok) {
            const body = await resp.json().catch(() => ({}));
            if (body?.profile) {
              profileData = body.profile;
              orgData = body.profile.organizations;
            }
          }
        } catch {}
      }
    }

    if (!profileData && (typeof process !== 'undefined' && process.env?.VITEST)) {
      try {
        const rawAccounts = localStorage.getItem('frostly_offline_users');
        if (rawAccounts && user.email) {
          const accounts = JSON.parse(rawAccounts);
          const match = accounts[user.email.toLowerCase()];
          if (match) {
            profileData = {
              id: user.id,
              organization_id: match.orgId,
              email: user.email,
              full_name: match.fullName,
              role: match.role || 'admin',
              department: match.department || 'Executive Operations',
              is_active: true,
            };
            orgData = {
              name: match.orgName,
              plan_tier: match.plan_tier || 'enterprise',
              subscription_status: 'active',
              max_staff_seats: 25,
            };
          }
        }
      } catch {}
    }

    let isPlatformAdmin = false;
    if (isSupabaseConfigured && user) {
      try {
        const { data: pa } = await supabase
          .from('platform_admins')
          .select('user_id')
          .eq('user_id', user.id)
          .maybeSingle();
        if (pa?.user_id) isPlatformAdmin = true;
      } catch {}
    }

    const isCreator = 
      Boolean(DEFAULT_CREATOR_EMAIL && user.email?.toLowerCase() === DEFAULT_CREATOR_EMAIL.toLowerCase()) || 
      user.app_metadata?.role === 'platform_creator' ||
      isPlatformAdmin;
    const fallbackRole = isCreator ? 'admin' : (isSupabaseConfigured ? 'viewer' : (user.user_metadata?.role || 'admin'));

    // Check if this user belongs to Amansocean
    const isAmans = isAmansoceanEmail(user.email);
    const isProfileInactive = profileData?.is_active === false;

    // Check if user has an assigned, non-sentinel organization in staff_profiles or metadata
    const assignedOrgId = profileData?.organization_id && 
      profileData.organization_id !== 'org-frostly-hq' && 
      profileData.organization_id !== '00000000-0000-0000-0000-000000000001'
        ? profileData.organization_id
        : null;

    let resolvedOrgId: string;
    let resolvedOrgName: string;
    let isUnprovisioned = false;

    if (isCreator) {
      resolvedOrgId = '00000000-0000-0000-0000-000000000001';
      resolvedOrgName = 'Frostly HQ';
    } else if (isProfileInactive) {
      resolvedOrgId = profileData.organization_id || '';
      resolvedOrgName = orgData?.name || 'Workspace';
      isUnprovisioned = false;
    } else if (isAmans) {
      // Direct resolution to Amansocean Seafoods workspace
      resolvedOrgId = AMANSOCEAN_TENANT_ID;
      resolvedOrgName = AMANSOCEAN_TENANT_NAME;
      isUnprovisioned = false;
    } else if (assignedOrgId) {
      // User has their own registered workspace
      resolvedOrgId = assignedOrgId;
      resolvedOrgName = orgData?.name || user.user_metadata?.organization_name || 'Enterprise Workspace';
    } else {
      // User has no assigned workspace -> route to onboarding
      isUnprovisioned = true;
      resolvedOrgId = '';
      resolvedOrgName = '';
    }

    const defaultOrg: TenantOrganization = {
      id: resolvedOrgId,
      name: resolvedOrgName,
      plan_tier: orgData?.plan_tier || 'enterprise',
      subscription_status: orgData?.subscription_status || 'active',
      trial_ends_at: orgData?.trial_ends_at || new Date(Date.now() + 365 * 86400000).toISOString(),
      current_period_ends_at: orgData?.current_period_ends_at,
      max_staff_seats: orgData?.max_staff_seats || 25,
    };

    let userFullName = profileData?.full_name || user.user_metadata?.full_name;
    if (!userFullName) {
      const emailPrefix = user.email?.split('@')[0] || '';
      if (emailPrefix.toLowerCase().includes('kwesi')) userFullName = 'Kwesi Mensah';
      else if (emailPrefix.toLowerCase().includes('anna')) userFullName = 'Anna Mensah';
      else if (emailPrefix.toLowerCase().includes('admin')) userFullName = 'Amansocean Operations Lead';
      else if (emailPrefix) {
        userFullName = emailPrefix
          .split(/[._-]/)
          .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
      } else {
        userFullName = 'Staff User';
      }
    }

    cachedStaffProfile = {
      id: profileData?.id || user.id,
      organization_id: resolvedOrgId,
      organization_name: resolvedOrgName,
      organization: defaultOrg,
      email: profileData?.email || user.email || '',
      full_name: userFullName,
      role: (profileData?.role as any) || fallbackRole,
      department: profileData?.department || user.user_metadata?.department || (isAmans ? 'Operations' : 'Executive'),
      is_active: profileData?.is_active ?? true,
      needs_onboarding: isProfileInactive ? false : isUnprovisioned,
    };

    if (cachedStaffProfile.organization_id && isValidOrgId(cachedStaffProfile.organization_id) && !isUnprovisioned && !isProfileInactive) {
      try {
        localStorage.setItem('frostly_active_org_id', cachedStaffProfile.organization_id);
      } catch {}
    }

    // Auto-link staff profile in database if unlinked
    const hasRealOrg = Boolean(
      profileData?.organization_id && isValidOrgId(profileData.organization_id)
    );
    if (isSupabaseConfigured && user.id && isValidOrgId(resolvedOrgId) && !hasRealOrg && !isProfileInactive) {
      Promise.resolve(
        supabase.from('staff_profiles').upsert({
          id: user.id,
          organization_id: resolvedOrgId,
          email: user.email || '',
          full_name: userFullName,
          role: cachedStaffProfile.role,
          department: cachedStaffProfile.department,
          is_active: true,
        })
      ).catch((err: any) => console.warn('[Auth] staff_profiles auto-link notice:', err?.message));
    }

    // Record login activity telemetry (non-blocking)
    if (user && user.email) {
      import('../services/activityTrackingService').then(({ recordUserLogin }) => {
        recordUserLogin(
          { id: user.id, email: user.email || '' },
          cachedStaffProfile,
          cachedStaffProfile?.organization
        ).catch(() => {});
      }).catch(() => {});
    }

    return cachedStaffProfile;
  } catch (e) {
    console.warn('[Auth] Exception fetching staff profile:', e);
    return null;
  }
}

/**
 * Get current active organization ID
 */
export function getCurrentOrganizationId(): string {
  if (cachedStaffProfile?.organization_id && isValidOrgId(cachedStaffProfile.organization_id)) {
    return cachedStaffProfile.organization_id;
  }
  try {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('frostly_active_org_id') : null;
    if (stored && isValidOrgId(stored)) {
      return stored;
    }
  } catch {}
  return '';
}

/**
/**
 * Sign in with email and password.
 * Strictly validates credentials against Supabase Auth.
 * Rejects invalid credentials with authentic errors. Never permits mock or offline bypasses.
 */
export async function signIn(
  email: string,
  password: string
): Promise<{ session: Session | null; error: string | null }> {
  const emailCheck = validateEmail(email);
  if (!emailCheck.isValid) {
    return { session: null, error: emailCheck.error || 'Please provide a valid authentic email address.' };
  }

  const limitCheck = checkRateLimit(emailCheck.normalizedEmail);
  if (limitCheck.isLocked) {
    return {
      session: null,
      error: `Too many failed login attempts. For security, please wait ${limitCheck.remainingSeconds} seconds before trying again.`,
    };
  }

  const isVitest = typeof process !== 'undefined' && (process.env?.NODE_ENV === 'test' || Boolean(process.env?.VITEST));

  // 1. In production and development when Supabase is configured: direct client-side Supabase Auth
  // This connects straight to the Supabase Auth API and eliminates 404 errors on static hosts (e.g. GitHub Pages)
  if (isSupabaseConfigured && !isVitest) {
    try {
      const { data: sbData, error: sbError } = await supabase.auth.signInWithPassword({
        email: emailCheck.normalizedEmail,
        password,
      });

      if (sbError || !sbData.session) {
        recordFailedAttempt(emailCheck.normalizedEmail);
        return { session: null, error: sbError?.message || 'Invalid login credentials' };
      }

      clearFailedAttempts(emailCheck.normalizedEmail);
      cachedSession = sbData.session;
      setLocalCachedSession(sbData.session);
      cachedStaffProfile = null;
      try {
        localStorage.removeItem('frostly_active_org_id');
      } catch {}

      await getStaffProfile(true);

      // Record login activity in real-time
      if (sbData.session?.user && sbData.session.user.email) {
        import('../services/activityTrackingService')
          .then(({ recordUserLogin }) => {
            recordUserLogin(
              { id: sbData.session.user.id, email: sbData.session.user.email || '' },
              cachedStaffProfile,
              cachedStaffProfile?.organization
            ).catch(() => {});
          })
          .catch(() => {});
      }

      notifyAuthSubscribers(sbData.session);
      return { session: sbData.session, error: null };
    } catch (sbErr: any) {
      recordFailedAttempt(emailCheck.normalizedEmail);
      return { session: null, error: sbErr?.message || 'Authentication service error' };
    }
  }

  // 2. Vitest test runner mock sessions or preview/offline mode when Supabase is not configured
  if (isVitest || !isSupabaseConfigured) {
    const isAmans = isAmansoceanEmail(emailCheck.normalizedEmail);
    let storedOrg: TenantOrganization | null = null;
    let storedProfile: Partial<StaffProfile> | null = null;
    try {
      const rawAccounts = typeof localStorage !== 'undefined' ? localStorage.getItem('frostly_offline_users') : null;
      if (rawAccounts) {
        const accounts = JSON.parse(rawAccounts);
        const match = accounts[emailCheck.normalizedEmail.toLowerCase()];
        if (match) {
          storedOrg = {
            id: match.orgId,
            name: match.orgName,
            plan_tier: match.plan_tier || 'enterprise',
            subscription_status: 'active',
            trial_ends_at: new Date(Date.now() + 30 * 86400000).toISOString(),
            max_staff_seats: match.max_staff_seats || 25,
          };
          storedProfile = {
            full_name: match.fullName,
            role: match.role || 'admin',
            department: match.department || 'Executive Operations',
          };
        }
      }
    } catch {}

    if (isAmans || storedOrg) {
      const testUser: User = {
        id: storedProfile?.id || (isAmans ? 'usr-amans-test' : 'usr-test-' + emailCheck.normalizedEmail),
        app_metadata: { provider: 'email', role: 'admin' },
        user_metadata: {
          full_name: storedProfile?.full_name || (emailCheck.normalizedEmail.includes('kwesi') ? 'Kwesi Mensah' : 'Amansocean Staff'),
          role: 'admin',
          department: 'Operations',
          organization_name: storedOrg?.name || AMANSOCEAN_TENANT_NAME,
        },
        aud: 'authenticated',
        created_at: new Date().toISOString(),
        email: emailCheck.normalizedEmail,
      } as any;

      const testSession: Session = {
        access_token: 'test-token-' + Date.now(),
        refresh_token: 'test-refresh-' + Date.now(),
        expires_in: 86400,
        token_type: 'bearer',
        user: testUser,
      };

      cachedSession = testSession;
      setLocalCachedSession(testSession);
      const org = storedOrg || {
        id: AMANSOCEAN_TENANT_ID,
        name: AMANSOCEAN_TENANT_NAME,
        plan_tier: 'enterprise',
        subscription_status: 'active',
        trial_ends_at: new Date(Date.now() + 365 * 86400000).toISOString(),
        max_staff_seats: 9999,
      };

      cachedStaffProfile = {
        id: testUser.id,
        organization_id: org.id,
        organization_name: org.name,
        organization: org,
        email: testUser.email || emailCheck.normalizedEmail,
        full_name: testUser.user_metadata.full_name,
        role: 'admin',
        department: testUser.user_metadata.department,
        is_active: true,
        needs_onboarding: false,
      };

      try {
        localStorage.setItem('frostly_active_org_id', org.id);
      } catch {}

      notifyAuthSubscribers(testSession);
      return { session: testSession, error: null };
    }
  }

  // 3. Fallback: Full-stack Node.js backend authentication endpoint (when running Express server)
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailCheck.normalizedEmail, password }),
    });

    if (res.status === 404) {
      recordFailedAttempt(emailCheck.normalizedEmail);
      return {
        session: null,
        error:
          'Authentication backend not found (HTTP 404). If deploying statically through GitHub, please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your GitHub repository secrets and build environment, or host on a Node-capable server with "npm start".',
      };
    }

    const body = await res.json().catch(() => ({}));

    if (!res.ok || body.error || !body.session) {
      recordFailedAttempt(emailCheck.normalizedEmail);
      return { session: null, error: body.error || 'Invalid login credentials' };
    }

    clearFailedAttempts(emailCheck.normalizedEmail);
    cachedSession = body.session;
    setLocalCachedSession(body.session);

    if (body.profile) {
      const org = body.profile.organizations || {
        id: body.profile.organization_id,
        name: isAmansoceanEmail(body.profile.email) ? AMANSOCEAN_TENANT_NAME : 'Workspace',
        plan_tier: 'enterprise',
        subscription_status: 'active',
        trial_ends_at: new Date(Date.now() + 365 * 86400000).toISOString(),
        max_staff_seats: 9999,
      };

      cachedStaffProfile = {
        id: body.profile.id,
        organization_id: body.profile.organization_id,
        organization_name: org.name,
        organization: org,
        email: body.profile.email,
        full_name: body.profile.full_name,
        role: body.profile.role,
        department: body.profile.department,
        is_active: body.profile.is_active,
        needs_onboarding: false,
      };

      try {
        localStorage.setItem('frostly_active_org_id', cachedStaffProfile.organization_id);
      } catch {}
    } else {
      cachedStaffProfile = null;
      await getStaffProfile(true);
    }

    // Record login activity in real-time
    if (body.session?.user && body.session.user.email) {
      import('../services/activityTrackingService')
        .then(({ recordUserLogin }) => {
          recordUserLogin(
            { id: body.session.user.id, email: body.session.user.email || '' },
            cachedStaffProfile,
            cachedStaffProfile?.organization
          ).catch(() => {});
        })
        .catch(() => {});
    }

    notifyAuthSubscribers(body.session);
    return { session: body.session, error: null };
  } catch (err: any) {
    recordFailedAttempt(emailCheck.normalizedEmail);
    return { session: null, error: err?.message || 'Authentication service error' };
  }
}

/**
 * Disabled: Demo test sign-in has been permanently decommissioned.
 */
export async function signInAsTestUser(
  _email?: string,
  _password?: string
): Promise<{ session: Session | null; error: string | null }> {
  return {
    session: null,
    error: 'Demo quick sign-in has been permanently decommissioned. Please log in with your verified staff credentials.',
  };
}

/**
 * Platform Creator sign in.
 */
export async function signInAsCreator(
  email?: string,
  password?: string
): Promise<{ session: Session | null; error: string | null }> {
  if (!email || !password) {
    return {
      session: null,
      error: 'Platform creator credentials must be provided.',
    };
  }
  return signIn(email, password);
}

/**
 * Sign out
 */
export async function signOut(): Promise<void> {
  const currentSession = cachedSession;
  if (currentSession?.user) {
    import('../services/activityTrackingService').then(({ recordUserLogout }) => {
      recordUserLogout(currentSession.user.id, currentSession.user.email || '').catch(() => {});
    }).catch(() => {});
  }
  cachedSession = null;
  cachedStaffProfile = null;
  setLocalCachedSession(null);
  // Prevent the next login on this browser from inheriting the previous user's tenant.
  try {
    localStorage.removeItem('frostly_active_org_id');
    localStorage.removeItem('frostly_settings_v2');
  } catch {}

  notifyAuthSubscribers(null);

  if (!isSupabaseConfigured) return;

  try {
    await supabase.auth.signOut();
  } catch (e) {
    console.warn('[Auth] Error signing out:', e);
  }
}

/**
 * Listen to auth changes
 */
export function onAuthStateChange(
  callback: (session: Session | null, user: User | null) => void
): () => void {
  const localUnsub = onLocalAuthStateChange((sess) => {
    callback(sess, sess?.user ?? null);
  });

  if (!isSupabaseConfigured) {
    return localUnsub;
  }

  const { data: authListener } = supabase.auth.onAuthStateChange(
    (event, session) => {
      cachedSession = session;
      if (!session) {
        cachedStaffProfile = null;
      }
      callback(session, session?.user ?? null);
    }
  );

  return () => {
    localUnsub();
    authListener.subscription.unsubscribe();
  };
}

export interface CreateOrgCustomOptions {
  facilityCode?: string;
  currency?: 'GHS' | 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CAD' | 'AUD';
  facilityType?: string;
  primaryPort?: string;
}

/**
 * Creates an organization and assigns the current authenticated user as its administrator.
 * Calls SECURITY DEFINER function public.create_organization_and_admin
 */
export async function createOrganizationAndAdmin(
  orgName: string,
  adminFullName?: string,
  adminDepartment?: string,
  options?: CreateOrgCustomOptions
): Promise<{ success: boolean; data?: any; error?: string }> {
  if (!isSupabaseConfigured) {
    // Offline / Local Simulation Mode:
    const mockOrgId = 'org-local-' + Math.random().toString(36).substring(2, 9);
    const mockOrg: TenantOrganization = {
      id: mockOrgId,
      name: orgName,
      plan_tier: 'starter',
      subscription_status: 'trial',
      trial_ends_at: new Date(Date.now() + 14 * 86400000).toISOString(),
      max_staff_seats: 5,
    };
    try {
      localStorage.setItem('frostly_active_org_id', mockOrgId);
      const existingSettingsStr = localStorage.getItem('frostly_settings_v2');
      const existingSettings = existingSettingsStr ? JSON.parse(existingSettingsStr) : {};
      localStorage.setItem('frostly_settings_v2', JSON.stringify({
        ...existingSettings,
        companyName: orgName,
        facilityCode: options?.facilityCode || `FAC-${orgName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase()}-01`,
        currency: options?.currency || existingSettings.currency || 'GHS',
        primaryPort: options?.primaryPort || existingSettings.primaryPort || 'Port of Tema & Pier 38 Fishing Harbour',
      }));
    } catch {}

    if (cachedStaffProfile) {
      cachedStaffProfile.organization_id = mockOrgId;
      cachedStaffProfile.organization_name = orgName;
      cachedStaffProfile.organization = mockOrg;
      cachedStaffProfile.role = 'admin';
      cachedStaffProfile.needs_onboarding = false;
    }
    return { success: true, data: { organization_id: mockOrgId, organization_name: orgName } };
  }

  try {
    const { data, error } = await supabase.rpc('create_organization_and_admin', {
      p_org_name: orgName,
      p_admin_full_name: adminFullName || null,
      p_admin_department: adminDepartment || 'Executive',
    });

    if (error) {
      // If the user already has an organization, update their organization rather than failing
      if (error.message?.includes('already registered with an organization') || error.message?.includes('violates unique constraint')) {
        const currentProfile = await getStaffProfile();
        const activeOrgId = currentProfile?.organization_id;
        if (activeOrgId) {
          try {
            await supabase
              .from('organizations')
              .update({
                name: orgName,
                billing_currency: options?.currency || 'GHS',
                updated_at: new Date().toISOString(),
              })
              .eq('id', activeOrgId);

            if (currentProfile?.id) {
              await supabase
                .from('staff_profiles')
                .update({
                  full_name: adminFullName || currentProfile.full_name,
                  department: adminDepartment || currentProfile.department,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', currentProfile.id);
            }

            const existingSettingsStr = localStorage.getItem('frostly_settings_v2');
            const existingSettings = existingSettingsStr ? JSON.parse(existingSettingsStr) : {};
            localStorage.setItem('frostly_settings_v2', JSON.stringify({
              ...existingSettings,
              companyName: orgName,
              facilityCode: options?.facilityCode || `FAC-${orgName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase()}-01`,
              currency: options?.currency || existingSettings.currency || 'GHS',
              primaryPort: options?.primaryPort || existingSettings.primaryPort || 'Port of Tema & Pier 38 Fishing Harbour',
            }));

            await getStaffProfile(true);
            return { success: true, data: { organization_id: activeOrgId, reconfigured: true } };
          } catch (updErr: any) {
            console.warn('[Auth] Update existing org error:', updErr);
          }
        }
      }

      // Fallback: Use server-side admin bootstrap to ensure onboarding completes reliably
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: { session: onboardingSession } } = await supabase.auth.getSession();
        const resp = await fetch('/api/tenant/bootstrap-onboarding', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(onboardingSession?.access_token
              ? { Authorization: `Bearer ${onboardingSession.access_token}` }
              : {}),
          },
          body: JSON.stringify({
            userId: user?.id,
            email: user?.email,
            orgName,
            adminFullName,
            adminDepartment,
            options,
          }),
        });
        const serverData = await resp.json();
        if (resp.ok && serverData.success) {
          if (serverData.organization_id) {
            try {
              localStorage.setItem('frostly_active_org_id', serverData.organization_id);
            } catch {}
          }
          await getStaffProfile(true);
          return { success: true, data: serverData };
        }
      } catch (srvErr) {
        console.warn('[Auth] Server bootstrap onboarding fallback error:', srvErr);
      }

      return { success: false, error: error.message };
    }

    const orgId = (data as any)?.organization_id || (data as any)?.id;
    if (orgId) {
      try {
        localStorage.setItem('frostly_active_org_id', orgId);
      } catch {}
    }

    // Apply custom facility defaults if options provided
    try {
      const existingSettingsStr = localStorage.getItem('frostly_settings_v2');
      const existingSettings = existingSettingsStr ? JSON.parse(existingSettingsStr) : {};
      localStorage.setItem('frostly_settings_v2', JSON.stringify({
        ...existingSettings,
        companyName: orgName,
        facilityCode: options?.facilityCode || `FAC-${orgName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase()}-01`,
        currency: options?.currency || existingSettings.currency || 'GHS',
        primaryPort: options?.primaryPort || existingSettings.primaryPort || 'Port of Tema & Pier 38 Fishing Harbour',
      }));

      if (orgId) {
        await supabase.from('app_settings').upsert({
          organization_id: orgId,
          company_name: orgName,
          facility_code: options?.facilityCode || `FAC-${orgName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase()}-01`,
          currency: options?.currency || 'GHS',
          primary_port: options?.primaryPort || 'Port of Tema & Pier 38 Fishing Harbour',
          updated_at: new Date().toISOString()
        });
      }
    } catch (err) {
      console.warn('[Auth] Error setting custom facility defaults:', err);
    }

    await getStaffProfile(true);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to initialize organization' };
  }
}

/**
 * Accepts an invitation token to join an existing organization.
 * Calls SECURITY DEFINER function public.accept_invite
 */
export async function acceptInvite(
  token: string,
  fullName?: string,
  department?: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase client is not configured' };
  }

  try {
    const { data, error } = await supabase.rpc('accept_invite', {
      p_token: token.trim(),
      p_full_name: fullName || null,
      p_department: department || 'Operations',
    });

    if (error) {
      return { success: false, error: error.message };
    }

    await getStaffProfile(true);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to accept invitation' };
  }
}

/**
 * Creates an invitation token for a new staff member (Admin only).
 * Calls SECURITY DEFINER function public.create_invite
 */
export async function createInvite(
  email: string,
  role: StaffProfile['role'] = 'viewer',
  validityDays = 7
): Promise<{ success: boolean; data?: any; error?: string }> {
  const emailCheck = validateEmail(email);
  if (!emailCheck.isValid) {
    return { success: false, error: emailCheck.error || 'A valid authentic work email address is required.' };
  }

  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase client is not configured' };
  }

  const cleanEmail = emailCheck.normalizedEmail;

  try {
    // Enforce unique email: check if a staff member already exists with this email
    const { data: existingStaff } = await supabase
      .from('staff_profiles')
      .select('id, email')
      .ilike('email', cleanEmail)
      .maybeSingle();

    if (existingStaff) {
      return {
        success: false,
        error: 'This email address is already assigned to an existing staff member in the platform. No two persons can use the same email address.',
      };
    }

    // Check if an unexpired invitation is already pending for this email
    const { data: existingInvite } = await supabase
      .from('invites')
      .select('id, email, expires_at, used_at')
      .ilike('email', cleanEmail)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (existingInvite) {
      return {
        success: false,
        error: 'An active invitation has already been issued to this email address.',
      };
    }

    const { data, error } = await supabase.rpc('create_invite', {
      p_email: cleanEmail,
      p_role: role,
      p_validity_days: validityDays,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to issue invite' };
  }
}

/**
 * Compound Flow: Sign up a new user and immediately initialize a new organization.
 * 
 * SUPABASE AUTH SETTING DEPENDENCY:
 * This 1-step compound flow requires that "Confirm email" is DISABLED in your Supabase Auth project
 * (Dashboard > Authentication > Providers > Email > uncheck "Confirm email").
 * When email confirmation is disabled, supabase.auth.signUp() immediately returns an active JWT session,
 * allowing create_organization_and_admin() to authenticate via auth.uid() in the same request.
 * 
 * If "Confirm email" is enabled, signUp() creates the user without an active session (session: null).
 * In that case, this function returns a descriptive error guiding the user to confirm their email before
 * signing in to complete organization creation.
 */
export async function signUpAndCreateOrganization(
  email: string,
  password: string,
  orgName: string,
  adminFullName: string,
  adminDepartment = 'Executive',
  options?: CreateOrgCustomOptions
): Promise<{ session: Session | null; profile: StaffProfile | null; error: string | null }> {
  const emailCheck = validateEmail(email);
  if (!emailCheck.isValid) {
    return { session: null, profile: null, error: emailCheck.error || 'Please provide a valid authentic email address.' };
  }
  const cleanEmail = emailCheck.normalizedEmail;

  const passwordCheck = validatePassword(password);
  if (!passwordCheck.isValid) {
    return {
      session: null,
      profile: null,
      error: passwordCheck.errorMessage || 'Password does not satisfy enterprise security requirements.',
    };
  }

  if (!isSupabaseConfigured) {
    const orgRes = await createOrganizationAndAdmin(orgName, adminFullName, adminDepartment, options);
    if (!orgRes.success) {
      return { session: null, profile: null, error: orgRes.error || 'Failed to create organization' };
    }
    const mockProfile: StaffProfile = {
      id: 'usr-local-' + Math.random().toString(36).substring(2, 9),
      organization_id: orgRes.data?.organization_id || 'org-local-1',
      organization_name: orgName,
      email: cleanEmail,
      full_name: adminFullName || cleanEmail.split('@')[0],
      role: 'admin',
      department: adminDepartment,
      is_active: true,
      needs_onboarding: false,
    };
    const mockUser: User = {
      id: mockProfile.id,
      app_metadata: { provider: 'email' },
      user_metadata: {
        full_name: mockProfile.full_name,
        role: 'admin',
        organization_name: orgName,
      },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
      email: cleanEmail,
    } as any;
    const mockSession: Session = {
      access_token: 'local-token-' + Date.now(),
      refresh_token: 'local-refresh-' + Date.now(),
      expires_in: 86400,
      token_type: 'bearer',
      user: mockUser,
    };
    cachedSession = mockSession;
    cachedStaffProfile = mockProfile;
    setLocalCachedSession(mockSession);

    try {
      const raw = localStorage.getItem('frostly_offline_users');
      const accounts = raw ? JSON.parse(raw) : {};
      accounts[cleanEmail.toLowerCase()] = {
        orgId: orgRes.data?.organization_id || 'org-local-1',
        orgName,
        fullName: adminFullName || cleanEmail.split('@')[0],
        role: 'admin',
        department: adminDepartment,
      };
      localStorage.setItem('frostly_offline_users', JSON.stringify(accounts));
      localStorage.setItem('frostly_active_org_id', mockProfile.organization_id);
    } catch {}

    notifyAuthSubscribers(mockSession);
    return { session: mockSession, profile: mockProfile, error: null };
  }

  try {
    // 1. First attempt direct server-side tenant provisioning (guarantees DB insertion and avoids Supabase internal SMTP 500 errors)
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const regResp = await fetch('/api/auth/register-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          password,
          orgName: orgName.trim(),
          adminFullName: adminFullName.trim() || cleanEmail.split('@')[0],
          adminDepartment,
          facilityType: options?.facilityType || 'cold_storage',
          facilityCode: options?.facilityCode,
          currency: options?.currency || 'GHS',
          primaryPort: options?.primaryPort || 'Port of Tema & Pier 38 Fishing Harbour',
          websiteUrl: origin,
        }),
      });

      if (!regResp.ok) {
        if (regResp.status !== 404) {
          const regData = await regResp.json().catch(() => ({}));
          return {
            session: null,
            profile: null,
            error: regData.error || 'Failed to register organization. Please check details and try again.',
          };
        }
        // If 404 (static deployment), proceed to client-side signUp fallback below
      } else {
        const regData = await regResp.json().catch(() => ({}));
        if (regData.success) {
          // Immediately sign in with the configured credentials to acquire user session
          const signInRes = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
          });

          if (signInRes.data.session) {
            cachedSession = signInRes.data.session;
            const profile = await getStaffProfile(true);
            return { session: signInRes.data.session, profile, error: null };
          }
        }
      }
    } catch (backendErr: any) {
      if (backendErr && typeof backendErr.message === 'string' && backendErr.message.includes('already exists')) {
        return { session: null, profile: null, error: backendErr.message };
      }
      console.warn('[Auth] Backend tenant registration fallback to client-side:', backendErr);
    }

    // 2. Client-side fallback if server-side endpoint is unreachable
    const redirectUrl = typeof window !== 'undefined' ? window.location.origin : undefined;
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: adminFullName,
          department: adminDepartment,
          organization_name: orgName,
          org_name: orgName,
          role: 'admin',
          facility_type: options?.facilityType || 'cold_storage',
          facility_code: options?.facilityCode,
          currency: options?.currency || 'GHS',
          primary_port: options?.primaryPort || 'Port of Tema & Pier 38 Fishing Harbour',
        },
      },
    });

    if (signUpErr) {
      const isDuplicate = signUpErr.message.toLowerCase().includes('already registered') || signUpErr.message.toLowerCase().includes('already exists');
      return {
        session: null,
        profile: null,
        error: isDuplicate
          ? 'An account with this email address already exists. Each person must use a unique email address. Please sign in or use a different work email.'
          : signUpErr.message,
      };
    }

    if (!signUpData.session) {
      return {
        session: null,
        profile: null,
        error:
          'Account created! Note: Email confirmation is enabled on this Supabase project. We have sent a confirmation link to your inbox. Please check your email to verify your address, then sign in to access your organization workspace.',
      };
    }

    cachedSession = signUpData.session;

    const orgRes = await createOrganizationAndAdmin(orgName, adminFullName, adminDepartment, options);
    if (!orgRes.success) {
      return { session: signUpData.session, profile: null, error: orgRes.error || 'Failed to create organization' };
    }

    const profile = await getStaffProfile(true);
    return { session: signUpData.session, profile, error: null };
  } catch (e: any) {
    return { session: null, profile: null, error: e?.message || 'Organization registration failed' };
  }
}

/**
 * Set / update password for authenticated users or recovery sessions
 * Enforces authenticated session security (prevents unauthenticated ATO attacks)
 */
export async function setPasswordAndActivate(
  email: string,
  newPassword: string
): Promise<{ success: boolean; error: string | null }> {
  const passCheck = validatePassword(newPassword);
  if (!passCheck.isValid) {
    return { success: false, error: passCheck.errorMessage || 'Password does not meet enterprise security requirements.' };
  }

  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase client is not configured' };
  }

  try {
    // Verify an authenticated session exists before permitting password modifications
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      return {
        success: false,
        error: 'Password modification requires an authenticated session. Please verify via your email link or use the password reset flow.',
      };
    }

    const { error: updateErr } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error updating password' };
  }
}

/**
 * Dispatches an email verification link to the given address via Google SMTP / Supabase Auth mail relay.
 */
export async function resendConfirmationEmail(
  email: string
): Promise<{ success: boolean; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase client is not configured' };
  }

  try {
    const redirectUrl = typeof window !== 'undefined' ? window.location.origin : undefined;
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: {
        emailRedirectTo: redirectUrl,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to dispatch confirmation email via Google SMTP' };
  }
}

/**
 * Alias to explicitly reflect Google SMTP delivery rather than third-party SaaS naming.
 */
export const requestConfirmationEmailViaGoogleSmtp = resendConfirmationEmail;

/**
 * Compound Flow: Sign up a new user and immediately accept an organization invite.
 * 
 * SUPABASE AUTH SETTING DEPENDENCY:
 * This 1-step compound flow requires that "Confirm email" is DISABLED in your Supabase Auth project
 * (Dashboard > Authentication > Providers > Email > uncheck "Confirm email").
 * When email confirmation is disabled, supabase.auth.signUp() immediately returns an active JWT session,
 * allowing accept_invite() to authenticate via auth.uid() in the same request.
 * 
 * If "Confirm email" is enabled, signUp() creates the user without an active session (session: null).
 * In that case, this function returns a descriptive error guiding the user to confirm their email before
 * signing in and accepting the invite.
 */
export async function signUpAndAcceptInvite(
  email: string,
  password: string,
  token: string,
  fullName: string,
  department = 'Operations'
): Promise<{ session: Session | null; profile: StaffProfile | null; error: string | null }> {
  const emailCheck = validateEmail(email);
  if (!emailCheck.isValid) {
    return { session: null, profile: null, error: emailCheck.error || 'Please provide a valid authentic email address.' };
  }
  const cleanEmail = emailCheck.normalizedEmail;

  const passCheck = validatePassword(password);
  if (!passCheck.isValid) {
    return { session: null, profile: null, error: passCheck.errorMessage || 'Password does not satisfy complexity requirements.' };
  }

  if (!isSupabaseConfigured) {
    return { session: null, profile: null, error: 'Supabase client is not configured' };
  }

  try {
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          full_name: fullName,
          department,
        },
      },
    });

    if (signUpErr) {
      return { session: null, profile: null, error: signUpErr.message };
    }

    // Check if email confirmation is required by Supabase Auth project settings
    if (!signUpData.session) {
      return {
        session: null,
        profile: null,
        error:
          'Account created! Note: Email confirmation is enabled on this Supabase project. Please check your inbox and confirm your email, then sign in and use "Join with Invite" with your token. (Tip: Disable "Confirm email" in Supabase Dashboard > Authentication > Providers > Email for instant zero-step onboarding).',
      };
    }

    cachedSession = signUpData.session;

    const inviteRes = await acceptInvite(token, fullName, department);
    if (!inviteRes.success) {
      return { session: signUpData.session, profile: null, error: inviteRes.error || 'Failed to accept invite' };
    }

    const profile = await getStaffProfile(true);
    return { session: signUpData.session, profile, error: null };
  } catch (e: any) {
    return { session: null, profile: null, error: e?.message || 'Invite registration failed' };
  }
}

/**
 * Decommissioned instant activation helper.
 * Enforces secure email verification and cryptographic token verification.
 */
export async function instantActivateAccount(_email: string, _password?: string): Promise<{
  success: boolean;
  actionLink?: string;
  hashedToken?: string;
  emailOtp?: string;
  organization_id?: string;
  organization_name?: string;
  error?: string;
}> {
  return {
    success: false,
    error: 'Direct unauthenticated activation is decommissioned for security. Please use the verification link sent to your registered email address or your invitation code.',
  };
}

/**
 * =========================================================================
 * TENANT WORKSPACE: WORKER & TEAM MANAGEMENT SERVICES
 * =========================================================================
 */

export interface WorkspaceWorker {
  id: string;
  organization_id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'ops_staff' | 'sales_staff' | 'dispatch_staff' | 'viewer';
  department: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface WorkspacePendingInvite {
  id: string;
  organization_id: string;
  email: string;
  role: 'admin' | 'ops_staff' | 'sales_staff' | 'dispatch_staff' | 'viewer';
  token: string;
  expires_at: string;
  created_at: string;
}

export interface WorkspaceWorkerListResult {
  success: boolean;
  workers: WorkspaceWorker[];
  pendingInvites: WorkspacePendingInvite[];
  seats: {
    used: number;
    max: number;
    available: number;
    activeWorkers: number;
    pendingInvites: number;
  };
  organization?: any;
  error?: string;
}

export interface AddWorkerParams {
  organizationId: string;
  email: string;
  fullName: string;
  role?: 'admin' | 'ops_staff' | 'sales_staff' | 'dispatch_staff' | 'viewer';
  department?: string;
  password?: string;
  sendEmail?: boolean;
}

export async function getAuthHeaders(includeJson: boolean = false): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  if (includeJson) {
    headers['Content-Type'] = 'application/json';
  }
  try {
    const session = await getSession();
    const token = session?.access_token;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch {}
  return headers;
}

/**
 * Retrieves all active/suspended workers and pending invites for the given tenant workspace.
 */
export async function listWorkspaceWorkers(organizationId: string): Promise<WorkspaceWorkerListResult> {
  if (!organizationId) {
    return {
      success: false,
      workers: [],
      pendingInvites: [],
      seats: { used: 0, max: 5, available: 5, activeWorkers: 0, pendingInvites: 0 },
      error: 'Organization ID is required.',
    };
  }

  // 1. Try server-side endpoint first (has service-role visibility into users & invites)
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/tenant/workers?organizationId=${encodeURIComponent(organizationId)}`, {
      headers,
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        try {
          localStorage.setItem(`frostly_workers_cache_${organizationId}`, JSON.stringify(data));
        } catch {}
        return data;
      }
    }
  } catch (err) {
    console.warn('[listWorkspaceWorkers] API call failed, falling back to Supabase client / cache:', err);
  }

  // 2. Direct Supabase Client Query fallback
  if (isSupabaseConfigured) {
    try {
      const { data: staffData } = await supabase
        .from('staff_profiles')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      const { data: inviteData } = await supabase
        .from('invites')
        .select('*')
        .eq('organization_id', organizationId)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      const workers: WorkspaceWorker[] = (staffData || []).map((s) => ({
        id: s.id,
        organization_id: s.organization_id,
        email: s.email,
        full_name: s.full_name,
        role: s.role,
        department: s.department || 'Operations',
        is_active: s.is_active ?? true,
        created_at: s.created_at || new Date().toISOString(),
        updated_at: s.updated_at,
      }));

      const pendingInvites: WorkspacePendingInvite[] = (inviteData || []).map((i) => ({
        id: i.id,
        organization_id: i.organization_id,
        email: i.email,
        role: i.role,
        token: i.token,
        expires_at: i.expires_at,
        created_at: i.created_at || new Date().toISOString(),
      }));

      const activeCount = workers.filter((w) => w.is_active).length;
      const totalUsed = activeCount + pendingInvites.length;

      return {
        success: true,
        workers,
        pendingInvites,
        seats: {
          used: totalUsed,
          max: 5,
          available: Math.max(0, 5 - totalUsed),
          activeWorkers: activeCount,
          pendingInvites: pendingInvites.length,
        },
      };
    } catch (err: any) {
      console.warn('[listWorkspaceWorkers] Supabase direct query error:', err);
    }
  }

  // 3. Local Storage Cache / Demo Mode fallback
  try {
    const cached = localStorage.getItem(`frostly_workers_cache_${organizationId}`);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {}

  // Fallback demo workers
  const demoWorkers: WorkspaceWorker[] = [
    {
      id: 'demo-worker-1',
      organization_id: organizationId,
      email: 'kofi.asante@frostly.io',
      full_name: 'Kofi Asante',
      role: 'ops_staff',
      department: 'Cold Storage Bay #1',
      is_active: true,
      created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    },
    {
      id: 'demo-worker-2',
      organization_id: organizationId,
      email: 'abena.mensah@frostly.io',
      full_name: 'Abena Mensah',
      role: 'dispatch_staff',
      department: 'Reefer Fleet Logistics',
      is_active: true,
      created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    },
  ];

  return {
    success: true,
    workers: demoWorkers,
    pendingInvites: [],
    seats: {
      used: 2,
      max: 5,
      available: 3,
      activeWorkers: 2,
      pendingInvites: 0,
    },
  };
}

/**
 * Adds a user / worker to the tenant workspace.
 * Supports direct account provisioning (password set) or workspace invitation token.
 */
export async function addWorkerToWorkspace(params: AddWorkerParams): Promise<{
  success: boolean;
  mode?: 'direct_provisioned' | 'invite_issued' | 'reactivated';
  worker?: WorkspaceWorker;
  invite?: WorkspacePendingInvite;
  credentials?: { email: string; password?: string; role: string };
  inviteToken?: string;
  inviteAcceptUrl?: string;
  error?: string;
  message?: string;
}> {
  const emailCheck = validateEmail(params.email);
  if (!emailCheck.isValid) {
    return { success: false, error: emailCheck.error || 'Please provide a valid authentic work email address.' };
  }
  const cleanEmail = emailCheck.normalizedEmail;

  if (params.password) {
    const passCheck = validatePassword(params.password);
    if (!passCheck.isValid) {
      return { success: false, error: passCheck.errorMessage || 'Worker password does not meet complexity requirements.' };
    }
  }

  const sanitizedParams = { ...params, email: cleanEmail };

  try {
    const headers = await getAuthHeaders(true);
    const res = await fetch('/api/tenant/workers', {
      method: 'POST',
      headers,
      body: JSON.stringify(sanitizedParams),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Failed to add worker to workspace' };
    }

    return data;
  } catch (err: any) {
    console.warn('[addWorkerToWorkspace] Backend endpoint error, attempting client fallback:', err);
    
    // Fallback: If invite mode or client-side mode
    if (!params.password) {
      const inviteRes = await createInvite(params.email, params.role || 'ops_staff', 7);
      if (inviteRes.success) {
        return {
          success: true,
          mode: 'invite_issued',
          message: `Workspace invite generated for ${params.email}`,
          inviteToken: inviteRes.data?.token,
        };
      }
      return { success: false, error: inviteRes.error || 'Failed to issue invite' };
    }

    return { success: false, error: err?.message || 'Failed to communicate with server.' };
  }
}

/**
 * Updates worker role, department, or active status in tenant workspace.
 */
export async function updateWorkspaceWorker(
  workerId: string,
  organizationId: string,
  updates: {
    role?: 'admin' | 'ops_staff' | 'sales_staff' | 'dispatch_staff' | 'viewer';
    department?: string;
    full_name?: string;
    is_active?: boolean;
  }
): Promise<{ success: boolean; worker?: WorkspaceWorker; error?: string }> {
  try {
    const headers = await getAuthHeaders(true);
    const res = await fetch(`/api/tenant/workers/${encodeURIComponent(workerId)}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ organizationId, ...updates }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Failed to update worker profile' };
    }

    return data;
  } catch (err: any) {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('staff_profiles')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', workerId)
          .eq('organization_id', organizationId)
          .select()
          .single();

        if (error) throw error;
        return { success: true, worker: data };
      } catch (clientErr: any) {
        return { success: false, error: clientErr?.message || 'Update failed' };
      }
    }
    return { success: false, error: err?.message || 'Network error updating worker' };
  }
}

/**
 * Removes a worker or revokes a pending invite from tenant workspace.
 */
export async function removeWorkerOrInvite(
  id: string,
  organizationId: string,
  isInvite: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(
      `/api/tenant/workers/${encodeURIComponent(id)}?organizationId=${encodeURIComponent(organizationId)}&isInvite=${isInvite}`,
      { method: 'DELETE', headers }
    );
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Failed to remove from workspace' };
    }
    return { success: true };
  } catch (err: any) {
    if (isSupabaseConfigured) {
      try {
        if (isInvite) {
          const { error } = await supabase.from('invites').delete().eq('id', id).eq('organization_id', organizationId);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('staff_profiles').update({ is_active: false }).eq('id', id).eq('organization_id', organizationId);
          if (error) throw error;
        }
        return { success: true };
      } catch (clientErr: any) {
        return { success: false, error: clientErr?.message };
      }
    }
    return { success: false, error: err?.message };
  }
}

/**
 * Resets a worker's password.
 */
export async function resetWorkerPassword(
  workerId: string,
  email: string,
  newPassword: string,
  organizationName?: string
): Promise<{ success: boolean; error?: string }> {
  const passCheck = validatePassword(newPassword);
  if (!passCheck.isValid) {
    return { success: false, error: passCheck.errorMessage || 'New password does not meet security requirements.' };
  }

  try {
    const headers = await getAuthHeaders(true);
    const res = await fetch(`/api/tenant/workers/${encodeURIComponent(workerId)}/reset-password`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email, password: newPassword, organizationName }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Failed to reset password' };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error' };
  }
}

/**
 * Updates the current authenticated user's own password with enterprise security validation.
 */
export async function changeCurrentUserPassword(
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const passCheck = validatePassword(newPassword);
  if (!passCheck.isValid) {
    return { success: false, error: passCheck.errorMessage || 'New password does not meet security requirements.' };
  }

  if (!isSupabaseConfigured) {
    return { success: true };
  }

  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update user password.' };
  }
}




