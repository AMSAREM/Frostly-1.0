import { Customer, CustomerType, PricingTier, PaymentTerms } from '../types';

export interface DatabaseCustomerRow {
  id: string;
  name: string;
  company_name: string;
  type: string;
  tier: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  credit_limit_usd: number | string;
  outstanding_balance_usd: number | string;
  payment_terms: string;
  total_orders_count: number | string;
  total_spend_usd: number | string;
  status: string;
  tax_id: string | null;
  notes: string | null;
  is_active?: boolean;
  joined_date?: string;
  created_at?: string;
  updated_at?: string;
  organization_id?: string;
}

export const customerMapper = {
  /**
   * Convert a Supabase database row to domain Customer
   */
  toDomain(row: DatabaseCustomerRow): Customer {
    return {
      id: row.id,
      name: row.name,
      companyName: row.company_name || row.name,
      type: (row.type as CustomerType) || 'Wholesale Restaurant',
      tier: (row.tier as PricingTier) || 'Tier 2 (Standard Wholesale)',
      contactPerson: row.contact_person || 'Purchasing Agent',
      email: row.email || '',
      phone: row.phone || '',
      address: row.address || '',
      city: row.city || '',
      creditLimitUSD: Number(row.credit_limit_usd ?? 50000),
      outstandingBalanceUSD: Number(row.outstanding_balance_usd ?? 0),
      paymentTerms: (row.payment_terms as PaymentTerms) || 'Net-30',
      totalOrdersCount: Number(row.total_orders_count ?? 0),
      totalSpendUSD: Number(row.total_spend_usd ?? 0),
      status: (row.status as 'Active' | 'Credit Hold' | 'Pending Review') || 'Active',
      taxId: row.tax_id ?? undefined,
      notes: row.notes ?? undefined,
      joinedDate: row.joined_date ? row.joined_date.split('T')[0] : new Date().toISOString().split('T')[0],
    };
  },

  /**
   * Convert domain Customer to Supabase database payload
   * Notice: organization_id is omitted so the database trigger can safely stamp it from current_org_id()
   */
  toDatabase(customer: Customer): Record<string, any> {
    const payload: Record<string, any> = {
      id: customer.id,
      name: customer.name,
      company_name: customer.companyName,
      type: customer.type,
      tier: customer.tier,
      contact_person: customer.contactPerson,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      city: customer.city,
      credit_limit_usd: customer.creditLimitUSD,
      outstanding_balance_usd: customer.outstandingBalanceUSD,
      payment_terms: customer.paymentTerms,
      total_orders_count: customer.totalOrdersCount,
      total_spend_usd: customer.totalSpendUSD,
      status: customer.status,
      tax_id: customer.taxId ?? null,
      notes: customer.notes ?? null,
      is_active: true,
      joined_date: customer.joinedDate || new Date().toISOString().split('T')[0],
    };

    return payload;
  },
};
