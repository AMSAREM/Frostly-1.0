import { Customer, ClientOrder, FinancialLedgerEntry, CustomerLedgerEntry } from '../types';

export interface CustomerLedgerSummary {
  totalInvoiced: number;
  totalPaid: number;
  outstandingBalance: number;
  availableCredit: number;
  creditUtilizationPct: number;
  openInvoicesCount: number;
  paidInvoicesCount: number;
  paymentsCount: number;
  lastPaymentDate?: string;
  lastPaymentAmount?: number;
}

/**
 * Builds a chronological Customer Ledger Statement combining:
 * 1. Client Orders (Invoices / Charges => Debits)
 * 2. Financial Ledger Entries (Payments / Settlements => Credits)
 * 3. Payment Reversals / Adjustments (if any)
 * 4. Running balance calculated after each transaction
 */
export function buildCustomerLedger(
  customer: Customer,
  orders: ClientOrder[] = [],
  financialEntries: FinancialLedgerEntry[] = []
): { entries: CustomerLedgerEntry[]; summary: CustomerLedgerSummary } {
  // 1. Filter Orders for this Customer
  const custOrders = orders.filter(o => 
    o.customerId === customer.id ||
    o.clientName.toLowerCase().trim() === customer.name.toLowerCase().trim() ||
    o.clientName.toLowerCase().trim() === customer.companyName.toLowerCase().trim()
  );

  // 2. Filter Financial Entries (Payments / AR Settlements) for this Customer
  const custPayments = financialEntries.filter(entry => {
    // Direct link by customerId
    if (entry.customerId && entry.customerId === customer.id) return true;
    
    // Direct reference match
    if (entry.referenceId && entry.referenceId.includes(customer.id)) return true;

    // Entity name match
    const entityLower = (entry.entityName || '').toLowerCase().trim();
    const nameLower = customer.name.toLowerCase().trim();
    const companyLower = customer.companyName.toLowerCase().trim();

    const matchesName = entityLower.length > 0 && (entityLower.includes(nameLower) || nameLower.includes(entityLower));
    const matchesCompany = entityLower.length > 0 && (entityLower.includes(companyLower) || companyLower.includes(entityLower));

    // Also match reference to any order of this customer
    const matchesOrderRef = custOrders.some(o => entry.referenceId && entry.referenceId.includes(o.id));

    return (matchesName || matchesCompany || matchesOrderRef) && (entry.type === 'Income' || entry.description.includes('Reversal'));
  });

  const rawEntries: Array<{
    date: string;
    sortKey: number;
    entry: Omit<CustomerLedgerEntry, 'runningBalance'>;
  }> = [];

  // Add Orders as Invoices (Debits)
  custOrders.forEach(order => {
    const amount = order.adjustedTotalUSD || order.quotedTotalUSD || 0;
    const dateStr = order.orderDate || new Date().toISOString().split('T')[0];
    const itemsDescription = order.items && order.items.length > 0
      ? order.items.map(i => `${i.speciesName} (${i.requestedWeightKg}kg)`).join(', ')
      : 'Cold-Chain Wholesale Seafood Order';

    rawEntries.push({
      date: dateStr,
      sortKey: new Date(dateStr).getTime() || 0,
      entry: {
        id: `LEDG-INV-${order.id}`,
        customerId: customer.id,
        customerName: customer.name,
        date: dateStr,
        type: 'Invoice',
        referenceId: order.id,
        description: `Wholesale Seafood Order Invoice #${order.id} (${itemsDescription})`,
        debit: amount,
        credit: 0,
        paymentMethod: order.paymentTerms || 'Net-30 Commercial Credit',
        status: order.paymentStatus === 'Paid' ? 'Settled' : 'Pending',
        orderId: order.id,
        createdAt: order.orderDate
      }
    });
  });

  // Add Payments as Credits
  custPayments.forEach(pmt => {
    const dateStr = pmt.date || new Date().toISOString().split('T')[0];
    const isReversal = pmt.description.toLowerCase().includes('reversal') || pmt.description.toLowerCase().includes('void');

    if (isReversal) {
      // Reversal cancels out a payment or re-debits the account
      rawEntries.push({
        date: dateStr,
        sortKey: (new Date(dateStr).getTime() || 0) + 1, // Sort right after payment if same day
        entry: {
          id: `LEDG-REV-${pmt.id}`,
          customerId: customer.id,
          customerName: customer.name,
          date: dateStr,
          type: 'Reversal',
          referenceId: pmt.referenceId || pmt.id,
          description: pmt.description || 'Payment Void / Reversal',
          debit: pmt.amount,
          credit: 0,
          paymentMethod: pmt.paymentMethod || 'Adjustment',
          status: 'Reversed',
          financialEntryId: pmt.id,
          notes: pmt.notes,
          receiptNumber: pmt.receiptNumber
        }
      });
    } else {
      rawEntries.push({
        date: dateStr,
        sortKey: (new Date(dateStr).getTime() || 0) + 1,
        entry: {
          id: `LEDG-PMT-${pmt.id}`,
          customerId: customer.id,
          customerName: customer.name,
          date: dateStr,
          type: 'Payment',
          referenceId: pmt.referenceId || `PMT-${pmt.id}`,
          description: pmt.description || 'AR Payment Settlement Received',
          debit: 0,
          credit: pmt.amount,
          paymentMethod: pmt.paymentMethod || 'Bank Wire Transfer',
          status: 'Settled',
          financialEntryId: pmt.id,
          notes: pmt.notes,
          receiptNumber: pmt.receiptNumber || (pmt.referenceId.startsWith('PMT') ? pmt.referenceId : `REC-${pmt.id.replace('FIN-', '')}`)
        }
      });
    }
  });

  // Sort chronologically ascending
  rawEntries.sort((a, b) => a.sortKey - b.sortKey);

  // Compute Running Balance
  let runningBalance = 0;
  const entries: CustomerLedgerEntry[] = rawEntries.map(item => {
    runningBalance += item.entry.debit - item.entry.credit;
    return {
      ...item.entry,
      runningBalance: Math.round(runningBalance * 100) / 100
    };
  });

  // Reverse so newest appears on top for display, while keeping accurate running balances
  entries.reverse();

  // Summary Metrics
  const totalInvoiced = entries.reduce((s, e) => s + (e.type === 'Invoice' ? e.debit : 0), 0);
  const totalPaid = entries.reduce((s, e) => s + (e.type === 'Payment' ? e.credit : 0), 0);
  const outstandingBalance = Math.max(0, customer.outstandingBalanceUSD);
  const availableCredit = Math.max(0, customer.creditLimitUSD - outstandingBalance);
  const creditUtilizationPct = customer.creditLimitUSD > 0 
    ? Math.min(100, Math.round((outstandingBalance / customer.creditLimitUSD) * 1000) / 10)
    : 0;

  const openInvoicesCount = custOrders.filter(o => o.paymentStatus !== 'Paid').length;
  const paidInvoicesCount = custOrders.filter(o => o.paymentStatus === 'Paid').length;
  const paymentsCount = custPayments.filter(p => !p.description.toLowerCase().includes('reversal')).length;

  const paymentsSorted = custPayments
    .filter(p => !p.description.toLowerCase().includes('reversal'))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const lastPayment = paymentsSorted[0];

  return {
    entries,
    summary: {
      totalInvoiced,
      totalPaid,
      outstandingBalance,
      availableCredit,
      creditUtilizationPct,
      openInvoicesCount,
      paidInvoicesCount,
      paymentsCount,
      lastPaymentDate: lastPayment?.date,
      lastPaymentAmount: lastPayment?.amount
    }
  };
}
