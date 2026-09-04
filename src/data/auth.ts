import { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../utils/supabase';

export interface StaffProfile {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'ops_staff' | 'sales_staff' | 'dispatch_staff' | 'viewer';
  department?: string;
  is_active: boolean;
}

let cachedSession: Session | null = null;
let cachedStaffProfile: StaffProfile | null = null;
let isInitialized = false;

// Optional development test user email (configurable via env)
export const DEFAULT_TEST_USER_EMAIL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_DEV_TEST_USER_EMAIL) ||
  'admin@frostly.com';

export const DEFAULT_TEST_USER = {
  email: DEFAULT_TEST_USER_EMAIL,
  password:
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_DEV_TEST_USER_PASSWORD) ||
    '',
};

/**
 * Get the current Supabase auth session, caching it locally
 */
export async function getSession(): Promise<Session | null> {
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
    const { data, error } = await supabase
      .from('staff_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.warn('[Auth] Could not fetch staff profile:', error.message);
      return null;
    }

    cachedStaffProfile = data as StaffProfile;
    return cachedStaffProfile;
  } catch (e) {
    console.warn('[Auth] Exception fetching staff profile:', e);
    return null;
  }
}

/**
 * Sign in with email and password
 */
export async function signIn(
  email: string,
  password: string
): Promise<{ session: Session | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { session: null, error: 'Supabase client is not configured' };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { session: null, error: error.message };
    }

    cachedSession = data.session;
    await getStaffProfile(true);
    return { session: data.session, error: null };
  } catch (err: any) {
    return { session: null, error: err?.message || 'Authentication failed' };
  }
}

/**
 * Convenience method to sign in with development test credentials.
 * Strictly gated: will error out in production environments.
 */
export async function signInAsTestUser(
  email?: string,
  password?: string
): Promise<{ session: Session | null; error: string | null }> {
  // Strict environment guard: completely block test user sign-in in production builds
  if (typeof import.meta !== 'undefined' && import.meta.env?.PROD) {
    return {
      session: null,
      error: 'Test user sign-in is disabled in production environments. Please sign in with staff credentials.',
    };
  }

  const targetEmail = email || DEFAULT_TEST_USER_EMAIL;
  const targetPassword =
    password ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_DEV_TEST_USER_PASSWORD) ||
    '';

  if (!targetPassword) {
    return {
      session: null,
      error: 'No dev test password configured in VITE_DEV_TEST_USER_PASSWORD. Please enter credentials manually.',
    };
  }

  return signIn(targetEmail, targetPassword);
}

/**
 * Sign out
 */
export async function signOut(): Promise<void> {
  cachedSession = null;
  cachedStaffProfile = null;

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
  if (!isSupabaseConfigured) {
    return () => {};
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
    authListener.subscription.unsubscribe();
  };
}
