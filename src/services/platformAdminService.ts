import { supabase } from '../utils/supabase';
import { getSession } from '../data/auth';

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

export async function checkIsPlatformAdmin(): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    // Only server-set app_metadata or the platform_admins table (self-readable via RLS) can grant this.
    if (user.app_metadata?.role === 'platform_creator') return true;
    const { data, error } = await supabase
      .from('platform_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();
    return !error && Boolean(data);
  } catch {
    return false;
  }
}

async function platformServerFetch(
  path: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; status: number; body: any }> {
  if (typeof window === 'undefined' || typeof fetch !== 'function') {
    return { ok: false, status: 0, body: null };
  }
  try {
    const session = await getSession();
    const token = session?.access_token;
    if (!token) {
      return { ok: false, status: 0, body: null };
    }
    const res = await fetch(path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
    const body = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, body };
  } catch {
    return { ok: false, status: 0, body: null };
  }
}

export async function fetchPlatformOrganizations(): Promise<PlatformOrganization[]> {
  const apiRes = await platformServerFetch('/api/platform/organizations');
  if (apiRes.ok && Array.isArray(apiRes.body?.organizations)) {
    return apiRes.body.organizations.map((d: any) => ({
      ...d,
      staff_count: Number(d.staff_count || 0),
      pending_invites_count: Number(d.pending_invites_count || 0),
    }));
  }

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

  throw new Error('Could not load organizations from the server.');
}

export async function fetchPlatformAuditLogs(): Promise<PlatformAuditLog[]> {
  const apiRes = await platformServerFetch('/api/platform/audit-logs');
  if (apiRes.ok && Array.isArray(apiRes.body?.logs)) {
    return apiRes.body.logs;
  }

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

  throw new Error('Could not load platform audit logs from the server.');
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

  const apiRes = await platformServerFetch(`/api/platform/organizations/${encodeURIComponent(orgId)}/subscription`, {
    method: 'POST',
    body: JSON.stringify({ status, planTier, maxSeats, trialEndsAt, reason }),
  });
  if (apiRes.ok && apiRes.body?.success) {
    return apiRes.body;
  }

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
    console.warn('RPC execution failed:', err);
  }

  // The server did not confirm this change; never simulate success locally.
  throw new Error('The server did not confirm this platform change. No changes were made.');
}

/**
 * Revoke/Suspend an organization's access and operational capability.
 * Updates status to 'suspended', invalidates active invites, and writes immutable audit log.
 */
export async function revokePlatformOrganization(orgId: string, reason: string): Promise<any> {
  const apiRes = await platformServerFetch(`/api/platform/organizations/${encodeURIComponent(orgId)}/revoke`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
  if (apiRes.ok && apiRes.body?.success) {
    return apiRes.body;
  }

  try {
    const { data, error } = await supabase.rpc('platform_revoke_organization_access', {
      p_org_id: orgId,
      p_reason: reason || 'Access revoked by platform administrator',
    });

    if (!error && data?.success) {
      return data;
    }
  } catch (err) {
    console.warn('RPC platform_revoke_organization_access failed:', err);
  }

  // The server did not confirm this change; never simulate success locally.
  throw new Error('The server did not confirm this platform change. No changes were made.');
}

/**
 * Reinstate an organization's active access and operational capability.
 */
export async function reinstatePlatformOrganization(
  orgId: string, 
  reason: string,
  targetStatus: 'active' | 'trial' = 'active'
): Promise<any> {
  const apiRes = await platformServerFetch(`/api/platform/organizations/${encodeURIComponent(orgId)}/reinstate`, {
    method: 'POST',
    body: JSON.stringify({ reason, targetStatus }),
  });
  if (apiRes.ok && apiRes.body?.success) {
    return apiRes.body;
  }

  try {
    const { data, error } = await supabase.rpc('platform_reinstate_organization_access', {
      p_org_id: orgId,
      p_reason: reason || 'Tenant access reinstated by platform administrator',
      p_target_status: targetStatus,
    });

    if (!error && data?.success) {
      return data;
    }
  } catch (err) {
    console.warn('RPC platform_reinstate_organization_access failed:', err);
  }

  // The server did not confirm this change; never simulate success locally.
  throw new Error('The server did not confirm this platform change. No changes were made.');
}

/**
 * Permanently delete/deprovision an organization and its tenant data.
 */
export async function deletePlatformOrganization(
  orgId: string, 
  reason: string,
  confirmName?: string
): Promise<any> {
  const apiRes = await platformServerFetch(`/api/platform/organizations/${encodeURIComponent(orgId)}/delete`, {
    method: 'POST',
    body: JSON.stringify({ reason, confirmName }),
  });
  if (apiRes.status >= 400 && apiRes.body?.error) {
    throw new Error(apiRes.body.error);
  }
  if (apiRes.ok && apiRes.body?.success) {
    return apiRes.body;
  }

  try {
    const { data, error } = await supabase.rpc('platform_delete_organization', {
      p_org_id: orgId,
      p_reason: reason || 'Organization permanently deleted',
      p_confirm_name: confirmName ?? null,
    });

    if (!error && data?.success) {
      return data;
    }
  } catch (err) {
    console.warn('RPC platform_delete_organization failed:', err);
  }

  // The server did not confirm this change; never simulate success locally.
  throw new Error('The server did not confirm this platform change. No changes were made.');
}

/**
 * Purges all operational, inventory, financial, and transactional data for a tenant
 * while strictly PRESERVING user credentials, accounts, roles, and authentication.
 */
export async function purgeTenantWorkspaceData(
  orgIdOrName: string,
  confirmName?: string
): Promise<{
  success: boolean;
  organization_id?: string;
  organization_name?: string;
  preserved_users_count?: number;
  preserved_user_emails?: string[];
  error?: string;
}> {
  // 1. Try server endpoint first with authenticated bearer token
  try {
    const session = await getSession();
    const token = session?.access_token;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch('/api/tenant/purge-data', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        organizationId: orgIdOrName,
        confirmName,
      }),
    });

    const data = await res.json().catch(() => null);

    if (res.ok && data?.success) {
      return data;
    }

    if (data?.error) {
      return { success: false, error: data.error };
    }
  } catch (err: any) {
    console.warn('POST /api/tenant/purge-data failed, attempting Supabase RPC:', err);
  }

  // 2. Try Supabase RPC directly
  try {
    const { data, error } = await supabase.rpc('purge_tenant_data_except_users', {
      p_org_identifier: orgIdOrName,
      p_confirm_name: confirmName ?? null,
    });

    if (!error && data?.success) {
      return data;
    }

    if (error) {
      return { success: false, error: error.message };
    }
  } catch (err: any) {
    console.warn('Supabase RPC purge_tenant_data_except_users failed:', err);
    return { success: false, error: err?.message || 'Purge failed' };
  }

  return { success: false, error: 'Failed to purge workspace data on server and database.' };
}


