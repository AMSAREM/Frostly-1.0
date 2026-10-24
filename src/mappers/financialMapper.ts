import { FinancialLedgerEntry, FinancialEntryCategory } from '../types';
import { ensureValidUuid } from './notificationMapper';

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

const VALID_FIN_CATEGORIES = new Set<string>([
  'Revenue (Wholesale)',
  'Revenue (Retail POS)',
  'COGS (Catch Intake)',
  'Logistics & Reefer Freight',
  'Cold Storage Utilities',
  'Packaging & Ice',
  'Labor & Cutting Crew',
  'Dock Fees & Port Taxes',
  'Inventory Adjustment',
]);

export function parseFinancialDescriptionMeta(rawDescription?: string | null): {
  cleanDescription: string;
  customerId?: string;
  supplierId?: string;
  receiptNumber?: string;
  voucherNumber?: string;
  notes?: string;
} {
  let cleanDescription = String(rawDescription || '');
  let customerId: string | undefined;
  let supplierId: string | undefined;
  let receiptNumber: string | undefined;
  let voucherNumber: string | undefined;
  let notes: string | undefined;

  if (cleanDescription.includes('<!--frostly_fin:')) {
    try {
      const match = cleanDescription.match(/<!--frostly_fin:(\{.*?\})-->/);
      if (match && match[1]) {
        const parsed = JSON.parse(match[1]);
        if (parsed.customerId) customerId = String(parsed.customerId);
        if (parsed.supplierId) supplierId = String(parsed.supplierId);
        if (parsed.receiptNumber) receiptNumber = String(parsed.receiptNumber);
        if (parsed.voucherNumber) voucherNumber = String(parsed.voucherNumber);
        if (parsed.notes) notes = String(parsed.notes);
      }
    } catch {
      // ignore malformed metadata
    }
    cleanDescription = cleanDescription.replace(/<!--frostly_fin:.*?-->/g, '').trim();
  }

  return {
    cleanDescription,
    customerId,
    supplierId,
    receiptNumber,
    voucherNumber,
    notes,
  };
}

export function encodeFinancialDescriptionMeta(
  description: string,
  meta: {
    customerId?: string | null;
    supplierId?: string | null;
    receiptNumber?: string | null;
    voucherNumber?: string | null;
    notes?: string | null;
  }
): string {
  const { cleanDescription } = parseFinancialDescriptionMeta(description);
  const payload: Record<string, string> = {};
  if (meta.customerId) payload.customerId = String(meta.customerId);
  if (meta.supplierId) payload.supplierId = String(meta.supplierId);
  if (meta.receiptNumber) payload.receiptNumber = String(meta.receiptNumber);
  if (meta.voucherNumber) payload.voucherNumber = String(meta.voucherNumber);
  if (meta.notes) payload.notes = String(meta.notes);

  if (Object.keys(payload).length === 0) {
    return cleanDescription || 'Financial Ledger Transaction';
  }
  const encoded = JSON.stringify(payload);
  return cleanDescription
    ? `${cleanDescription} <!--frostly_fin:${encoded}-->`
    : `Financial Ledger Transaction <!--frostly_fin:${encoded}-->`;
}

export const financialMapper = {
  toDomain(row: DatabaseFinancialEntryRow): FinancialLedgerEntry {
    const meta = parseFinancialDescriptionMeta(row.description);
    return {
      id: row.id,
      date: row.entry_date ? row.entry_date.split('T')[0] : new Date().toISOString().split('T')[0],
      type: (row.type as any) || 'Income',
      category: (row.category as FinancialEntryCategory) || 'Revenue (Wholesale)',
      description: meta.cleanDescription,
      referenceId: row.reference_id || '',
      entityName: row.entity_name || '',
      amount: Number(row.amount ?? 0),
      paymentMethod: row.payment_method || 'Bank Transfer (ACH / SEPA)',
      status: (row.status as any) || 'Settled',
      customerId: row.customer_id || meta.customerId || undefined,
      supplierId: row.supplier_id || meta.supplierId || undefined,
      receiptNumber: row.receipt_number || meta.receiptNumber || undefined,
      voucherNumber: row.voucher_number || meta.voucherNumber || undefined,
      notes: row.notes || meta.notes || undefined,
    };
  },

  toDatabase(entry: FinancialLedgerEntry): Record<string, any> {
    const cleanType =
      entry.type === 'Income' || entry.type === 'COGS' || entry.type === 'OpEx'
        ? entry.type
        : 'Income';

    const cleanCategory = VALID_FIN_CATEGORIES.has(entry.category)
      ? entry.category
      : cleanType === 'Income'
      ? 'Revenue (Wholesale)'
      : cleanType === 'COGS'
      ? 'COGS (Catch Intake)'
      : 'Cold Storage Utilities';

    const cleanStatus =
      entry.status === 'Settled' || entry.status === 'Pending' || entry.status === 'Overdue'
        ? entry.status
        : 'Settled';

    const rawDate = entry.date ? entry.date.split('T')[0].split(' ')[0] : '';
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
      ? rawDate
      : new Date().toISOString().split('T')[0];

    const payload: Record<string, any> = {
      id: ensureValidUuid(entry.id || `fin-${Date.now()}`),
      entry_date: validDate,
      type: cleanType,
      category: cleanCategory,
      description: entry.description || 'Financial Ledger Transaction',
      reference_id: entry.referenceId || 'LEDGER',
      entity_name: entry.entityName || 'Counterparty',
      amount: Math.max(0, Number(entry.amount) || 0),
      payment_method: entry.paymentMethod || 'Cash / Bank Transfer',
      status: cleanStatus,
      customer_id: entry.customerId || null,
      supplier_id: entry.supplierId || null,
      receipt_number: entry.receiptNumber || null,
      voucher_number: entry.voucherNumber || null,
      notes: entry.notes || null,
    };

    return payload;
  },
};
