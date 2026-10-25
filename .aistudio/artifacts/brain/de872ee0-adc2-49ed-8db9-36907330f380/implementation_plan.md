# Universal Product & Catch Image Visualization System

## Summary
Ensure every uploaded picture for products and inventory catch batches appears everywhere it is needed—including the Retail POS catalog & cart drawer, Wholesale orders & line items, customer B2B invoices & packing slips, verified traceability passports, and inventory ledger—accompanied by an interactive high-resolution lightbox modal with lot provenance and robust fallback resolution.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following product decisions were confirmed during the interactive interview:

- **Confirmed Decision 1: Omnipresent Image Coverage**: Product and lot pictures will appear everywhere across the application:
  1. **Retail POS Touch Grid**: Prominent photo cards with grade, cut, and inventory status.
  2. **POS Checkout Cart & Summary**: Clear thumbnail previews for every item in the cart drawer.
  3. **Wholesale Order Management (`OrdersView` & `NewOrderModal`)**: Visual item selection and line-item photo badges.
  4. **Customer Invoices (`InvoiceModal`)**: High-contrast, printable photo thumbnails on line items alongside traceability lots.
  5. **Digital Traceability Passports (`TraceabilityPassportModal`)**: Verified catch photograph displayed beside the digital QR passport.
  6. **Inventory Ledger & Lot Details**: Crisp photo previews on lot cards and details modals.
- **Confirmed Decision 2: High-Resolution Lightbox**: Clicking any product or batch image thumbnail opens a high-resolution preview modal with keyboard navigation (Escape), zoom, species taxonomy, cut grade, and traceability lot tags.
- **Confirmed Decision 3: Image Priority & Fallback Chain**:
  1. Product photo uploaded directly via `ProductModal` or catalog manager.
  2. If absent or broken, fallback automatically to the linked raw inventory batch catch photo (`batch.imageUrl`).
  3. If neither photo is provided, display an elegant, clean SVG seafood biological icon with subtle species color coding rather than a broken image frame.

---

## 1. Overview & Core Concept

### What It Delivers
A unified seafood visualization engine that guarantees zero lost pictures. When an operator, warehouse manager, or sales agent uploads a picture of a seafood cut or fresh catch lot, that image immediately propagates across POS touchscreens, cart drawers, B2B wholesale order queues, customer invoices, and GS1/GDST traceability passports.

### Target Personas
- **Dockside Intake & Vault Operators**: Uploading real catch photos during intake weighing.
- **Retail Cashiers & Counter Staff**: Rapidly identifying whole fish and saku cuts on the POS touchscreen with visual confidence.
- **Wholesale Sales Agents & Chefs**: Reviewing exact lot cuts, grades, and cold-chain compliance on orders and invoices.
- **Compliance Auditors**: Inspecting organoleptic quality and visual appearance in digital traceability passports.

---

## 2. User Experience & Visual Design

Following the **Universal Frontend Design Constitution** and **E-Commerce & Retail Guidelines**:

### Visual Identity & Layout
- **Image Cards & Aspect Ratios**:
  - POS Grid Cards: $4:3$ unified aspect ratio with `object-cover` and rounded-2xl geometry.
  - Cart & Table Rows: $1:1$ square micro-thumbnails (`w-11 h-11` or `w-12 h-12`) with subtle rounded-xl border frames.
  - Traceability Passport: $16:9$ or $4:3$ cinematic photograph hero block integrated with the certificate badge and QR verification.
- **Typography & Clean Metadata (Zero-Pill Discipline)**:
  - Product names in `Outfit` / `Plus Jakarta Sans` semi-bold.
  - Unboxed inline metadata: `Skinless Saku · Grade AAA · 250g Pack`.
  - Tabular numerals (`font-mono tabular-nums`) for prices, weights, and lot codes.
- **Color Distribution (60-30-10)**:
  - 60% clean slate/neutral canvas (`bg-[#f8f9fc]`).
  - 30% structural white card surfaces with subtle hairline borders (`border-slate-200/80`).
  - 10% purposeful accents: emerald for in-stock/HACCP pass, indigo for wholesale/traceability, rose for temperature/stock alerts.
- **Interactive Lightbox Experience**:
  - Smooth backdrop dimming (`bg-slate-950/85 backdrop-blur-md`).
  - Clean close button with escape key binding and outside click dismissal.
  - Displays high-resolution picture, product/lot title, scientific name, cut type, landing port, and QR traceability code.

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Shared Image Resolver Helper
- **Approach**: Build a centralized utility function `resolveProductImage(product, linkedBatch)` that standardizes the priority order: `product.imageUrl` $\to$ `batch.imageUrl` $\to$ default species artwork.
- **Why**: Eliminates scattered ternary conditions across 10+ components, ensuring uniform fallback behavior and broken-link error handling throughout the application.

### Decision 2: Zero Broken Image Policy
- **Approach**: Implement an `<ImageWithFallback />` component that listens to `onError` events and smoothly switches to the batch image or a stylized SVG fallback icon without layout shift.
- **Why**: Avoids ugly browser-default broken image icons if an external image link expires or fails to load.

---

## 4. Technical Architecture & Data Strategy

### System Component Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Product & Lot Image Hub                         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
           ┌────────────────────────┴────────────────────────┐
           ▼                                                 ▼
┌─────────────────────────────┐           ┌─────────────────────────────┐
│ ProductModal / BatchUpload  │           │  resolveProductImage Helper │
│ (Base64 / Supabase Storage) │           │ (Product -> Batch -> SVG)   │
└──────────────┬──────────────┘           └──────────────┬──────────────┘
               │                                         │
               ├─────────────────────────────────────────┼────────────────────────────────────────┐
               ▼                                         ▼                                        ▼
    ┌──────────────────────┐                  ┌──────────────────────┐                 ┌──────────────────────┐
    │  Retail POS & Cart   │                  │  Wholesale Orders &  │                 │ Invoice & Passports  │
    │  - POS Grid Cards    │                  │  - Order Line Items  │                 │ - Invoice Line Items │
    │  - Cart Drawer Items │                  │  - NewOrder Modal    │                 │ - Passport Hero Card │
    │  - Receipt Preview   │                  │  - OrdersView List   │                 │ - Lot Details Modal  │
    └──────────┬───────────┘                  └──────────┬───────────┘                 └──────────┬───────────┘
               │                                         │                                        │
               └─────────────────────────────────────────┼────────────────────────────────────────┘
                                                         ▼
                                          ┌─────────────────────────────┐
                                          │   High-Res Image Lightbox   │
                                          │   (Zoom, Traceability, Lot) │
                                          └─────────────────────────────┘
```

### Affected Files & Scope
1. **Utility & Resolver**:
   - Create `src/utils/productImageResolver.ts` with `resolveProductImage` and unified image URL verification.
   - Create `src/components/Common/ImageLightboxModal.tsx` for full-resolution interactive previews.
2. **Retail & POS (`src/components/RetailWholesaleView.tsx`)**:
   - Update POS grid cards to use `resolveProductImage` with click-to-enlarge.
   - Add product image thumbnails to the POS shopping cart drawer items.
   - Update Wholesale catalog table and mobile view.
3. **Wholesale Orders (`src/components/OrdersView.tsx` & `src/components/Modals/NewOrderModal.tsx`)**:
   - Add product/batch image thumbnails to line items in order cards.
   - Display image previews in the item selection picker when creating orders.
4. **Customer Invoice (`src/components/Modals/InvoiceModal.tsx`)**:
   - Add a clean, print-friendly thumbnail column to the line-items table.
5. **Traceability Passport (`src/components/Modals/TraceabilityPassportModal.tsx`)**:
   - Embed the product cut and raw catch intake photograph in the passport card.
6. **Lot Details (`src/components/Inventory/LotDetailsModal.tsx`)**:
   - Provide an explicit interactive photo thumbnail with click-to-enlarge.
