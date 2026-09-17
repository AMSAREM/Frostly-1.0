import { ClientOrder, OrderStatus, OrderLineItem } from '../types';

export interface DatabaseOrderRow {
  id: string;
  customer_id?: string;
  client_name: string;
  client_category: string;
  contact_person: string;
  contact_email: string;
  contact_phone: string;
  destination_city: string;
  delivery_address: string;
  order_date: string;
  required_delivery_date: string;
  actual_delivery_date?: string | null;
  status: string;
  quoted_total_usd: number | string;
  adjusted_total_usd: number | string;
  assigned_reefer_id?: string | null;
  assigned_driver?: string | null;
  payment_status: string;
  packaging_requirement: string;
  special_instructions?: string | null;
  packing_slip_generated: boolean;
  created_at?: string;
  updated_at?: string;
  organization_id?: string;
  // May include join items
  order_line_items?: any[];
  items?: any[];
}

export const orderMapper = {
  toDomain(row: DatabaseOrderRow): ClientOrder {
    const rawItems = row.order_line_items || row.items || [];
    const items: OrderLineItem[] = Array.isArray(rawItems)
      ? rawItems.map((item: any) => ({
          id: item.id || `item-${item.species_id || item.speciesId || 'line'}-${Math.random().toString(36).substring(2, 7)}`,
          speciesId: item.species_id || item.speciesId || 'SPEC-DEFAULT',
          speciesName: item.species_name || item.speciesName || 'Seafood Species',
          grade: item.grade || 'Grade AAA (Super-Frozen)',
          lotId: item.lot_id || item.lotId || 'LOT-DEFAULT',
          requestedWeightKg: Number(item.requested_weight_kg ?? item.requestedWeightKg ?? 0),
          actualWeighedKg: item.actual_weighed_kg !== undefined && item.actual_weighed_kg !== null
            ? Number(item.actual_weighed_kg)
            : (item.actualWeighedKg !== undefined && item.actualWeighedKg !== null ? Number(item.actualWeighedKg) : null),
          pricePerKg: Number(item.price_per_kg ?? item.pricePerKg ?? 0),
          notes: item.notes || undefined,
        }))
      : [];

    return {
      id: row.id,
      customerId: row.customer_id || undefined,
      clientName: row.client_name,
      clientCategory: (row.client_category as any) || 'Michelin Restaurant',
      contactPerson: row.contact_person || '',
      contactEmail: row.contact_email || '',
      contactPhone: row.contact_phone || '',
      destinationCity: row.destination_city || '',
      deliveryAddress: row.delivery_address || '',
      orderDate: row.order_date ? row.order_date.split('T')[0] : new Date().toISOString().split('T')[0],
      requiredDeliveryDate: row.required_delivery_date ? row.required_delivery_date.split('T')[0] : new Date().toISOString().split('T')[0],
      actualDeliveryDate: row.actual_delivery_date ? row.actual_delivery_date.split('T')[0] : undefined,
      status: (row.status as OrderStatus) || 'Pending Confirmation',
      items,
      quotedTotalUSD: Number(row.quoted_total_usd ?? 0),
      adjustedTotalUSD: Number(row.adjusted_total_usd ?? 0),
      assignedReeferId: row.assigned_reefer_id || undefined,
      assignedDriver: row.assigned_driver || undefined,
      paymentStatus: (row.payment_status as any) || 'Pending Net-30',
      packagingRequirement: (row.packaging_requirement as any) || 'Dry Ice & Insulated Wax Carton',
      specialInstructions: row.special_instructions || undefined,
      packingSlipGenerated: Boolean(row.packing_slip_generated),
    };
  },

  toDatabase(order: ClientOrder): Record<string, any> {
    return {
      id: order.id,
      customer_id: order.customerId || 'CUST-101', // Fallback or linked customer
      client_name: order.clientName,
      client_category: order.clientCategory,
      contact_person: order.contactPerson,
      contact_email: order.contactEmail,
      contact_phone: order.contactPhone,
      destination_city: order.destinationCity,
      delivery_address: order.deliveryAddress,
      order_date: order.orderDate || new Date().toISOString().split('T')[0],
      required_delivery_date: order.requiredDeliveryDate || new Date().toISOString().split('T')[0],
      actual_delivery_date: order.actualDeliveryDate || null,
      status: order.status,
      quoted_total_usd: order.quotedTotalUSD,
      adjusted_total_usd: order.adjustedTotalUSD,
      assigned_reefer_id: order.assignedReeferId || null,
      assigned_driver: order.assignedDriver || null,
      payment_status: order.paymentStatus,
      packaging_requirement: order.packagingRequirement,
      special_instructions: order.specialInstructions || null,
      packing_slip_generated: Boolean(order.packingSlipGenerated),
    };
  }
};
