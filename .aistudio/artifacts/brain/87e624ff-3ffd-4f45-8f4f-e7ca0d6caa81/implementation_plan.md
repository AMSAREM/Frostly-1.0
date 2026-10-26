# Implementation Plan: Enforce Real Authentication, Restore Amansocean Workspace Access, and Purge Demo Elements

## 1. Executive Summary & Clarification Decisions
Based on your confirmation:
- **Authentication Enforcement**: Eliminate synthetic offline session creation. Every login must authenticate against live Supabase Auth (`supabase.auth.signInWithPassword`). Invalid emails or passwords must be rejected with legitimate auth error messages.
- **Amansocean Workspace Access**: Directly link `amoakoemmanuel2020@gmail.com` and all `@amansocean.com` staff accounts to the Amansocean Seafoods workspace (`35a94c6e-e230-4b7c-8404-a4f0ae06b798`), with full `admin` role, bypassing empty onboarding screens and granting immediate access to coldstore batches, orders, ledger, and GH₵ pricelist.
- **Demo Purge**: Remove all "Explore Demo Mode", "Dev Quick Login", test credentials auto-fillers, and sample mock data fallbacks (such as Alaskan Cod / USD Pacific Tuna demo states) so the system exclusively operates on real tenant database records.

---

## 2. Key Root Causes Identified
1. **Any Password Login**: `src/data/auth.ts` contained an offline bypass (`if (!isSupabaseConfigured)`) that fabricated dummy sessions and users locally when Supabase was unreachable or credentials failed, allowing arbitrary credentials to sign in.
2. **Amansocean Lockout**: `isAmansoceanEmail()` in `src/data/auth.ts` only matched `@amansocean.com`, `@amansocean.store`, and short test prefixes (`admin@`, `kwesi@`, `anna@`). The owner's primary email (`amoakoemmanuel2020@gmail.com`) was not recognized, causing `getStaffProfile` to mark the account as unprovisioned (`resolvedOrgId = ''`) and trap the user on an onboarding / setup screen.
3. **Demo UI & Data Spillover**:
   - `AuthGateScreen.tsx` and `AuthGate.tsx` exposed "Explore Demo Mode (Instant Access)" and dev auto-login buttons calling `signInAsTestUser()`.
   - `AuthModal.tsx` contained dev account buttons and quick-fill test credentials.
   - `LandingHero.tsx` contained "Explore Live Demo" CTA.
   - `App.tsx` fell back to `INITIAL_BATCHES`, `INITIAL_ORDERS`, `INITIAL_CUSTOMERS` (`mockData.ts`) whenever an organization wasn't resolved, masking live database states with fictitious American seafood mockups.

---

## 3. Architecture & Target Implementation

```
[User Login Request]
        │
        ▼
[supabase.auth.signInWithPassword] ──(Invalid Credentials)──► [Real Auth Error Message]
        │
        ▼ (Valid Supabase Auth)
[getStaffProfile(auth.user)]
        │
        ├── Email is 'amoakoemmanuel2020@gmail.com' OR ends with '@amansocean.com'
        │       │
        │       ▼
        │   Resolve Org: 35a94c6e-e230-4b7c-8404-a4f0ae06b798 (Amansocean Seafoods)
        │   Role: 'admin'
        │   Bypass onboarding (needs_onboarding: false)
        │   Sync profile to live staff_profiles database
        │
        └── Other Verified Tenants: Resolve against organization_members & staff_profiles
        │
        ▼
[App State & Repository Provider]
        │
        ▼
[Live Coldstore Repositories: Batches, Invoices, POS, Products]
(No mock data fallbacks; pure live data with real empty states)
```

---

## 4. File-by-File Changes

### A. `src/data/auth.ts`
1. **Remove Fake / Offline Session Fallback**:
   - In `signIn(email, password)`: Remove the fallback block that created synthetic tokens and mock users. If `supabase.auth.signInWithPassword` returns an error or is unconfigured, return the actual authentication error.
   - Remove `signInAsTestUser()` or convert it to strictly return an authentication required error.
2. **Update Amansocean Domain & Email Resolution**:
   - Update `isAmansoceanEmail(email)`: Explicitly include `amoakoemmanuel2020@gmail.com`, `*@amansocean.com`, `*@amansocean.store`, and known staff aliases.
   - Update `getStaffProfile(user)`:
     - When user email matches `isAmansoceanEmail` or `amoakoemmanuel2020@gmail.com`, guarantee resolution to:
       - `organization_id: '35a94c6e-e230-4b7c-8404-a4f0ae06b798'`
       - `organization_name: 'Amansocean Seafoods and Coldstore'`
       - `role: 'admin'`
       - `needs_onboarding: false`
     - Persist/upsert this link to `staff_profiles` in Supabase so row-level security (RLS) policies permit reading all Amansocean coldstore records.
3. **Clean Up Helper Functions**:
   - Remove mock session persistence in `localStorage` that fabricated bypass logins.

### B. `src/components/AuthGateScreen.tsx`
1. **Remove Instant Demo Button**: Delete `auth-gate-instant-demo-btn` ("Explore Demo Mode (Instant Access)").
2. **Remove Dev Quick Logins**: Delete `handleDevQuickLogin` and `handleCreatorQuickLogin` and their corresponding UI cards.
3. **Streamline Auth Gate**: Present only the secure, production-grade login form with email, password, and error reporting.

### C. `src/components/AuthModal.tsx`
1. **Remove Demo Credential Buttons**: Delete `fill-demo-creds-button` and the "Development Staff Account" auto-login card.
2. **Ensure Clean Credentials Form**: Retain only the real authentication inputs for staff and administrators.

### D. `src/components/LandingPage/` & `src/components/AuthGate.tsx`
1. **Remove "Explore Demo" CTAs**:
   - In `LandingHero.tsx` & `LandingPage/index.tsx`: Replace "Explore Live Demo" with "Sign In to Workspace" or "Access Portal" directing to the real authentication gate.
   - In `AuthGate.tsx`: Remove `onExploreDemo` handler which previously executed synthetic logins.

### E. `src/App.tsx` & Data Fallbacks
1. **Purge Mock Data Initial State**:
   - Replace fallback state initializers (`INITIAL_BATCHES`, `INITIAL_ORDERS`, `INITIAL_CUSTOMERS`, `INITIAL_PRODUCTS`) with empty arrays `[]` when waiting for or fetching database records.
   - For Amansocean, ensure the official catalog (`027_amansocean_official_pricelist.sql` / `amansoceanProducts.ts`) and live coldstore batches load directly via the repository layer (`supabaseBatchRepository`, `supabaseOrderRepository`, etc.).

---

## 5. Verification & Testing Strategy
1. **Compile & Lint Verification**:
   - Run `compile_applet` and `lint_applet` to ensure zero TypeScript errors or missing imports.
2. **Authentication Hardening Verification**:
   - Test sign-in with dummy/fake credentials (e.g. `fake@user.com` / `randompassword`) -> Verify that login is strictly blocked with "Invalid login credentials".
   - Test sign-in with `amoakoemmanuel2020@gmail.com` -> Verify that the account resolves to `Amansocean Seafoods and Coldstore` (`35a94c6e-e230-4b7c-8404-a4f0ae06b798`), `admin` role, and loads Amansocean inventory and orders without onboarding prompts.
3. **UI Cleanliness Verification**:
   - Inspect AuthGateScreen, AuthModal, and Landing Hero to confirm no "Demo Mode", "Dev Quick Login", or test accounts are visible.
