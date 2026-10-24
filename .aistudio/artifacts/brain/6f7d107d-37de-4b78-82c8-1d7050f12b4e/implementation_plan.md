# Amans Ocean Official Seafood Price List & Supabase Admin Sync

Replace placeholder demo items with the official 32-SKU Amans Ocean price list in Ghana Cedis (`GH₵`), persist all products and linked cold-storage lots directly in Supabase, and expose live product and pricing controls across the Admin Product Catalog, POS, Customer View, and Public Storefront.

## User Review & Critical Decisions

> [!IMPORTANT]
> All four catalog and pricing rules have been confirmed and will govern the database synchronization and user interface updates below.

- **Confirmed Decision 1 — Replace Legacy Demo Catalog**: Deactivate the 8 placeholder USD demo items (such as fries, onion rings, sorbet, and gelato) in Supabase while preserving historical foreign-key integrity, making the official Amans Ocean seafood list the active catalog.
- **Confirmed Decision 2 — Split Fish & Shrimp Powder Ranges**: Represent *Fish Powder (Ghc 50 – 100)* and *Shrimp Powder (Ghc 50 – 100)* as two distinct pack sizes each — **Regular Pack (`GH₵ 50.00`)** and **Large Pack (`GH₵ 100.00`)** — expanding the 30 flyer rows into 32 concrete, orderable SKUs.
- **Confirmed Decision 3 — Printed Kilo Rates & Bulk Tiers**: Set **Peeled Shrimps** (`GH₵ 220/kg` retail · `GH₵ 200/kg` wholesale at 10 kg+ MOQ) and **Squid** (`GH₵ 150/kg` retail · `GH₵ 130/kg` wholesale at 10 kg+ MOQ) to their exact printed bulk tiers, and initialize all other wholesale prices to match the printed kilo/pack rate (5 kg MOQ) so admins can adjust negotiated B2B pricing anytime.
- **Confirmed Decision 4 — Full Omnichannel `GH₵` Rollout**: Synchronize the Ghana Cedi (`GH₵`) catalog and pricing across Supabase, Admin Product Catalog & Pricing (both Tenant Workspace Admin and Platform Admin Console), Retail & Wholesale POS, POS Customer View, and the Public Storefront.

---

## 1. Overview & Core Concept

- **What It Does**: Establishes a single authoritative Supabase-backed product catalog containing every seafood item and Ghana Cedi price from the official Amans Ocean flyer, complete with inline admin price editing, one-click Supabase catalog synchronization, an embedded flyer preview, and live reflection across counter POS and online ordering.
- **Target Audience / Persona**:
  - **Amans Ocean Administrators & Managers** managing daily retail counter prices, negotiated wholesale rates, and cold-room stock from the ERP Product Catalog and Platform Admin views.
  - **POS Cashiers** ringing up per-kilo seafood cuts and seasoned powders in `GH₵`.
  - **Retail & Wholesale Buyers** browsing live `GH₵` per-kilo and 10 kg+ bulk rates on the Counter Customer View and Public Storefront.
- **Key Value**: Eliminates placeholder USD sample items and ensures every channel reads and writes the real Amans Ocean Kumasi coldstore catalog (`Akoko Specs Station off Abrepo, Barekese Road` · `0247293446`) directly in Supabase.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Automatic & On-Demand Supabase Sync**: When the workspace or storefront loads, the backend verifies that all 32 official Amans Ocean products (and linked cold-storage lots) exist in Supabase and deactivates legacy demo rows without overwriting subsequent admin price edits. Admins can also click **Sync Official Price List** at any time to reconcile or restore missing official SKUs in Supabase.
  2. **Admin Side — Amans Product Catalog & Pricing**:
     - In **Retail & Wholesale Hub → Product Catalog & Pricing** (for Amans Ocean staff/admins) and in a dedicated **Amans Products** tab inside the **Platform Console** (for the platform owner account), admins view all 32 products with instant search, seafood group filtering, inline `GH₵` Retail & Wholesale price editing, full product modal editing, and a **View Official Price List PDF** drawer/modal displaying the uploaded flyer.
  3. **POS, Customer View & Storefront Ordering**:
     - Cashiers, counter kiosk shoppers, and online storefront visitors browse the 32 items grouped into natural seafood categories (*Whole & Cut Fish*, *Fillets & Chunks*, *Shrimps, Prawns & Lobster*, *Octopus, Squid & Shellfish*, and *Seasoned Powders*), with `GH₵` formatting and automatic 10 kg+ wholesale tier visibility on Peeled Shrimps and Squid.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Clean utilitarian cold-chain operations console on the Admin/POS side paired with crisp, appetizing seafood retail merchandising on the Storefront and Customer View.
  - *Color Palette & Mood*: Disciplined 60-30-10 balance — crisp white and cool slate (`#F8FAFC` / `#FFFFFF`) canvas across Admin data views with deep slate (`#0F172A`) primary typography and emerald/indigo semantic action accents; warm coastal ivory (`#FBF3E4`), deep navy (`#0F172A`), and ocean gold/crimson accents on the Amans Ocean Storefront.
  - *Typography & Hierarchy*: Structured geometric sans headings (`Plus Jakarta Sans` / `DM Sans`) paired with strict tabular monospace figures (`tabular-nums`) across all `GH₵` prices, per-kilo weights, MOQ thresholds, and margin columns so decimal points align vertically without jitter.
  - *Component Styling & Layout*:
    - High-density admin data table ($40\text{px}$–$44\text{px}$ row rhythm, single-elevation `1px` hairline borders, zero nested card clutter, and responsive mobile cards on narrow screens).
    - Zero-pill static metadata discipline: SKU codes, cut types, origins, and MOQ notes render as quiet inline text separated by `·` rather than cluttered badge clusters, while category filter bars use clean single-line segmented buttons (`whitespace-nowrap shrink-0`).
    - Resilient product thumbnails with domain-authentic seafood illustration fallbacks so no card ever displays a broken image frame.

- **Interactive Feedback & Motion**:
  - Immediate ($\le 150\text{ms}$) inline input focus and optimistic UI state updates when saving edited `GH₵` retail/wholesale prices, followed by confirmed Supabase persistence toasts and error recovery banners if offline.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1 — Soft-Deactivating Legacy Demo Products Instead of Hard-Deleting**
  - *Chosen Approach*: Mark the 8 legacy USD demo rows `is_active = false` (and unavailable for retail/wholesale) in Supabase while filtering inactive rows out of all Admin, POS, Customer View, and Storefront queries.
  - *Why*: Guarantees historical receipts, order line items, and financial ledger entries referencing old demo IDs never suffer foreign-key violations while keeping the live catalog 100% clean.
  - *Alternatives Considered*: Hard `DELETE` on `retail_wholesale_products`, which risks PostgreSQL foreign-key errors if prior test transactions exist in `retail_sale_items`.

- **Decision 2 — Non-Destructive Idempotent Seeding + Explicit Admin Sync Endpoint**
  - *Chosen Approach*: Seed any missing official `ao-*` SKUs into Supabase automatically on catalog fetch without overwriting existing admin-edited `GH₵` prices, and provide an explicit authenticated admin action (**Sync Official Price List**) with an option to either add missing items or reset prices to the printed flyer rates.
  - *Why*: Ensures all 32 items appear immediately in Supabase on startup while respecting ongoing admin price negotiations.

- **Decision 3 — Surfacing Amans Product Management in Both Tenant Admin & Platform Console**
  - *Chosen Approach*: Upgrade **Retail & Wholesale Hub → Product Catalog & Pricing** and add a live **Amans Products** management view in **Platform Console** wired to the same Supabase `retail_wholesale_products` table for the Amans Ocean organization.
  - *Why*: Whether an administrator signs in via the Amans Ocean workspace account or the Platform Owner account, they can view, search, and update Amans Ocean products and Supabase prices from one unified source of truth.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                     OFFICIAL AMANS OCEAN CATALOG SOURCE                      │
│   32-SKU Ghana Cedi (GH₵) Master Definition + Attached Price List PDF Asset  │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                     BACKEND API & SUPABASE SYNC LAYER                        │
│  • Auto-Seed & Legacy Demo Deactivation (is_active = false on old USD rows)  │
│  • GET  /api/storefront/catalog          (Public Storefront GH₵ Catalog)     │
│  • GET  /api/pos/customer-catalog        (Dual Retail + Wholesale Catalog)   │
│  • GET  /api/erp/amansocean-products     (Admin Catalog & Lot Inspector)     │
│  • POST /api/erp/amansocean-products/sync (Idempotent Upsert / Price Reset)  │
│  • PATCH /api/erp/amansocean-products/:id (Direct Admin Price & Stock Save)  │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                         SUPABASE POSTGRESQL DATABASE                         │
│   organizations ──► species ──► retail_wholesale_products ──► inventory_batches
└──────────┬───────────────────────────┬───────────────────────────┬───────────┘
           │                           │                           │
           ▼                           ▼                           ▼
┌─────────────────────┐   ┌─────────────────────────┐   ┌──────────────────────┐
│   ADMIN INTERFACES  │   │   COUNTER POS & KIOSK   │   │  PUBLIC STOREFRONT   │
│ • ERP Product &     │   │ • Cashier POS Grid      │   │ • Category Filter    │
│   Price Matrix      │   │ • POS Customer View     │   │ • Product Grid (GH₵) │
│ • Platform Console  │   │   (Retail & 10kg+ Bulk) │   │ • Cart & Order Track │
│   Amans Products    │   │                         │   │ • Kumasi Contact Info│
│ • PDF Flyer Viewer  │   │                         │   │                      │
└─────────────────────┘   └─────────────────────────┘   └──────────────────────┘
```

- **Complete 32-SKU Amans Ocean Catalog Specification (`GH₵`)**:

| # | Product Name | Cut / Format | Storefront Group | Unit | Retail (`GH₵`) | Wholesale (`GH₵`) | Wholesale MOQ |
| :- | :--- | :--- | :--- | :--- | ---: | ---: | ---: |
| 1 | Red Fish | Whole Round Fish | Whole & Cut Fish | kg | 80.00 | 80.00 | 5 kg |
| 2 | Red Snapper | Whole Round Fish | Whole & Cut Fish | kg | 90.00 | 90.00 | 5 kg |
| 3 | Nile Perch | Whole Round Fish | Whole & Cut Fish | kg | 85.00 | 85.00 | 5 kg |
| 4 | Sea Breams | Whole Round Fish | Whole & Cut Fish | kg | 80.00 | 80.00 | 5 kg |
| 5 | Barracuda | Whole Round Fish | Whole & Cut Fish | kg | 80.00 | 80.00 | 5 kg |
| 6 | Sole Fish | Whole Round Fish | Whole & Cut Fish | kg | 80.00 | 80.00 | 5 kg |
| 7 | Grouper | Whole Round Fish | Whole & Cut Fish | kg | 150.00 | 150.00 | 5 kg |
| 8 | Butter Nose | Whole Round Fish | Whole & Cut Fish | kg | 65.00 | 65.00 | 5 kg |
| 9 | Butter Fish | Whole Round Fish | Whole & Cut Fish | kg | 60.00 | 60.00 | 5 kg |
| 10 | Butter Fish Fillet | Skin-On Loin / Fillet | Fillets & Chunks | kg | 150.00 | 150.00 | 5 kg |
| 11 | Zipper Fish | Whole Round Fish | Whole & Cut Fish | kg | 60.00 | 60.00 | 5 kg |
| 12 | Cassava Fish | Whole Round Fish | Whole & Cut Fish | kg | 100.00 | 100.00 | 5 kg |
| 13 | Cassava Fish Fillet | Skin-On Loin / Fillet | Fillets & Chunks | kg | 180.00 | 180.00 | 5 kg |
| 14 | Cassava Chunks (No Head) | Headless & Gutted (H&G) | Fillets & Chunks | kg | 180.00 | 180.00 | 5 kg |
| 15 | Tilapia | Whole Round Fish | Whole & Cut Fish | kg | 80.00 | 80.00 | 5 kg |
| 16 | Unpeeled Shrimps | IQF Flash Frozen Box | Shrimps, Prawns & Lobster | kg | 100.00 | 100.00 | 5 kg |
| 17 | Peeled Shrimps | IQF Flash Frozen Box | Shrimps, Prawns & Lobster | kg | 220.00 | 200.00 | 10 kg |
| 18 | Prawns (Jumbo) | IQF Flash Frozen Box | Shrimps, Prawns & Lobster | kg | 250.00 | 250.00 | 5 kg |
| 19 | Prawns (Medium) | IQF Flash Frozen Box | Shrimps, Prawns & Lobster | kg | 220.00 | 220.00 | 5 kg |
| 20 | Octopus | IQF Flash Frozen Box | Octopus, Squid & Shellfish | kg | 150.00 | 150.00 | 5 kg |
| 21 | Squid | IQF Flash Frozen Box | Octopus, Squid & Shellfish | kg | 150.00 | 130.00 | 10 kg |
| 22 | Sea Snails | IQF Flash Frozen Box | Octopus, Squid & Shellfish | kg | 40.00 | 40.00 | 5 kg |
| 23 | Sea Crabs | IQF Flash Frozen Box | Octopus, Squid & Shellfish | kg | 30.00 | 30.00 | 5 kg |
| 24 | Lobsters | IQF Flash Frozen Box | Shrimps, Prawns & Lobster | kg | 180.00 | 180.00 | 5 kg |
| 25 | Grouper Fillet | Skin-On Loin / Fillet | Fillets & Chunks | kg | 220.00 | 220.00 | 5 kg |
| 26 | Grouper Chunks (No Head) | Headless & Gutted (H&G) | Fillets & Chunks | kg | 150.00 | 150.00 | 5 kg |
| 27 | Fish Fillet (Any Other Fish) | Skin-On Loin / Fillet | Fillets & Chunks | kg | 150.00 | 150.00 | 5 kg |
| 28 | Doctor Fish | Whole Round Fish | Whole & Cut Fish | kg | 100.00 | 100.00 | 5 kg |
| 29 | Fish Powder (Regular Pack) | Packaged 500g Tray | Seasoned Powders | pack | 50.00 | 50.00 | 5 packs |
| 30 | Fish Powder (Large Pack) | IQF Flash Frozen Box | Seasoned Powders | pack | 100.00 | 100.00 | 5 packs |
| 31 | Shrimp Powder (Regular Pack) | Packaged 500g Tray | Seasoned Powders | pack | 50.00 | 50.00 | 5 packs |
| 32 | Shrimp Powder (Large Pack) | IQF Flash Frozen Box | Seasoned Powders | pack | 100.00 | 100.00 | 5 packs |

- **Data Model & State**:
  - **Supabase Tables**: `species` (taxonomy & storage zone defaults), `retail_wholesale_products` (SKU, `unit` as `'kg'` or `'pack'`, `retail_price_per_unit`, `wholesale_price_per_unit`, `wholesale_min_qty`, `cost_price_per_unit`, `stock_kg`, `is_active`), and `inventory_batches` (1:1 linked cold-storage lots for FEFO stock deduction).
  - **Repository Filtering**: Active product queries filter `is_active !== false` and exclude retired demo IDs so local caches and Supabase queries stay clean across sessions.
  - **Migration Reproducibility**: Include a SQL migration script under the database migrations folder that upserts the 32 Amans Ocean products and deactivates legacy demo rows for direct SQL execution as well.

- **Interactive Component & State Mapping**:
  - **Admin Product Catalog & Pricing (`Retail & Wholesale Hub`)**: Search input, category filter tabs, inline **Edit Prices** (`GH₵` Retail & Wholesale inputs + Save), **Add New Cut / SKU** modal, **Sync Official Price List** button (with loading spinner and success toast), and **View Price List PDF** modal embedding `/assets/aistudio/_Amansocean_pricelist_69e95296.pdf`.
  - **Platform Console → Amans Products Tab**: Loads live `retail_wholesale_products` for the primary Amans Ocean organization from Supabase, lets platform admins search/filter, edit Retail/Wholesale `GH₵` prices and stock, create new products, or trigger a full Supabase price-list sync.
  - **Storefront & POS Customer View**: Dynamically renders the new seafood categories, `GH₵` currency formatting, bulk pricing callouts (`GH₵ 200/kg for 10kg+` on Peeled Shrimps, `GH₵ 130/kg for 10kg+` on Squid, and 5 kg+ bulk discount notice), and Amans Ocean's official phone (`0247293446`) and Abrepo/Barekese Road location.
