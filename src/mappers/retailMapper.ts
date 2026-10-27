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

export const productMapper = {
  toDomain(row: DatabaseProductRow): RetailWholesaleProduct {
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
      origin: row.origin,
      isAvailableForRetail: Boolean(row.is_available_for_retail),
      isAvailableForWholesale: Boolean(row.is_available_for_wholesale),
      linkedBatchId: row.linked_batch_id || undefined,
      storageZone: (row.storage_zone as any) || undefined,
    };
  },

  toDatabase(domain: RetailWholesaleProduct): Partial<DatabaseProductRow> {
    return {
      id: domain.id,
      species_id: domain.speciesId,
      name: domain.name,
      cut_type: domain.cutType,
      category: domain.category,
      grade: domain.grade,
      stock_kg: domain.stockKg,
      unit: domain.unit,
      cost_price_per_unit: domain.costPricePerUnit,
      wholesale_price_per_unit: domain.wholesalePricePerUnit,
      retail_price_per_unit: domain.retailPricePerUnit,
      wholesale_min_qty: domain.wholesaleMinQty,
      retail_pack_size: domain.retailPackSize || null,
      sku: domain.sku,
      image_url: domain.imageUrl,
      origin: domain.origin,
      is_available_for_retail: domain.isAvailableForRetail,
      is_available_for_wholesale: domain.isAvailableForWholesale,
      linked_batch_id: domain.linkedBatchId || null,
      storage_zone: domain.storageZone || null,
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
          cutType: (item.cut_type || item.cutType || 'Fillet / Portion') as SeafoodCutType,
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
    return {
      id: domain.id,
      receipt_number: domain.receiptNumber,
      customer_name: domain.customerName,
      customer_phone: domain.customerPhone || null,
      subtotal: domain.subtotal,
      tax_amount: domain.taxAmount,
      discount_amount: domain.discountAmount,
      total_amount: domain.totalAmount,
      cost_total: domain.costTotal,
      gross_margin: domain.grossMargin,
      payment_method: domain.paymentMethod,
      cashier_name: domain.cashierName,
      status: domain.status,
    };
  },
};
