import { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../utils/supabase';

export interface StaffProfile {
  id: string;
  organization_id: string;
  organization_name?: string;
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
      .select('*, organizations(name)')
      .eq('id', user.id)
      .single();

    if (error) {
      console.warn('[Auth] Could not fetch staff profile:', error.message);
      return null;
    }

    const orgName = (data as any)?.organizations?.name;
    cachedStaffProfile = {
      id: data.id,
      organization_id: data.organization_id,
      organization_name: orgName,
      email: data.email,
      full_name: data.full_name,
      role: data.role,
      department: data.department,
      is_active: data.is_active,
    };
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

/**
 * Creates an organization and assigns the current authenticated user as its administrator.
 * Calls SECURITY DEFINER function public.create_organization_and_admin
 */
export async function createOrganizationAndAdmin(
  orgName: string,
  adminFullName?: string,
  adminDepartment?: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase client is not configured' };
  }

  try {
    const { data, error } = await supabase.rpc('create_organization_and_admin', {
      p_org_name: orgName,
      p_admin_full_name: adminFullName || null,
      p_admin_department: adminDepartment || 'Executive',
    });

    if (error) {
      return { success: false, error: error.message };
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
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase client is not configured' };
  }

  try {
    const { data, error } = await supabase.rpc('create_invite', {
      p_email: email.trim(),
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
 * Compound Flow: Sign up a new user and immediately initialize a new organization
 */
export async function signUpAndCreateOrganization(
  email: string,
  password: string,
  orgName: string,
  adminFullName: string,
  adminDepartment = 'Executive'
): Promise<{ session: Session | null; profile: StaffProfile | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { session: null, profile: null, error: 'Supabase client is not configured' };
  }

  try {
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: adminFullName,
          department: adminDepartment,
        },
      },
    });

    if (signUpErr) {
      return { session: null, profile: null, error: signUpErr.message };
    }

    // In case auto-confirm is enabled or session is returned
    cachedSession = signUpData.session;

    const orgRes = await createOrganizationAndAdmin(orgName, adminFullName, adminDepartment);
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
 * Compound Flow: Sign up a new user and immediately accept an organization invite
 */
export async function signUpAndAcceptInvite(
  email: string,
  password: string,
  token: string,
  fullName: string,
  department = 'Operations'
): Promise<{ session: Session | null; profile: StaffProfile | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { session: null, profile: null, error: 'Supabase client is not configured' };
  }

  try {
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email,
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

