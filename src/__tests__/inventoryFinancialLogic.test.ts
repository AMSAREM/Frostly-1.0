import { describe, it, expect, vi } from 'vitest';
import {
  ClientOrder,
  Customer,
  FinancialLedgerEntry,
  InventoryBatch,
  InventoryStockAdjustment,
  PurchaseOrderLanding,
  RetailTransaction,
  RetailWholesaleProduct,
  Supplier,
} from '../types';
import {
  calculateCashInflowForEntries,
  calculateCashOutflowForEntries,
  calculateCategoryRevenueBreakdown,
  calculateEnterpriseFinancials,
  calculateSpeciesMarginBenchmarks,
  calculateVaultValuation,
  getRetailNetRevenue,
} from '../utils/financialMetrics';
import {
  applyOrderAllocationDeltas,
  applyRetailSaleStockDeductions,
  computeOrderCustomerFinancialDelta,
  validateOrderLotAvailability,
} from '../utils/inventorySync';
import { buildCustomerLedger } from '../utils/customerLedger';
import { buildSupplierLedger } from '../utils/supplierLedger';
import { buildProductLedger } from '../utils/productLedger';
import { financialRepository, isInventoryAdjustmentLedgerEntry } from '../repositories/financialRepository';

function makeBatch(overrides: Partial<InventoryBatch> = {}): InventoryBatch {
  return {
    id: 'LOT-001',
    speciesId: 'spec-tuna',
    speciesName: 'Pacific Bluefin Tuna',
    scientificName: 'Thunnus orientalis',
    category: 'Pelagic',
    harvestDate: '2026-04-01',
    landingPort: 'Tema Harbour',
    vesselName: 'FV Horizon',
    vesselRegistration: 'GH-101',
    captainName: 'Capt. Mensah',
    faoArea: 'FAO 34',
    coordinates: { lat: 5.6, lng: 0.0, description: 'Tema' },
    gearType: 'Hook & Line',
    grade: 'Sashimi AAA',
    initialWeightKg: 100,
    availableWeightKg: 80,
    allocatedWeightKg: 0,
    storageZone: 'Super-Cryo Deep Freeze (-60°C)',
    currentTempCelsius: -59.5,
    targetTempCelsius: -60,
    costPerKg: 20,
    wholesalePricePerKg: 35,
    certifications: ['MSC'],
    inspectionStatus: 'Passed',
    histaminePpm: 1.1,
    coreTempCelsius: -58,
    receivedDate: '2026-04-01',
    expiryDate: '2026-10-01',
    qrCodeSeed: 'QR-LOT-001',
    notes: 'Test lot',
    linkedProductId: 'prod-1',
    productSku: 'SKU-TUNA-01',
    ...overrides,
  };
}

function makeProduct(overrides: Partial<RetailWholesaleProduct> = {}): RetailWholesaleProduct {
  return {
    id: 'prod-1',
    speciesId: 'spec-tuna',
    name: 'Pacific Bluefin Tuna',
    cutType: 'Skinless Sashimi Saku Block',
    category: 'Pelagic',
    grade: 'Sashimi AAA',
    stockKg: 80,
    unit: 'kg',
    costPricePerUnit: 20,
    wholesalePricePerUnit: 35,
    retailPricePerUnit: 50,
    wholesaleMinQty: 10,
    retailPackSize: '1kg',
    sku: 'SKU-TUNA-01',
    imageUrl: '',
    origin: 'Tema',
    isAvailableForRetail: true,
    isAvailableForWholesale: true,
    linkedBatchId: 'LOT-001',
    ...overrides,
  };
}

function makeOrder(overrides: Partial<ClientOrder> = {}): ClientOrder {
  return {
    id: 'ORD-1001',
    customerId: 'cust-1',
    clientName: 'Ocean',
    clientCategory: 'Michelin Restaurant',
    contactPerson: 'Chef Ama',
    contactEmail: 'chef@ocean.test',
    contactPhone: '0240000000',
    destinationCity: 'Accra',
    deliveryAddress: 'Osu, Accra',
    orderDate: '2026-04-10',
    requiredDeliveryDate: '2026-04-11',
    status: 'Pending Confirmation',
    items: [
      {
        id: 'line-1',
        speciesId: 'spec-tuna',
        speciesName: 'Pacific Bluefin Tuna',
        grade: 'Sashimi AAA',
        lotId: 'LOT-001',
        requestedWeightKg: 10,
        actualWeighedKg: null,
        pricePerKg: 35,
      },
    ],
    quotedTotalUSD: 350,
    adjustedTotalUSD: 350,
    paymentStatus: 'Pending Net-30',
    packagingRequirement: 'Dry Ice & Insulated Wax Carton',
    packingSlipGenerated: false,
    ...overrides,
  };
}

describe('Inventory Allocation & Stock Synchronization', () => {
  it('preserves prior POS sales/shrinkage when allocating, weighing, and voiding orders', () => {
    // 100 initial, 20 already depleted via POS/shrinkage => 80 available, 0 allocated
    const initialBatch = makeBatch({ initialWeightKg: 100, availableWeightKg: 80, allocatedWeightKg: 0 });
    const orderLines = [
      {
        id: 'l1',
        speciesId: 'spec-tuna',
        speciesName: 'Pacific Bluefin Tuna',
        grade: 'Sashimi AAA' as const,
        lotId: 'LOT-001',
        requestedWeightKg: 10,
        actualWeighedKg: null,
        pricePerKg: 35,
      },
      {
        id: 'l2',
        speciesId: 'spec-tuna',
        speciesName: 'Pacific Bluefin Tuna',
        grade: 'Sashimi AAA' as const,
        lotId: 'LOT-001',
        requestedWeightKg: 5,
        actualWeighedKg: null,
        pricePerKg: 35,
      },
    ];

    // Allocate 15 kg across two lines sharing the same lot
    const created = applyOrderAllocationDeltas([initialBatch], [], false, orderLines, true);
    expect(created.changedBatches).toHaveLength(1);
    expect(created.updatedBatches[0].availableWeightKg).toBe(65);
    expect(created.updatedBatches[0].allocatedWeightKg).toBe(15);

    // Weigh line 1 up from 10 kg to 12.5 kg (+2.5 kg delta)
    const weighedLines = [
      { ...orderLines[0], actualWeighedKg: 12.5 },
      orderLines[1],
    ];
    const weighed = applyOrderAllocationDeltas(created.updatedBatches, orderLines, true, weighedLines, true);
    expect(weighed.updatedBatches[0].availableWeightKg).toBe(62.5);
    expect(weighed.updatedBatches[0].allocatedWeightKg).toBe(17.5);

    // Void the order -> returns 17.5 kg back to 80 available (NOT 100!)
    const voided = applyOrderAllocationDeltas(weighed.updatedBatches, weighedLines, true, weighedLines, false);
    expect(voided.updatedBatches[0].availableWeightKg).toBe(80);
    expect(voided.updatedBatches[0].allocatedWeightKg).toBe(0);
  });

  it('rejects over-allocation beyond available batch stock while crediting back existing order hold on edit', () => {
    const batch = makeBatch({ availableWeightKg: 10, allocatedWeightKg: 15 });
    const existingOrder = makeOrder({
      items: [
        {
          id: 'l1',
          speciesId: 'spec-tuna',
          speciesName: 'Pacific Bluefin Tuna',
          grade: 'Sashimi AAA',
          lotId: 'LOT-001',
          requestedWeightKg: 15,
          actualWeighedKg: null,
          pricePerKg: 35,
        },
      ],
    });

    // Max allowable when editing existingOrder is 10 available + 15 held = 25 kg
    expect(
      validateOrderLotAvailability(
        [{ ...existingOrder.items[0], requestedWeightKg: 25 }],
        [batch],
        existingOrder
      ).valid
    ).toBe(true);

    const fail = validateOrderLotAvailability(
      [{ ...existingOrder.items[0], requestedWeightKg: 26 }],
      [batch],
      existingOrder
    );
    expect(fail.valid).toBe(false);
    expect(fail.error).toContain('Insufficient stock');
  });

  it('deducts pack (0.5 kg) and kg retail POS items consistently across products and linked batches', () => {
    const kgProd = makeProduct({ id: 'prod-1', unit: 'kg', stockKg: 80, linkedBatchId: 'LOT-001' });
    const packProd = makeProduct({
      id: 'prod-2',
      sku: 'SKU-PACK-2',
      unit: 'pack',
      stockKg: 10,
      linkedBatchId: 'LOT-002',
    });
    const b1 = makeBatch({ id: 'LOT-001', availableWeightKg: 80, linkedProductId: 'prod-1' });
    const b2 = makeBatch({ id: 'LOT-002', availableWeightKg: 10, linkedProductId: 'prod-2', productSku: 'SKU-PACK-2' });

    const res = applyRetailSaleStockDeductions([kgProd, packProd], [b1, b2], [
      {
        productId: 'prod-1',
        productName: 'Bluefin',
        cutType: 'Skin-On Loin / Fillet',
        quantity: 2.5,
        unit: 'kg',
        unitPrice: 50,
        costPrice: 20,
        lineTotal: 125,
      },
      {
        productId: 'prod-2',
        productName: 'Packs',
        cutType: 'Packaged 500g Tray',
        quantity: 4, // 4 packs * 0.5 kg = 2.0 kg
        unit: 'pack',
        unitPrice: 25,
        costPrice: 10,
        lineTotal: 100,
      },
    ]);

    expect(res.updatedProducts.find(p => p.id === 'prod-1')?.stockKg).toBe(77.5);
    expect(res.updatedProducts.find(p => p.id === 'prod-2')?.stockKg).toBe(8);
    expect(res.updatedBatches.find(b => b.id === 'LOT-001')?.availableWeightKg).toBe(77.5);
    expect(res.updatedBatches.find(b => b.id === 'LOT-002')?.availableWeightKg).toBe(8);
  });

  it('reconciles customer ordersCount, totalSpend, and AR balance accurately across lifecycle transitions', () => {
    const ord = makeOrder({ adjustedTotalUSD: 350, paymentStatus: 'Pending Net-30' });
    expect(computeOrderCustomerFinancialDelta(undefined, ord)).toEqual({
      ordersCountDelta: 1,
      totalSpendDelta: 350,
      outstandingBalanceDelta: 350,
    });

    const paidOrd = { ...ord, paymentStatus: 'Paid in Full' as const };
    expect(computeOrderCustomerFinancialDelta(ord, paidOrd)).toEqual({
      ordersCountDelta: 0,
      totalSpendDelta: 0,
      outstandingBalanceDelta: -350,
    });

    const voidedOrd = { ...ord, status: 'Voided' as const, paymentStatus: 'Cancelled' as const };
    expect(computeOrderCustomerFinancialDelta(ord, voidedOrd)).toEqual({
      ordersCountDelta: 0,
      totalSpendDelta: -350,
      outstandingBalanceDelta: -350,
    });

    expect(computeOrderCustomerFinancialDelta(ord, undefined)).toEqual({
      ordersCountDelta: -1,
      totalSpendDelta: -350,
      outstandingBalanceDelta: -350,
    });
  });
});

describe('Enterprise Financial Metrics & Cash Flow Integrity', () => {
  it('excludes Voided/Cancelled orders, Refunded POS sales, and sales tax, while matching COGS to sold items', () => {
    const batch = makeBatch({ costPerKg: 20, availableWeightKg: 50, wholesalePricePerKg: 35 });
    const prod = makeProduct({ costPricePerUnit: 20 });

    const activeOrder = makeOrder({
      id: 'ORD-1',
      status: 'Delivered',
      paymentStatus: 'Paid',
      items: [
        {
          id: 'l1',
          speciesId: 'spec-tuna',
          speciesName: 'Pacific Bluefin Tuna',
          grade: 'Sashimi AAA',
          lotId: 'LOT-001',
          requestedWeightKg: 10,
          actualWeighedKg: 10,
          pricePerKg: 35,
        },
      ],
      quotedTotalUSD: 350,
      adjustedTotalUSD: 350,
    });
    const voidedOrder = makeOrder({
      id: 'ORD-2',
      status: 'Voided',
      paymentStatus: 'Cancelled',
      quotedTotalUSD: 1000,
      adjustedTotalUSD: 1000,
    });

    const completedPos: RetailTransaction = {
      id: 'REC-1',
      receiptNumber: 'POS-1',
      date: '2026-04-12 10:00',
      customerName: 'Walk-in',
      items: [
        {
          productId: 'prod-1',
          productName: 'Pacific Bluefin Tuna',
          cutType: 'Skin-On Loin / Fillet',
          quantity: 4,
          unit: 'kg',
          unitPrice: 50,
          costPrice: 20,
          lineTotal: 200,
        },
      ],
      subtotal: 200,
      discountAmount: 0,
      taxAmount: 17.5, // Tax must not inflate net revenue
      totalAmount: 217.5,
      costTotal: 80,
      grossMargin: 120,
      paymentMethod: 'Cash',
      cashierName: 'Anna',
      status: 'Completed',
    };
    const refundedPos: RetailTransaction = {
      ...completedPos,
      id: 'REC-2',
      receiptNumber: 'POS-2',
      status: 'Refunded',
    };

    // Unsold bulk PO of $2,000 must NOT expense $2,000 immediately as COGS!
    const largePO: PurchaseOrderLanding = {
      id: 'PO-1',
      supplierId: 'sup-1',
      supplierName: 'Fleet',
      vesselName: 'FV Horizon',
      portLocation: 'Tema',
      orderDate: '2026-04-01',
      deliveryDate: '2026-04-01',
      status: 'Received & In Stock',
      speciesItems: [
        {
          speciesName: 'Pacific Bluefin Tuna',
          grade: 'Sashimi AAA',
          weightKg: 100,
          costPerKg: 20,
          totalCost: 2000,
          storageZone: 'Super-Cryo Deep Freeze (-60°C)',
        },
      ],
      totalCostUSD: 2000,
      paymentStatus: 'Pending Settlement',
      paymentDueDate: '2026-04-16',
      receivedBy: 'Dock Master',
      lotAssignedId: 'LOT-001',
    };

    const entries: FinancialLedgerEntry[] = [
      {
        id: 'FIN-ADJ-1',
        date: '2026-04-12',
        type: 'COGS',
        category: 'Inventory Adjustment',
        description: 'Spoilage write-off',
        referenceId: 'ADJ-1',
        entityName: 'Lot LOT-001',
        amount: 30,
        paymentMethod: 'Account 5150',
        status: 'Settled',
      },
      {
        id: 'FIN-EXP-1',
        date: '2026-04-12',
        type: 'OpEx',
        category: 'Cold Storage Utilities',
        description: 'Cryo freezer electricity',
        referenceId: 'EXP-1',
        entityName: 'ECG Power',
        amount: 50,
        paymentMethod: 'Bank Transfer',
        status: 'Settled',
      },
    ];

    expect(getRetailNetRevenue(completedPos)).toBe(200);
    expect(getRetailNetRevenue(refundedPos)).toBe(0);

    const fin = calculateEnterpriseFinancials({
      orders: [activeOrder, voidedOrder],
      retailSales: [completedPos, refundedPos],
      batches: [batch],
      products: [prod],
      purchaseOrders: [largePO],
      financialEntries: entries,
    });

    // Revenue = 350 wholesale + 200 ex-tax retail = 550 (excludes 1000 voided & 200 refunded & 17.5 tax)
    expect(fin.wholesaleRevenue).toBe(350);
    expect(fin.retailRevenue).toBe(200);
    expect(fin.totalRevenue).toBe(550);

    // Sold COGS = 10*20 (200) + 4*20 (80) = 280 + 30 shrinkage = 310 (NOT 2000 PO!)
    expect(fin.soldCOGS).toBe(280);
    expect(fin.totalCOGS).toBe(310);
    expect(fin.grossProfit).toBe(240);
    expect(fin.totalOpEx).toBe(50);
    expect(fin.netOperatingProfit).toBe(190);

    // Cash flow avoids counting non-cash Inventory Adjustment as cash outflow and avoids double-counting POS
    const posWithLedgerEntry: FinancialLedgerEntry = {
      id: 'FIN-POS-1',
      date: '2026-04-12',
      type: 'Income',
      category: 'Revenue (Retail POS)',
      description: 'Counter Walk-in',
      referenceId: 'REC-1',
      receiptNumber: 'POS-1',
      entityName: 'Walk-in',
      amount: 217.5,
      paymentMethod: 'Cash',
      status: 'Settled',
    };
    expect(calculateCashInflowForEntries([posWithLedgerEntry], [completedPos])).toBe(217.5);
    expect(calculateCashOutflowForEntries(entries)).toBe(50); // Excludes $30 Inventory Adjustment!

    // Vault Valuation separates costBasisUSD vs wholesaleMarketValueUSD and ignores decommissioned lots
    const decomm = makeBatch({ id: 'LOT-DEAD', availableWeightKg: 100, notes: '[DECOMMISSIONED 2026-04-10]' });
    const vault = calculateVaultValuation([batch, decomm]);
    expect(vault.availableWeightKg).toBe(50);
    expect(vault.costBasisUSD).toBe(1000);
    expect(vault.wholesaleMarketValueUSD).toBe(1750);

    // Live Category & Benchmark Helpers
    const catBreakdown = calculateCategoryRevenueBreakdown({
      orders: [activeOrder, voidedOrder],
      retailSales: [completedPos, refundedPos],
      batches: [batch],
      products: [prod],
    });
    expect(catBreakdown).toHaveLength(1);
    expect(catBreakdown[0].name).toBe('Pelagic');
    expect(catBreakdown[0].revenue).toBe(550);

    const benchmarks = calculateSpeciesMarginBenchmarks({ batches: [batch], products: [prod] });
    expect(benchmarks[0].speciesName).toBe('Pacific Bluefin Tuna');
    expect(benchmarks[0].marginPct).toBeCloseTo(42.9, 1);
  });
});

describe('Sub-Ledgers: Customer, Supplier, and Product Ledgers', () => {
  it('excludes voided orders, Pending credit accruals, and partial substring collisions in Customer Ledger', () => {
    const cust: Customer = {
      id: 'cust-1',
      name: 'Ocean',
      companyName: 'Ocean Grill',
      type: 'Wholesale Restaurant',
      tier: 'Tier 2 (Standard Wholesale)',
      contactPerson: 'Chef Ama',
      email: 'ama@ocean.test',
      phone: '0240000000',
      address: 'Osu',
      city: 'Accra',
      paymentTerms: 'Net-30',
      creditLimitUSD: 5000,
      outstandingBalanceUSD: 500,
      totalSpendUSD: 900,
      totalOrdersCount: 2,
      status: 'Active',
      joinedDate: '2026-01-01',
    };

    const unpaidOrder = makeOrder({ id: 'ORD-1', adjustedTotalUSD: 500, paymentStatus: 'Pending Net-30' });
    const paidInFullOrder = makeOrder({ id: 'ORD-2', adjustedTotalUSD: 400, paymentStatus: 'Paid in Full' });
    const voidedOrder = makeOrder({ id: 'ORD-3', adjustedTotalUSD: 999, status: 'Voided', paymentStatus: 'Cancelled' });
    // Different customer whose name merely contains "Ocean" as a substring
    const unrelatedOrder = makeOrder({ id: 'ORD-99', customerId: 'cust-999', clientName: 'Oceanic Palace', adjustedTotalUSD: 700 });

    const ledgerEntries: FinancialLedgerEntry[] = [
      // Pending accrual created at order checkout must NOT credit AR balance
      {
        id: 'FIN-ORD-1',
        date: '2026-04-10',
        type: 'Income',
        category: 'Revenue (Wholesale)',
        description: 'Wholesale Credit Order #ORD-1 (Net-30)',
        referenceId: 'ORD-1',
        entityName: 'Ocean Grill',
        amount: 500,
        paymentMethod: 'Credit Facility',
        status: 'Pending',
      },
      // Real settled payment for ORD-2
      {
        id: 'FIN-PMT-2',
        date: '2026-04-11',
        type: 'Income',
        category: 'Revenue (Wholesale)',
        description: 'Customer AR Settlement Received - Ocean',
        referenceId: 'PMT-AR-ORD-2',
        entityName: 'Ocean',
        amount: 400,
        paymentMethod: 'Bank Wire',
        status: 'Settled',
        customerId: 'cust-1',
      },
      // Unrelated customer payment containing substring "Ocean"
      {
        id: 'FIN-PMT-99',
        date: '2026-04-11',
        type: 'Income',
        category: 'Revenue (Wholesale)',
        description: 'Customer AR Settlement Received - Oceanic Palace',
        referenceId: 'PMT-AR-cust-999',
        entityName: 'Oceanic Palace',
        amount: 700,
        paymentMethod: 'Bank Wire',
        status: 'Settled',
        customerId: 'cust-999',
      },
    ];

    const res = buildCustomerLedger(cust, [unpaidOrder, paidInFullOrder, voidedOrder, unrelatedOrder], ledgerEntries);
    expect(res.summary.totalInvoiced).toBe(900);
    expect(res.summary.totalPaid).toBe(400);
    expect(res.summary.outstandingBalance).toBe(500);
    expect(res.summary.paidInvoicesCount).toBe(1);
    expect(res.summary.openInvoicesCount).toBe(1);
  });

  it('excludes Pending catch intake accrual rows and substring collisions in Supplier Ledger', () => {
    const sup: Supplier = {
      id: 'sup-1',
      name: 'Sea',
      type: 'Vessel / Fleet Captain',
      contactPerson: 'Capt. Kojo',
      email: 'sea@fleet.test',
      phone: '0241111111',
      portLocation: 'Takoradi',
      country: 'Ghana',
      suppliedSpecies: ['Snapper'],
      rating: 4.9,
      paymentTerms: 'Net-15',
      totalPurchasedUSD: 1000,
      outstandingPayableUSD: 1000,
      totalWeightSuppliedKg: 100,
      status: 'Active',
    };

    const po: PurchaseOrderLanding = {
      id: 'PO-1',
      supplierId: 'sup-1',
      supplierName: 'Sea',
      vesselName: 'FV Sea',
      portLocation: 'Takoradi',
      orderDate: '2026-04-05',
      deliveryDate: '2026-04-05',
      status: 'Received & In Stock',
      speciesItems: [
        { speciesName: 'Snapper', grade: 'Grade #1', weightKg: 100, costPerKg: 10, totalCost: 1000, storageZone: 'Commercial Cold Storage (-22°C)' },
      ],
      totalCostUSD: 1000,
      paymentStatus: 'Pending Settlement',
      paymentDueDate: '2026-04-20',
      receivedBy: 'Dock Master',
      lotAssignedId: 'LOT-SNAP-1',
    };

    const ledgerEntries: FinancialLedgerEntry[] = [
      // Pending PO accrual should NOT reduce AP balance!
      {
        id: 'FIN-PO-1',
        date: '2026-04-05',
        type: 'COGS',
        category: 'COGS (Catch Intake)',
        description: 'Catch Intake Purchase - Sea (PO-1)',
        referenceId: 'PO-1',
        entityName: 'Sea',
        amount: 1000,
        paymentMethod: 'Accounts Payable Net Terms',
        status: 'Pending',
      },
      // Another supplier whose name contains "Sea"
      {
        id: 'FIN-AP-OTHER',
        date: '2026-04-06',
        type: 'COGS',
        category: 'COGS (Catch Intake)',
        description: 'Harvester AP Settlement Wire - DeepSea Co',
        referenceId: 'PMT-AP-sup-999',
        entityName: 'DeepSea Co',
        amount: 500,
        paymentMethod: 'Wire',
        status: 'Settled',
        supplierId: 'sup-999',
      },
    ];

    const res = buildSupplierLedger(sup, [po], ledgerEntries);
    expect(res.summary.totalBilledUSD).toBe(1000);
    expect(res.summary.totalDisbursedUSD).toBe(0);
    expect(res.summary.outstandingPayableUSD).toBe(1000);
  });

  it('prevents PO intake double-counting, excludes Voided/Refunded sales, and computes sold COGS in Product Ledger', () => {
    const prod = makeProduct({ id: 'prod-1', stockKg: 85, costPricePerUnit: 20 });
    const batch = makeBatch({ id: 'LOT-001', initialWeightKg: 100, availableWeightKg: 85, costPerKg: 20 });
    const po: PurchaseOrderLanding = {
      id: 'PO-1',
      supplierId: 'sup-1',
      supplierName: 'Fleet',
      vesselName: 'FV Horizon',
      portLocation: 'Tema',
      orderDate: '2026-04-01',
      deliveryDate: '2026-04-01',
      status: 'Received & In Stock',
      lotAssignedId: 'LOT-001',
      speciesItems: [
        {
          speciesName: 'Pacific Bluefin Tuna',
          grade: 'Sashimi AAA',
          weightKg: 100,
          costPerKg: 20,
          totalCost: 2000,
          storageZone: 'Super-Cryo Deep Freeze (-60°C)',
        },
      ],
      totalCostUSD: 2000,
      paymentStatus: 'Paid in Full',
      paymentDueDate: '2026-04-16',
      receivedBy: 'Dock Master',
    };

    const adj: InventoryStockAdjustment = {
      id: 'ADJ-1',
      batchId: 'LOT-001',
      speciesName: 'Pacific Bluefin Tuna',
      previousWeightKg: 90,
      newWeightKg: 85,
      deltaWeightKg: -5,
      unitCostUSD: 20,
      valuationVarianceUSD: -100,
      reason: 'Trimming / Butcher Processing Waste',
      adjustmentAccountId: 'adj-5150',
      adjustmentAccountCode: '5150',
      adjustmentAccountName: 'Shrinkage & Spoilage',
      createdBy: 'Staff',
      createdAt: '2026-04-03T10:00:00Z',
    };

    const validOrder = makeOrder({
      id: 'ORD-1',
      status: 'Delivered',
      items: [
        {
          id: 'l1',
          speciesId: 'spec-tuna',
          speciesName: 'Pacific Bluefin Tuna',
          grade: 'Sashimi AAA',
          lotId: 'LOT-001',
          requestedWeightKg: 10,
          actualWeighedKg: 10,
          pricePerKg: 35,
        },
      ],
    });
    const voidedOrder = makeOrder({ id: 'ORD-2', status: 'Voided', paymentStatus: 'Cancelled' });

    const refundedSale: RetailTransaction = {
      id: 'POS-REF-1',
      receiptNumber: 'RCPT-REF-1',
      date: '2026-04-04 10:00:00',
      customerName: 'Walk-in',
      customerPhone: '',
      items: [
        {
          productId: 'prod-1',
          productName: 'Pacific Bluefin Tuna',
          cutType: 'Skinless Sashimi Saku Block',
          quantity: 4,
          unit: 'kg',
          unitPrice: 40,
          costPrice: 20,
          lineTotal: 160,
        },
      ],
      subtotal: 160,
      discountAmount: 0,
      taxAmount: 16,
      totalAmount: 176,
      costTotal: 80,
      grossMargin: 80,
      paymentMethod: 'Credit Card',
      cashierName: 'Staff',
      status: 'Refunded',
    };

    const ledger = buildProductLedger(prod, [batch], [refundedSale], [validOrder, voidedOrder], [adj], [po]);
    // Inflow should only be 100 kg (from LOT-001), NOT 200 kg double-counted with PO-1!
    expect(ledger.summary.totalInwardStock).toBe(100);
    // Sold units = 10 kg wholesale (excludes 5 kg shrinkage, voided order, and refunded POS sale)
    expect(ledger.summary.wholesaleSalesQty).toBe(10);
    expect(ledger.summary.retailSalesQty).toBe(0);
    expect(ledger.summary.netAdjustmentQty).toBe(-5);
    // Sold COGS = 10 * 20 = 200 (excludes 100 shrinkage write-off)
    expect(ledger.summary.totalCogs).toBe(200);
    expect(ledger.summary.totalRevenue).toBe(350);
  });
});

describe('Inventory Adjustment Ledger Cleanup', () => {
  it('identifies Inventory Adjustment test entries while preserving real sales, catch intake, and OpEx rows', () => {
    const adjByCat: FinancialLedgerEntry = {
      id: 'LEDGER-991',
      date: '2026-04-12',
      type: 'COGS',
      category: 'Inventory Adjustment',
      description: 'Test shrinkage write-off',
      referenceId: 'LOT-001',
      entityName: 'Internal Cold Vault [Acc 5150]',
      amount: 100,
      paymentMethod: 'Adjustment Account 5150',
      status: 'Settled',
    };
    const writeOffById: FinancialLedgerEntry = {
      id: 'FIN-WO-123456-ABC',
      date: '2026-04-12',
      type: 'COGS',
      category: 'COGS (Catch Intake)',
      description: 'Catalog Removal Inventory Write-Off: Lot LOT-002',
      referenceId: 'LOT-002',
      entityName: 'Internal Cold Vault [Acc 5150]',
      amount: 50,
      paymentMethod: 'Adjustment Account 5150',
      status: 'Settled',
    };
    const realSale: FinancialLedgerEntry = {
      id: 'FIN-ORD-100',
      date: '2026-04-12',
      type: 'Income',
      category: 'Revenue (Wholesale)',
      description: 'Wholesale Invoice #ORD-100',
      referenceId: 'ORD-100',
      entityName: 'Ocean Grill',
      amount: 350,
      paymentMethod: 'Bank Transfer',
      status: 'Settled',
    };
    const realOpex: FinancialLedgerEntry = {
      id: 'FIN-EXP-200',
      date: '2026-04-12',
      type: 'OpEx',
      category: 'Cold Storage Utilities',
      description: 'Power bill',
      referenceId: 'EXP-200',
      entityName: 'ECG',
      amount: 80,
      paymentMethod: 'Bank Transfer',
      status: 'Settled',
    };

    expect(isInventoryAdjustmentLedgerEntry(adjByCat)).toBe(true);
    expect(isInventoryAdjustmentLedgerEntry(writeOffById)).toBe(true);
    expect(isInventoryAdjustmentLedgerEntry(realSale)).toBe(false);
    expect(isInventoryAdjustmentLedgerEntry(realOpex)).toBe(false);
  });

  it('purges Inventory Adjustment entries from local cache via clearInventoryAdjustmentEntries', async () => {
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = String(v); },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { Object.keys(store).forEach(k => delete store[k]); },
      get length() { return Object.keys(store).length; },
      key: (i: number) => Object.keys(store)[i] ?? null,
    });

    const orgId = '11111111-1111-4111-8111-111111111111';
    localStorage.setItem('frostly_active_org_id', orgId);
    const orgSpy = vi.spyOn(financialRepository, 'getOrganizationId').mockResolvedValue(orgId);
    const supaSpy = vi.spyOn(financialRepository, 'canAccessSupabase').mockResolvedValue(false);

    const entries: FinancialLedgerEntry[] = [
      {
        id: 'FIN-ADJ-1001',
        date: '2026-04-10',
        type: 'COGS',
        category: 'Inventory Adjustment',
        description: 'Inventory Lot LOT-1 Adjustment (Test) - 5150 Shrinkage',
        referenceId: 'LOT-1',
        entityName: 'Internal Cold Vault [Acc 5150]',
        amount: 250,
        paymentMethod: 'Adjustment Account 5150',
        status: 'Settled',
      },
      {
        id: 'FIN-SALE-1',
        date: '2026-04-10',
        type: 'Income',
        category: 'Revenue (Wholesale)',
        description: 'Wholesale Invoice #ORD-1',
        referenceId: 'ORD-1',
        entityName: 'Client A',
        amount: 500,
        paymentMethod: 'Bank Wire',
        status: 'Settled',
      },
    ];
    financialRepository.setLocalCache(entries, orgId);

    const res = await financialRepository.clearInventoryAdjustmentEntries();
    expect(res.deletedCount).toBe(1);
    const remaining = financialRepository.getLocalCache([], orgId);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('FIN-SALE-1');

    orgSpy.mockRestore();
    supaSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
