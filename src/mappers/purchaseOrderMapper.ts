import { PurchaseOrderLanding, QualityGrade, StorageZone } from '../types';

export interface DatabasePurchaseOrderRow {
  id: string;
  supplier_id: string;
  supplier_name: string;
  vessel_name: string;
  port_location: string;
  order_date: string;
  delivery_date: string;
  total_cost_usd: number | string;
  payment_status: string;
  payment_due_date: string;
  received_by: string;
  lot_assigned_id: string;
  status: string;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  organization_id?: string;
  purchase_order_items?: any[];
  species_items?: any[];
}

export const purchaseOrderMapper = {
  toDomain(row: DatabasePurchaseOrderRow): PurchaseOrderLanding {
    const rawItems = row.purchase_order_items || row.species_items || [];
    const speciesItems = Array.isArray(rawItems)
      ? rawItems.map((item: any) => ({
          speciesName: item.species_name || item.speciesName || 'Seafood Catch',
          weightKg: Number(item.weight_kg ?? item.weightKg ?? 0),
          costPerKg: Number(item.cost_per_kg ?? item.costPerKg ?? 0),
          totalCost: Number(item.total_cost ?? item.totalCost ?? 0),
          grade: (item.grade as QualityGrade) || 'Sashimi AAA',
          storageZone: (item.storage_zone as StorageZone) || 'Super-Cryo Deep Freeze (-60°C)',
        }))
      : [];

    return {
      id: row.id,
      supplierId: row.supplier_id,
      supplierName: row.supplier_name,
      vesselName: row.vessel_name,
      portLocation: row.port_location,
      orderDate: row.order_date,
      deliveryDate: row.delivery_date,
      speciesItems,
      totalCostUSD: Number(row.total_cost_usd || 0),
      paymentStatus: (row.payment_status as any) || 'Pending Settlement',
      paymentDueDate: row.payment_due_date,
      receivedBy: row.received_by,
      lotAssignedId: row.lot_assigned_id || '',
      status: (row.status as any) || 'Received & In Stock',
      notes: row.notes || undefined,
    };
  },

  toDatabase(domain: PurchaseOrderLanding): Partial<DatabasePurchaseOrderRow> {
    return {
      id: domain.id,
      supplier_id: domain.supplierId,
      supplier_name: domain.supplierName,
      vessel_name: domain.vesselName,
      port_location: domain.portLocation,
      order_date: domain.orderDate,
      delivery_date: domain.deliveryDate,
      total_cost_usd: domain.totalCostUSD,
      payment_status: domain.paymentStatus,
      payment_due_date: domain.paymentDueDate,
      received_by: domain.receivedBy,
      lot_assigned_id: domain.lotAssignedId,
      status: domain.status,
      notes: domain.notes || null,
    };
  },
};
