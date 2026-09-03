export type SpeciesCategory = 'Pelagic' | 'Salmonid' | 'Crustacean' | 'Mollusk' | 'Groundfish';

export type QualityGrade = 'Sashimi AAA' | 'Grade #1' | 'Grade #2' | 'Processing Grade' | 'Live Prime';

export type StorageZone = 'Super-Cryo Deep Freeze (-60°C)' | 'Commercial Cold Storage (-22°C)' | 'Fresh Slush Ice (0°C to +2°C)' | 'Live Seawater Tank (+8°C)';

export interface Species {
  id: string;
  name: string;
  scientificName: string;
  category: SpeciesCategory;
  defaultZone: StorageZone;
  standardPricePerKg: number;
  availableGrades: QualityGrade[];
  faoZones: string[];
  gearTypes: string[];
  seasonalPeak: string;
  image: string;
  shelfLifeFreshDays: number;
  shelfLifeFrozenMonths: number;
}

export interface InventoryBatch {
  id: string; // Lot ID e.g. "LOT-2026-TUNA-094"
  speciesId: string;
  speciesName: string;
  scientificName: string;
  category: SpeciesCategory;
  harvestDate: string;
  landingPort: string;
  vesselName: string;
  vesselRegistration: string;
  captainName: string;
  faoArea: string;
  coordinates: {
    lat: number;
    lng: number;
    description: string;
  };
  gearType: string;
  grade: QualityGrade;
  initialWeightKg: number;
  availableWeightKg: number;
  allocatedWeightKg: number;
  storageZone: StorageZone;
  currentTempCelsius: number;
  targetTempCelsius: number;
  costPerKg: number;
  wholesalePricePerKg: number;
  certifications: string[]; // ['MSC Certified', 'ASC', 'FDA HACCP', 'Friend of the Sea']
  inspectionStatus: 'Passed' | 'Pending' | 'Flagged';
  histaminePpm?: number;
  coreTempCelsius: number;
  receivedDate: string;
  expiryDate: string;
  qrCodeSeed: string;
  notes: string;
}

export type OrderStatus = 
  | 'Pending Confirmation'
  | 'Weighing & Grading'
  | 'Cryo-Packed & Iced'
  | 'In Reefer Transit'
  | 'Delivered'
  | 'Cancelled';

export interface OrderLineItem {
  id: string;
  speciesId: string;
  speciesName: string;
  grade: QualityGrade;
  lotId: string;
  requestedWeightKg: number;
  actualWeighedKg: number | null;
  pricePerKg: number;
  notes?: string;
}

export interface ClientOrder {
  id: string; // "ORD-9421"
  clientName: string;
  clientCategory: 'Michelin Restaurant' | 'Luxury Hotel Group' | 'Seafood Wholesaler' | 'Supermarket Chain' | 'Gourmet Fishmonger';
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  destinationCity: string;
  deliveryAddress: string;
  orderDate: string;
  requiredDeliveryDate: string;
  actualDeliveryDate?: string;
  status: OrderStatus;
  items: OrderLineItem[];
  quotedTotalUSD: number;
  adjustedTotalUSD: number;
  assignedReeferId?: string;
  assignedDriver?: string;
  paymentStatus: 'Paid' | 'Pending Net-30' | 'Invoiced' | 'Overdue';
  packagingRequirement: 'Dry Ice & Insulated Wax Carton' | 'Slush Ice Gel Packed' | 'Live Oxygenated Tank Container' | 'Standard Cryo-Box';
  specialInstructions?: string;
  packingSlipGenerated: boolean;
}

export interface ReeferSensorData {
  timestamp: string;
  temperature: number;
  humidity: number;
  powerStatus: 'Optimal' | 'Auxiliary' | 'Warning';
}

export interface ReeferVehicle {
  id: string;
  name: string;
  driverName: string;
  driverPhone: string;
  vehiclePlate: string;
  type: 'Electric Cryo-Truck (10T)' | 'Heavy Reefer Articulated (24T)' | 'Sprinter Air-Freight Express (2T)' | 'Cold-Storage Facility Depot A';
  originPort: string;
  destination: string;
  status: 'In Transit' | 'Loading / Pre-Cooling' | 'Standby' | 'Temp Alert!';
  currentTempCelsius: number;
  targetTempCelsius: number;
  minSafeTemp: number;
  maxSafeTemp: number;
  ambientHumidityPct: number;
  batteryLevelPct: number;
  eta: string;
  routeProgressPct: number;
  activeLotIds: string[];
  activeOrderIds: string[];
  tempHistory: ReeferSensorData[];
  alerts: string[];
}

export interface MarketPriceIndex {
  id: string;
  speciesName: string;
  category: SpeciesCategory;
  exchange: 'Tokyo Toyosu Market' | 'Boston Seafood Exchange' | 'Bergen Salmon Index' | 'Sydney Fish Market' | 'Global Frozen Index';
  currentPricePerKg: number;
  previousPricePerKg: number;
  change24hPct: number;
  volumeTons24h: number;
  weeklyTrend: number[];
  high30d: number;
  low30d: number;
  demandStatus: 'Surging High' | 'Steady' | 'Soft Supply';
}

export interface HaccpAuditRecord {
  id: string;
  lotId: string;
  speciesName: string;
  inspectionDate: string;
  inspectorName: string;
  inspectorId: string;
  coreTemperature: number;
  histamineLevelPpm: number;
  organolepticScore: number; // 1 to 10
  parasiteVisualCheck: 'Clean' | 'Pass with Trimming' | 'Failed';
  sanitizationLogPass: boolean;
  finalCompliance: 'Approved - Grade AAA' | 'Approved - Standard' | 'Quarantine - Re-inspect' | 'Rejected';
  certificationRef: string;
  notes: string;
}

export interface FleetVessel {
  id: string;
  name: string;
  vesselCode: string;
  captain: string;
  targetSpecies: string[];
  currentZone: string;
  etaPort: string;
  estimatedCatchKg: number;
  status: 'Harvesting' | 'Steaming to Port' | 'Discharging Catch' | 'At Anchor';
  coordinates: {
    lat: number;
    lng: number;
  };
  iceOnBoardTons: number;
  seaSurfaceTemp: number;
}

export interface SystemNotification {
  id: string;
  type: 'temp_alert' | 'order_update' | 'catch_landed' | 'haccp_pass' | 'system' | 'payment_received' | 'invoice_due' | 'supplier_delivery';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

// -------------------------------------------------------------
// CORE BUSINESS ENTITIES: CUSTOMERS, SUPPLIERS, RETAIL & FINANCIALS
// -------------------------------------------------------------

export type CustomerType = 'Wholesale Restaurant' | 'Hotel & Resort' | 'Supermarket / Retailer' | 'Fishmonger / Distributor' | 'Direct Retail VIP';
export type PricingTier = 'Tier 1 (VIP Wholesale -15%)' | 'Tier 2 (Standard Wholesale)' | 'Retail Standard' | 'Contract Custom';
export type PaymentTerms = 'Net-30' | 'Net-15' | 'Cash on Delivery (COD)' | 'Prepaid / Due on Receipt' | 'Instant Card/Cash';

export interface Customer {
  id: string; // e.g. "CUST-101"
  name: string;
  companyName: string;
  type: CustomerType;
  tier: PricingTier;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  creditLimitUSD: number;
  outstandingBalanceUSD: number; // Accounts Receivable
  paymentTerms: PaymentTerms;
  totalOrdersCount: number;
  totalSpendUSD: number;
  status: 'Active' | 'Credit Hold' | 'Pending Review';
  taxId?: string;
  notes?: string;
  joinedDate: string;
}

export type SupplierType = 'Fishermen Co-op' | 'Vessel / Fleet Captain' | 'Aquaculture Farm' | 'Fish Auction / Wholesaler' | 'Direct Marine Import';

export interface Supplier {
  id: string; // e.g. "SUP-201"
  name: string;
  contactPerson: string;
  type: SupplierType;
  email: string;
  phone: string;
  portLocation: string;
  country: string;
  vesselNames?: string[];
  suppliedSpecies: string[];
  paymentTerms: 'Net-30' | 'Net-15' | 'Cash on Dock (COD)' | 'Weekly Settlement';
  outstandingPayableUSD: number; // Accounts Payable
  totalPurchasedUSD: number;
  totalWeightSuppliedKg: number;
  rating: number; // 1 to 5
  status: 'Preferred Partner' | 'Active' | 'Under Audit';
  bankAccountRef?: string;
  notes?: string;
}

export type SeafoodCutType = 
  | 'Whole Round Fish'
  | 'Headless & Gutted (H&G)'
  | 'Skin-On Loin / Fillet'
  | 'Skinless Sashimi Saku Block'
  | 'Live in Oxygen Tank'
  | 'Packaged 500g Tray'
  | 'IQF Flash Frozen Box';

export interface RetailWholesaleProduct {
  id: string;
  speciesId: string;
  name: string;
  cutType: SeafoodCutType;
  category: SpeciesCategory;
  grade: QualityGrade;
  stockKg: number;
  unit: 'kg' | 'lb' | 'piece' | 'pack';
  costPricePerUnit: number;
  wholesalePricePerUnit: number;
  retailPricePerUnit: number;
  wholesaleMinQty: number;
  retailPackSize?: string;
  sku: string;
  imageUrl: string;
  origin: string;
  isAvailableForRetail: boolean;
  isAvailableForWholesale: boolean;
}

export interface RetailSaleItem {
  productId: string;
  productName: string;
  cutType: SeafoodCutType;
  quantity: number;
  unit: 'kg' | 'lb' | 'piece' | 'pack';
  unitPrice: number;
  costPrice: number;
  lineTotal: number;
}

export interface RetailTransaction {
  id: string; // "REC-5021"
  receiptNumber: string;
  date: string;
  customerName: string;
  customerPhone?: string;
  items: RetailSaleItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  costTotal: number;
  grossMargin: number;
  paymentMethod: 'Cash' | 'Credit Card' | 'Apple Pay / Contactless' | 'Store Credit';
  cashierName: string;
  status: 'Completed' | 'Refunded';
}

export interface PurchaseOrderLanding {
  id: string; // e.g. "PO-8821"
  supplierId: string;
  supplierName: string;
  vesselName: string;
  portLocation: string;
  orderDate: string;
  deliveryDate: string;
  speciesItems: {
    speciesName: string;
    weightKg: number;
    costPerKg: number;
    totalCost: number;
    grade: QualityGrade;
    storageZone: StorageZone;
  }[];
  totalCostUSD: number;
  paymentStatus: 'Paid in Full' | 'Pending Settlement' | 'Partial Paid' | 'Overdue';
  paymentDueDate: string;
  receivedBy: string;
  lotAssignedId: string;
  status: 'Received & In Stock' | 'Pending Dock Inspection' | 'In Transit';
  notes?: string;
}

export type FinancialEntryCategory = 'Revenue (Wholesale)' | 'Revenue (Retail POS)' | 'COGS (Catch Intake)' | 'Logistics & Reefer Freight' | 'Cold Storage Utilities' | 'Packaging & Ice' | 'Labor & Cutting Crew' | 'Dock Fees & Port Taxes';

export interface FinancialLedgerEntry {
  id: string;
  date: string;
  type: 'Income' | 'COGS' | 'OpEx';
  category: FinancialEntryCategory;
  description: string;
  referenceId: string; // Order ID, PO ID, or Receipt ID
  entityName: string; // Customer or Supplier Name
  amount: number; // positive value
  paymentMethod: string;
  status: 'Settled' | 'Pending' | 'Overdue';
}

export interface AppSettings {
  // Enterprise & Facility Profile
  companyName: string;
  facilityCode: string;
  fdaRegistrationNumber: string;
  euApprovalNumber: string;
  haccpCoordinator: string;
  primaryPort: string;
  taxRate: number; // percentage (e.g. 5)
  currency: 'GHS' | 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CAD' | 'AUD';
  
  // Cold-Chain Telemetry & HACCP Excursion Limits
  superCryoTargetC: number;
  superCryoMaxAlertC: number;
  commercialFreezeTargetC: number;
  commercialFreezeMaxAlertC: number;
  slushIceTargetC: number;
  slushIceMaxAlertC: number;
  histamineLimitPpm: number;
  sensorPollingIntervalSec: number;
  enableAudioAlerts: boolean;

  // Display & Measurement Units
  useImperial: boolean;
  weightDecimalPlaces: number;
  dateFormat: 'YYYY-MM-DD' | 'MM/DD/YYYY' | 'DD/MM/YYYY';
  
  // POS & Order Fulfillment Defaults
  defaultPaymentTerms: string;
  autoGenerateQRTraceability: boolean;
  icePackagingFeePerKg: number;
  minOrderValueWholesale: number;
  
  // Notification Preferences
  notifyHaccpExcursion: boolean;
  notifyLowInventory: boolean;
  notifyOverdueInvoices: boolean;
  notifyVesselArrivals: boolean;
  lowStockThresholdKg: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  companyName: 'Pacific Cold-Chain & Seafood Holdings Ltd.',
  facilityCode: 'FAC-PAC-808-CRY',
  fdaRegistrationNumber: 'FDA-REG-#1948201',
  euApprovalNumber: 'EU-ESP-9281-CE',
  haccpCoordinator: 'Dr. Elena Rostova, Lead Quality Auditor',
  primaryPort: 'Port of Tema & Pier 38 Fishing Harbour',
  taxRate: 15.0, // standard VAT / NHIL / GETFund
  currency: 'GHS',
  superCryoTargetC: -60.0,
  superCryoMaxAlertC: -50.0,
  commercialFreezeTargetC: -22.0,
  commercialFreezeMaxAlertC: -18.0,
  slushIceTargetC: 0.5,
  slushIceMaxAlertC: 3.0,
  histamineLimitPpm: 50,
  sensorPollingIntervalSec: 30,
  enableAudioAlerts: true,
  useImperial: false,
  weightDecimalPlaces: 1,
  dateFormat: 'YYYY-MM-DD',
  defaultPaymentTerms: 'Net 30 Days',
  autoGenerateQRTraceability: true,
  icePackagingFeePerKg: 0.45,
  minOrderValueWholesale: 300,
  notifyHaccpExcursion: true,
  notifyLowInventory: true,
  notifyOverdueInvoices: true,
  notifyVesselArrivals: true,
  lowStockThresholdKg: 200
};
