# Implementation Plan: Universal Product Image Display & Security Hardening

## Overview
This plan addresses two critical goals:
1. **Universal Product Image Rendering**: Ensure product and batch images uploaded via ERP or the catalog display consistently and reliably everywhere they are referenced—including POS catalog and cart, customer-facing POS display, inventory cards and tables, batch detail inspections, digital traceability passports, wholesale order lines, storefront cart drawer, and order tracking. All image elements include resilient `onError` fallbacks to styled species badges.
2. **Security Audit Hardening**: Apply verified enterprise security patches to `server.ts`, `src/data/auth.ts`, and Supabase webhook edge functions to eliminate unauthenticated routes, prevent webhook forgery, enforce rate limiting and security headers (`helmet`), and restrict test credentials to development environments.

---

## User Review Required

> [!IMPORTANT]
> **Key Architectural Decisions**:
> 1. **Image Fallback Strategy**: Any broken or missing product/lot image gracefully falls back to a category-specific cold-chain badge displaying the species icon and cut name, avoiding broken image icons or layout shifting.
> 2. **Linked Product & Batch Image Resolution**: If a batch has no direct photo uploaded, it automatically checks the linked product's `imageUrl` before displaying the fallback badge, maximizing visual coverage.
> 3. **Security Scope**: Installs `helmet` and `express-rate-limit`, secures `/api/smtp/*` and `/api/feedback` to creator-only, enforces server-side confirmation URL building, hardens platform creator role checks against client-side metadata tampering, and enforces cryptographic signature verification on Stripe and Paystack webhooks.

---

## Proposed Changes

### Component 1: Universal Product & Batch Image Display

#### [src/types.ts]
- Update `RetailSaleItem` to include `imageUrl?: string` so line items across POS carts, customer displays, and receipts preserve the product image.
- Update `OrderLineItem` to include `imageUrl?: string` for wholesale contracts and packing dock stations.

#### [src/components/RetailWholesaleView.tsx]
- **POS Product Grid**: Ensure uploaded `imageUrl` renders with resilient `onError` fallback to category badge.
- **POS Cart & Receipt**: Add product image thumbnail (`w-10 h-10 rounded-xl`) to each cart row so cashiers have immediate visual confirmation of weighed cuts. Include images in completed receipt modals.
- **Price Matrix Tab**: Display image thumbnail alongside SKU, cut type, and price tiers.
- **Storefront Queue Tab**: Display line item thumbnails in the order fulfillment drawer.

#### [src/components/PosCustomerView.tsx]
- In customer-facing live register session, ensure cart item rows render product images using `ImageWithFallback`.

#### [src/components/InventoryLedgerView.tsx] & [src/components/Inventory/LotDetailsModal.tsx]
- Expand `getBatchUserImage` to resolve both `batch.imageUrl` and linked product `imageUrl`.
- Add `onError` state handling to batch cards and table rows so broken links fail gracefully to an upload prompt / category icon.
- In `LotDetailsModal.tsx`, wrap the header image in an error-safe image component.

#### [src/components/Modals/TraceabilityPassportModal.tsx]
- Display the batch / product high-res photo banner alongside the QR code, landing port, and vessel provenance.

#### [src/components/OrdersView.tsx] & [src/components/Modals/NewOrderModal.tsx]
- In `OrdersView.tsx`, render product/batch image thumbnails for each allocated seafood line item.
- In `NewOrderModal.tsx`, display the lot image thumbnail in the item selector dropdown and line items.

#### [src/components/LandingPage/CartDrawer.tsx] & [src/components/LandingPage/OrderTrackingModal.tsx]
- Add `onError` fallbacks for cart items in `CartDrawer.tsx`.
- Include product thumbnail images in `OrderTrackingModal.tsx` line item breakdown.

---

### Component 2: Security Hardening & Vulnerability Remediation

#### [package.json]
- Install `helmet` and `express-rate-limit`.

#### [server.ts]
- Disable `x-powered-by` and enable `helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false })`.
- Apply conservative body limits: 12MB dedicated for `/api/erp/upload-image`, 2MB for general routes.
- Add `express-rate-limit` to abuse-prone routes:
  - 30 requests / 15 min for `/api/smtp/*`, `/api/auth/*`, `/api/feedback`, and `/api/storefront/newsletter`.
  - 120 requests / 15 min for `/api/storefront/orders` and `/api/storefront/analytics`.
- Protect `/api/smtp/config`, `/api/smtp/test`, and GET `/api/feedback` with `creatorOnly` middleware.
- In `/api/smtp/send-confirmation`, ignore client-supplied URLs and build the confirmation link server-side using `APP_PUBLIC_URL` or verified origin.
- Protect uploaded files by setting `X-Content-Type-Options: nosniff` and `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox` on file-serving routes.
- Harden `requirePlatformCreator`: check `platform_admins` table or server-set `app_metadata.role`, removing trust in client-editable `user_metadata.role`. Require `email_confirmed_at` for env-email match.

#### [src/data/auth.ts]
- Guard `DEFAULT_TEST_USER_EMAIL` and `DEFAULT_TEST_USER_PASSWORD` fallback values so they only activate when `isDev` is true.

#### [supabase/functions/stripe-webhook/index.ts]
- Import Stripe SDK with SubtleCrypto provider and verify `stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret, undefined, Stripe.createSubtleCryptoProvider())`. Reject forged requests with 400.

#### [supabase/functions/paystack-webhook/index.ts]
- Fail closed: return 500 immediately if `PAYSTACK_SECRET_KEY` is not configured. Verify HMAC SHA-512 signature before parsing the body.

---

## Verification Plan

### Automated Tests
1. Run existing test suite (`npm test`) to ensure all 151+ tests pass.
2. Add security unit tests verifying:
   - Rate limiting headers are set on public endpoints.
   - Creator-only routes return 401/403 for unauthenticated or non-creator requests.
   - Default test credentials evaluate to empty strings in production mode (`isDev = false`).
3. Run `npm run lint` and `compile_applet` to verify zero TypeScript errors.

### Manual Verification
1. **POS Grid & Cart**: Add products to cart in Retail POS; verify thumbnails appear in product cards, cart list, and completed receipts.
2. **Customer Display**: Pair customer display and verify cart items reflect uploaded product images with fallback badges.
3. **Inventory & Passports**: Inspect lot cards and table rows; test upload photo; open Traceability Passport modal to verify high-res photo banner displays.
4. **Security Verification**: Test `/api/smtp/config` and `/api/feedback` without authorization headers to confirm 401/403 response; verify security headers (`X-Content-Type-Options: nosniff`).
