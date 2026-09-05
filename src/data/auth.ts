import { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../utils/supabase';

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

// Optional development test user email (configurable via env)
export const DEFAULT_TEST_USER_EMAIL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_DEV_TEST_USER_EMAIL) ||
  'admin@frostly.com';

export const DEFAULT_TEST_USER_PASSWORD =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_DEV_TEST_USER_PASSWORD) ||
  'FrostlyAdmin2026!';

export const DEFAULT_TEST_USER = {
  email: DEFAULT_TEST_USER_EMAIL,
  password: DEFAULT_TEST_USER_PASSWORD,
};

// Platform Creator / System Operator credentials (stored at backend in auth.users and public.platform_admins)
export const DEFAULT_CREATOR_EMAIL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_DEV_CREATOR_EMAIL) ||
  'creator@frostly.io';

export const DEFAULT_CREATOR_PASSWORD =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_DEV_CREATOR_PASSWORD) ||
  'FrostlyCreator2026!';

export const DEFAULT_CREATOR_USER = {
  email: DEFAULT_CREATOR_EMAIL,
  password: DEFAULT_CREATOR_PASSWORD,
  role: 'platform_creator' as const,
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
    let profileData: any = null;
    let orgData: any = null;

    // 1. Attempt joined query with organizations
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

    const isCreator = user.email === 'creator@frostly.io' || user.email === 'owner@frostly.io';
    const fallbackRole = isCreator ? 'admin' : (user.user_metadata?.role || 'admin');

    const defaultOrg: TenantOrganization = {
      id: profileData?.organization_id || 'org-frostly-hq',
      name: orgData?.name || 'Frostly Seafood Operations',
      plan_tier: orgData?.plan_tier || 'enterprise',
      subscription_status: orgData?.subscription_status || 'active',
      trial_ends_at: orgData?.trial_ends_at,
      current_period_ends_at: orgData?.current_period_ends_at,
      max_staff_seats: orgData?.max_staff_seats || 50,
    };

    cachedStaffProfile = {
      id: profileData?.id || user.id,
      organization_id: profileData?.organization_id || 'org-frostly-hq',
      organization_name: orgData?.name || 'Frostly Seafood Operations',
      organization: defaultOrg,
      email: profileData?.email || user.email || '',
      full_name: profileData?.full_name || user.user_metadata?.full_name || (user.email?.split('@')[0] ?? 'Staff User'),
      role: (profileData?.role as any) || fallbackRole,
      department: profileData?.department || user.user_metadata?.department || 'Operations',
      is_active: profileData?.is_active ?? true,
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
  const targetPassword = password || DEFAULT_TEST_USER_PASSWORD;

  if (!targetPassword) {
    return {
      session: null,
      error: 'No dev test password configured in VITE_DEV_TEST_USER_PASSWORD. Please enter credentials manually.',
    };
  }

  return signIn(targetEmail, targetPassword);
}

/**
 * Convenience method to sign in with Platform Creator / System Operator credentials.
 * Connects to the backend-persisted creator identity in auth.users & public.platform_admins.
 */
export async function signInAsCreator(
  email?: string,
  password?: string
): Promise<{ session: Session | null; error: string | null }> {
  // Strict environment guard: block unauthenticated test shortcuts in production builds
  if (typeof import.meta !== 'undefined' && import.meta.env?.PROD && !password) {
    return {
      session: null,
      error: 'Creator auto-login is disabled in production environments. Please sign in with creator credentials.',
    };
  }

  const targetEmail = email || DEFAULT_CREATOR_EMAIL;
  const targetPassword = password || DEFAULT_CREATOR_PASSWORD;

  if (!targetPassword) {
    return {
      session: null,
      error: 'No creator password configured. Please provide creator credentials.',
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
  adminDepartment = 'Executive'
): Promise<{ session: Session | null; profile: StaffProfile | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { session: null, profile: null, error: 'Supabase client is not configured' };
  }

  try {
    const redirectUrl = typeof window !== 'undefined' ? window.location.origin : undefined;
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: adminFullName,
          department: adminDepartment,
          organization_name: orgName,
          org_name: orgName,
          role: 'admin',
        },
      },
    });

    if (signUpErr) {
      return { session: null, profile: null, error: signUpErr.message };
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

