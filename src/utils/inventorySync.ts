import {
  ClientOrder,
  InventoryBatch,
  OrderLineItem,
  RetailSaleItem,
  RetailWholesaleProduct,
} from '../types';
import { isOrderActive, isOrderPaid } from './financialMetrics';

export function getEffectiveLineWeightKg(item: Pick<OrderLineItem, 'requestedWeightKg' | 'actualWeighedKg'>): number {
  const raw = item.actualWeighedKg !== null && item.actualWeighedKg !== undefined
    ? item.actualWeighedKg
    : item.requestedWeightKg;
  return Math.max(0, Number(raw) || 0);
}

/**
 * Sum effective weight per lotId across an array of order line items.
 */
export function aggregateWeightByLot(items: OrderLineItem[] = []): Map<string, number> {
  const map = new Map<string, number>();
  items.forEach(item => {
    if (!item.lotId) return;
    const qty = getEffectiveLineWeightKg(item);
    if (qty <= 0) return;
    map.set(item.lotId, Number(((map.get(item.lotId) || 0) + qty).toFixed(2)));
  });
  return map;
}

/**
 * Validates that requested weights per lot do not exceed available stock
 * (crediting back any weight already held by `existingOrder` when editing/weighing).
 */
export function validateOrderLotAvailability(
  nextItems: OrderLineItem[],
  batches: InventoryBatch[],
  existingOrder?: ClientOrder
): { valid: boolean; error?: string } {
  const nextByLot = aggregateWeightByLot(nextItems);
  const prevByLot =
    existingOrder && isOrderActive(existingOrder)
      ? aggregateWeightByLot(existingOrder.items || [])
      : new Map<string, number>();

  for (const [lotId, requestedKg] of nextByLot.entries()) {
    const batch = batches.find(b => b.id === lotId);
    if (!batch) continue;
    const alreadyHeldKg = prevByLot.get(lotId) || 0;
    const maxAllowableKg = Number((Math.max(0, batch.availableWeightKg) + alreadyHeldKg).toFixed(2));
    if (requestedKg > maxAllowableKg + 0.01) {
      return {
        valid: false,
        error: `Insufficient stock in ${batch.speciesName} (${lotId}): requested ${requestedKg.toFixed(1)} kg exceeds available ${maxAllowableKg.toFixed(1)} kg.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Applies allocation deltas to InventoryBatches cleanly using availableWeightKg +/- delta
 * rather than recalculating from initialWeightKg - allocatedWeightKg (which would erase prior POS sales & adjustments).
 */
export function applyOrderAllocationDeltas(
  batches: InventoryBatch[],
  oldItems: OrderLineItem[],
  oldActive: boolean,
  newItems: OrderLineItem[],
  newActive: boolean
): { updatedBatches: InventoryBatch[]; changedBatches: InventoryBatch[] } {
  const oldByLot = oldActive ? aggregateWeightByLot(oldItems) : new Map<string, number>();
  const newByLot = newActive ? aggregateWeightByLot(newItems) : new Map<string, number>();

  const affectedLotIds = new Set<string>([...oldByLot.keys(), ...newByLot.keys()]);
  const changedBatches: InventoryBatch[] = [];

  const updatedBatches = batches.map(batch => {
    if (!affectedLotIds.has(batch.id)) return batch;

    const oldQty = oldByLot.get(batch.id) || 0;
    const newQty = newByLot.get(batch.id) || 0;
    const delta = Number((newQty - oldQty).toFixed(2));
    if (Math.abs(delta) < 0.001) return batch;

    const nextAllocated = Math.max(0, Number(((batch.allocatedWeightKg || 0) + delta).toFixed(2)));
    const nextAvailable = Math.max(0, Number(((batch.availableWeightKg || 0) - delta).toFixed(2)));

    const updated: InventoryBatch = {
      ...batch,
      allocatedWeightKg: nextAllocated,
      availableWeightKg: nextAvailable,
    };
    changedBatches.push(updated);
    return updated;
  });

  return { updatedBatches, changedBatches };
}

/**
 * Matches a RetailWholesaleProduct and InventoryBatch using explicit links, SKUs, or deterministic IDs.
 */
export function doesBatchMatchProduct(batch: InventoryBatch, product: RetailWholesaleProduct): boolean {
  const batchSkuClean = (batch.productSku || '').toLowerCase().trim();
  const prodSkuClean = (product.sku || '').toLowerCase().trim();
  const detProdBatchId = `LOT-RET-${(product.sku || product.id).toUpperCase().replace(/[^A-Z0-9-]/g, '')}`;

  return Boolean(
    (product.linkedBatchId && product.linkedBatchId === batch.id) ||
      (batch.linkedProductId && batch.linkedProductId === product.id) ||
      (batchSkuClean && prodSkuClean && batchSkuClean === prodSkuClean) ||
      batch.id === detProdBatchId ||
      batch.id === `LOT-RET-${product.id.replace('prod-', '')}` ||
      batch.id === `LOT-RET-${product.id}` ||
      product.id === `prod-${batch.id}`
  );
}

/**
 * Deducts sold POS quantities from both RetailWholesaleProducts and linked InventoryBatches consistently.
 */
export function applyRetailSaleStockDeductions(
  products: RetailWholesaleProduct[],
  batches: InventoryBatch[],
  saleItems: RetailSaleItem[]
): {
  updatedProducts: RetailWholesaleProduct[];
  changedProducts: RetailWholesaleProduct[];
  updatedBatches: InventoryBatch[];
  changedBatches: InventoryBatch[];
} {
  const soldWeightByProductId = new Map<string, number>();

  saleItems.forEach(item => {
    const prod = products.find(p => p.id === item.productId);
    const unit = prod?.unit || item.unit;
    const soldWeight = unit === 'pack' ? Number(item.quantity) * 0.5 : Number(item.quantity);
    if (soldWeight > 0) {
      soldWeightByProductId.set(
        item.productId,
        Number(((soldWeightByProductId.get(item.productId) || 0) + soldWeight).toFixed(2))
      );
    }
  });

  const changedProducts: RetailWholesaleProduct[] = [];
  const updatedProducts = products.map(prod => {
    const soldWeight = soldWeightByProductId.get(prod.id);
    if (!soldWeight) return prod;
    const updated: RetailWholesaleProduct = {
      ...prod,
      stockKg: Math.max(0, Number((prod.stockKg - soldWeight).toFixed(2))),
    };
    changedProducts.push(updated);
    return updated;
  });

  const changedBatches: InventoryBatch[] = [];
  const updatedBatches = batches.map(batch => {
    let deductedWeight = 0;

    for (const [productId, weight] of soldWeightByProductId.entries()) {
      const matchedProd = products.find(p => p.id === productId);
      const saleItem = saleItems.find(i => i.productId === productId);
      const isLinked =
        (batch.linkedProductId && batch.linkedProductId === productId) ||
        (matchedProd && doesBatchMatchProduct(batch, matchedProd)) ||
        (batch.productSku && saleItem?.productName?.includes(batch.productSku));

      if (isLinked) {
        deductedWeight += weight;
      }
    }

    if (deductedWeight <= 0) return batch;

    const newAvailable = Math.max(0, Number((batch.availableWeightKg - deductedWeight).toFixed(2)));
    const updated: InventoryBatch = {
      ...batch,
      availableWeightKg: newAvailable,
    };
    changedBatches.push(updated);
    return updated;
  });

  return { updatedProducts, changedProducts, updatedBatches, changedBatches };
}

/**
 * Computes deltas to customer order count, lifetime spend, and AR balance
 * when an order transitions between states (create, edit, weigh, void, delete).
 */
export function computeOrderCustomerFinancialDelta(
  prevOrder: ClientOrder | undefined,
  nextOrder: ClientOrder | undefined
): {
  ordersCountDelta: number;
  totalSpendDelta: number;
  outstandingBalanceDelta: number;
} {
  const prevActive = prevOrder ? isOrderActive(prevOrder) : false;
  const nextActive = nextOrder ? isOrderActive(nextOrder) : false;

  const prevSpend = prevActive ? Number(prevOrder!.adjustedTotalUSD || prevOrder!.quotedTotalUSD || 0) : 0;
  const nextSpend = nextActive ? Number(nextOrder!.adjustedTotalUSD || nextOrder!.quotedTotalUSD || 0) : 0;

  const prevAR = prevActive && !isOrderPaid(prevOrder!) ? prevSpend : 0;
  const nextAR = nextActive && !isOrderPaid(nextOrder!) ? nextSpend : 0;

  // On delete (nextOrder === undefined), decrement order count if prevOrder existed;
  // on void (nextOrder exists with status Voided/Cancelled), keep historical order count or treat only delete as -1.
  const ordersCountDelta =
    !prevOrder && nextOrder ? 1 : prevOrder && !nextOrder ? -1 : 0;

  return {
    ordersCountDelta,
    totalSpendDelta: Number((nextSpend - prevSpend).toFixed(2)),
    outstandingBalanceDelta: Number((nextAR - prevAR).toFixed(2)),
  };
}
