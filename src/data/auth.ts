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
  needs_onboarding?: boolean;
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

// Development test user credentials (must be configured via environment variables)
export const DEFAULT_TEST_USER_EMAIL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_DEV_TEST_USER_EMAIL) || '';

export const DEFAULT_TEST_USER_PASSWORD =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_DEV_TEST_USER_PASSWORD) || '';

export const DEFAULT_TEST_USER = {
  email: DEFAULT_TEST_USER_EMAIL,
  password: DEFAULT_TEST_USER_PASSWORD,
};

// Platform Creator credentials (must be configured via environment variables)
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

    const isCreator = 
      (DEFAULT_CREATOR_EMAIL && user.email?.toLowerCase() === DEFAULT_CREATOR_EMAIL.toLowerCase()) || 
      user.user_metadata?.role === 'platform_creator' || 
      user.app_metadata?.role === 'platform_creator';
    const fallbackRole = isCreator ? 'admin' : (user.user_metadata?.role || 'admin');
    const isUnprovisioned = !profileData && !isCreator;

    const defaultOrg: TenantOrganization = {
      id: profileData?.organization_id || (isUnprovisioned ? '' : 'org-frostly-hq'),
      name: orgData?.name || user.user_metadata?.organization_name || (isUnprovisioned ? '' : 'Frostly Seafood Operations'),
      plan_tier: orgData?.plan_tier || 'starter',
      subscription_status: orgData?.subscription_status || 'trial',
      trial_ends_at: orgData?.trial_ends_at || new Date(Date.now() + 14 * 86400000).toISOString(),
      current_period_ends_at: orgData?.current_period_ends_at,
      max_staff_seats: orgData?.max_staff_seats || 5,
    };

    cachedStaffProfile = {
      id: profileData?.id || user.id,
      organization_id: profileData?.organization_id || (isUnprovisioned ? '' : 'org-frostly-hq'),
      organization_name: orgData?.name || user.user_metadata?.organization_name || (isUnprovisioned ? '' : 'Frostly Seafood Operations'),
      organization: defaultOrg,
      email: profileData?.email || user.email || '',
      full_name: profileData?.full_name || user.user_metadata?.full_name || (user.email?.split('@')[0] ?? 'Staff User'),
      role: (profileData?.role as any) || fallbackRole,
      department: profileData?.department || user.user_metadata?.department || 'Executive',
      is_active: profileData?.is_active ?? true,
      needs_onboarding: isUnprovisioned,
    };

    if (cachedStaffProfile.organization_id && cachedStaffProfile.organization_id !== 'org-frostly-hq' && !isUnprovisioned) {
      try {
        localStorage.setItem('frostly_active_org_id', cachedStaffProfile.organization_id);
      } catch {}
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
  if (cachedStaffProfile?.organization_id && cachedStaffProfile.organization_id !== 'org-frostly-hq') {
    return cachedStaffProfile.organization_id;
  }
  try {
    const stored = localStorage.getItem('frostly_active_org_id');
    if (stored) return stored;
  } catch {}
  return '00000000-0000-0000-0000-000000000001';
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

  if (!targetEmail || !targetPassword) {
    return {
      session: null,
      error: 'Development test credentials are not configured. Please set VITE_DEV_TEST_USER_EMAIL and VITE_DEV_TEST_USER_PASSWORD in environment variables.',
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

  if (!targetEmail || !targetPassword) {
    return {
      session: null,
      error: 'Platform creator credentials are not configured. Please set VITE_DEV_CREATOR_EMAIL and VITE_DEV_CREATOR_PASSWORD in environment variables.',
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
        const resp = await fetch('/api/tenant/bootstrap-onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase client is not configured' };
  }

  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, error: 'A valid email address is required.' };
  }

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
  if (!isSupabaseConfigured) {
    const orgRes = await createOrganizationAndAdmin(orgName, adminFullName, adminDepartment, options);
    if (!orgRes.success) {
      return { session: null, profile: null, error: orgRes.error || 'Failed to create organization' };
    }
    const mockProfile: StaffProfile = {
      id: 'usr-local-' + Math.random().toString(36).substring(2, 9),
      organization_id: orgRes.data?.organization_id || 'org-local-1',
      organization_name: orgName,
      email,
      full_name: adminFullName || email.split('@')[0],
      role: 'admin',
      department: adminDepartment,
      is_active: true,
      needs_onboarding: false,
    };
    cachedStaffProfile = mockProfile;
    return { session: null, profile: mockProfile, error: null };
  }

  try {
    // 1. First attempt direct server-side tenant provisioning (guarantees DB insertion and avoids Supabase internal SMTP 500 errors)
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const regResp = await fetch('/api/auth/register-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          orgName: orgName.trim(),
          adminFullName: adminFullName.trim() || email.trim().split('@')[0],
          adminDepartment,
          facilityType: options?.facilityType || 'cold_storage',
          facilityCode: options?.facilityCode,
          currency: options?.currency || 'GHS',
          primaryPort: options?.primaryPort || 'Port of Tema & Pier 38 Fishing Harbour',
          websiteUrl: origin,
        }),
      });

      if (!regResp.ok) {
        const regData = await regResp.json().catch(() => ({}));
        return {
          session: null,
          profile: null,
          error: regData.error || 'Failed to register organization. Please check details and try again.',
        };
      }

      const regData = await regResp.json();
      if (regData.success) {
        // Immediately sign in with the configured credentials to acquire user session
        const signInRes = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (signInRes.data.session) {
          cachedSession = signInRes.data.session;
          const profile = await getStaffProfile(true);
          return { session: signInRes.data.session, profile, error: null };
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
 * Set password and activate account for users arriving from an activation email link
 */
export async function setPasswordAndActivate(
  email: string,
  newPassword: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const resp = await fetch('/api/auth/set-password-and-activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password: newPassword }),
    });
    const data = await resp.json();
    if (!resp.ok || !data.success) {
      return { success: false, error: data.error || 'Failed to update password' };
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

/**
 * 1-Click Instant Activation helper for email links or direct admin confirmation
 */
export async function instantActivateAccount(email: string, password?: string): Promise<{
  success: boolean;
  actionLink?: string;
  hashedToken?: string;
  organization_id?: string;
  organization_name?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/auth/instant-activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Failed to activate account' };
    }
    return {
      success: true,
      actionLink: data.actionLink,
      hashedToken: data.hashedToken,
      organization_id: data.organization_id,
      organization_name: data.organization_name,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error during activation' };
  }
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
    const res = await fetch(`/api/tenant/workers?organizationId=${encodeURIComponent(organizationId)}`);
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
  try {
    const res = await fetch('/api/tenant/workers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
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
    const res = await fetch(`/api/tenant/workers/${encodeURIComponent(workerId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
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
    const res = await fetch(
      `/api/tenant/workers/${encodeURIComponent(id)}?organizationId=${encodeURIComponent(organizationId)}&isInvite=${isInvite}`,
      { method: 'DELETE' }
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
  try {
    const res = await fetch(`/api/tenant/workers/${encodeURIComponent(workerId)}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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



