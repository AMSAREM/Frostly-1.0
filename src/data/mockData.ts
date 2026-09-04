import { 
  Species, 
  InventoryBatch, 
  ClientOrder, 
  ReeferVehicle, 
  MarketPriceIndex, 
  HaccpAuditRecord, 
  FleetVessel,
  SystemNotification,
  Customer,
  Supplier,
  RetailWholesaleProduct,
  RetailTransaction,
  PurchaseOrderLanding,
  FinancialLedgerEntry
} from '../types';

/**
 * Master Species Reference Catalog
 * Provides standardized seafood taxonomy, HACCP storage zones, and quality grades.
 */
export const SPECIES_CATALOG: Species[] = [
  {
    id: 'spec-bluefin',
    name: 'Pacific Bluefin Tuna (Hon-Maguro)',
    scientificName: 'Thunnus orientalis',
    category: 'Pelagic',
    defaultZone: 'Super-Cryo Deep Freeze (-60°C)',
    standardPricePerKg: 110.00,
    availableGrades: ['Sashimi AAA', 'Grade #1', 'Grade #2'],
    faoZones: ['FAO 61 (Northwest Pacific)', 'FAO 71 (Western Central Pacific)'],
    gearTypes: ['Pelagic Longline', 'Iki-Jime Single Line'],
    seasonalPeak: 'November - March',
    image: 'https://images.unsplash.com/photo-1534482421-64566f976cfa?auto=format&fit=crop&w=600&q=80',
    shelfLifeFreshDays: 7,
    shelfLifeFrozenMonths: 24
  },
  {
    id: 'spec-yellowfin',
    name: 'Yellowfin Tuna (Ahi Loin)',
    scientificName: 'Thunnus albacares',
    category: 'Pelagic',
    defaultZone: 'Super-Cryo Deep Freeze (-60°C)',
    standardPricePerKg: 38.50,
    availableGrades: ['Sashimi AAA', 'Grade #1', 'Grade #2'],
    faoZones: ['FAO 71 (Western Central Pacific)', 'FAO 77 (Eastern Central Pacific)'],
    gearTypes: ['Pole and Line', 'Pelagic Longline'],
    seasonalPeak: 'Year-Round (Peak Jul - Oct)',
    image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=600&q=80',
    shelfLifeFreshDays: 8,
    shelfLifeFrozenMonths: 18
  },
  {
    id: 'spec-salmon',
    name: 'Wild King & Atlantic Salmon (Icy Fjord)',
    scientificName: 'Salmo salar / Oncorhynchus tshawytscha',
    category: 'Salmonid',
    defaultZone: 'Fresh Slush Ice (0°C to +2°C)',
    standardPricePerKg: 24.80,
    availableGrades: ['Sashimi AAA', 'Grade #1', 'Grade #2'],
    faoZones: ['FAO 27 (Northeast Atlantic - Lofoten)', 'FAO 67 (Northeast Pacific - Alaska)'],
    gearTypes: ['Drift Net / Tangle', 'Sustainable Aquaculture Pens'],
    seasonalPeak: 'May - September',
    image: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=600&q=80',
    shelfLifeFreshDays: 10,
    shelfLifeFrozenMonths: 12
  },
  {
    id: 'spec-kingcrab',
    name: 'Red King Crab (Whole Clusters)',
    scientificName: 'Paralithodes camtschaticus',
    category: 'Crustacean',
    defaultZone: 'Commercial Cold Storage (-22°C)',
    standardPricePerKg: 78.00,
    availableGrades: ['Grade #1', 'Sashimi AAA', 'Grade #2'],
    faoZones: ['FAO 67 (Bering Sea / Bristol Bay)', 'FAO 27 (Barents Sea)'],
    gearTypes: ['Heavy Steel Crab Pots'],
    seasonalPeak: 'October - January',
    image: 'https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=600&q=80',
    shelfLifeFreshDays: 4,
    shelfLifeFrozenMonths: 18
  },
  {
    id: 'spec-lobster',
    name: 'North Atlantic Hard-Shell Live Lobster',
    scientificName: 'Homarus americanus',
    category: 'Crustacean',
    defaultZone: 'Live Seawater Tank (+8°C)',
    standardPricePerKg: 42.00,
    availableGrades: ['Live Prime', 'Grade #1'],
    faoZones: ['FAO 21 (Northwest Atlantic - Gulf of Maine)'],
    gearTypes: ['Vented Lobster Traps'],
    seasonalPeak: 'June - December',
    image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80',
    shelfLifeFreshDays: 5,
    shelfLifeFrozenMonths: 6
  },
  {
    id: 'spec-blacktiger',
    name: 'Jumbo Black Tiger Prawns (U-8 Count)',
    scientificName: 'Penaeus monodon',
    category: 'Crustacean',
    defaultZone: 'Commercial Cold Storage (-22°C)',
    standardPricePerKg: 32.50,
    availableGrades: ['Grade #1', 'Grade #2'],
    faoZones: ['FAO 57 (Indian Ocean)', 'FAO 71 (Sulu Sea)'],
    gearTypes: ['Certified Mangrove Co-Op Traps'],
    seasonalPeak: 'Year-Round',
    image: 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=600&q=80',
    shelfLifeFreshDays: 4,
    shelfLifeFrozenMonths: 24
  },
  {
    id: 'spec-oyster',
    name: 'Kumamoto & Belon Pacific Oysters',
    scientificName: 'Crassostrea sikamea / Ostrea edulis',
    category: 'Mollusk',
    defaultZone: 'Fresh Slush Ice (0°C to +2°C)',
    standardPricePerKg: 28.00,
    availableGrades: ['Live Prime', 'Grade #1'],
    faoZones: ['FAO 67 (Puget Sound / Pacific Northwest)', 'FAO 27 (Brittany Coast)'],
    gearTypes: ['Suspended Deep-Water Lantern Nets'],
    seasonalPeak: 'September - April',
    image: 'https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?auto=format&fit=crop&w=600&q=80',
    shelfLifeFreshDays: 12,
    shelfLifeFrozenMonths: 0
  },
  {
    id: 'spec-blackcod',
    name: 'Alaskan Black Cod (Sablefish Butterfish)',
    scientificName: 'Anoplopoma fimbria',
    category: 'Groundfish',
    defaultZone: 'Commercial Cold Storage (-22°C)',
    standardPricePerKg: 46.00,
    availableGrades: ['Sashimi AAA', 'Grade #1'],
    faoZones: ['FAO 67 (Gulf of Alaska Deep Trench)'],
    gearTypes: ['Demersal Longline (Deep Sea 800m)'],
    seasonalPeak: 'March - November',
    image: 'https://images.unsplash.com/photo-1534482421-64566f976cfa?auto=format&fit=crop&w=600&q=80',
    shelfLifeFreshDays: 7,
    shelfLifeFrozenMonths: 18
  }
];

// Clean Production Datasets (0 Seeded / Mock Records)
export const INITIAL_BATCHES: InventoryBatch[] = [];
export const INITIAL_ORDERS: ClientOrder[] = [];
export const INITIAL_REEFERS: ReeferVehicle[] = [];
export const MARKET_INDEX: MarketPriceIndex[] = [];
export const INITIAL_HACCP_RECORDS: HaccpAuditRecord[] = [];
export const INITIAL_FLEET_VESSELS: FleetVessel[] = [];
export const INITIAL_NOTIFICATIONS: SystemNotification[] = [];
export const INITIAL_CUSTOMERS: Customer[] = [];
export const INITIAL_SUPPLIERS: Supplier[] = [];
export const INITIAL_PRODUCTS: RetailWholesaleProduct[] = [];
export const INITIAL_RETAIL_TRANSACTIONS: RetailTransaction[] = [];
export const INITIAL_PURCHASE_ORDERS: PurchaseOrderLanding[] = [];
export const INITIAL_FINANCIAL_ENTRIES: FinancialLedgerEntry[] = [];
