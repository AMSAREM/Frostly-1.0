import { Supplier, PurchaseOrderLanding, FinancialLedgerEntry, SupplierLedgerEntry } from '../types';

export interface SupplierLedgerSummary {
  totalBilledUSD: number;
  totalDisbursedUSD: number;
  outstandingPayableUSD: number;
  openBillsCount: number;
  settledBillsCount: number;
  disbursementsCount: number;
  lastPaymentDate?: string;
  lastPaymentAmount?: number;
}

/**
 * Builds a chronological Accounts Payable (AP) Supplier Ledger Statement combining:
 * 1. Inward Landed Catch POs (Bills => Credits, increases AP liability)
 * 2. Disbursements / Payouts (Payments => Debits, decreases AP liability)
 * 3. Payment Reversals / Adjustments (if any)
 * 4. Running AP balance calculated after each transaction
 */
export function buildSupplierLedger(
  supplier: Supplier,
  purchaseOrders: PurchaseOrderLanding[] = [],
  financialEntries: FinancialLedgerEntry[] = []
): { entries: SupplierLedgerEntry[]; summary: SupplierLedgerSummary } {
  // 1. Filter Purchase Orders for this Supplier
  const supPOs = purchaseOrders.filter(po => 
    po.supplierId === supplier.id ||
    po.supplierName.toLowerCase().trim() === supplier.name.toLowerCase().trim()
  );

  // 2. Filter Financial Entries (Disbursements / AP Settlements) for this Supplier
  const supDisbursements = financialEntries.filter(entry => {
    // Direct link by supplierId
    if (entry.supplierId && entry.supplierId === supplier.id) return true;

    // Direct reference match
    if (entry.referenceId && (entry.referenceId.includes(supplier.id) || entry.referenceId.includes(`AP-${supplier.id}`))) {
      return true;
    }

    // Entity name match
    const entityLower = (entry.entityName || '').toLowerCase().trim();
    const nameLower = supplier.name.toLowerCase().trim();
    const matchesName = entityLower.length > 0 && (entityLower.includes(nameLower) || nameLower.includes(entityLower));

    // Match reference to any PO of this supplier
    const matchesPORef = supPOs.some(po => entry.referenceId && entry.referenceId.includes(po.id));

    const isAPType = entry.type === 'COGS' || 
                     entry.category === 'COGS (Catch Intake)' || 
                     entry.description.toLowerCase().includes('harvester') || 
                     entry.description.toLowerCase().includes('supplier') || 
                     entry.description.toLowerCase().includes('payout') ||
                     entry.description.toLowerCase().includes('disbursement');

    return (matchesName || matchesPORef) && isAPType;
  });

  const rawEntries: Array<{
    date: string;
    sortKey: number;
    entry: Omit<SupplierLedgerEntry, 'runningBalance'>;
  }> = [];

  // Add Purchase Orders as Bills (Credits, increases AP liability)
  supPOs.forEach(po => {
    const amount = po.totalCostUSD || 0;
    const dateStr = po.orderDate || po.deliveryDate || new Date().toISOString().split('T')[0];
    const itemsDescription = po.speciesItems && po.speciesItems.length > 0
      ? po.speciesItems.map(i => `${i.speciesName} (${i.weightKg.toLocaleString()}kg @ $${i.costPerKg}/kg)`).join(', ')
      : 'Landed Seafood Catch Haul';

    rawEntries.push({
      date: dateStr,
      sortKey: new Date(dateStr).getTime() || 0,
      entry: {
        id: `LEDG-BILL-${po.id}`,
        supplierId: supplier.id,
        supplierName: supplier.name,
        date: dateStr,
        type: 'Bill',
        referenceId: po.id,
        description: `Landed Catch Bill #${po.id} (${itemsDescription}) • Vessel: ${po.vesselName || 'Direct Dock Intake'}`,
        debit: 0,
        credit: amount,
        paymentMethod: supplier.paymentTerms || 'Net-30 Harvester Terms',
        status: po.paymentStatus === 'Paid in Full' 
          ? 'Settled' 
          : po.paymentStatus === 'Partial Paid' 
          ? 'Partially Paid' 
          : 'Pending',
        purchaseOrderId: po.id,
        lotAssignedId: po.lotAssignedId,
        createdAt: po.orderDate
      }
    });
  });

  // Add Disbursements as Debits (reduces AP liability)
  supDisbursements.forEach(pmt => {
    const dateStr = pmt.date || new Date().toISOString().split('T')[0];
    const isReversal = pmt.description.toLowerCase().includes('reversal') || pmt.description.toLowerCase().includes('void');

    if (isReversal) {
      // Reversal cancels out a disbursement and re-credits the liability
      rawEntries.push({
        date: dateStr,
        sortKey: (new Date(dateStr).getTime() || 0) + 1,
        entry: {
          id: `LEDG-AP-REV-${pmt.id}`,
          supplierId: supplier.id,
          supplierName: supplier.name,
          date: dateStr,
          type: 'Reversal',
          referenceId: pmt.referenceId || pmt.id,
          description: pmt.description || 'Disbursement Void / Reversal',
          debit: 0,
          credit: pmt.amount,
          paymentMethod: pmt.paymentMethod || 'Wire Recall / Adjustment',
          status: 'Reversed',
          financialEntryId: pmt.id,
          notes: pmt.notes,
          voucherNumber: pmt.voucherNumber || pmt.receiptNumber
        }
      });
    } else {
      const fallbackVoucherNum = pmt.voucherNumber || 
        (pmt.referenceId.startsWith('VOUCH') || pmt.referenceId.startsWith('DSB') 
          ? pmt.referenceId 
          : `VOUCH-${pmt.id.replace(/[^0-9]/g, '').slice(-4) || '8841'}`);

      rawEntries.push({
        date: dateStr,
        sortKey: (new Date(dateStr).getTime() || 0) + 1,
        entry: {
          id: `LEDG-DSB-${pmt.id}`,
          supplierId: supplier.id,
          supplierName: supplier.name,
          date: dateStr,
          type: 'Disbursement',
          referenceId: pmt.referenceId || fallbackVoucherNum,
          description: pmt.description || `Harvester Settlement Wire Disbursed - ${supplier.name}`,
          debit: pmt.amount,
          credit: 0,
          paymentMethod: pmt.paymentMethod || 'Federal Wire Transfer / ACH',
          status: 'Settled',
          financialEntryId: pmt.id,
          notes: pmt.notes,
          voucherNumber: fallbackVoucherNum
        }
      });
    }
  });

  // Sort chronologically ascending
  rawEntries.sort((a, b) => a.sortKey - b.sortKey);

  // Compute Running Balance (Credit increases payable liability, Debit reduces payable)
  let runningBalance = 0;
  const entries: SupplierLedgerEntry[] = rawEntries.map(item => {
    runningBalance += item.entry.credit - item.entry.debit;
    return {
      ...item.entry,
      runningBalance: Math.max(0, Math.round(runningBalance * 100) / 100)
    };
  });

  // Reverse so newest transactions appear at top of statement
  entries.reverse();

  // Summary Metrics
  const totalBilledUSD = entries.reduce((s, e) => s + (e.type === 'Bill' ? e.credit : 0), 0);
  const totalDisbursedUSD = entries.reduce((s, e) => s + (e.type === 'Disbursement' ? e.debit : 0), 0);
  const outstandingPayableUSD = Math.max(0, supplier.outstandingPayableUSD);

  const openBillsCount = supPOs.filter(p => p.paymentStatus !== 'Paid in Full').length;
  const settledBillsCount = supPOs.filter(p => p.paymentStatus === 'Paid in Full').length;
  const disbursementsCount = supDisbursements.filter(p => !p.description.toLowerCase().includes('reversal')).length;

  const disbursementsSorted = supDisbursements
    .filter(p => !p.description.toLowerCase().includes('reversal'))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const lastPayment = disbursementsSorted[0];

  return {
    entries,
    summary: {
      totalBilledUSD,
      totalDisbursedUSD,
      outstandingPayableUSD,
      openBillsCount,
      settledBillsCount,
      disbursementsCount,
      lastPaymentDate: lastPayment?.date,
      lastPaymentAmount: lastPayment?.amount
    }
  };
}
