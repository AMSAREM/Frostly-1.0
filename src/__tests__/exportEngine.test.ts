import { describe, it, expect, vi } from 'vitest';
import { 
  exportDualPricingToExcel, 
  exportDualPricingToPdf, 
  exportInventoryToExcel, 
  exportInventoryToPdf,
  exportWholesaleOrdersToExcel,
  exportWholesaleOrdersToPdf
} from '../utils/exportEngine';
import { RetailWholesaleProduct, InventoryBatch, ClientOrder } from '../types';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

vi.mock('xlsx', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    writeFile: vi.fn(),
  };
});

vi.mock('jspdf', () => {
  return {
    default: class MockJsPDF {
      internal = {
        pageSize: {
          getWidth: () => 841.89,
          getHeight: () => 595.28,
        },
      };
      setFillColor = vi.fn();
      rect = vi.fn();
      roundedRect = vi.fn();
      setTextColor = vi.fn();
      setFont = vi.fn();
      setFontSize = vi.fn();
      text = vi.fn();
      save = vi.fn();
    },
  };
});

vi.mock('jspdf-autotable', () => ({
  default: vi.fn((_doc: any, options: any) => {
    if (options?.didDrawPage) {
      options.didDrawPage({ pageNumber: 1 });
    }
  }),
}));

const mockProducts: RetailWholesaleProduct[] = [
  {
    id: 'prod-tuna-01',
    speciesId: 'spec-bluefin',
    name: 'Pacific Bluefin Tuna Saku',
    cutType: 'Skinless Sashimi Saku Block',
    category: 'Pelagic',
    grade: 'Sashimi AAA',
    stockKg: 150,
    unit: 'kg',
    costPricePerUnit: 65,
    wholesalePricePerUnit: 95,
    retailPricePerUnit: 125,
    wholesaleMinQty: 10,
    retailPackSize: '1.0 kg vacuum saku',
    sku: 'SKU-BF-01',
    imageUrl: 'https://example.com/tuna.jpg',
    origin: 'Tsukiji Direct Airfreight',
    isAvailableForRetail: true,
    isAvailableForWholesale: true,
    linkedBatchId: 'LOT-BF-01',
    storageZone: 'Super-Cryo Deep Freeze (-60°C)'
  }
];

const mockBatches: InventoryBatch[] = [
  {
    id: 'LOT-BF-01',
    speciesId: 'spec-bluefin',
    speciesName: 'Pacific Bluefin Tuna Saku',
    scientificName: 'Thunnus orientalis',
    category: 'Pelagic',
    harvestDate: '2026-11-01',
    landingPort: 'Tokyo Bay Dock',
    vesselName: 'F/V Kuroshio Maru',
    vesselRegistration: 'JP-9921',
    captainName: 'Capt. Tanaka',
    coordinates: { lat: 35.6895, lng: 139.6917, description: 'Tsukiji Dock' },
    faoArea: 'FAO 61 (Northwest Pacific)',
    gearType: 'Iki-Jime Single Line',
    grade: 'Sashimi AAA',
    initialWeightKg: 200,
    availableWeightKg: 150,
    allocatedWeightKg: 50,
    storageZone: 'Super-Cryo Deep Freeze (-60°C)',
    currentTempCelsius: -59.5,
    targetTempCelsius: -60.0,
    costPerKg: 65,
    wholesalePricePerKg: 95,
    certifications: ['FDA HACCP Compliant', 'MSC Certified'],
    inspectionStatus: 'Passed',
    histaminePpm: 0.4,
    coreTempCelsius: -59.5,
    receivedDate: '2026-11-02',
    expiryDate: '2027-05-01',
    qrCodeSeed: 'QR-BF-01',
    notes: 'Premium sashimi cut',
    linkedProductId: 'prod-tuna-01',
    productSku: 'SKU-BF-01',
    isRetailCutLot: true
  }
];

const mockOrders: ClientOrder[] = [
  {
    id: 'ORD-501',
    clientName: 'Nobu Downtown',
    clientCategory: 'Michelin Restaurant',
    contactPerson: 'Head Chef Ken',
    contactEmail: 'ken@nobu.com',
    contactPhone: '+1-555-0199',
    destinationCity: 'New York',
    deliveryAddress: '40 Hudson Yards',
    orderDate: '2026-11-10',
    requiredDeliveryDate: '2026-11-12',
    status: 'Weighing & Grading',
    paymentStatus: 'Pending Net-30',
    paymentTerms: 'Net-30',
    packagingRequirement: 'Dry Ice & Insulated Wax Carton',
    quotedTotalUSD: 1900,
    adjustedTotalUSD: 1900,
    items: [
      {
        id: 'item-1',
        speciesId: 'spec-bluefin',
        speciesName: 'Pacific Bluefin Tuna Saku',
        grade: 'Sashimi AAA',
        lotId: 'LOT-BF-01',
        requestedWeightKg: 20,
        actualWeighedKg: 20,
        pricePerKg: 95
      }
    ],
    packingSlipGenerated: true
  }
];

describe('Export Engine (Excel & PDF for Dual Pricing, Inventory & Orders)', () => {
  it('exports Dual Pricing Catalog to Excel workbook without error', () => {
    expect(() => {
      exportDualPricingToExcel({
        products: mockProducts,
        batches: mockBatches,
        companyName: 'Amansocean Test',
        currencySymbol: '$'
      });
    }).not.toThrow();

    expect(XLSX.writeFile).toHaveBeenCalled();
  });

  it('exports Dual Pricing Catalog to PDF document without error', () => {
    expect(() => {
      exportDualPricingToPdf({
        products: mockProducts,
        batches: mockBatches,
        companyName: 'Amansocean Test',
        currencySymbol: '$'
      });
    }).not.toThrow();
  });

  it('exports Cold Vault Inventory Ledger to Excel workbook without error', () => {
    expect(() => {
      exportInventoryToExcel({
        batches: mockBatches,
        products: mockProducts,
        companyName: 'Amansocean Test',
        currencySymbol: '$'
      });
    }).not.toThrow();
  });

  it('exports Cold Vault Inventory Ledger to PDF document without error', () => {
    expect(() => {
      exportInventoryToPdf({
        batches: mockBatches,
        products: mockProducts,
        companyName: 'Amansocean Test',
        currencySymbol: '$'
      });
    }).not.toThrow();
  });

  it('exports Wholesale B2B Orders to Excel and PDF without error', () => {
    expect(() => {
      exportWholesaleOrdersToExcel({
        orders: mockOrders,
        companyName: 'Amansocean Test',
        currencySymbol: '$'
      });
    }).not.toThrow();

    expect(() => {
      exportWholesaleOrdersToPdf({
        orders: mockOrders,
        companyName: 'Amansocean Test',
        currencySymbol: '$'
      });
    }).not.toThrow();
  });
});
