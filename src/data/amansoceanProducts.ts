import type { RetailWholesaleProduct } from '../types';

export const CURRENCY = 'GH₵';

export const AMANSOCEAN_PRICE_LIST_PDF_URL = '/assets/aistudio/_Amansocean_pricelist_69e95296.pdf';
export const AMANSOCEAN_CONTACT_PHONE = '0247293446';
export const AMANSOCEAN_LOCATION = 'Akoko Specs Station off Abrepo, Barekese Road';
export const AMANSOCEAN_ORIGIN_LABEL = 'Amans Ocean Coldstore · Abrepo, Barekese Rd';

export const AMANSOCEAN_FLYER_NOTES = [
  'Discounted offers exist for purchases above 5kg',
  'Prices of stocks can vary downwards or upwards due to availability',
  'Wholesale prices available at negotiable rates',
] as const;

export const LEGACY_DEMO_PRODUCT_IDS = [
  'prod-prawns-500g',
  'prod-fish-fingers-750g',
  'prod-fries-1kg',
  'prod-salmon-fillet-600g',
  'prod-calamari-rings-500g',
  'prod-onion-rings-750g',
  'prod-mango-sorbet-500ml',
  'prod-gelato-sea-salt-500ml',
] as const;

export type AmansoceanCategory =
  | 'Whole Fish'
  | 'Fillets & Chunks'
  | 'Shrimps, Prawns & Shellfish'
  | 'Fish & Shrimp Powders';

export type DbSeafoodCategory = 'Pelagic' | 'Groundfish' | 'Crustacean' | 'Mollusk' | 'Salmonid';

export interface AmansoceanProduct {
  id: string;
  sku?: string;
  name: string;
  category: AmansoceanCategory;
  description: string;
  price: number;
  wholesalePrice?: number;
  wholesaleMinQty?: number;
  unit?: 'kg' | 'pack' | 'box';
  image: string;
  badge?: 'New' | 'Hot' | 'Best Seller';
  weight?: string;
  rating?: number;
  origin?: string;
  stockKg?: number;
  inStock?: boolean;
}

export interface AmansoceanOfficialCatalogItem {
  id: string;
  sku: string;
  name: string;
  species_id: string;
  species_name: string;
  scientific_name: string;
  db_category: DbSeafoodCategory;
  storefront_category: AmansoceanCategory;
  cut_type:
    | 'Whole Round Fish'
    | 'Headless & Gutted (H&G)'
    | 'Skin-On Loin / Fillet'
    | 'Skinless Sashimi Saku Block'
    | 'Live in Oxygen Tank'
    | 'Packaged 500g Tray'
    | 'IQF Flash Frozen Box';
  grade: 'Sashimi AAA' | 'Grade #1' | 'Grade #2' | 'Processing Grade' | 'Live Prime';
  unit: 'kg' | 'pack';
  retail_pack_size: string;
  retail_price_per_unit: number;
  wholesale_price_per_unit: number;
  cost_price_per_unit: number;
  wholesale_min_qty: number;
  stock_kg: number;
  min_safety_stock_kg?: number;
  lot_id: string;
  description: string;
  image_url: string;
  origin: string;
  badge?: 'New' | 'Hot' | 'Best Seller';
  rating: number;
}

function buildSeafoodArtworkUri(
  title: string,
  subtitle: string,
  variant: 'whole-fish' | 'fillets' | 'shellfish' | 'powder',
  accentHex: string
): string {
  const safeTitle = title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const safeSub = subtitle
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const motifByVariant: Record<typeof variant, string> = {
    'whole-fish': `
      <path d="M190 215 C265 145, 395 145, 470 215 C515 190, 555 165, 575 155 L555 215 L575 275 C555 265, 515 240, 470 215 C395 285, 265 285, 190 215 Z" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.65)" stroke-width="4" stroke-linejoin="round"/>
      <path d="M315 162 L355 125 L368 165 Z" fill="rgba(255,255,255,0.28)"/>
      <circle cx="242" cy="204" r="8" fill="#ffffff"/>
      <circle cx="242" cy="204" r="3.5" fill="#0B192C"/>
      <path d="M282 186 C295 204, 295 226, 282 244" stroke="rgba(255,255,255,0.5)" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <path d="M335 195 Q365 215 335 235 M375 195 Q405 215 375 235" stroke="rgba(255,255,255,0.35)" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    `,
    fillets: `
      <rect x="205" y="152" width="275" height="126" rx="28" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.62)" stroke-width="4"/>
      <path d="M240 175 C270 205, 270 225, 240 255 M295 170 C325 205, 325 225, 295 260 M350 170 C380 205, 380 225, 350 260 M405 175 C435 205, 435 225, 405 255" stroke="rgba(255,255,255,0.55)" stroke-width="4" fill="none" stroke-linecap="round"/>
      <rect x="440" y="132" width="110" height="44" rx="14" fill="rgba(255,255,255,0.22)" stroke="rgba(255,255,255,0.5)" stroke-width="2.5"/>
    `,
    shellfish: `
      <path d="M250 255 C235 190, 290 140, 365 148 C435 155, 475 202, 452 252 C432 286, 382 288, 355 265 C375 252, 392 228, 378 205 C364 185, 326 186, 312 212 C298 238, 314 265, 286 272 Z" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.68)" stroke-width="4" stroke-linejoin="round"/>
      <path d="M245 215 C195 195, 168 165, 152 138 M248 228 C192 222, 165 205, 145 188" stroke="rgba(255,255,255,0.55)" stroke-width="3" fill="none" stroke-linecap="round"/>
      <circle cx="272" cy="196" r="6.5" fill="#ffffff"/>
    `,
    powder: `
      <rect x="268" y="128" width="184" height="178" rx="22" fill="rgba(255,255,255,0.16)" stroke="rgba(255,255,255,0.68)" stroke-width="4"/>
      <line x1="268" y1="164" x2="452" y2="164" stroke="rgba(255,255,255,0.48)" stroke-width="3"/>
      <circle cx="360" cy="224" r="38" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.55)" stroke-width="3"/>
      <circle cx="346" cy="218" r="3" fill="#ffffff"/>
      <circle cx="362" cy="210" r="3" fill="#ffffff"/>
      <circle cx="374" cy="224" r="3" fill="#ffffff"/>
      <circle cx="355" cy="234" r="3" fill="#ffffff"/>
      <circle cx="368" cy="238" r="3" fill="#ffffff"/>
    `,
  };

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 520" width="720" height="520">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#07192B"/>
        <stop offset="55%" stop-color="#0D2F4F"/>
        <stop offset="100%" stop-color="${accentHex}"/>
      </linearGradient>
      <radialGradient id="glow" cx="72%" cy="28%" r="60%">
        <stop offset="0%" stop-color="rgba(255,255,255,0.22)"/>
        <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
      </radialGradient>
    </defs>
    <rect width="720" height="520" fill="url(#bg)"/>
    <rect width="720" height="520" fill="url(#glow)"/>
    <path d="M0 390 Q180 355 360 390 T720 385 L720 520 L0 520 Z" fill="rgba(4,15,28,0.48)"/>
    <text x="48" y="64" fill="rgba(255,255,255,0.72)" font-family="Plus Jakarta Sans, system-ui, sans-serif" font-size="16" font-weight="600" letter-spacing="1.5">AMANS OCEAN COLDSTORE</text>
    ${motifByVariant[variant]}
    <text x="48" y="438" fill="#FFFFFF" font-family="Plus Jakarta Sans, system-ui, sans-serif" font-size="31" font-weight="700">${safeTitle}</text>
    <text x="48" y="472" fill="rgba(226,232,240,0.88)" font-family="Plus Jakarta Sans, system-ui, sans-serif" font-size="18" font-weight="500">${safeSub}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const AMANSOCEAN_CATEGORIES: ReadonlyArray<{
  id: AmansoceanCategory;
  label: string;
  theme: 'red' | 'yellow';
  image: string;
  tagline: string;
}> = [
  {
    id: 'Whole Fish',
    label: 'Whole Fish',
    theme: 'red',
    image: buildSeafoodArtworkUri('Whole Ocean & River Fish', 'Snapper · Grouper · Perch · Tilapia', 'whole-fish', '#0E7490'),
    tagline: 'Cleaned whole catch per kilo',
  },
  {
    id: 'Fillets & Chunks',
    label: 'Fillets & Chunks',
    theme: 'yellow',
    image: buildSeafoodArtworkUri('Boneless Fillets & Chunks', 'Grouper · Cassava · Butter Fish', 'fillets', '#1D4ED8'),
    tagline: 'Trimmed boneless fillets & headless cuts',
  },
  {
    id: 'Shrimps, Prawns & Shellfish',
    label: 'Shrimps & Shellfish',
    theme: 'red',
    image: buildSeafoodArtworkUri('Shrimps, Prawns & Shellfish', 'Jumbo Prawns · Lobster · Squid · Crab', 'shellfish', '#BE123C'),
    tagline: 'Wild prawns, peeled shrimps & mollusks',
  },
  {
    id: 'Fish & Shrimp Powders',
    label: 'Fish & Shrimp Powders',
    theme: 'yellow',
    image: buildSeafoodArtworkUri('Pure Fish & Shrimp Powders', 'Regular GH₵ 50 · Large GH₵ 100 Packs', 'powder', '#B45309'),
    tagline: '100% natural ground seasoning packs',
  },
];

interface RawFlyerSeed {
  id: string;
  sku: string;
  name: string;
  species_id: string;
  species_name: string;
  scientific_name: string;
  db_category: DbSeafoodCategory;
  storefront_category: AmansoceanCategory;
  cut_type:
    | 'Whole Round Fish'
    | 'Headless & Gutted (H&G)'
    | 'Skin-On Loin / Fillet'
    | 'Skinless Sashimi Saku Block'
    | 'Live in Oxygen Tank'
    | 'Packaged 500g Tray'
    | 'IQF Flash Frozen Box';
  grade: 'Sashimi AAA' | 'Grade #1' | 'Grade #2' | 'Processing Grade' | 'Live Prime';
  unit: 'kg' | 'pack';
  retail_pack_size: string;
  retail_price: number;
  wholesale_price: number;
  wholesale_min_qty: number;
  stock_kg: number;
  min_safety_stock_kg?: number;
  lot_id: string;
  description: string;
  badge?: 'New' | 'Hot' | 'Best Seller';
  rating: number;
}

const RAW_OFFICIAL_SEEDS: RawFlyerSeed[] = [
  {
    id: 'ao-red-fish',
    sku: 'AO-REDFISH-1KG',
    name: 'Red Fish',
    species_id: 'sp-ao-red-fish',
    species_name: 'Atlantic Red Fish',
    scientific_name: 'Sebastes marinus',
    db_category: 'Pelagic',
    storefront_category: 'Whole Fish',
    cut_type: 'Whole Round Fish',
    grade: 'Grade #1',
    unit: 'kg',
    retail_pack_size: '1kg',
    retail_price: 80,
    wholesale_price: 80,
    wholesale_min_qty: 5,
    stock_kg: 180,
    lot_id: 'LOT-AO-2026-001',
    description: 'Firm, sweet Atlantic red fish flash-frozen for rich Ghanaian stews, grilling, and light soup.',
    badge: 'Best Seller',
    rating: 4.9,
  },
  {
    id: 'ao-red-snapper',
    sku: 'AO-SNAPPER-1KG',
    name: 'Red Snapper',
    species_id: 'sp-ao-red-snapper',
    species_name: 'Wild Red Snapper',
    scientific_name: 'Lutjanus campechanus',
    db_category: 'Groundfish',
    storefront_category: 'Whole Fish',
    cut_type: 'Whole Round Fish',
    grade: 'Grade #1',
    unit: 'kg',
    retail_pack_size: '1kg',
    retail_price: 90,
    wholesale_price: 90,
    wholesale_min_qty: 5,
    stock_kg: 165,
    lot_id: 'LOT-AO-2026-002',
    description: 'Premium wild-caught whole red snapper with delicate flaky white meat, ideal for oven roasting and grill.',
    badge: 'Best Seller',
    rating: 5.0,
  },
  {
    id: 'ao-nile-perch',
    sku: 'AO-NILEPERCH-1KG',
    name: 'Nile Perch',
    species_id: 'sp-ao-nile-perch',
    species_name: 'Nile Perch',
    scientific_name: 'Lates niloticus',
    db_category: 'Groundfish',
    storefront_category: 'Whole Fish',
    cut_type: 'Whole Round Fish',
    grade: 'Grade #1',
    unit: 'kg',
    retail_pack_size: '1kg',
    retail_price: 85,
    wholesale_price: 85,
    wholesale_min_qty: 5,
    stock_kg: 140,
    lot_id: 'LOT-AO-2026-003',
    description: 'Meaty, mild-flavored freshwater Nile perch prized for thick steaks, soups, and deep frying.',
    rating: 4.8,
  },
  {
    id: 'ao-sea-breams',
    sku: 'AO-SEABREAM-1KG',
    name: 'Sea Breams',
    species_id: 'sp-ao-sea-breams',
    species_name: 'Sea Bream',
    scientific_name: 'Sparus aurata',
    db_category: 'Pelagic',
    storefront_category: 'Whole Fish',
    cut_type: 'Whole Round Fish',
    grade: 'Grade #1',
    unit: 'kg',
    retail_pack_size: '1kg',
    retail_price: 80,
    wholesale_price: 80,
    wholesale_min_qty: 5,
    stock_kg: 150,
    lot_id: 'LOT-AO-2026-004',
    description: 'Clean, succulent whole sea breams with crisp skin when grilled or steamed with herbs.',
    rating: 4.8,
  },
  {
    id: 'ao-barracuda',
    sku: 'AO-BARRACUDA-1KG',
    name: 'Barracuda',
    species_id: 'sp-ao-barracuda',
    species_name: 'Great Barracuda',
    scientific_name: 'Sphyraena barracuda',
    db_category: 'Pelagic',
    storefront_category: 'Whole Fish',
    cut_type: 'Whole Round Fish',
    grade: 'Grade #1',
    unit: 'kg',
    retail_pack_size: '1kg',
    retail_price: 80,
    wholesale_price: 80,
    wholesale_min_qty: 5,
    stock_kg: 135,
    lot_id: 'LOT-AO-2026-005',
    description: 'Dense, flavorful ocean barracuda steaks and whole cuts suited for pepper soup and charcoal grilling.',
    rating: 4.7,
  },
  {
    id: 'ao-sole-fish',
    sku: 'AO-SOLEFISH-1KG',
    name: 'Sole Fish',
    species_id: 'sp-ao-sole-fish',
    species_name: 'West African Sole',
    scientific_name: 'Solea solea',
    db_category: 'Groundfish',
    storefront_category: 'Whole Fish',
    cut_type: 'Whole Round Fish',
    grade: 'Grade #1',
    unit: 'kg',
    retail_pack_size: '1kg',
    retail_price: 80,
    wholesale_price: 80,
    wholesale_min_qty: 5,
    stock_kg: 120,
    lot_id: 'LOT-AO-2026-006',
    description: 'Tender flat sole fish with delicate sweet flesh that pan-sears cleanly in minutes.',
    rating: 4.8,
  },
  {
    id: 'ao-grouper',
    sku: 'AO-GROUPER-1KG',
    name: 'Grouper',
    species_id: 'sp-ao-grouper',
    species_name: 'Atlantic Grouper',
    scientific_name: 'Epinephelus marginatus',
    db_category: 'Groundfish',
    storefront_category: 'Whole Fish',
    cut_type: 'Whole Round Fish',
    grade: 'Sashimi AAA',
    unit: 'kg',
    retail_pack_size: '1kg',
    retail_price: 150,
    wholesale_price: 150,
    wholesale_min_qty: 5,
    stock_kg: 110,
    lot_id: 'LOT-AO-2026-007',
    description: 'Chef-grade whole grouper renowned for moist, firm flakes and rich natural gelatin in soups.',
    badge: 'Hot',
    rating: 4.9,
  },
  {
    id: 'ao-butter-nose',
    sku: 'AO-BUTTERNOSE-1KG',
    name: 'Butter Nose',
    species_id: 'sp-ao-butter-nose',
    species_name: 'Butter Nose Fish',
    scientific_name: 'Galeoides decadactylus',
    db_category: 'Pelagic',
    storefront_category: 'Whole Fish',
    cut_type: 'Whole Round Fish',
    grade: 'Grade #1',
    unit: 'kg',
    retail_pack_size: '1kg',
    retail_price: 65,
    wholesale_price: 65,
    wholesale_min_qty: 5,
    stock_kg: 175,
    lot_id: 'LOT-AO-2026-008',
    description: 'Everyday family favorite coastal butter nose fish with soft, savory flesh.',
    rating: 4.7,
  },
  {
    id: 'ao-butter-fish',
    sku: 'AO-BUTTERFISH-1KG',
    name: 'Butter Fish',
    species_id: 'sp-ao-butter-fish',
    species_name: 'Atlantic Butterfish',
    scientific_name: 'Peprilus triacanthus',
    db_category: 'Pelagic',
    storefront_category: 'Whole Fish',
    cut_type: 'Whole Round Fish',
    grade: 'Grade #1',
    unit: 'kg',
    retail_pack_size: '1kg',
    retail_price: 60,
    wholesale_price: 60,
    wholesale_min_qty: 5,
    stock_kg: 190,
    lot_id: 'LOT-AO-2026-009',
    description: 'Rich, buttery-textured whole fish ideal for crispy frying and homestyle tomato gravy.',
    rating: 4.7,
  },
  {
    id: 'ao-butter-fish-fillet',
    sku: 'AO-BTRFILLET-1KG',
    name: 'Butter Fish Fillet',
    species_id: 'sp-ao-butter-fish',
    species_name: 'Atlantic Butterfish',
    scientific_name: 'Peprilus triacanthus',
    db_category: 'Pelagic',
    storefront_category: 'Fillets & Chunks',
    cut_type: 'Skin-On Loin / Fillet',
    grade: 'Grade #1',
    unit: 'kg',
    retail_pack_size: '1kg',
    retail_price: 150,
    wholesale_price: 150,
    wholesale_min_qty: 5,
    stock_kg: 95,
    lot_id: 'LOT-AO-2026-010',
    description: 'Boneless trimmed butter fish fillets ready for pan-searing, baking, and restaurant plating.',
    rating: 4.9,
  },
  {
    id: 'ao-zipper-fish',
    sku: 'AO-ZIPPER-1KG',
    name: 'Zipper Fish',
    species_id: 'sp-ao-zipper-fish',
    species_name: 'Zipper Scabbardfish',
    scientific_name: 'Trichiurus lepturus',
    db_category: 'Pelagic',
    storefront_category: 'Whole Fish',
    cut_type: 'Whole Round Fish',
    grade: 'Grade #1',
    unit: 'kg',
    retail_pack_size: '1kg',
    retail_price: 60,
    wholesale_price: 60,
    wholesale_min_qty: 5,
    stock_kg: 160,
    lot_id: 'LOT-AO-2026-011',
    description: 'Slender, silver-skinned zipper fish that fries golden and crisp with minimal bones.',
    rating: 4.6,
  },
  {
    id: 'ao-cassava-fish',
    sku: 'AO-CASSAVA-1KG',
    name: 'Cassava Fish',
    species_id: 'sp-ao-cassava-fish',
    species_name: 'Cassava Croaker',
    scientific_name: 'Pseudotolithus senegalensis',
    db_category: 'Groundfish',
    storefront_category: 'Whole Fish',
    cut_type: 'Whole Round Fish',
    grade: 'Grade #1',
    unit: 'kg',
    retail_pack_size: '1kg',
    retail_price: 100,
    wholesale_price: 100,
    wholesale_min_qty: 5,
    stock_kg: 155,
    lot_id: 'LOT-AO-2026-012',
    description: 'Classic West African cassava croaker prized for sweet, flaky white meat and banku pairings.',
    badge: 'Best Seller',
    rating: 4.9,
  },
  {
    id: 'ao-cassava-fish-fillet',
    sku: 'AO-CASFILLET-1KG',
    name: 'Cassava Fish Fillet',
    species_id: 'sp-ao-cassava-fish',
    species_name: 'Cassava Croaker',
    scientific_name: 'Pseudotolithus senegalensis',
    db_category: 'Groundfish',
    storefront_category: 'Fillets & Chunks',
    cut_type: 'Skin-On Loin / Fillet',
    grade: 'Sashimi AAA',
    unit: 'kg',
    retail_pack_size: '1kg',
    retail_price: 180,
    wholesale_price: 180,
    wholesale_min_qty: 5,
    stock_kg: 90,
    lot_id: 'LOT-AO-2026-013',
    description: 'Hand-trimmed boneless cassava fish fillets for effortless frying, grilling, and kids meals.',
    badge: 'New',
    rating: 4.9,
  },
  {
    id: 'ao-cassava-chunks',
    sku: 'AO-CASCHUNKS-1KG',
    name: 'Cassava Chunks (No Head)',
    species_id: 'sp-ao-cassava-fish',
    species_name: 'Cassava Croaker',
    scientific_name: 'Pseudotolithus senegalensis',
    db_category: 'Groundfish',
    storefront_category: 'Fillets & Chunks',
    cut_type: 'Headless & Gutted (H&G)',
    grade: 'Grade #1',
    unit: 'kg',
    retail_pack_size: '1kg',
    retail_price: 180,
    wholesale_price: 180,
    wholesale_min_qty: 5,
    stock_kg: 105,
    lot_id: 'LOT-AO-2026-014',
    description: 'Zero-waste headless cassava fish center chunks cut to uniform stew and soup portions.',
    rating: 4.8,
  },
  {
    id: 'ao-tilapia',
    sku: 'AO-TILAPIA-1KG',
    name: 'Tilapia',
    species_id: 'sp-ao-tilapia',
    species_name: 'Volta Tilapia',
    scientific_name: 'Oreochromis niloticus',
    db_category: 'Groundfish',
    storefront_category: 'Whole Fish',
    cut_type: 'Whole Round Fish',
    grade: 'Grade #1',
    unit: 'kg',
    retail_pack_size: '1kg',
    retail_price: 80,
    wholesale_price: 80,
    wholesale_min_qty: 5,
    stock_kg: 210,
    lot_id: 'LOT-AO-2026-015',
    description: 'Freshly chilled and blast-frozen whole tilapia ready for spicy green marinade and banku grill.',
    badge: 'Best Seller',
    rating: 4.9,
  },
  {
    id: 'ao-unpeeled-shrimps',
    sku: 'AO-UNPLSHRMP-1KG',
    name: 'Unpeeled Shrimps',
    species_id: 'sp-ao-shrimps',
    species_name: 'Atlantic Pink Shrimp',
    scientific_name: 'Penaeus notialis',
    db_category: 'Crustacean',
    storefront_category: 'Shrimps, Prawns & Shellfish',
    cut_type: 'IQF Flash Frozen Box',
    grade: 'Grade #1',
    unit: 'kg',
    retail_pack_size: '1kg',
    retail_price: 100,
    wholesale_price: 100,
    wholesale_min_qty: 5,
    stock_kg: 130,
    lot_id: 'LOT-AO-2026-016',
    description: 'Shell-on wild shrimps packed with natural ocean sweetness for stocks, jollof, and stir-fries.',
    rating: 4.8,
  },
  {
    id: 'ao-peeled-shrimps',
    sku: 'AO-PLDSHRMP-1KG',
    name: 'Peeled Shrimps',
    species_id: 'sp-ao-shrimps',
    species_name: 'Atlantic Pink Shrimp',
    scientific_name: 'Penaeus notialis',
    db_category: 'Crustacean',
    storefront_category: 'Shrimps, Prawns & Shellfish',
    cut_type: 'IQF Flash Frozen Box',
    grade: 'Sashimi AAA',
    unit: 'kg',
    retail_pack_size: '1kg',
    retail_price: 220,
    wholesale_price: 200,
    wholesale_min_qty: 10,
    stock_kg: 115,
    lot_id: 'LOT-AO-2026-017',
    description: 'Cleaned, deveined peeled shrimps ready straight from the pack. Special GH₵ 200/kg bulk rate on 10kg+.',
    badge: 'Hot',
    rating: 5.0,
  },
  {
    id: 'ao-prawns-jumbo',
    sku: 'AO-PRAWNJMB-1KG',
    name: 'Prawns (Jumbo)',
    species_id: 'sp-ao-prawns',
    species_name: 'Jumbo Tiger Prawn',
    scientific_name: 'Penaeus monodon',
    db_category: 'Crustacean',
    storefront_category: 'Shrimps, Prawns & Shellfish',
    cut_type: 'IQF Flash Frozen Box',
    grade: 'Sashimi AAA',
    unit: 'kg',
    retail_pack_size: '1kg',
    retail_price: 250,
    wholesale_price: 250,
    wholesale_min_qty: 5,
    stock_kg: 85,
    lot_id: 'LOT-AO-2026-018',
    description: 'Show-stopping jumbo tiger prawns flash-frozen for garlic butter grilling and seafood platters.',
    badge: 'Best Seller',
    rating: 5.0,
  },
  {
    id: 'ao-prawns-medium',
    sku: 'AO-PRAWNMED-1KG',
    name: 'Prawns (Medium)',
    species_id: 'sp-ao-prawns',
    species_name: 'Tiger Prawn Medium',
    scientific_name: 'Penaeus monodon',
    db_category: 'Crustacean',
    storefront_category: 'Shrimps, Prawns & Shellfish',
    cut_type: 'IQF Flash Frozen Box',
    grade: 'Grade #1',
    unit: 'kg',
    retail_pack_size: '1kg',
    retail_price: 220,
    wholesale_price: 220,
    wholesale_min_qty: 5,
    stock_kg: 100,
    lot_id: 'LOT-AO-2026-019',
    description: 'Juicy medium ocean prawns balanced for fried rice, pasta, skewers, and seafood okro.',
    rating: 4.9,
  },
  {
    id: 'ao-octopus',
    sku: 'AO-OCTOPUS-1KG',
    name: 'Octopus',
    species_id: 'sp-ao-octopus',
    species_name: 'Common Atlantic Octopus',
    scientific_name: 'Octopus vulgaris',
    db_category: 'Mollusk',
    storefront_category: 'Shrimps, Prawns & Shellfish',
    cut_type: 'IQF Flash Frozen Box',
    grade: 'Grade #1',
    unit: 'kg',
    retail_pack_size: '1kg',
    retail_price: 150,
    wholesale_price: 150,
    wholesale_min_qty: 5,
    stock_kg: 75,
    min_safety_stock_kg: 100,
    lot_id: 'LOT-AO-2026-020',
    description: 'Cleaned whole Atlantic octopus tenderized by deep-freeze for charring, braising, and spicy stews.',
    rating: 4.8,
  },
  {
    id: 'ao-squid',
    sku: 'AO-SQUID-1KG',
    name: 'Squid',
    species_id: 'sp-ao-squid',
    species_name: 'Atlantic Calamari Squid',
    scientific_name: 'Loligo vulgaris',
    db_category: 'Mollusk',
    storefront_category: 'Shrimps, Prawns & Shellfish',
    cut_type: 'IQF Flash Frozen Box',
    grade: 'Grade #1',
    unit: 'kg',
    retail_pack_size: '1kg',
    retail_price: 150,
    wholesale_price: 130,
    wholesale_min_qty: 10,
    stock_kg: 110,
    lot_id: 'LOT-AO-2026-021',
    description: 'Tender squid tubes and tentacles for crispy calamari rings. Special GH₵ 130/kg bulk rate on 10kg+.',
    badge: 'Hot',
    rating: 4.8,
  },
  {
    id: 'ao-sea-snails',
    sku: 'AO-SEASNAIL-1KG',
    name: 'Sea Snails',
    species_id: 'sp-ao-sea-snails',
    species_name: 'West African Sea Snail',
    scientific_name: 'Cymbium pepo',
    db_category: 'Mollusk',
    storefront_category: 'Shrimps, Prawns & Shellfish',
    cut_type: 'IQF Flash Frozen Box',
    grade: 'Grade #1',
    unit: 'kg',
    retail_pack_size: '1kg',
    retail_price: 40,
    wholesale_price: 40,
    wholesale_min_qty: 5,
    stock_kg: 140,
    lot_id: 'LOT-AO-2026-022',
    description: 'Savory ocean sea snails cleaned and frozen for traditional palm nut soup, okro, and kebabs.',
    rating: 4.7,
  },
  {
    id: 'ao-sea-crabs',
    sku: 'AO-SEACRAB-1KG',
    name: 'Sea Crabs',
    species_id: 'sp-ao-sea-crabs',
    species_name: 'Blue Swimming Sea Crab',
    scientific_name: 'Callinectes amnicola',
    db_category: 'Crustacean',
    storefront_category: 'Shrimps, Prawns & Shellfish',
    cut_type: 'IQF Flash Frozen Box',
    grade: 'Grade #1',
    unit: 'kg',
    retail_pack_size: '1kg',
    retail_price: 30,
    wholesale_price: 30,
    wholesale_min_qty: 5,
    stock_kg: 185,
    lot_id: 'LOT-AO-2026-023',
    description: 'Sweet coastal swimming sea crabs essential for authentic Ghanaian okro stew and kontomire.',
    badge: 'Best Seller',
    rating: 4.8,
  },
  {
    id: 'ao-lobsters',
    sku: 'AO-LOBSTER-1KG',
    name: 'Lobsters',
    species_id: 'sp-ao-lobsters',
    species_name: 'Spiny Rock Lobster',
    scientific_name: 'Panulirus regius',
    db_category: 'Crustacean',
    storefront_category: 'Shrimps, Prawns & Shellfish',
    cut_type: 'Live in Oxygen Tank',
    grade: 'Sashimi AAA',
    unit: 'kg',
    retail_pack_size: '1kg',
    retail_price: 180,
    wholesale_price: 180,
    wholesale_min_qty: 5,
    stock_kg: 65,
    lot_id: 'LOT-AO-2026-024',
    description: 'Royal West African spiny lobsters with sweet tail meat for fine dining, grilling, and celebrations.',
    badge: 'Hot',
    rating: 5.0,
  },
  {
    id: 'ao-grouper-fillet',
    sku: 'AO-GRPFILLET-1KG',
    name: 'Grouper Fillet',
    species_id: 'sp-ao-grouper',
    species_name: 'Atlantic Grouper',
    scientific_name: 'Epinephelus marginatus',
    db_category: 'Groundfish',
    storefront_category: 'Fillets & Chunks',
    cut_type: 'Skin-On Loin / Fillet',
    grade: 'Sashimi AAA',
    unit: 'kg',
    retail_pack_size: '1kg',
    retail_price: 220,
    wholesale_price: 220,
    wholesale_min_qty: 5,
    stock_kg: 80,
    lot_id: 'LOT-AO-2026-025',
    description: 'Prime thick-cut boneless grouper loin fillets trimmed for hotels, caterers, and gourmet kitchens.',
    badge: 'Best Seller',
    rating: 5.0,
  },
  {
    id: 'ao-grouper-chunks',
    sku: 'AO-GRPCHUNKS-1KG',
    name: 'Grouper Chunks (No Head)',
    species_id: 'sp-ao-grouper',
    species_name: 'Atlantic Grouper',
    scientific_name: 'Epinephelus marginatus',
    db_category: 'Groundfish',
    storefront_category: 'Fillets & Chunks',
    cut_type: 'Headless & Gutted (H&G)',
    grade: 'Grade #1',
    unit: 'kg',
    retail_pack_size: '1kg',
    retail_price: 150,
    wholesale_price: 150,
    wholesale_min_qty: 5,
    stock_kg: 95,
    lot_id: 'LOT-AO-2026-026',
    description: 'Meaty headless grouper body chunks cut ready for rich light soup and braised dishes.',
    rating: 4.9,
  },
  {
    id: 'ao-fish-fillet-other',
    sku: 'AO-OTRFILLET-1KG',
    name: 'Fish Fillet (Any Other Fish)',
    species_id: 'sp-ao-mixed-fillet',
    species_name: 'Ocean Whitefish Fillet',
    scientific_name: 'Lutjanidae spp.',
    db_category: 'Groundfish',
    storefront_category: 'Fillets & Chunks',
    cut_type: 'Skin-On Loin / Fillet',
    grade: 'Grade #1',
    unit: 'kg',
    retail_pack_size: '1kg',
    retail_price: 150,
    wholesale_price: 150,
    wholesale_min_qty: 5,
    stock_kg: 110,
    lot_id: 'LOT-AO-2026-027',
    description: 'Boneless seasonal ocean whitefish fillets prepared clean for fish fingers, curry, and pan frying.',
    rating: 4.8,
  },
  {
    id: 'ao-doctor-fish',
    sku: 'AO-DOCTORFISH-1KG',
    name: 'Doctor Fish',
    species_id: 'sp-ao-doctor-fish',
    species_name: 'Atlantic Surgeonfish (Doctor Fish)',
    scientific_name: 'Acanthurus monroviae',
    db_category: 'Pelagic',
    storefront_category: 'Whole Fish',
    cut_type: 'Whole Round Fish',
    grade: 'Grade #1',
    unit: 'kg',
    retail_pack_size: '1kg',
    retail_price: 100,
    wholesale_price: 100,
    wholesale_min_qty: 5,
    stock_kg: 125,
    lot_id: 'LOT-AO-2026-028',
    description: 'Lean, aromatic coastal doctor fish loved for grilling, smoking, and spicy herbal soups.',
    rating: 4.8,
  },
  {
    id: 'ao-fish-powder-regular',
    sku: 'AO-FISHPWD-REG',
    name: 'Fish Powder (Regular Pack)',
    species_id: 'sp-ao-fish-powder',
    species_name: 'Pure Dried Fish Powder',
    scientific_name: 'Clupeidae spp.',
    db_category: 'Pelagic',
    storefront_category: 'Fish & Shrimp Powders',
    cut_type: 'Packaged 500g Tray',
    grade: 'Grade #1',
    unit: 'pack',
    retail_pack_size: 'Regular Pack',
    retail_price: 50,
    wholesale_price: 50,
    wholesale_min_qty: 5,
    stock_kg: 100,
    lot_id: 'LOT-AO-2026-029',
    description: '100% pure oven-dried, finely milled fish powder with no additives for stews, shito, and baby meals.',
    badge: 'New',
    rating: 4.9,
  },
  {
    id: 'ao-fish-powder-large',
    sku: 'AO-FISHPWD-LRG',
    name: 'Fish Powder (Large Pack)',
    species_id: 'sp-ao-fish-powder',
    species_name: 'Pure Dried Fish Powder',
    scientific_name: 'Clupeidae spp.',
    db_category: 'Pelagic',
    storefront_category: 'Fish & Shrimp Powders',
    cut_type: 'IQF Flash Frozen Box',
    grade: 'Grade #1',
    unit: 'pack',
    retail_pack_size: 'Large Pack',
    retail_price: 100,
    wholesale_price: 100,
    wholesale_min_qty: 5,
    stock_kg: 80,
    lot_id: 'LOT-AO-2026-030',
    description: 'Family and catering value pack of 100% pure ground fish powder for rich natural umami seasoning.',
    badge: 'Best Seller',
    rating: 5.0,
  },
  {
    id: 'ao-shrimp-powder-regular',
    sku: 'AO-SHRMPPWD-REG',
    name: 'Shrimp Powder (Regular Pack)',
    species_id: 'sp-ao-shrimp-powder',
    species_name: 'Pure Dried Shrimp Powder',
    scientific_name: 'Penaeus notialis',
    db_category: 'Crustacean',
    storefront_category: 'Fish & Shrimp Powders',
    cut_type: 'Packaged 500g Tray',
    grade: 'Grade #1',
    unit: 'pack',
    retail_pack_size: 'Regular Pack',
    retail_price: 50,
    wholesale_price: 50,
    wholesale_min_qty: 5,
    stock_kg: 100,
    lot_id: 'LOT-AO-2026-031',
    description: 'Aromatic roasted & finely ground pure shrimp powder for authentic shito, palava sauce, and soups.',
    badge: 'New',
    rating: 4.9,
  },
  {
    id: 'ao-shrimp-powder-large',
    sku: 'AO-SHRMPPWD-LRG',
    name: 'Shrimp Powder (Large Pack)',
    species_id: 'sp-ao-shrimp-powder',
    species_name: 'Pure Dried Shrimp Powder',
    scientific_name: 'Penaeus notialis',
    db_category: 'Crustacean',
    storefront_category: 'Fish & Shrimp Powders',
    cut_type: 'IQF Flash Frozen Box',
    grade: 'Grade #1',
    unit: 'pack',
    retail_pack_size: 'Large Pack',
    retail_price: 100,
    wholesale_price: 100,
    wholesale_min_qty: 5,
    stock_kg: 80,
    lot_id: 'LOT-AO-2026-032',
    description: 'Large value pack of fragrant pure shrimp powder hygienically milled at Amans Ocean Coldstore.',
    badge: 'Best Seller',
    rating: 5.0,
  },
];

function categoryVisualStyle(cat: AmansoceanCategory): {
  variant: 'whole-fish' | 'fillets' | 'shellfish' | 'powder';
  accent: string;
} {
  switch (cat) {
    case 'Whole Fish':
      return { variant: 'whole-fish', accent: '#0E7490' };
    case 'Fillets & Chunks':
      return { variant: 'fillets', accent: '#1D4ED8' };
    case 'Shrimps, Prawns & Shellfish':
      return { variant: 'shellfish', accent: '#BE123C' };
    case 'Fish & Shrimp Powders':
      return { variant: 'powder', accent: '#B45309' };
  }
}

export const AMANSOCEAN_OFFICIAL_CATALOG: AmansoceanOfficialCatalogItem[] = RAW_OFFICIAL_SEEDS.map(
  (seed) => {
    const style = categoryVisualStyle(seed.storefront_category);
    const unitSuffix = seed.unit === 'kg' ? 'per kilo' : seed.retail_pack_size;
    const bulkHint =
      seed.wholesale_price < seed.retail_price
        ? ` · ${CURRENCY} ${seed.wholesale_price}/kg on ${seed.wholesale_min_qty}kg+`
        : '';

    return {
      id: seed.id,
      sku: seed.sku,
      name: seed.name,
      species_id: seed.species_id,
      species_name: seed.species_name,
      scientific_name: seed.scientific_name,
      db_category: seed.db_category,
      storefront_category: seed.storefront_category,
      cut_type: seed.cut_type,
      grade: seed.grade,
      unit: seed.unit,
      retail_pack_size: seed.retail_pack_size,
      retail_price_per_unit: seed.retail_price,
      wholesale_price_per_unit: seed.wholesale_price,
      cost_price_per_unit: Number((seed.wholesale_price * 0.72).toFixed(2)),
      wholesale_min_qty: seed.wholesale_min_qty,
      stock_kg: seed.stock_kg,
      min_safety_stock_kg:
        seed.min_safety_stock_kg ?? (seed.wholesale_min_qty ? seed.wholesale_min_qty * 10 : 50),
      lot_id: seed.lot_id,
      description: seed.description,
      image_url: buildSeafoodArtworkUri(
        seed.name,
        `${CURRENCY} ${seed.retail_price.toFixed(2)} ${unitSuffix}${bulkHint}`,
        style.variant,
        style.accent
      ),
      origin: AMANSOCEAN_ORIGIN_LABEL,
      badge: seed.badge,
      rating: seed.rating,
    };
  }
);

function mapSeedToStorefrontProduct(item: AmansoceanOfficialCatalogItem): AmansoceanProduct {
  return {
    id: item.id,
    sku: item.sku,
    name: item.name,
    category: item.storefront_category,
    description: item.description,
    price: item.retail_price_per_unit,
    wholesalePrice: item.wholesale_price_per_unit,
    wholesaleMinQty: item.wholesale_min_qty,
    unit: item.unit,
    image: item.image_url,
    badge: item.badge,
    weight: item.retail_pack_size,
    rating: item.rating,
    origin: item.origin,
    stockKg: item.stock_kg,
    inStock: item.stock_kg > 0,
  };
}

export const FEATURED_PRODUCTS: AmansoceanProduct[] = AMANSOCEAN_OFFICIAL_CATALOG.filter(
  (item) => item.storefront_category !== 'Fish & Shrimp Powders'
).map(mapSeedToStorefrontProduct);

export const COOL_TREATS_PRODUCTS: AmansoceanProduct[] = AMANSOCEAN_OFFICIAL_CATALOG.filter(
  (item) => item.storefront_category === 'Fish & Shrimp Powders'
).map(mapSeedToStorefrontProduct);

export const ALL_AMANSOCEAN_STOREFRONT_PRODUCTS: AmansoceanProduct[] =
  AMANSOCEAN_OFFICIAL_CATALOG.map(mapSeedToStorefrontProduct);

export const AMANSOCEAN_OFFICIAL_DOMAIN_PRODUCTS: RetailWholesaleProduct[] =
  AMANSOCEAN_OFFICIAL_CATALOG.map((item) => ({
    id: item.id,
    speciesId: item.species_id,
    name: item.name,
    cutType: item.cut_type,
    category: item.db_category,
    grade: item.grade,
    stockKg: item.stock_kg,
    unit: item.unit,
    costPricePerUnit: item.cost_price_per_unit,
    wholesalePricePerUnit: item.wholesale_price_per_unit,
    retailPricePerUnit: item.retail_price_per_unit,
    wholesaleMinQty: item.wholesale_min_qty,
    retailPackSize: item.retail_pack_size,
    sku: item.sku,
    imageUrl: item.image_url,
    origin: item.origin,
    isAvailableForRetail: true,
    isAvailableForWholesale: true,
  }));
