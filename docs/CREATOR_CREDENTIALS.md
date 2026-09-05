# Frostly Seafood Platform - Creator Credentials & Backend Architecture

This document specifies the Platform Creator (System Owner) credentials, security architecture, and backend storage implementation for Frostly.

---

## 1. Creator Login Credentials

| Attribute | Value | Description |
| :--- | :--- | :--- |
| **Email** | `creator@frostly.io` | Primary Platform Creator & Multi-Tenant Operator |
| **Password** | `FrostlyCreator2026!` | Backend hashed password (bcrypt via PostgreSQL `pgcrypto`) |
| **Role** | `Platform Creator / Owner` | Global governance role (outside single-tenant isolation) |
| **Auth Provider** | Supabase Auth (`auth.users`) | Cryptographic session tokens and JWT signing |
| **Backend Storage** | `auth.users` & `public.platform_admins` | **Strictly stored at the database backend** |

*(Note: In local development, the login screen includes a quick-login button for testing this account instantly).*

---

## 2. Backend Storage Implementation

Credentials and platform privileges are **strictly stored and verified at the database backend**, never hardcoded on the client:

### A. Identity & Cryptographic Password Hash (`auth.users`)
The account identity and password hash are stored in the PostgreSQL backend schema:
- **Table**: `auth.users`
- **Password Hashing**: Blowfish bcrypt salt (`crypt('FrostlyCreator2026!', gen_salt('bf', 10))`)
- **Metadata**:
  ```json
  {
    "role": "platform_creator",
    "platform_owner": true
  }
  ```

### B. Creator Authorization & Access Control (`public.platform_admins`)
Platform governance privileges are anchored by the immutable table defined in `supabase/migrations/014_platform_admin_console.sql` and bootstrapped in `supabase/migrations/015_creator_bootstrap.sql`:
- **Table**: `public.platform_admins`
- **Schema**:
  ```sql
  CREATE TABLE public.platform_admins (
      user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_by UUID REFERENCES auth.users(id),
      notes TEXT
  );
  ```
- **RLS Guard**:
  - **Zero INSERT/UPDATE/DELETE policies for `anon` or `authenticated` roles**.
  - No client-side user can self-promote to platform admin. Only direct database administration or `service_role` can modify `platform_admins`.

---

## 3. Backend Verification Function (`public.is_platform_admin`)

The database evaluates creator authorization on every privileged RPC using:

```sql
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.platform_admins 
    WHERE user_id = auth.uid()
  );
$$;
```

---

## 4. Zero Ambient Operational Access Principle

To protect tenant privacy, compliance, and HACCP cold-chain confidentiality:
- Platform Creators have **ZERO ambient SELECT/UPDATE permissions** on tenant operational data (`customers`, `inventory_batches`, `client_orders`, `financial_ledger_entries`).
- Platform Creators govern **platform metadata and billing** (subscription statuses, plan quotas, staff seat ceilings, and audit logs) without having visibility into sensitive commercial seafood trade data.

---

## 5. Backend Password Rotation or Creating Additional Creators

To rotate the password or bootstrap another creator directly on the backend database, run the `public.bootstrap_platform_creator` function in SQL:

```sql
SELECT public.bootstrap_platform_creator(
    'new_creator@frostly.io',
    'YourSecurePassword2026!',
    'Regional Operations Lead'
);
```
