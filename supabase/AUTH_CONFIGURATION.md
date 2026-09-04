# Supabase Auth Configuration & Multi-Tenant Onboarding Guide

## Overview

Frostly Cold-Chain Platform uses multi-tenant Row-Level Security (RLS) backed by Supabase Auth (`auth.uid()`) and PostgreSQL tables (`public.organizations`, `public.staff_profiles`, and `public.invites`).

The application features compound onboarding flows:
1. **New Tenant Org Creation** (`signUpAndCreateOrganization`): Creates an `auth.users` identity and immediately executes the PostgreSQL RPC `create_organization_and_admin` to atomically initialize the tenant namespace and grant the caller `admin` permissions.
2. **Staff Invite Acceptance** (`signUpAndAcceptInvite`): Creates an `auth.users` identity and immediately executes the PostgreSQL RPC `accept_invite` to atomically validate the token, bind the user to the organization, and stamp their assigned role.

---

## The Critical Auth Setting: "Confirm email"

Both compound flows execute two steps in sequence:
1. `supabase.auth.signUp(...)`
2. `supabase.rpc('create_organization_and_admin', ...)` OR `supabase.rpc('accept_invite', ...)`

Step 2 is a database function that requires an authenticated caller (`auth.uid() IS NOT NULL`). Whether Step 1 returns an active session with a valid JWT token depends entirely on the **"Confirm email"** toggle in the Supabase Dashboard.

### Mode A: Instant Zero-Friction Onboarding (Recommended for Private / Enterprise Deployments)

* **Supabase Setting**: **`Confirm email` = DISABLED (Unchecked)**
* **Location in Dashboard**: `Authentication` -> `Providers` -> `Email` -> Uncheck **"Confirm email"** -> Click **Save**.
* **Behavior**:
  - `supabase.auth.signUp()` immediately issues a valid JWT access token and returns an active `session`.
  - The client passes this JWT token in the `Authorization: Bearer <token>` header to the database RPC.
  - PostgreSQL evaluates `auth.uid()` successfully, provisions the organization / staff profile, and signs the user into their tenant dashboard in a single click.

### Mode B: Email Verification Required (Default for Public Self-Serve Supabase Projects)

* **Supabase Setting**: **`Confirm email` = ENABLED (Checked)**
* **Behavior**:
  - `supabase.auth.signUp()` registers the user in `auth.users`, but returns `session: null`.
  - No JWT access token exists yet; an activation link is dispatched to the user's email address.
  - The application detects `session: null` and displays a clear guidance message informing the user to check their email and confirm their account.
  - **Two-Step Onboarding Flow**:
    1. User submits the registration form.
    2. User clicks the verification link in their email inbox.
    3. User signs in with their email and password.
    4. Once signed in, the user completes organization creation or token acceptance via the authenticated session.

---

## Summary Checklist for Project Administrators

| Supabase Setting | Recommended Value | Impact on Frostly Onboarding |
| --- | --- | --- |
| **Enable Email Signup** | `Enabled` | Allows new tenant admins and invited staff to sign up |
| **Confirm email** | `Disabled` (Internal / Demo) / `Enabled` (Public) | When disabled, enables 1-click compound tenant registration; when enabled, requires inbox link confirmation first |
| **Secure email change** | `Enabled` | Security best practice for email updates |
| **Minimum password length** | `8+ characters` | Enforces strong credential standards |

---

## Troubleshooting

### Error: "Authentication required. Please sign in first."
- **Root Cause**: The user attempted to call `create_organization_and_admin` or `accept_invite` without an active Supabase JWT session (most commonly caused by "Confirm email" being enabled while attempting instant registration).
- **Resolution**: Verify your email via the confirmation link, or disable "Confirm email" under `Authentication -> Providers -> Email` in the Supabase project dashboard.
