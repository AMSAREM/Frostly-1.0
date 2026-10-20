import React, { useState, useMemo } from 'react';
import { 
  DollarSign, 
  Receipt, 
  FileText, 
  CreditCard, 
  ArrowDownLeft, 
  ArrowUpRight, 
  RotateCcw, 
  Printer, 
  Download, 
  Search, 
  Plus, 
  AlertCircle, 
  CheckCircle2, 
  Building2, 
  Calendar, 
  ChevronRight,
  Filter,
  Eye
} from 'lucide-react';
import { Customer, ClientOrder, FinancialLedgerEntry, CustomerLedgerEntry } from '../types';
import { buildCustomerLedger, CustomerLedgerSummary } from '../utils/customerLedger';
import { PaymentReceiptModal } from './Modals/PaymentReceiptModal';

interface CustomerLedgerTabProps {
  customer: Customer;
  orders: ClientOrder[];
  financialEntries: FinancialLedgerEntry[];
  formatCurrency: (val: number) => string;
  onOpenRecordPayment: (customer: Customer, specificOrderId?: string, suggestedAmount?: number) => void;
  onReversePayment?: (paymentEntryId: string, customerId: string, amount: number, reason: string) => void;
  onSelectCustomerForOrder?: (customer: Customer) => void;
  onOpenInvoice?: (order: ClientOrder) => void;
}

export const CustomerLedgerTab: React.FC<CustomerLedgerTabProps> = ({
  customer,
  orders,
  financialEntries,
  formatCurrency,
  onOpenRecordPayment,
  onReversePayment,
  onSelectCustomerForOrder,
  onOpenInvoice
}) => {
  const [filterType, setFilterType] = useState<'all' | 'Payment' | 'Invoice' | 'Reversal'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReceiptEntry, setSelectedReceiptEntry] = useState<CustomerLedgerEntry | null>(null);

  // Compute ledger entries and summary
  const { entries, summary } = useMemo(() => {
    return buildCustomerLedger(customer, orders, financialEntries);
  }, [customer, orders, financialEntries]);

  // Filtered entries
  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      const matchesType = filterType === 'all' || entry.type === filterType;
      const matchesSearch = 
        entry.referenceId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (entry.paymentMethod || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (entry.notes || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [entries, filterType, searchQuery]);

  const handleExportCSV = () => {
    if (entries.length === 0) return;
    const headers = ['Date', 'Type', 'Reference ID', 'Description', 'Payment Method', 'Debit (Charges)', 'Credit (Payments)', 'Running Balance', 'Status'];
    const rows = entries.map(e => [
      e.date,
      e.type,
      `"${e.referenceId}"`,
      `"${e.description.replace(/"/g, '""')}"`,
      `"${e.paymentMethod || ''}"`,
      e.debit.toFixed(2),
      e.credit.toFixed(2),
      e.runningBalance.toFixed(2),
      e.status
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Customer_Ledger_${customer.id}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintLedger = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Ledger KPI Cards Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Invoiced (Lifetime Charges) */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Invoiced</span>
            <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <ArrowUpRight className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl font-black font-mono-code text-slate-900">
            {formatCurrency(summary.totalInvoiced)}
          </div>
          <div className="text-[11px] text-slate-500">
            {summary.paidInvoicesCount + summary.openInvoicesCount} wholesale invoice(s)
          </div>
        </div>

        {/* Total Payments Settled */}
        <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200/80 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Total Payments Made</span>
            <span className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
              <ArrowDownLeft className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl font-black font-mono-code text-emerald-950">
            {formatCurrency(summary.totalPaid)}
          </div>
          <div className="text-[11px] text-emerald-700">
            {summary.paymentsCount} payments logged & reconciled
          </div>
        </div>

        {/* Current AR Balance Outstanding */}
        <div className={`p-4 rounded-2xl border shadow-xs space-y-1.5 ${
          summary.outstandingBalance > 0
            ? 'bg-amber-50/60 border-amber-200 text-amber-950'
            : 'bg-slate-50 border-slate-200 text-slate-900'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900">Current Balance Due</span>
            <span className={`p-1.5 rounded-lg ${summary.outstandingBalance > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-600'}`}>
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl font-black font-mono-code text-amber-950">
            {formatCurrency(summary.outstandingBalance)}
          </div>
          <div className="text-[11px] text-amber-800 font-medium">
            {summary.openInvoicesCount > 0 ? `${summary.openInvoicesCount} open invoice(s) pending` : 'All invoices settled'}
          </div>
        </div>

        {/* Available Credit Line */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Available Credit</span>
            <span className="p-1.5 bg-slate-100 text-slate-700 rounded-lg">
              <CreditCard className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl font-black font-mono-code text-slate-900">
            {formatCurrency(summary.availableCredit)}
          </div>
          <div className="text-[11px] text-slate-500">
            Limit: {formatCurrency(customer.creditLimitUSD)} ({summary.creditUtilizationPct}% used)
          </div>
        </div>
      </div>

      {/* Action Toolbar & Search / Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs">
        
        {/* Left: Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
              filterType === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            All Transactions ({entries.length})
          </button>

          <button
            onClick={() => setFilterType('Payment')}
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1 transition-all cursor-pointer ${
              filterType === 'Payment'
                ? 'bg-emerald-700 text-white'
                : 'bg-white text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>Payments Only ({entries.filter(e => e.type === 'Payment').length})</span>
          </button>

          <button
            onClick={() => setFilterType('Invoice')}
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1 transition-all cursor-pointer ${
              filterType === 'Invoice'
                ? 'bg-indigo-700 text-white'
                : 'bg-white text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Invoices Only ({entries.filter(e => e.type === 'Invoice').length})</span>
          </button>
        </div>

        {/* Right: Search & Action Buttons */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-48">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search ledger..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 font-bold transition-colors cursor-pointer"
            title="Export CSV Statement"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Export CSV</span>
          </button>

          <button
            onClick={() => onOpenRecordPayment(customer)}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Record Payment</span>
          </button>
        </div>
      </div>

      {/* Customer Ledger Table */}
      <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Type & Ref</th>
                <th className="p-3.5">Description & Allocation</th>
                <th className="p-3.5">Method / Terms</th>
                <th className="p-3.5 text-right text-indigo-700">Debit (Charges)</th>
                <th className="p-3.5 text-right text-emerald-700">Credit (Payments)</th>
                <th className="p-3.5 text-right">Running Balance</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredEntries.length > 0 ? (
                filteredEntries.map((entry) => {
                  const isPayment = entry.type === 'Payment';
                  const isInvoice = entry.type === 'Invoice';
                  const isReversal = entry.type === 'Reversal';

                  return (
                    <tr 
                      key={entry.id} 
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isPayment ? 'bg-emerald-50/15' : isReversal ? 'bg-rose-50/20' : ''
                      }`}
                    >
                      {/* Date */}
                      <td className="p-3.5 whitespace-nowrap font-medium text-slate-800">
                        {entry.date}
                      </td>

                      {/* Type & Reference ID */}
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isPayment 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : isInvoice
                              ? 'bg-indigo-100 text-indigo-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}>
                            {entry.type}
                          </span>
                          <span className="font-mono-code font-bold text-slate-900">{entry.referenceId}</span>
                        </div>
                      </td>

                      {/* Description & Allocation */}
                      <td className="p-3.5 max-w-xs truncate" title={entry.description}>
                        <div className="font-medium text-slate-900 truncate">{entry.description}</div>
                        {entry.notes && (
                          <div className="text-[10px] text-slate-400 italic truncate">{entry.notes}</div>
                        )}
                      </td>

                      {/* Payment Method / Terms */}
                      <td className="p-3.5 whitespace-nowrap text-slate-600">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[11px] font-medium">
                          {entry.paymentMethod || 'Commercial Net-30'}
                        </span>
                      </td>

                      {/* Debit (+) */}
                      <td className="p-3.5 whitespace-nowrap text-right font-mono-code font-bold text-indigo-700">
                        {entry.debit > 0 ? formatCurrency(entry.debit) : '—'}
                      </td>

                      {/* Credit (-) */}
                      <td className="p-3.5 whitespace-nowrap text-right font-mono-code font-bold text-emerald-700">
                        {entry.credit > 0 ? formatCurrency(entry.credit) : '—'}
                      </td>

                      {/* Running Balance */}
                      <td className="p-3.5 whitespace-nowrap text-right font-mono-code font-black text-slate-900">
                        {formatCurrency(entry.runningBalance)}
                      </td>

                      {/* Status */}
                      <td className="p-3.5 whitespace-nowrap text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          entry.status === 'Settled'
                            ? 'bg-emerald-100 text-emerald-800'
                            : entry.status === 'Pending'
                            ? 'bg-amber-100 text-amber-800'
                            : entry.status === 'Reversed'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {entry.status}
                        </span>
                      </td>

                      {/* ACTION COLUMN FOR EVERY PAYMENT */}
                      <td className="p-3.5 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isPayment && (
                            <>
                              {/* Action 1: View Receipt & Voucher */}
                              <button
                                onClick={() => setSelectedReceiptEntry(entry)}
                                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors cursor-pointer"
                                title="View & Print Payment Receipt"
                              >
                                <Receipt className="w-3.5 h-3.5" />
                                <span>Receipt</span>
                              </button>

                              {/* Action 2: Quick Print Receipt */}
                              <button
                                onClick={() => setSelectedReceiptEntry(entry)}
                                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                                title="Print Receipt"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>

                              {/* Action 3: Void / Reverse */}
                              {onReversePayment && entry.financialEntryId && (
                                <button
                                  onClick={() => setSelectedReceiptEntry(entry)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                                  title="Void or Reverse Payment"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </>
                          )}

                          {isInvoice && (
                            <>
                              {/* Invoice Actions */}
                              {entry.orderId && onOpenInvoice && (
                                <button
                                  onClick={() => {
                                    const ord = orders.find(o => o.id === entry.orderId);
                                    if (ord) onOpenInvoice(ord);
                                  }}
                                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
                                  title="View Order Invoice"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Invoice</span>
                                </button>
                              )}

                              {entry.status !== 'Settled' && (
                                <button
                                  onClick={() => onOpenRecordPayment(customer, entry.orderId, entry.debit)}
                                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                                  title="Pay this invoice now"
                                >
                                  <DollarSign className="w-3.5 h-3.5" />
                                  <span>Pay</span>
                                </button>
                              )}
                            </>
                          )}

                          {isReversal && (
                            <span className="text-[10px] text-rose-600 font-bold italic">
                              Voided
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Receipt className="w-8 h-8 text-slate-300" />
                      <p className="font-bold text-sm text-slate-600">No ledger transactions match your criteria</p>
                      <p className="text-xs text-slate-400">
                        {entries.length === 0 
                          ? 'This client has not placed any wholesale orders or made any payments yet.'
                          : 'Try changing your search terms or transaction type filter above.'}
                      </p>
                      {entries.length === 0 && (
                        <div className="flex items-center gap-2 pt-2">
                          <button
                            onClick={() => onOpenRecordPayment(customer)}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs cursor-pointer shadow-xs"
                          >
                            Record Initial Payment / Deposit
                          </button>
                          {onSelectCustomerForOrder && (
                            <button
                              onClick={() => onSelectCustomerForOrder(customer)}
                              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs cursor-pointer shadow-xs"
                            >
                              Create First Order
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Official Payment Receipt Modal */}
      <PaymentReceiptModal
        isOpen={Boolean(selectedReceiptEntry)}
        onClose={() => setSelectedReceiptEntry(null)}
        entry={selectedReceiptEntry}
        customer={customer}
        formatCurrency={formatCurrency}
        onReversePayment={onReversePayment}
      />
    </div>
  );
};
