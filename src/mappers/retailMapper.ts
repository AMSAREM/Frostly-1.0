import { RetailWholesaleProduct, RetailTransaction, RetailSaleItem, SeafoodCutType, SpeciesCategory, QualityGrade } from '../types';

export interface DatabaseProductRow {
  id: string;
  species_id: string;
  name: string;
  cut_type: string;
  category: string;
  grade: string;
  stock_kg: number | string;
  unit: string;
  cost_price_per_unit: number | string;
  wholesale_price_per_unit: number | string;
  retail_price_per_unit: number | string;
  wholesale_min_qty: number | string;
  retail_pack_size?: string | null;
  sku: string;
  image_url: string;
  origin: string;
  is_available_for_retail: boolean;
  is_available_for_wholesale: boolean;
  linked_batch_id?: string | null;
  storage_zone?: string | null;
  min_safety_stock_kg?: number | string | null;
  is_active?: boolean;
  organization_id?: string;
}

export interface DatabaseRetailTransactionRow {
  id: string;
  receipt_number: string;
  customer_name: string;
  customer_phone?: string | null;
  subtotal: number | string;
  tax_amount: number | string;
  discount_amount: number | string;
  total_amount: number | string;
  cost_total: number | string;
  gross_margin: number | string;
  payment_method: string;
  cashier_name: string;
  status: string;
  created_at?: string;
  organization_id?: string;
  retail_sale_items?: any[];
  items?: any[];
}

export function parseProductOriginMeta(rawOrigin?: string | null): {
  cleanOrigin: string;
  linkedBatchId?: string;
  storageZone?: string;
  minSafetyStockKg?: number;
} {
  let cleanOrigin = String(rawOrigin || '');
  let linkedBatchId: string | undefined;
  let storageZone: string | undefined;
  let minSafetyStockKg: number | undefined;

  if (cleanOrigin.includes('<!--frostly_lot:')) {
    try {
      const match = cleanOrigin.match(/<!--frostly_lot:(\{.*?\})-->/);
      if (match && match[1]) {
        const parsed = JSON.parse(match[1]);
        if (parsed.linkedBatchId) linkedBatchId = String(parsed.linkedBatchId);
        if (parsed.storageZone) storageZone = String(parsed.storageZone);
        if (parsed.minSafetyStockKg !== undefined && parsed.minSafetyStockKg !== null) {
          minSafetyStockKg = Number(parsed.minSafetyStockKg);
        }
      }
    } catch {
      // ignore malformed comment metadata
    }
    cleanOrigin = cleanOrigin.replace(/<!--frostly_lot:.*?-->/g, '').trim();
  }

  return { cleanOrigin, linkedBatchId, storageZone, minSafetyStockKg };
}

export function encodeProductOriginMeta(
  origin: string,
  linkedBatchId?: string | null,
  storageZone?: string | null,
  minSafetyStockKg?: number | null
): string {
  const { cleanOrigin } = parseProductOriginMeta(origin);
  const hasSafety = minSafetyStockKg !== undefined && minSafetyStockKg !== null;
  if (!linkedBatchId && !storageZone && !hasSafety) {
    return cleanOrigin;
  }
  const meta = JSON.stringify({
    linkedBatchId: linkedBatchId || null,
    storageZone: storageZone || null,
    minSafetyStockKg: hasSafety ? Number(minSafetyStockKg) : null,
  });
  return cleanOrigin ? `${cleanOrigin} <!--frostly_lot:${meta}-->` : `<!--frostly_lot:${meta}-->`;
}

const VALID_CUT_TYPES = new Set<string>([
  'Whole Round Fish',
  'Headless & Gutted (H&G)',
  'Skin-On Loin / Fillet',
  'Skinless Sashimi Saku Block',
  'Live in Oxygen Tank',
  'Packaged 500g Tray',
  'IQF Flash Frozen Box',
]);

export function normalizeRetailCutType(cutType?: string | null): SeafoodCutType {
  const raw = String(cutType || '').trim();
  if (VALID_CUT_TYPES.has(raw)) {
    return raw as SeafoodCutType;
  }
  const lower = raw.toLowerCase();
  if (/saku|sashimi/.test(lower)) return 'Skinless Sashimi Saku Block';
  if (/fillet|loin|portion|chunk/.test(lower)) return 'Skin-On Loin / Fillet';
  if (/headless|gutted|h&g/.test(lower)) return 'Headless & Gutted (H&G)';
  if (/tray|pack|powder/.test(lower)) return 'Packaged 500g Tray';
  if (/live|tank/.test(lower)) return 'Live in Oxygen Tank';
  if (/whole|round/.test(lower)) return 'Whole Round Fish';
  return 'IQF Flash Frozen Box';
}

export function normalizeRetailPaymentMethod(
  method?: string | null
): 'Cash' | 'Credit Card' | 'Apple Pay / Contactless' | 'Store Credit' {
  const raw = String(method || '').trim();
  if (
    raw === 'Cash' ||
    raw === 'Credit Card' ||
    raw === 'Apple Pay / Contactless' ||
    raw === 'Store Credit'
  ) {
    return raw;
  }
  const lower = raw.toLowerCase();
  if (/credit account|store credit|net-|on account/.test(lower)) {
    return 'Store Credit';
  }
  if (/mobile|momo|apple|contactless|qr|transfer/.test(lower)) {
    return 'Apple Pay / Contactless';
  }
  if (/card|visa|mastercard|pos/.test(lower)) {
    return 'Credit Card';
  }
  return 'Cash';
}

export const productMapper = {
  toDomain(row: DatabaseProductRow): RetailWholesaleProduct {
    const meta = parseProductOriginMeta(row.origin);
    return {
      id: row.id,
      speciesId: row.species_id,
      name: row.name,
      cutType: row.cut_type as SeafoodCutType,
      category: row.category as SpeciesCategory,
      grade: row.grade as QualityGrade,
      stockKg: Number(row.stock_kg || 0),
      unit: (row.unit as any) || 'kg',
      costPricePerUnit: Number(row.cost_price_per_unit || 0),
      wholesalePricePerUnit: Number(row.wholesale_price_per_unit || 0),
      retailPricePerUnit: Number(row.retail_price_per_unit || 0),
      wholesaleMinQty: Number(row.wholesale_min_qty || 1),
      retailPackSize: row.retail_pack_size || undefined,
      sku: row.sku,
      imageUrl: row.image_url,
      origin: meta.cleanOrigin,
      isAvailableForRetail: Boolean(row.is_available_for_retail),
      isAvailableForWholesale: Boolean(row.is_available_for_wholesale),
      linkedBatchId: row.linked_batch_id || meta.linkedBatchId || undefined,
      storageZone: (row.storage_zone || meta.storageZone || undefined) as any,
      minSafetyStockKg:
        row.min_safety_stock_kg !== undefined && row.min_safety_stock_kg !== null
          ? Number(row.min_safety_stock_kg)
          : meta.minSafetyStockKg,
    };
  },

  toDatabase(domain: RetailWholesaleProduct): Partial<DatabaseProductRow> {
    const encodedOrigin = encodeProductOriginMeta(
      domain.origin,
      domain.linkedBatchId,
      domain.storageZone,
      domain.minSafetyStockKg
    );
    const validUnit =
      domain.unit === 'kg' || domain.unit === 'lb' || domain.unit === 'piece' || domain.unit === 'pack'
        ? domain.unit
        : 'kg';
    return {
      id: domain.id,
      species_id: domain.speciesId,
      name: domain.name,
      cut_type: normalizeRetailCutType(domain.cutType),
      category: domain.category || 'Groundfish',
      grade: domain.grade || 'Grade #1',
      stock_kg: Math.max(0, Number(domain.stockKg) || 0),
      unit: validUnit,
      cost_price_per_unit: Math.max(0, Number(domain.costPricePerUnit) || 0),
      wholesale_price_per_unit: Math.max(0, Number(domain.wholesalePricePerUnit) || 0),
      retail_price_per_unit: Math.max(0, Number(domain.retailPricePerUnit) || 0),
      wholesale_min_qty: Math.max(1, Number(domain.wholesaleMinQty) || 1),
      retail_pack_size: domain.retailPackSize || null,
      sku: domain.sku,
      image_url: domain.imageUrl?.trim() || '',
      origin: encodedOrigin,
      is_available_for_retail: domain.isAvailableForRetail,
      is_available_for_wholesale: domain.isAvailableForWholesale,
      is_active: true,
    };
  },
};

export const retailTransactionMapper = {
  toDomain(row: DatabaseRetailTransactionRow): RetailTransaction {
    const rawItems = row.retail_sale_items || row.items || [];
    const items: RetailSaleItem[] = Array.isArray(rawItems)
      ? rawItems.map((item: any) => ({
          productId: item.product_id || item.productId || '',
          productName: item.product_name || item.productName || 'Seafood Cut',
          cutType: (item.cut_type || item.cutType || 'Skin-On Loin / Fillet') as SeafoodCutType,
          quantity: Number(item.quantity || 0),
          unit: (item.unit as any) || 'kg',
          unitPrice: Number(item.unit_price ?? item.unitPrice ?? 0),
          costPrice: Number(item.cost_price ?? item.costPrice ?? 0),
          lineTotal: Number(item.line_total ?? item.lineTotal ?? 0),
        }))
      : [];

    return {
      id: row.id,
      receiptNumber: row.receipt_number,
      date: row.created_at || new Date().toISOString(),
      customerName: row.customer_name,
      customerPhone: row.customer_phone || undefined,
      items,
      subtotal: Number(row.subtotal || 0),
      taxAmount: Number(row.tax_amount || 0),
      discountAmount: Number(row.discount_amount || 0),
      totalAmount: Number(row.total_amount || 0),
      costTotal: Number(row.cost_total || 0),
      grossMargin: Number(row.gross_margin || 0),
      paymentMethod: (row.payment_method as any) || 'Cash',
      cashierName: row.cashier_name,
      status: (row.status as any) || 'Completed',
    };
  },

  toDatabase(domain: RetailTransaction): Partial<DatabaseRetailTransactionRow> {
    const cleanStatus = domain.status === 'Refunded' ? 'Refunded' : 'Completed';
    return {
      id: domain.id,
      receipt_number: domain.receiptNumber || domain.id,
      customer_name: domain.customerName || 'Walk-in Customer',
      customer_phone: domain.customerPhone || null,
      subtotal: Math.max(0, Number(domain.subtotal) || 0),
      tax_amount: Math.max(0, Number(domain.taxAmount) || 0),
      discount_amount: Math.max(0, Number(domain.discountAmount) || 0),
      total_amount: Math.max(0, Number(domain.totalAmount) || 0),
      cost_total: Math.max(0, Number(domain.costTotal) || 0),
      gross_margin: Number(domain.grossMargin || 0),
      payment_method: normalizeRetailPaymentMethod(domain.paymentMethod),
      cashier_name: domain.cashierName || 'Amansocean POS',
      status: cleanStatus,
    };
  },
};
