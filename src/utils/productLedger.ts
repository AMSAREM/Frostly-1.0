import { 
  RetailWholesaleProduct, 
  InventoryBatch, 
  RetailTransaction, 
  ClientOrder, 
  InventoryStockAdjustment, 
  PurchaseOrderLanding,
  ProductLedgerEntry,
  ProductLedgerSummary
} from '../types';

/**
 * Builds a chronological perpetual Product Movement Ledger (Stock Card)
 * compiling:
 * 1. Catch Landings & Vessel Intake Batches (Inward)
 * 2. Retail POS Walk-in Sales (Outward)
 * 3. Wholesale B2B Client Orders (Outward)
 * 4. Vault Calibration Variances / Audit Adjustments (Inward / Outward)
 * 5. Purchase Order Receipts (Inward)
 * 6. Perpetual running stock on hand balance after each movement
 */
export function buildProductLedger(
  product: RetailWholesaleProduct,
  batches: InventoryBatch[] = [],
  retailSales: RetailTransaction[] = [],
  orders: ClientOrder[] = [],
  stockAdjustments: InventoryStockAdjustment[] = [],
  purchaseOrders: PurchaseOrderLanding[] = []
): { entries: ProductLedgerEntry[]; summary: ProductLedgerSummary } {
  const productNameLower = product.name.toLowerCase().trim();
  const productSkuLower = (product.sku || '').toLowerCase().trim();

  // Find linked batch IDs: prioritize explicit product/SKU/lot matches
  const directBatches = batches.filter(b => 
    (b.linkedProductId && b.linkedProductId === product.id) ||
    (b.productSku && productSkuLower && b.productSku.toLowerCase().trim() === productSkuLower) ||
    (product.linkedBatchId && b.id === product.linkedBatchId) ||
    b.id === `LOT-RET-${(product.sku || product.id).toUpperCase().replace(/[^A-Z0-9-]/g, '')}` ||
    b.id === `LOT-RET-${product.id.replace('prod-', '')}` ||
    b.id === `LOT-RET-${product.id}`
  );

  const linkedBatches = directBatches.length > 0
    ? directBatches
    : batches.filter(b => b.speciesId === product.speciesId && b.grade === product.grade);

  const linkedBatchIds = new Set(linkedBatches.map(b => b.id));

  const rawMovements: Array<{
    date: string;
    sortKey: number;
    movement: Omit<ProductLedgerEntry, 'runningBalance'>;
  }> = [];

  // 1. Vessel Intake Batches (Catch Landings allocated to this cut)
  linkedBatches.forEach(batch => {
    const intakeWeight = batch.initialWeightKg || batch.availableWeightKg || 50;
    const dateStr = batch.harvestDate || batch.receivedDate || new Date().toISOString().split('T')[0];

    rawMovements.push({
      date: dateStr,
      sortKey: new Date(dateStr).getTime() || 0,
      movement: {
        id: `LEDG-INTAKE-${batch.id}`,
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        date: dateStr,
        movementType: 'Vessel Catch Intake',
        referenceId: batch.id,
        description: `Catch Landing received from ${batch.vesselName || 'Harvest Vessel'} (${batch.landingPort || 'Harbour Quay'})`,
        channel: 'Catch Landings',
        quantityIn: intakeWeight,
        quantityOut: 0,
        netChange: intakeWeight,
        unit: product.unit,
        unitCost: batch.costPerKg || product.costPricePerUnit,
        unitPrice: batch.wholesalePricePerKg || product.wholesalePricePerUnit,
        totalValuationUSD: intakeWeight * (batch.costPerKg || product.costPricePerUnit),
        performedBy: batch.captainName ? `Capt. ${batch.captainName}` : 'Dockside Intake Officer',
        batchLotId: batch.id,
        notes: `Grade: ${batch.grade} • Zone: ${batch.storageZone}`
      }
    });
  });

  // 2. Retail POS Counter Transactions
  retailSales.forEach(sale => {
    if (!sale.items || sale.items.length === 0) return;
    const dateStr = sale.date ? sale.date.split(' ')[0] : new Date().toISOString().split('T')[0];

    sale.items.forEach((item, idx) => {
      const isMatch = 
        item.productId === product.id ||
        (product.sku && item.productId === product.sku) ||
        item.productName.toLowerCase().trim() === productNameLower;

      if (isMatch) {
        const qty = item.quantity || 1;
        const lineValuation = qty * (item.costPrice || product.costPricePerUnit);
        const lineRevenue = item.lineTotal || (qty * item.unitPrice);

        rawMovements.push({
          date: dateStr,
          sortKey: new Date(sale.date || dateStr).getTime() || 0,
          movement: {
            id: `LEDG-POS-${sale.id}-${idx}`,
            productId: product.id,
            productName: product.name,
            productSku: product.sku,
            date: dateStr,
            movementType: 'Retail POS Sale',
            referenceId: sale.receiptNumber || sale.id,
            description: `Walk-in POS Sale to ${sale.customerName || 'Retail Customer'} (${sale.paymentMethod || 'Direct Payment'})`,
            channel: 'Retail POS',
            quantityIn: 0,
            quantityOut: qty,
            netChange: -qty,
            unit: item.unit || product.unit,
            unitCost: item.costPrice || product.costPricePerUnit,
            unitPrice: item.unitPrice || product.retailPricePerUnit,
            totalValuationUSD: lineValuation,
            revenueUSD: lineRevenue,
            performedBy: sale.cashierName || 'Counter Cashier',
            notes: item.isBulkDiscountApplied ? `Bulk discount rate applied: -${item.discountRatePct || 10}%` : undefined
          }
        });
      }
    });
  });

  // 3. Wholesale Client Orders
  orders.forEach(order => {
    if (!order.items || order.items.length === 0) return;
    if (order.status === 'Cancelled') return;
    const dateStr = order.orderDate || new Date().toISOString().split('T')[0];

    order.items.forEach((item, idx) => {
      const isMatch = 
        (product.linkedBatchId && item.lotId === product.linkedBatchId) ||
        linkedBatchIds.has(item.lotId) ||
        item.speciesId === product.speciesId ||
        item.speciesName.toLowerCase().trim().includes(productNameLower) ||
        productNameLower.includes(item.speciesName.toLowerCase().trim());

      if (isMatch) {
        const qty = item.actualWeighedKg ?? item.requestedWeightKg ?? 10;
        const lineValuation = qty * product.costPricePerUnit;
        const lineRevenue = qty * item.pricePerKg;

        rawMovements.push({
          date: dateStr,
          sortKey: new Date(dateStr).getTime() || 0,
          movement: {
            id: `LEDG-ORD-${order.id}-${idx}`,
            productId: product.id,
            productName: product.name,
            productSku: product.sku,
            date: dateStr,
            movementType: 'Wholesale Order Fulfillment',
            referenceId: order.id,
            description: `Commercial Wholesale Dispatch for ${order.clientName} (${order.destinationCity || 'Regional Route'})`,
            channel: 'Wholesale B2B',
            quantityIn: 0,
            quantityOut: qty,
            netChange: -qty,
            unit: product.unit,
            unitCost: product.costPricePerUnit,
            unitPrice: item.pricePerKg,
            totalValuationUSD: lineValuation,
            revenueUSD: lineRevenue,
            performedBy: order.assignedDriver || 'Cold-Vault Dispatch Crew',
            batchLotId: item.lotId,
            notes: `Fulfillment: ${order.status} • Packaging: ${order.packagingRequirement}`
          }
        });
      }
    });
  });

  // 4. Inventory Stock Adjustments (Audit Variances, Shrinkage & Found Stock)
  stockAdjustments.forEach(adj => {
    const isMatch = 
      (product.linkedBatchId && adj.batchId === product.linkedBatchId) ||
      linkedBatchIds.has(adj.batchId) ||
      adj.speciesName.toLowerCase().trim().includes(productNameLower) ||
      productNameLower.includes(adj.speciesName.toLowerCase().trim());

    if (isMatch) {
      const dateStr = adj.createdAt ? adj.createdAt.split('T')[0] : new Date().toISOString().split('T')[0];
      const isGain = adj.deltaWeightKg > 0;
      const absQty = Math.abs(adj.deltaWeightKg);

      rawMovements.push({
        date: dateStr,
        sortKey: new Date(adj.createdAt || dateStr).getTime() || 0,
        movement: {
          id: `LEDG-ADJ-${adj.id}`,
          productId: product.id,
          productName: product.name,
          productSku: product.sku,
          date: dateStr,
          movementType: isGain ? 'Stock Calibration Recovery' : 'Stock Calibration Loss',
          referenceId: adj.id,
          description: `Vault Scale Audit: ${adj.reason} (GL [${adj.adjustmentAccountCode}] ${adj.adjustmentAccountName})`,
          channel: 'Cold Vault Audit',
          quantityIn: isGain ? absQty : 0,
          quantityOut: isGain ? 0 : absQty,
          netChange: adj.deltaWeightKg,
          unit: product.unit,
          unitCost: adj.unitCostUSD || product.costPricePerUnit,
          totalValuationUSD: Math.abs(adj.valuationVarianceUSD || (absQty * product.costPricePerUnit)),
          performedBy: adj.createdBy || 'Lead Quality Auditor',
          batchLotId: adj.batchId,
          notes: adj.notes
        }
      });
    }
  });

  // 5. Purchase Order Receipts
  purchaseOrders.forEach(po => {
    if (po.status !== 'Received & In Stock') return;
    const dateStr = po.deliveryDate || po.orderDate || new Date().toISOString().split('T')[0];

    (po.speciesItems || []).forEach((pi, idx) => {
      const isMatch = 
        pi.speciesName.toLowerCase().trim().includes(productNameLower) ||
        productNameLower.includes(pi.speciesName.toLowerCase().trim());

      if (isMatch) {
        rawMovements.push({
          date: dateStr,
          sortKey: new Date(dateStr).getTime() || 0,
          movement: {
            id: `LEDG-PO-${po.id}-${idx}`,
            productId: product.id,
            productName: product.name,
            productSku: product.sku,
            date: dateStr,
            movementType: 'Opening Stock / Intake',
            referenceId: po.id,
            description: `Direct Catch Inward Purchase from ${po.supplierName} (${po.vesselName})`,
            channel: 'Catch Landings',
            quantityIn: pi.weightKg,
            quantityOut: 0,
            netChange: pi.weightKg,
            unit: product.unit,
            unitCost: pi.costPerKg || product.costPricePerUnit,
            totalValuationUSD: pi.totalCost || (pi.weightKg * pi.costPerKg),
            performedBy: po.receivedBy || 'Receiving Supervisor',
            batchLotId: po.lotAssignedId,
            notes: `Grade: ${pi.grade} • Zone: ${pi.storageZone}`
          }
        });
      }
    });
  });

  // Sort movements chronologically (oldest to newest)
  rawMovements.sort((a, b) => a.sortKey - b.sortKey);

  // Reconcile Baseline:
  // Calculate total inflows and outflows from movements
  let recordedInflow = 0;
  let recordedOutflow = 0;
  rawMovements.forEach(m => {
    recordedInflow += m.movement.quantityIn;
    recordedOutflow += m.movement.quantityOut;
  });

  // If there are no movements yet or if product has established stock, ensure opening balance exists
  const targetStock = product.stockKg;
  const impliedOpening = Math.max(0, targetStock + recordedOutflow - recordedInflow);

  // If impliedOpening > 0 and no initial opening movement existed, inject opening balance
  if (impliedOpening > 0 && rawMovements.length === 0) {
    const openingDate = '2026-01-01';
    rawMovements.unshift({
      date: openingDate,
      sortKey: new Date(openingDate).getTime(),
      movement: {
        id: `LEDG-OPEN-${product.id}`,
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        date: openingDate,
        movementType: 'Opening Stock / Intake',
        referenceId: `OPEN-${product.sku}`,
        description: `Initial Vault Cold-Storage Stock on Hand Setup (${product.cutType})`,
        channel: 'Catch Landings',
        quantityIn: parseFloat(impliedOpening.toFixed(2)),
        quantityOut: 0,
        netChange: parseFloat(impliedOpening.toFixed(2)),
        unit: product.unit,
        unitCost: product.costPricePerUnit,
        totalValuationUSD: parseFloat((impliedOpening * product.costPricePerUnit).toFixed(2)),
        performedBy: 'System Warehouse Initialization',
        notes: `Opening perpetual baseline for ${product.name} (${product.grade})`
      }
    });
  } else if (rawMovements.length > 0 && Math.abs((recordedInflow - recordedOutflow) - targetStock) > 0.05) {
    // Inject calibrated baseline adjustment at beginning of records
    const diff = targetStock - (recordedInflow - recordedOutflow);
    const openingDate = rawMovements[0]?.date || '2026-01-01';

    if (diff > 0) {
      rawMovements.unshift({
        date: openingDate,
        sortKey: rawMovements[0].sortKey - 1000,
        movement: {
          id: `LEDG-BASE-${product.id}`,
          productId: product.id,
          productName: product.name,
          productSku: product.sku,
          date: openingDate,
          movementType: 'Opening Stock / Intake',
          referenceId: `BASE-${product.sku}`,
          description: `Perpetual Inventory Intake Baseline (${product.storageZone || 'Commercial Cold Storage'})`,
          channel: 'Catch Landings',
          quantityIn: parseFloat(diff.toFixed(2)),
          quantityOut: 0,
          netChange: parseFloat(diff.toFixed(2)),
          unit: product.unit,
          unitCost: product.costPricePerUnit,
          totalValuationUSD: parseFloat((diff * product.costPricePerUnit).toFixed(2)),
          performedBy: 'Cold-Chain Inventory Auditor',
          notes: 'Standardized perpetual inventory alignment'
        }
      });
    }
  }

  // Compute perpetual running balance forward
  let currentRunning = 0;
  const entriesChronological: ProductLedgerEntry[] = rawMovements.map(item => {
    currentRunning = parseFloat((currentRunning + item.movement.quantityIn - item.movement.quantityOut).toFixed(2));
    return {
      ...item.movement,
      runningBalance: Math.max(0, currentRunning)
    };
  });

  // Build summary metrics
  let totalInward = 0;
  let totalOutward = 0;
  let retailQty = 0;
  let retailRev = 0;
  let wholesaleQty = 0;
  let wholesaleRev = 0;
  let totalRev = 0;
  let netAdj = 0;

  entriesChronological.forEach(e => {
    totalInward += e.quantityIn;
    totalOutward += e.quantityOut;

    if (e.channel === 'Retail POS') {
      retailQty += e.quantityOut;
      retailRev += (e.revenueUSD || 0);
      totalRev += (e.revenueUSD || 0);
    } else if (e.channel === 'Wholesale B2B') {
      wholesaleQty += e.quantityOut;
      wholesaleRev += (e.revenueUSD || 0);
      totalRev += (e.revenueUSD || 0);
    } else if (e.channel === 'Cold Vault Audit') {
      netAdj += e.netChange;
    }
  });

  const totalCogs = totalOutward * product.costPricePerUnit;
  const grossMarginUSD = totalRev - totalCogs;
  const grossMarginPct = totalRev > 0 ? (grossMarginUSD / totalRev) * 100 : 0;

  // Order entries newest first for statement presentation
  const entries = [...entriesChronological].reverse();

  const summary: ProductLedgerSummary = {
    productId: product.id,
    productName: product.name,
    productSku: product.sku,
    unit: product.unit,
    currentStock: product.stockKg,
    currentValuation: parseFloat((product.stockKg * product.costPricePerUnit).toFixed(2)),
    totalInwardStock: parseFloat(totalInward.toFixed(2)),
    totalOutwardStock: parseFloat(totalOutward.toFixed(2)),
    retailSalesQty: parseFloat(retailQty.toFixed(2)),
    retailSalesRevenue: parseFloat(retailRev.toFixed(2)),
    wholesaleSalesQty: parseFloat(wholesaleQty.toFixed(2)),
    wholesaleSalesRevenue: parseFloat(wholesaleRev.toFixed(2)),
    totalRevenue: parseFloat(totalRev.toFixed(2)),
    totalCogs: parseFloat(totalCogs.toFixed(2)),
    grossMarginUSD: parseFloat(grossMarginUSD.toFixed(2)),
    grossMarginPct: parseFloat(grossMarginPct.toFixed(1)),
    netAdjustmentQty: parseFloat(netAdj.toFixed(2)),
    movementsCount: entries.length,
    lastMovementDate: entries[0]?.date
  };

  return { entries, summary };
}
