import { ClientOrder, OrderStatus, OrderLineItem, QualityGrade } from '../types';

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

const VALID_CUSTOMER_TYPES = new Set<string>([
  'Wholesale Restaurant',
  'Hotel & Resort',
  'Supermarket / Retailer',
  'Fishmonger / Distributor',
  'Direct Retail VIP',
]);

const VALID_QUALITY_GRADES = new Set<string>([
  'Sashimi AAA',
  'Grade #1',
  'Grade #2',
  'Processing Grade',
  'Live Prime',
]);

const VALID_ORDER_STATUSES = new Set<string>([
  'Pending Confirmation',
  'Weighing & Grading',
  'Cryo-Packed & Iced',
  'In Reefer Transit',
  'Delivered',
  'Cancelled',
]);

const VALID_PAYMENT_STATUSES = new Set<string>([
  'Paid',
  'Pending Net-30',
  'Invoiced',
  'Overdue',
  'Paid in Full',
  'Pending Settlement',
  'Partial Paid',
]);

export function normalizeOrderCustomerCategory(cat?: string | null): string {
  const raw = String(cat || '').trim();
  if (VALID_CUSTOMER_TYPES.has(raw)) return raw;
  const lower = raw.toLowerCase();
  if (/hotel|resort/.test(lower)) return 'Hotel & Resort';
  if (/supermarket|retailer|grocery/.test(lower)) return 'Supermarket / Retailer';
  if (/fishmonger|distributor|wholesaler/.test(lower)) return 'Fishmonger / Distributor';
  if (/vip|direct|retail/.test(lower)) return 'Direct Retail VIP';
  return 'Wholesale Restaurant';
}

export function normalizeQualityGrade(grade?: string | null): QualityGrade {
  const raw = String(grade || '').trim();
  if (VALID_QUALITY_GRADES.has(raw)) return raw as QualityGrade;
  const lower = raw.toLowerCase();
  if (/aaa|sashimi/.test(lower)) return 'Sashimi AAA';
  if (/live/.test(lower)) return 'Live Prime';
  if (/2/.test(lower)) return 'Grade #2';
  if (/process/.test(lower)) return 'Processing Grade';
  return 'Grade #1';
}

export function normalizeOrderPaymentStatus(status?: string | null): string {
  const raw = String(status || '').trim();
  if (VALID_PAYMENT_STATUSES.has(raw)) return raw;
  const lower = raw.toLowerCase();
  if (/net-15|net-30/.test(lower)) return 'Pending Net-30';
  if (/paid/.test(lower)) return 'Paid';
  if (/overdue/.test(lower)) return 'Overdue';
  if (/invoiced/.test(lower)) return 'Invoiced';
  return 'Pending Settlement';
}

export const orderMapper = {
  toDomain(row: DatabaseOrderRow): ClientOrder {
    const rawItems = row.order_line_items || row.items || [];
    const items: OrderLineItem[] = Array.isArray(rawItems)
      ? rawItems.map((item: any) => ({
          id:
            item.id ||
            `item-${item.species_id || item.speciesId || 'line'}-${Math.random()
              .toString(36)
              .substring(2, 7)}`,
          speciesId: item.species_id || item.speciesId || 'SPEC-DEFAULT',
          speciesName: item.species_name || item.speciesName || 'Seafood Species',
          grade: normalizeQualityGrade(item.grade),
          lotId: item.lot_id || item.lotId || 'LOT-DEFAULT',
          requestedWeightKg: Number(item.requested_weight_kg ?? item.requestedWeightKg ?? 0),
          actualWeighedKg:
            item.actual_weighed_kg !== undefined && item.actual_weighed_kg !== null
              ? Number(item.actual_weighed_kg)
              : item.actualWeighedKg !== undefined && item.actualWeighedKg !== null
              ? Number(item.actualWeighedKg)
              : null,
          pricePerKg: Number(item.price_per_kg ?? item.pricePerKg ?? 0),
          notes: item.notes || undefined,
        }))
      : [];

    return {
      id: row.id,
      customerId: row.customer_id || undefined,
      clientName: row.client_name,
      clientCategory: (row.client_category as any) || 'Wholesale Restaurant',
      contactPerson: row.contact_person || '',
      contactEmail: row.contact_email || '',
      contactPhone: row.contact_phone || '',
      destinationCity: row.destination_city || '',
      deliveryAddress: row.delivery_address || '',
      orderDate: row.order_date
        ? row.order_date.split('T')[0]
        : new Date().toISOString().split('T')[0],
      requiredDeliveryDate: row.required_delivery_date
        ? row.required_delivery_date.split('T')[0]
        : new Date().toISOString().split('T')[0],
      actualDeliveryDate: row.actual_delivery_date
        ? row.actual_delivery_date.split('T')[0]
        : undefined,
      status: (row.status as OrderStatus) || 'Pending Confirmation',
      items,
      quotedTotalUSD: Number(row.quoted_total_usd ?? 0),
      adjustedTotalUSD: Number(row.adjusted_total_usd ?? 0),
      assignedReeferId: row.assigned_reefer_id || undefined,
      assignedDriver: row.assigned_driver || undefined,
      paymentStatus: (row.payment_status as any) || 'Pending Net-30',
      packagingRequirement:
        (row.packaging_requirement as any) || 'Dry Ice & Insulated Wax Carton',
      specialInstructions: row.special_instructions || undefined,
      packingSlipGenerated: Boolean(row.packing_slip_generated),
    };
  },

  toDatabase(order: ClientOrder): Record<string, any> {
    const cleanStatus = VALID_ORDER_STATUSES.has(order.status)
      ? order.status
      : 'Pending Confirmation';

    return {
      id: order.id,
      customer_id: order.customerId || 'CUST-WALKIN',
      client_name: order.clientName || 'Wholesale Client',
      client_category: normalizeOrderCustomerCategory(order.clientCategory),
      contact_person: order.contactPerson || order.clientName || 'Purchasing Contact',
      contact_email: order.contactEmail || 'orders@amansocean.store',
      contact_phone: order.contactPhone || 'N/A',
      destination_city: order.destinationCity || 'Accra / Tema',
      delivery_address: order.deliveryAddress || 'Coldstore Pickup',
      order_date: order.orderDate
        ? order.orderDate.split('T')[0]
        : new Date().toISOString().split('T')[0],
      required_delivery_date: order.requiredDeliveryDate
        ? order.requiredDeliveryDate.split('T')[0]
        : new Date().toISOString().split('T')[0],
      actual_delivery_date: order.actualDeliveryDate
        ? order.actualDeliveryDate.split('T')[0]
        : null,
      status: cleanStatus,
      quoted_total_usd: Math.max(0, Number(order.quotedTotalUSD) || 0),
      adjusted_total_usd: Math.max(0, Number(order.adjustedTotalUSD ?? order.quotedTotalUSD) || 0),
      assigned_reefer_id: order.assignedReeferId || null,
      assigned_driver: order.assignedDriver || null,
      payment_status: normalizeOrderPaymentStatus(order.paymentStatus),
      packaging_requirement: order.packagingRequirement || 'Dry Ice & Insulated Wax Carton',
      special_instructions: order.specialInstructions || null,
      packing_slip_generated: Boolean(order.packingSlipGenerated),
    };
  },
};
