import {
  ClientOrder,
  Customer,
  FinancialLedgerEntry,
  InventoryBatch,
  PurchaseOrderLanding,
  RetailTransaction,
  RetailWholesaleProduct,
  SpeciesCategory,
  Supplier,
} from '../types';
import { isReversalLedgerEntry } from '../repositories/financialRepository';

export function isOrderActive(order: Pick<ClientOrder, 'status' | 'paymentStatus'>): boolean {
  return (
    order.status !== 'Cancelled' &&
    order.status !== 'Voided' &&
    order.paymentStatus !== 'Cancelled' &&
    order.paymentStatus !== 'Voided'
  );
}

export function isOrderPaid(order: Pick<ClientOrder, 'paymentStatus'>): boolean {
  return order.paymentStatus === 'Paid' || order.paymentStatus === 'Paid in Full';
}

export function getOrderRevenue(order: ClientOrder): number {
  if (!isOrderActive(order)) return 0;
  return Number(order.adjustedTotalUSD || order.quotedTotalUSD || 0);
}

export function getRetailNetRevenue(sale: RetailTransaction): number {
  if (sale.status === 'Refunded') return 0;
  const total = Number(sale.totalAmount || 0);
  const tax = Number(sale.taxAmount || 0);
  if (tax > 0 && total >= tax) {
    return Math.max(0, Number((total - tax).toFixed(2)));
  }
  const subtotal = Number(sale.subtotal || 0);
  const discount = Number(sale.discountAmount || 0);
  if (subtotal > 0) {
    return Math.max(0, Number((subtotal - discount).toFixed(2)));
  }
  return Math.max(0, total);
}

export function calculateOrderCOGS(
  order: ClientOrder,
  batches: InventoryBatch[] = [],
  products: RetailWholesaleProduct[] = []
): number {
  if (!isOrderActive(order) || !order.items || order.items.length === 0) return 0;
  return order.items.reduce((sum, item) => {
    const qty = Number(item.actualWeighedKg ?? item.requestedWeightKg ?? 0);
    if (qty <= 0) return sum;
    const matchedBatch = batches.find(b => b.id === item.lotId);
    const matchedProd =
      products.find(p => p.linkedBatchId === item.lotId) ||
      products.find(p => p.speciesId === item.speciesId && p.grade === item.grade) ||
      products.find(p => p.speciesId === item.speciesId);
    const unitCost = Number(matchedBatch?.costPerKg ?? matchedProd?.costPricePerUnit ?? 0);
    return sum + qty * unitCost;
  }, 0);
}

export function calculateRetailSaleCOGS(
  sale: RetailTransaction,
  products: RetailWholesaleProduct[] = []
): number {
  if (sale.status === 'Refunded') return 0;
  if (sale.items && sale.items.length > 0) {
    return sale.items.reduce((sum, item) => {
      const qty = Number(item.quantity || 0);
      const prod = products.find(p => p.id === item.productId);
      const unitCost = Number(item.costPrice || prod?.costPricePerUnit || 0);
      return sum + qty * unitCost;
    }, 0);
  }
  return Math.max(0, Number(sale.costTotal || 0));
}

export function calculateInventoryAdjustmentImpact(financialEntries: FinancialLedgerEntry[] = []) {
  const adjustmentEntries = financialEntries.filter(e => e.category === 'Inventory Adjustment');
  const loss = adjustmentEntries
    .filter(e => e.type === 'COGS')
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const gain = adjustmentEntries
    .filter(e => e.type === 'Income')
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);
  return {
    invAdjustmentLoss: Number(loss.toFixed(2)),
    invAdjustmentGain: Number(gain.toFixed(2)),
    netInventoryAdjustmentCost: Number((loss - gain).toFixed(2)),
  };
}

export function calculateVaultValuation(batches: InventoryBatch[] = []) {
  const activeBatches = batches.filter(
    b => !(b.notes && b.notes.includes('[DECOMMISSIONED'))
  );
  const inStockBatches = activeBatches.filter(b => Number(b.availableWeightKg || 0) > 0);

  const availableWeightKg = inStockBatches.reduce((s, b) => s + Number(b.availableWeightKg || 0), 0);
  const allocatedWeightKg = activeBatches.reduce((s, b) => s + Math.max(0, Number(b.allocatedWeightKg || 0)), 0);
  const totalIntakeWeightKg = activeBatches.reduce((s, b) => s + Number(b.initialWeightKg || 0), 0);

  const costBasisUSD = inStockBatches.reduce(
    (s, b) => s + Number(b.availableWeightKg || 0) * Math.max(0, Number(b.costPerKg || 0)),
    0
  );
  const wholesaleMarketValueUSD = inStockBatches.reduce(
    (s, b) => s + Number(b.availableWeightKg || 0) * Math.max(0, Number(b.wholesalePricePerKg || 0)),
    0
  );
  const potentialProfitUSD = wholesaleMarketValueUSD - costBasisUSD;
  const potentialMarginPct = wholesaleMarketValueUSD > 0 ? (potentialProfitUSD / wholesaleMarketValueUSD) * 100 : 0;

  return {
    activeBatches,
    inStockBatches,
    activeBatchesCount: inStockBatches.length,
    availableWeightKg: Number(availableWeightKg.toFixed(2)),
    allocatedWeightKg: Number(allocatedWeightKg.toFixed(2)),
    totalIntakeWeightKg: Number(totalIntakeWeightKg.toFixed(2)),
    costBasisUSD: Number(costBasisUSD.toFixed(2)),
    wholesaleMarketValueUSD: Number(wholesaleMarketValueUSD.toFixed(2)),
    potentialProfitUSD: Number(potentialProfitUSD.toFixed(2)),
    potentialMarginPct: Number(potentialMarginPct.toFixed(1)),
  };
}

export function calculateCashInflowForEntries(
  financialEntries: FinancialLedgerEntry[] = [],
  retailSales: RetailTransaction[] = []
): number {
  const settledIncomeFromLedger = financialEntries
    .filter(e => e.type === 'Income' && e.status === 'Settled')
    .reduce((sum, e) => {
      const amt = Number(e.amount || 0);
      if (isReversalLedgerEntry(e)) {
        return sum - Math.abs(amt);
      }
      return sum + amt;
    }, 0);

  // Only include direct-payment retail tickets that do NOT already have a settled ledger entry
  // to avoid double-counting POS sales that post directly to financial_ledger_entries.
  const recordedSaleIds = new Set(
    financialEntries
      .filter(e => e.type === 'Income' && e.referenceId)
      .map(e => e.referenceId)
  );
  const recordedReceiptNums = new Set(
    financialEntries
      .filter(e => e.type === 'Income' && e.receiptNumber)
      .map(e => e.receiptNumber!)
  );

  const unrecordedDirectRetailCash = retailSales
    .filter(
      r =>
        r.status !== 'Refunded' &&
        r.paymentMethod !== 'Customer Credit Account' &&
        !recordedSaleIds.has(r.id) &&
        !recordedReceiptNums.has(r.receiptNumber)
    )
    .reduce((sum, r) => sum + Number(r.totalAmount || 0), 0);

  return Number((settledIncomeFromLedger + unrecordedDirectRetailCash).toFixed(2));
}

export function calculateCashOutflowForEntries(financialEntries: FinancialLedgerEntry[] = []): number {
  return Number(
    financialEntries
      .filter(e => {
        if (e.status !== 'Settled') return false;
        if (isReversalLedgerEntry(e)) return false;
        // Inventory adjustments are non-cash asset write-downs, not cash disbursements
        if (e.category === 'Inventory Adjustment') return false;
        return e.type === 'COGS' || e.type === 'OpEx';
      })
      .reduce((sum, e) => sum + Number(e.amount || 0), 0)
      .toFixed(2)
  );
}

export function calculateEnterpriseFinancials(params: {
  orders?: ClientOrder[];
  retailSales?: RetailTransaction[];
  batches?: InventoryBatch[];
  products?: RetailWholesaleProduct[];
  purchaseOrders?: PurchaseOrderLanding[];
  financialEntries?: FinancialLedgerEntry[];
  customers?: Customer[];
  suppliers?: Supplier[];
}) {
  const orders = params.orders || [];
  const retailSales = params.retailSales || [];
  const batches = params.batches || [];
  const products = params.products || [];
  const purchaseOrders = params.purchaseOrders || [];
  const financialEntries = params.financialEntries || [];
  const customers = params.customers || [];
  const suppliers = params.suppliers || [];

  const activeOrders = orders.filter(isOrderActive);
  const activeRetailSales = retailSales.filter(r => r.status !== 'Refunded');

  const wholesaleRevenue = activeOrders.reduce((sum, o) => sum + getOrderRevenue(o), 0);
  const retailRevenue = activeRetailSales.reduce((sum, r) => sum + getRetailNetRevenue(r), 0);
  const totalRevenue = wholesaleRevenue + retailRevenue;

  const wholesaleCOGS = activeOrders.reduce((sum, o) => sum + calculateOrderCOGS(o, batches, products), 0);
  const retailCOGS = activeRetailSales.reduce((sum, r) => sum + calculateRetailSaleCOGS(r, products), 0);
  const soldCOGS = Number((wholesaleCOGS + retailCOGS).toFixed(2));

  const totalIntakeSpend = purchaseOrders.reduce((sum, po) => sum + Number(po.totalCostUSD || 0), 0);
  const { invAdjustmentLoss, invAdjustmentGain, netInventoryAdjustmentCost } =
    calculateInventoryAdjustmentImpact(financialEntries);

  const totalCOGS = Number((soldCOGS + netInventoryAdjustmentCost).toFixed(2));
  const grossProfit = Number((totalRevenue - totalCOGS).toFixed(2));
  const grossMarginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  const opexEntries = financialEntries.filter(e => e.type === 'OpEx' && !isReversalLedgerEntry(e));
  const totalOpEx = opexEntries.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const netOperatingProfit = Number((grossProfit - totalOpEx).toFixed(2));
  const netMarginPct = totalRevenue > 0 ? (netOperatingProfit / totalRevenue) * 100 : 0;

  const totalAR = customers.reduce((sum, c) => sum + Number(c.outstandingBalanceUSD || 0), 0);
  const totalAP = suppliers.reduce((sum, s) => sum + Number(s.outstandingPayableUSD || 0), 0);

  return {
    activeOrders,
    activeOrdersCount: activeOrders.length,
    activeRetailSalesCount: activeRetailSales.length,
    wholesaleRevenue: Number(wholesaleRevenue.toFixed(2)),
    retailRevenue: Number(retailRevenue.toFixed(2)),
    totalRevenue: Number(totalRevenue.toFixed(2)),
    wholesaleCOGS: Number(wholesaleCOGS.toFixed(2)),
    retailCOGS: Number(retailCOGS.toFixed(2)),
    soldCOGS,
    totalIntakeSpend: Number(totalIntakeSpend.toFixed(2)),
    invAdjustmentLoss,
    invAdjustmentGain,
    netInventoryAdjustmentCost,
    totalCOGS,
    grossProfit,
    grossMarginPct,
    totalOpEx: Number(totalOpEx.toFixed(2)),
    netOperatingProfit,
    netMarginPct,
    totalAR: Number(totalAR.toFixed(2)),
    totalAP: Number(totalAP.toFixed(2)),
  };
}

const CATEGORY_COLORS: Record<string, string> = {
  Pelagic: '#3b82f6',
  Salmonid: '#10b981',
  Crustacean: '#f59e0b',
  Mollusk: '#8b5cf6',
  Groundfish: '#06b6d4',
};

export function calculateCategoryRevenueBreakdown(params: {
  orders?: ClientOrder[];
  retailSales?: RetailTransaction[];
  batches?: InventoryBatch[];
  products?: RetailWholesaleProduct[];
}): Array<{ name: string; revenue: number; value: number; color: string }> {
  const orders = (params.orders || []).filter(isOrderActive);
  const retailSales = (params.retailSales || []).filter(r => r.status !== 'Refunded');
  const batches = params.batches || [];
  const products = params.products || [];

  const totals: Record<string, number> = {};

  const addCatRev = (cat: string, rev: number) => {
    if (rev <= 0) return;
    totals[cat] = (totals[cat] || 0) + rev;
  };

  orders.forEach(order => {
    const items = order.items || [];
    if (items.length === 0) return;
    const rawLineSum = items.reduce(
      (s, i) => s + Number(i.actualWeighedKg ?? i.requestedWeightKg ?? 0) * Number(i.pricePerKg || 0),
      0
    );
    const orderTotal = getOrderRevenue(order);
    const scale = rawLineSum > 0 ? orderTotal / rawLineSum : 1;

    items.forEach(item => {
      const batch = batches.find(b => b.id === item.lotId);
      const prod = products.find(p => p.speciesId === item.speciesId);
      const cat: SpeciesCategory | string = batch?.category || prod?.category || 'Pelagic';
      const lineRev = Number(item.actualWeighedKg ?? item.requestedWeightKg ?? 0) * Number(item.pricePerKg || 0) * scale;
      addCatRev(cat, lineRev);
    });
  });

  retailSales.forEach(sale => {
    const items = sale.items || [];
    if (items.length === 0) return;
    const netRev = getRetailNetRevenue(sale);
    const rawSum = items.reduce((s, i) => s + Number(i.lineTotal || i.quantity * i.unitPrice || 0), 0);
    const scale = rawSum > 0 ? netRev / rawSum : 1;

    items.forEach(item => {
      const prod = products.find(p => p.id === item.productId || p.name.toLowerCase() === item.productName.toLowerCase());
      const cat = prod?.category || 'Pelagic';
      const lineRev = Number(item.lineTotal || item.quantity * item.unitPrice || 0) * scale;
      addCatRev(cat, lineRev);
    });
  });

  const grandTotal = Object.values(totals).reduce((s, v) => s + v, 0);
  if (grandTotal <= 0) return [];

  return Object.entries(totals)
    .sort(([, a], [, b]) => b - a)
    .map(([name, revenue]) => ({
      name,
      revenue: Number(revenue.toFixed(2)),
      value: Math.round((revenue / grandTotal) * 1000) / 10,
      color: CATEGORY_COLORS[name] || '#64748b',
    }));
}

export interface SpeciesMarginBenchmark {
  speciesName: string;
  category: string;
  avgCostPerKg: number;
  avgWholesalePerKg: number;
  avgRetailPerUnit: number;
  marginPct: number;
  availableWeightKg: number;
}

export function calculateSpeciesMarginBenchmarks(params: {
  batches?: InventoryBatch[];
  products?: RetailWholesaleProduct[];
}): SpeciesMarginBenchmark[] {
  const batches = (params.batches || []).filter(
    b => !(b.notes && b.notes.includes('[DECOMMISSIONED'))
  );
  const products = params.products || [];

  const bySpecies = new Map<
    string,
    {
      speciesName: string;
      category: string;
      costSum: number;
      wsSum: number;
      weightSum: number;
      lotCount: number;
      retailSum: number;
      retailCount: number;
    }
  >();

  batches.forEach(b => {
    const key = (b.speciesName || b.speciesId || 'Unknown').trim();
    const w = Math.max(1, Number(b.availableWeightKg || b.initialWeightKg || 0));
    const cur = bySpecies.get(key) || {
      speciesName: b.speciesName,
      category: b.category,
      costSum: 0,
      wsSum: 0,
      weightSum: 0,
      lotCount: 0,
      retailSum: 0,
      retailCount: 0,
    };
    cur.costSum += Number(b.costPerKg || 0) * w;
    cur.wsSum += Number(b.wholesalePricePerKg || 0) * w;
    cur.weightSum += w;
    cur.lotCount += 1;
    bySpecies.set(key, cur);
  });

  products.forEach(p => {
    const key = (p.name || p.speciesId || 'Unknown').trim();
    const cur = bySpecies.get(key) || {
      speciesName: p.name,
      category: p.category,
      costSum: 0,
      wsSum: 0,
      weightSum: 0,
      lotCount: 0,
      retailSum: 0,
      retailCount: 0,
    };
    if (cur.lotCount === 0) {
      const w = Math.max(1, Number(p.stockKg || 0));
      cur.costSum += Number(p.costPricePerUnit || 0) * w;
      cur.wsSum += Number(p.wholesalePricePerUnit || 0) * w;
      cur.weightSum += w;
      cur.lotCount += 1;
    }
    if (p.retailPricePerUnit > 0) {
      cur.retailSum += Number(p.retailPricePerUnit);
      cur.retailCount += 1;
    }
    bySpecies.set(key, cur);
  });

  return Array.from(bySpecies.values())
    .map(entry => {
      const avgCost = entry.weightSum > 0 ? entry.costSum / entry.weightSum : 0;
      const avgWs = entry.weightSum > 0 ? entry.wsSum / entry.weightSum : 0;
      const avgRetail =
        entry.retailCount > 0 ? entry.retailSum / entry.retailCount : avgWs * 1.3;
      const marginPct = avgWs > 0 ? ((avgWs - avgCost) / avgWs) * 100 : 0;

      return {
        speciesName: entry.speciesName,
        category: entry.category,
        avgCostPerKg: Number(avgCost.toFixed(2)),
        avgWholesalePerKg: Number(avgWs.toFixed(2)),
        avgRetailPerUnit: Number(avgRetail.toFixed(2)),
        marginPct: Number(marginPct.toFixed(1)),
        availableWeightKg: Number(entry.weightSum.toFixed(1)),
      };
    })
    .filter(item => item.avgWholesalePerKg > 0 || item.avgCostPerKg > 0)
    .sort((a, b) => b.availableWeightKg - a.availableWeightKg)
    .slice(0, 6);
}
