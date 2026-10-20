import { FinancialLedgerEntry, FinancialEntryCategory } from '../types';

export interface DatabaseFinancialEntryRow {
  id: string;
  entry_date: string;
  type: string;
  category: string;
  description: string;
  reference_id: string;
  entity_name: string;
  amount: number | string;
  payment_method: string;
  status: string;
  created_at?: string;
  created_by?: string;
  organization_id?: string;
  customer_id?: string;
  supplier_id?: string;
  receipt_number?: string;
  voucher_number?: string;
  notes?: string;
}

export const financialMapper = {
  toDomain(row: DatabaseFinancialEntryRow): FinancialLedgerEntry {
    return {
      id: row.id,
      date: row.entry_date ? row.entry_date.split('T')[0] : new Date().toISOString().split('T')[0],
      type: (row.type as any) || 'Income',
      category: (row.category as FinancialEntryCategory) || 'Revenue (Wholesale)',
      description: row.description || '',
      referenceId: row.reference_id || '',
      entityName: row.entity_name || '',
      amount: Number(row.amount ?? 0),
      paymentMethod: row.payment_method || 'Bank Transfer (ACH / SEPA)',
      status: (row.status as any) || 'Settled',
      customerId: row.customer_id || undefined,
      supplierId: row.supplier_id || undefined,
      receiptNumber: row.receipt_number || undefined,
      voucherNumber: row.voucher_number || undefined,
      notes: row.notes || undefined,
    };
  },

  toDatabase(entry: FinancialLedgerEntry): Record<string, any> {
    // Generate valid UUID if needed or omit to let db gen_random_uuid()
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entry.id);
    const payload: Record<string, any> = {
      entry_date: entry.date || new Date().toISOString().split('T')[0],
      type: entry.type,
      category: entry.category,
      description: entry.description,
      reference_id: entry.referenceId,
      entity_name: entry.entityName,
      amount: entry.amount,
      payment_method: entry.paymentMethod,
      status: entry.status,
    };
    if (entry.customerId) payload.customer_id = entry.customerId;
    if (entry.supplierId) payload.supplier_id = entry.supplierId;
    if (entry.receiptNumber) payload.receipt_number = entry.receiptNumber;
    if (entry.voucherNumber) payload.voucher_number = entry.voucherNumber;
    if (entry.notes) payload.notes = entry.notes;
    if (isUuid) {
      payload.id = entry.id;
    }
    return payload;
  }
};
