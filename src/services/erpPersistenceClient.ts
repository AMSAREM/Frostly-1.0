import { getSession } from '../data/auth';

/**
 * Authenticated client bridge to `/api/erp/persistence/*` server routes.
 * Ensures every ERP, POS, Inventory, Ledger, and Settings write/read/delete
 * persists directly to Supabase with tenant isolation, FK prerequisite resolution,
 * child line-item synchronization, and soft-delete safety across all staff roles.
 *
 * Gracefully returns `{ handled: false }` when offline, unauthenticated, or in
 * isolated unit-test environments without an active HTTP server.
 */
async function getVerifiedBearerToken(): Promise<string | null> {
  if (typeof window === 'undefined' || typeof fetch !== 'function') {
    return null;
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return null;
  }
  try {
    const session = await getSession();
    const token = session?.access_token;
    if (!token || token.startsWith('local-token-')) {
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

export async function erpServerQuery<T = any>(params: {
  tableName: string;
  organizationId?: string;
  recordId?: string;
  includeChildren?: boolean;
  limit?: number;
}): Promise<{ handled: boolean; rows?: T[]; row?: T | null; error?: string }> {
  const token = await getVerifiedBearerToken();
  if (!token) return { handled: false };

  try {
    const qs = new URLSearchParams({ table: params.tableName });
    if (params.organizationId) qs.set('organizationId', params.organizationId);
    if (params.recordId) qs.set('recordId', params.recordId);
    if (params.includeChildren) qs.set('includeChildren', 'true');
    if (params.limit) qs.set('limit', String(params.limit));

    const res = await fetch(`/api/erp/persistence/query?${qs.toString()}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.status === 404) {
      return { handled: false };
    }

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { handled: true, error: body?.error || `HTTP ${res.status}` };
    }

    return {
      handled: true,
      rows: Array.isArray(body.rows) ? body.rows : [],
      row: body.row ?? null,
    };
  } catch {
    return { handled: false };
  }
}

export async function erpServerUpsert<T = any>(params: {
  tableName: string;
  payload: Record<string, any>;
  onConflict?: string;
  organizationId?: string;
  childItems?: Array<Record<string, any>>;
}): Promise<{ handled: boolean; row?: T | null; error?: string }> {
  const token = await getVerifiedBearerToken();
  if (!token) return { handled: false };

  try {
    const res = await fetch('/api/erp/persistence/upsert', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        tableName: params.tableName,
        payload: params.payload,
        onConflict: params.onConflict,
        organizationId: params.organizationId,
        childItems: params.childItems,
      }),
    });

    if (res.status === 404) {
      return { handled: false };
    }

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { handled: true, error: body?.error || `HTTP ${res.status}` };
    }

    return {
      handled: true,
      row: body.row ?? null,
    };
  } catch {
    return { handled: false };
  }
}

export async function erpServerDelete(params: {
  tableName: string;
  recordId: string;
  organizationId?: string;
}): Promise<{ handled: boolean; error?: string }> {
  const token = await getVerifiedBearerToken();
  if (!token) return { handled: false };

  try {
    const res = await fetch('/api/erp/persistence/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        tableName: params.tableName,
        recordId: params.recordId,
        organizationId: params.organizationId,
      }),
    });

    if (res.status === 404) {
      return { handled: false };
    }

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { handled: true, error: body?.error || `HTTP ${res.status}` };
    }

    return { handled: true };
  } catch {
    return { handled: false };
  }
}

export async function erpServerGetSettings(
  organizationId?: string
): Promise<{ handled: boolean; row?: any; error?: string }> {
  const token = await getVerifiedBearerToken();
  if (!token) return { handled: false };

  try {
    const qs = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : '';
    const res = await fetch(`/api/erp/persistence/settings${qs}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 404) return { handled: false };
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { handled: true, error: body?.error || `HTTP ${res.status}` };
    return { handled: true, row: body.row ?? null };
  } catch {
    return { handled: false };
  }
}

export async function erpServerSaveSettings(
  payload: Record<string, any>,
  organizationId?: string
): Promise<{ handled: boolean; row?: any; error?: string }> {
  const token = await getVerifiedBearerToken();
  if (!token) return { handled: false };

  try {
    const res = await fetch('/api/erp/persistence/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ payload, organizationId }),
    });
    if (res.status === 404) return { handled: false };
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { handled: true, error: body?.error || `HTTP ${res.status}` };
    return { handled: true, row: body.row ?? null };
  } catch {
    return { handled: false };
  }
}
