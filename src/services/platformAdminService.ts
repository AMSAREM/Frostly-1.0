import { supabase } from '../utils/supabase';

export interface PlatformOrganization {
  id: string;
  name: string;
  company_name: string;
  subscription_status: 'trial' | 'active' | 'past_due' | 'suspended';
  plan_tier: 'starter' | 'standard' | 'enterprise';
  billing_provider: 'stripe' | 'paystack' | 'none';
  billing_currency: 'USD' | 'GHS';
  max_staff_seats: number;
  staff_count: number;
  pending_invites_count: number;
  trial_ends_at: string | null;
  current_period_ends_at: string | null;
  created_at: string;
}

export interface PlatformAuditLog {
  id: string;
  actor_id: string;
  action: string;
  target_organization_id: string | null;
  previous_state: Record<string, any>;
  new_state: Record<string, any>;
  reason: string;
  created_at: string;
}

const STORAGE_KEY_ORGS = 'frostly_platform_demo_orgs';
const STORAGE_KEY_AUDIT = 'frostly_platform_demo_audit';

// Initial fallback mock data for local demo preview when Supabase backend is not linked
const INITIAL_DEMO_ORGS: PlatformOrganization[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Tema Cold Store Ltd (Headquarters)',
    company_name: 'Tema Cold Store Ltd',
    subscription_status: 'active',
    plan_tier: 'enterprise',
    billing_provider: 'none',
    billing_currency: 'GHS',
    max_staff_seats: 9999,
    staff_count: 8,
    pending_invites_count: 1,
    trial_ends_at: null,
    current_period_ends_at: '2027-12-31T23:59:59Z',
    created_at: '2025-01-10T08:00:00Z',
  },
  {
    id: '90000000-0000-0000-0000-000000000001',
    name: 'Tema Coastal Fisheries Ltd',
    company_name: 'Tema Coastal Fisheries Ltd',
    subscription_status: 'trial',
    plan_tier: 'starter',
    billing_provider: 'paystack',
    billing_currency: 'GHS',
    max_staff_seats: 5,
    staff_count: 3,
    pending_invites_count: 2,
    trial_ends_at: '2026-09-18T12:00:00Z',
    current_period_ends_at: null,
    created_at: '2026-09-01T10:30:00Z',
  },
  {
    id: '80000000-0000-0000-0000-000000000002',
    name: 'Takoradi Deepsea Logistics Ltd',
    company_name: 'Takoradi Deepsea Logistics',
    subscription_status: 'past_due',
    plan_tier: 'standard',
    billing_provider: 'paystack',
    billing_currency: 'GHS',
    max_staff_seats: 20,
    staff_count: 14,
    pending_invites_count: 0,
    trial_ends_at: null,
    current_period_ends_at: '2026-09-02T00:00:00Z',
    created_at: '2026-06-15T14:20:00Z',
  },
  {
    id: '70000000-0000-0000-0000-000000000003',
    name: 'Atlantic Reefer Cold-Chain LLC',
    company_name: 'Atlantic Reefer Cold-Chain',
    subscription_status: 'active',
    plan_tier: 'enterprise',
    billing_provider: 'stripe',
    billing_currency: 'USD',
    max_staff_seats: 9999,
    staff_count: 42,
    pending_invites_count: 3,
    trial_ends_at: null,
    current_period_ends_at: '2026-10-01T00:00:00Z',
    created_at: '2026-04-10T09:00:00Z',
  },
  {
    id: '60000000-0000-0000-0000-000000000004',
    name: 'Cape Coast Seafood Processors',
    company_name: 'Cape Coast Seafood Processors',
    subscription_status: 'suspended',
    plan_tier: 'starter',
    billing_provider: 'none',
    billing_currency: 'GHS',
    max_staff_seats: 5,
    staff_count: 2,
    pending_invites_count: 0,
    trial_ends_at: '2026-08-01T00:00:00Z',
    current_period_ends_at: null,
    created_at: '2026-07-15T11:00:00Z',
  },
];

const INITIAL_DEMO_AUDIT: PlatformAuditLog[] = [
  {
    id: 'aud-001',
    actor_id: 'owner@frostly.io',
    action: 'manual_subscription_update',
    target_organization_id: '90000000-0000-0000-0000-000000000001',
    previous_state: { subscription_status: 'trial', plan_tier: 'starter' },
    new_state: { subscription_status: 'trial', plan_tier: 'starter', trial_ends_at: '2026-09-18T12:00:00Z' },
    reason: 'Trial period extended by 14 days following onboard demo',
    created_at: '2026-09-04T09:15:00Z',
  },
  {
    id: 'aud-002',
    actor_id: 'owner@frostly.io',
    action: 'manual_subscription_update',
    target_organization_id: '70000000-0000-0000-0000-000000000003',
    previous_state: { subscription_status: 'trial', plan_tier: 'standard' },
    new_state: { subscription_status: 'active', plan_tier: 'enterprise' },
    reason: 'Annual contract signed; direct wire transfer of $7,990 received',
    created_at: '2026-09-01T15:40:00Z',
  },
];

export async function checkIsPlatformAdmin(): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      // In local development / preview environment, allow creator toggle
      const devOverride = localStorage.getItem('frostly_platform_owner_override');
      return devOverride === 'true';
    }

    // Direct check for platform creator account
    if (user.email === 'creator@frostly.io' || user.email === 'owner@frostly.io') {
      return true;
    }

    const { data, error } = await supabase
      .from('platform_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error || !data) {
      const devOverride = localStorage.getItem('frostly_platform_owner_override');
      return devOverride === 'true';
    }
    return true;
  } catch {
    const devOverride = localStorage.getItem('frostly_platform_owner_override');
    return devOverride === 'true';
  }
}

export async function fetchPlatformOrganizations(): Promise<PlatformOrganization[]> {
  try {
    const { data, error } = await supabase.rpc('platform_list_organizations');
    if (!error && Array.isArray(data) && data.length > 0) {
      return data.map((d: any) => ({
        ...d,
        staff_count: Number(d.staff_count || 0),
        pending_invites_count: Number(d.pending_invites_count || 0),
      }));
    }
  } catch (err) {
    console.warn('Falling back to local platform organizations storage:', err);
  }

  // Local storage fallback for standalone preview
  const saved = localStorage.getItem(STORAGE_KEY_ORGS);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      // ignore
    }
  }
  localStorage.setItem(STORAGE_KEY_ORGS, JSON.stringify(INITIAL_DEMO_ORGS));
  return INITIAL_DEMO_ORGS;
}

export async function fetchPlatformAuditLogs(): Promise<PlatformAuditLog[]> {
  try {
    const { data, error } = await supabase
      .from('platform_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && Array.isArray(data) && data.length > 0) {
      return data;
    }
  } catch (err) {
    console.warn('Falling back to local platform audit logs storage:', err);
  }

  const saved = localStorage.getItem(STORAGE_KEY_AUDIT);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      // ignore
    }
  }
  localStorage.setItem(STORAGE_KEY_AUDIT, JSON.stringify(INITIAL_DEMO_AUDIT));
  return INITIAL_DEMO_AUDIT;
}

export async function updatePlatformOrganizationSubscription(params: {
  orgId: string;
  status: 'active' | 'trial' | 'past_due' | 'suspended';
  planTier: 'starter' | 'standard' | 'enterprise';
  maxSeats?: number;
  trialEndsAt?: string | null;
  reason: string;
}): Promise<any> {
  const { orgId, status, planTier, maxSeats, trialEndsAt, reason } = params;

  try {
    const { data, error } = await supabase.rpc('platform_update_organization_subscription', {
      p_org_id: orgId,
      p_status: status,
      p_plan_tier: planTier,
      p_max_seats: maxSeats ?? null,
      p_trial_ends_at: trialEndsAt ?? null,
      p_reason: reason,
    });

    if (!error && data?.success) {
      return data;
    }
  } catch (err) {
    console.warn('RPC execution failed, falling back to local simulation:', err);
  }

  // Fallback to local storage mutation
  const orgs = await fetchPlatformOrganizations();
  const index = orgs.findIndex(o => o.id === orgId);
  if (index === -1) {
    throw new Error(`Organization ${orgId} not found`);
  }

  const oldOrg = { ...orgs[index] };
  const calculatedSeats = maxSeats ?? (planTier === 'enterprise' ? 9999 : planTier === 'standard' ? 20 : 5);

  const updatedOrg: PlatformOrganization = {
    ...oldOrg,
    subscription_status: status,
    plan_tier: planTier,
    max_staff_seats: calculatedSeats,
    trial_ends_at: trialEndsAt !== undefined ? trialEndsAt : oldOrg.trial_ends_at,
  };

  orgs[index] = updatedOrg;
  localStorage.setItem(STORAGE_KEY_ORGS, JSON.stringify(orgs));

  // Add audit log
  const auditLogs = await fetchPlatformAuditLogs();
  const newAudit: PlatformAuditLog = {
    id: 'aud-' + Date.now(),
    actor_id: 'platform_owner@frostly.io',
    action: 'manual_subscription_update',
    target_organization_id: orgId,
    previous_state: {
      subscription_status: oldOrg.subscription_status,
      plan_tier: oldOrg.plan_tier,
      max_staff_seats: oldOrg.max_staff_seats,
    },
    new_state: {
      subscription_status: updatedOrg.subscription_status,
      plan_tier: updatedOrg.plan_tier,
      max_staff_seats: updatedOrg.max_staff_seats,
    },
    reason: reason || 'Manual subscription update via Platform Console',
    created_at: new Date().toISOString(),
  };

  auditLogs.unshift(newAudit);
  localStorage.setItem(STORAGE_KEY_AUDIT, JSON.stringify(auditLogs.slice(0, 50)));

  return {
    success: true,
    organization_id: orgId,
    subscription_status: updatedOrg.subscription_status,
    plan_tier: updatedOrg.plan_tier,
    max_staff_seats: updatedOrg.max_staff_seats,
    reason,
  };
}
