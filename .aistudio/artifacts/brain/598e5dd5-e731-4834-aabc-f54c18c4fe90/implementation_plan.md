# Amansocean Workspace Authentication & Tenant Routing Fix

Establish direct, authoritative routing for Amansocean credentials to the Amansocean Seafoods and Coldstore tenant workspace, eliminate accidental fallbacks to the generic Frostly demo workspace (`org-frostly-hq`), and ensure registered multi-tenant users route directly to their respective workspaces.

## User Review & Critical Decisions

> [!IMPORTANT]
> Based on your confirmed preferences in Phase 1:
> - **Input Flow**: You are typing email and password directly into the login form.
> - **Primary Routing**: Amansocean credentials will route directly into the Amansocean Seafoods tenant workspace (`35a94c6e-e230-4b7c-8404-a4f0ae06b798`), while registered accounts from other organizations will route cleanly to their respective individual workspaces.
> - **Preview & Offline Behavior**: Default preview/offline sessions will map to Amansocean Seafoods instead of the generic Frostly demo account ("Captain Alex Mercer").

- **Confirmed Decision 1**: Offline & preview sessions will default to **Amansocean Seafoods and Coldstore** (`35a94c6e-e230-4b7c-8404-a4f0ae06b798`) rather than `org-frostly-hq`.
- **Confirmed Decision 2**: Registered credentials with existing tenant assignments in Supabase or local storage will preserve their distinct tenant workspace (`organization_id`), ensuring multi-tenant isolation.
- **Confirmed Decision 3**: Quick login and dev credentials helpers on the login screen will be updated to feature verified Amansocean staff credentials.

---

## 1. Overview & Core Concept

- **What It Does**: Resolves the login dispatch logic in `auth.ts`, `server.ts`, and `AuthGateScreen.tsx` so that logging in with Amansocean credentials (such as `@amansocean.com` or primary tenant admins) lands immediately in the full **Amansocean Seafoods and Coldstore** operations environment with full access to the product catalog, POS registers, inventory ledger, and orders.
- **Target Audience / Persona**: Amansocean cold-chain operators, inventory managers, cashiers, and third-party enterprise tenants logging in through the portal.
- **Key Value**: Prevents operators from being stranded in an empty demo account or locked out behind sentinel fallback checks.

---

## 2. User Experience & Visual Design

### User Flows
1. **Amansocean Operator Sign-In**:
   - Operator enters `kwesi@amansocean.com` (or any verified Amansocean email) and password.
   - System authenticates credentials and assigns active tenant `35a94c6e-e230-4b7c-8404-a4f0ae06b798` ("Amansocean Seafoods and Coldstore").
   - Dashboard loads with Amansocean catalog, inventory batches, POS register data, and customer ledgers without demo placeholders.
2. **Third-Party Registered Tenant Sign-In**:
   - Tenant administrator enters their registered organizational email.
   - System queries `staff_profiles` and resolves their specific `organization_id`.
   - Dashboard loads their isolated organizational workspace.
3. **Offline / Preview Fallback**:
   - In environments where live Supabase credentials are absent or during connectivity drops, signing in without an explicit third-party tenant defaults to the Amansocean workspace instead of the legacy Frostly Demo ("Captain Alex Mercer").

### Visual Refinements
- Update sign-in modal helper card on `AuthGateScreen.tsx` to display Amansocean credentials alongside Platform Creator.
- Ensure workspace badge in the application header displays **Amansocean Seafoods and Coldstore** with active enterprise status.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Tenant Resolution Order in `auth.ts`**
  - *Chosen Approach*: Check authenticated user profile -> if profile has an assigned `organization_id` that is not a demo sentinel, use it; if user email matches an Amansocean domain (`*@amansocean.com` or storefront admin) or lacks a profile in preview mode, resolve directly to `35a94c6e-e230-4b7c-8404-a4f0ae06b798` ("Amansocean Seafoods and Coldstore").
  - *Why*: Eliminates the hardcoded fallback to `org-frostly-hq` that caused Amansocean staff to end up in demo mode.
  - *Alternatives Considered*: Forcing every user through an onboarding wizard was rejected because Amansocean is already an established organization with seed data.

- **Decision 2: App.tsx Sentinel Guard Alignment**
  - *Chosen Approach*: Retain `00000000-0000-0000-0000-000000000001` and `org-frostly-hq` as sentinel flags for truly unconfigured states, but guarantee Amansocean (`35a94c6e-e230-4b7c-8404-a4f0ae06b798`) is recognized as a valid active tenant (`isTenantUser = true`, `activeOrgId = '35a94c6e-e230-4b7c-8404-a4f0ae06b798'`).
  - *Why*: Unlocks all operational tabs (Inventory, POS, HACCP, Fleet, Orders) immediately upon login.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────┐
│                   Sign-In Form                         │
│       Email: *.[@amansocean.com / tenant email]        │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
             Is Supabase Configured & Online?
              ├── YES ──► Supabase Auth & staff_profiles Query
              │             ├── Found profile with org_id ─► Load Assigned Tenant Workspace
              │             └── No profile / Amans domain ─► Auto-link Amansocean Org ID:
              │                                               35a94c6e-e230-4b7c-8404-a4f0ae06b798
              │
              └── NO  ──► Local / Offline Auth Handler
                            ├── Stored Tenant in localStorage ─► Load Stored Tenant
                            └── Default / Amansocean Login    ─► Amansocean Seafoods Workspace
                                                                  (35a94c6e-e230-4b7c-8404-a4f0ae06b798)
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│                App.tsx / AuthGate                      │
│   activeOrgId = 35a94c6e-e230-4b7c-8404-a4f0ae06b798   │
│   isTenantUser = true (Full Access to Amansocean ERP)  │
└────────────────────────────────────────────────────────┘
```

### Affected Components & Implementation Steps

1. **`src/data/auth.ts`**:
   - In `signIn()`: Update offline fallback when `!isSupabaseConfigured` to use Amansocean organization ID `35a94c6e-e230-4b7c-8404-a4f0ae06b798` and organization name `'Amansocean Seafoods and Coldstore'` rather than `'org-frostly-hq'`.
   - In `getStaffProfile()`: If user email ends in `@amansocean.com` or matches Amansocean admin, or if `profileData` has no org, bind to `35a94c6e-e230-4b7c-8404-a4f0ae06b798` with name `'Amansocean Seafoods and Coldstore'`.
   - Update `DEFAULT_TEST_USER_EMAIL` default fallback from `admin@frostly.io` to `admin@amansocean.com`.

2. **`server.ts`**:
   - In `/api/auth/register-tenant` and `/api/auth/session`, ensure user profile lookup checks for Amansocean organization matching and returns proper tenant metadata.

3. **`src/components/AuthGateScreen.tsx`**:
   - Update test and dev auto-fill credentials to use Amansocean staff accounts (`kwesi@amansocean.com` / `admin@amansocean.com`).

4. **Verification**:
   - Run `compile_applet` and test suite (`npm test`) to verify all 16 test files pass without regression.
