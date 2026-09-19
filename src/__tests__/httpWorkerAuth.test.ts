import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { createExpressApp } from '../../server';

describe('HTTP-Level Auth & Security Vulnerability Tests', () => {
  let server: http.Server;
  let baseUrl: string;

  const mockAdminClient = {
    auth: {
      getUser: async (token: string) => {
        if (token === 'admin-token') {
          return { data: { user: { id: 'admin-user-id', email: 'admin@tenant-a.com' } }, error: null };
        }
        if (token === 'worker-token') {
          return { data: { user: { id: 'worker-user-id', email: 'worker@tenant-a.com' } }, error: null };
        }
        return { data: { user: null }, error: new Error('Invalid token') };
      },
    },
    from: (table: string) => ({
      select: () => ({
        eq: (col: string, val: string) => ({
          eq: (_col2: string, _val2: any) => ({
            maybeSingle: async () => {
              if (table === 'staff_profiles') {
                if (val === 'admin-user-id') {
                  return {
                    data: {
                      id: 'admin-user-id',
                      organization_id: 'org-a-id',
                      role: 'admin',
                      is_active: true,
                    },
                    error: null,
                  };
                }
                if (val === 'worker-user-id') {
                  return {
                    data: {
                      id: 'worker-user-id',
                      organization_id: 'org-a-id',
                      role: 'ops_staff',
                      is_active: true,
                    },
                    error: null,
                  };
                }
              }
              return { data: null, error: null };
            },
          }),
          maybeSingle: async () => {
            if (table === 'organizations') {
              return {
                data: {
                  id: val,
                  name: 'Test Tenant Org',
                  plan_tier: 'starter',
                  max_staff_seats: 5,
                },
                error: null,
              };
            }
            return { data: null, error: null };
          },
          order: () => ({
            then: (resolve: any) => resolve({ data: [], error: null }),
          }),
          is: () => ({
            gt: () => ({
              order: () => ({
                then: (resolve: any) => resolve({ data: [], error: null }),
              }),
            }),
          }),
        }),
      }),
    }),
  };

  beforeAll(async () => {
    const app = await createExpressApp({ withVite: false, adminClient: mockAdminClient });
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  describe('Decommissioned Unauthenticated Bypass Routes', () => {
    it('rejects unauthenticated /api/auth/set-password-and-activate with 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/api/auth/set-password-and-activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@target-company.com', password: 'HackedPassword123!' }),
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toMatch(/forbidden/i);
    });

    it('rejects unauthenticated /api/auth/instant-activate with 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/api/auth/instant-activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@target-company.com', password: 'HackedPassword123!' }),
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toMatch(/forbidden/i);
    });
  });

  describe('Tenant Workers Authorization (/api/tenant/workers)', () => {
    it('returns 401 Unauthorized when no Authorization header is provided', async () => {
      const res = await fetch(`${baseUrl}/api/tenant/workers?organizationId=org-a-id`);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toMatch(/Missing or invalid Authorization bearer token/i);
    });

    it('returns 401 Unauthorized when an invalid token is provided', async () => {
      const res = await fetch(`${baseUrl}/api/tenant/workers?organizationId=org-a-id`, {
        headers: { Authorization: 'Bearer invalid-token' },
      });
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toMatch(/Unauthorized/i);
    });

    it('returns 403 Forbidden when a non-admin authenticated user calls /api/tenant/workers', async () => {
      const res = await fetch(`${baseUrl}/api/tenant/workers?organizationId=org-a-id`, {
        headers: { Authorization: 'Bearer worker-token' },
      });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toMatch(/Administrator privileges required/i);
    });

    it('returns 403 Forbidden when an admin attempts to access another organization', async () => {
      const res = await fetch(`${baseUrl}/api/tenant/workers?organizationId=org-b-id`, {
        headers: { Authorization: 'Bearer admin-token' },
      });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toMatch(/Access denied to target tenant organization/i);
    });

    it('returns 200 OK when an authenticated tenant admin calls /api/tenant/workers for their organization', async () => {
      const res = await fetch(`${baseUrl}/api/tenant/workers?organizationId=org-a-id`, {
        headers: { Authorization: 'Bearer admin-token' },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.organization.name).toBe('Test Tenant Org');
    });
  });
});
