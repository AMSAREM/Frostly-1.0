import { Supplier, SupplierType } from '../types';

export interface DatabaseSupplierRow {
  id: string;
  name: string;
  contact_person: string;
  type: string;
  email: string;
  phone: string;
  port_location: string;
  country: string;
  vessel_names?: string[];
  supplied_species?: string[];
  payment_terms: string;
  outstanding_payable_usd: number | string;
  total_purchased_usd: number | string;
  total_weight_supplied_kg: number | string;
  rating: number | string;
  status: string;
  bank_account_ref?: string | null;
  notes?: string | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  organization_id?: string;
}

export const supplierMapper = {
  toDomain(row: DatabaseSupplierRow): Supplier {
    return {
      id: row.id,
      name: row.name,
      contactPerson: row.contact_person || '',
      type: (row.type as SupplierType) || 'Fishermen Co-op',
      email: row.email || '',
      phone: row.phone || '',
      portLocation: row.port_location || '',
      country: row.country || '',
      vesselNames: Array.isArray(row.vessel_names) ? row.vessel_names : [],
      suppliedSpecies: Array.isArray(row.supplied_species) ? row.supplied_species : [],
      paymentTerms: (row.payment_terms as any) || 'Net-30',
      outstandingPayableUSD: Number(row.outstanding_payable_usd ?? 0),
      totalPurchasedUSD: Number(row.total_purchased_usd ?? 0),
      totalWeightSuppliedKg: Number(row.total_weight_supplied_kg ?? 0),
      rating: Number(row.rating ?? 5.0),
      status: (row.status as any) || 'Active',
      bankAccountRef: row.bank_account_ref ?? undefined,
      notes: row.notes ?? undefined,
    };
  },

  toDatabase(supplier: Supplier): Record<string, any> {
    return {
      id: supplier.id,
      name: supplier.name,
      contact_person: supplier.contactPerson,
      type: supplier.type,
      email: supplier.email,
      phone: supplier.phone,
      port_location: supplier.portLocation,
      country: supplier.country,
      vessel_names: supplier.vesselNames || [],
      supplied_species: supplier.suppliedSpecies || [],
      payment_terms: supplier.paymentTerms,
      outstanding_payable_usd: supplier.outstandingPayableUSD,
      total_purchased_usd: supplier.totalPurchasedUSD,
      total_weight_supplied_kg: supplier.totalWeightSuppliedKg,
      rating: supplier.rating,
      status: supplier.status,
      bank_account_ref: supplier.bankAccountRef || null,
      notes: supplier.notes || null,
      is_active: true,
    };
  }
};
