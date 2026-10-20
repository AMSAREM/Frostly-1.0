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
  Ship, 
  Calendar, 
  ChevronRight,
  Filter,
  Eye,
  Anchor
} from 'lucide-react';
import { Supplier, PurchaseOrderLanding, FinancialLedgerEntry, SupplierLedgerEntry } from '../types';
import { buildSupplierLedger, SupplierLedgerSummary } from '../utils/supplierLedger';
import { SupplierPaymentVoucherModal } from './Modals/SupplierPaymentVoucherModal';

interface SupplierLedgerTabProps {
  supplier: Supplier;
  purchaseOrders: PurchaseOrderLanding[];
  financialEntries: FinancialLedgerEntry[];
  formatCurrency: (val: number) => string;
  onOpenRecordPayment: (supplier: Supplier, specificPOId?: string, suggestedAmount?: number) => void;
  onReversePayment?: (paymentEntryId: string, supplierId: string, amount: number, reason: string) => void;
  onOpenNewCatch?: (supplier: Supplier) => void;
}

export const SupplierLedgerTab: React.FC<SupplierLedgerTabProps> = ({
  supplier,
  purchaseOrders,
  financialEntries,
  formatCurrency,
  onOpenRecordPayment,
  onReversePayment,
  onOpenNewCatch
}) => {
  const [filterType, setFilterType] = useState<'all' | 'Disbursement' | 'Bill' | 'Reversal'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVoucherEntry, setSelectedVoucherEntry] = useState<SupplierLedgerEntry | null>(null);

  // Compute ledger entries and summary
  const { entries, summary } = useMemo(() => {
    return buildSupplierLedger(supplier, purchaseOrders, financialEntries);
  }, [supplier, purchaseOrders, financialEntries]);

  // Filtered entries
  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      const matchesType = filterType === 'all' || entry.type === filterType;
      const matchesSearch = 
        entry.referenceId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (entry.voucherNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (entry.paymentMethod || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (entry.notes || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [entries, filterType, searchQuery]);

  const handleExportCSV = () => {
    if (entries.length === 0) return;
    const headers = [
      'Date', 
      'Type', 
      'Reference ID', 
      'Voucher / PO #', 
      'Description', 
      'Payment Method', 
      'Landed Catch Bill (Credit)', 
      'Disbursement / Payout (Debit)', 
      'Running AP Balance', 
      'Status'
    ];
    const rows = entries.map(e => [
      e.date,
      e.type,
      `"${e.referenceId}"`,
      `"${e.voucherNumber || e.purchaseOrderId || ''}"`,
      `"${e.description.replace(/"/g, '""')}"`,
      `"${e.paymentMethod || ''}"`,
      e.credit.toFixed(2),
      e.debit.toFixed(2),
      e.runningBalance.toFixed(2),
      e.status
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Supplier_AP_Ledger_${supplier.id}_${new Date().toISOString().split('T')[0]}.csv`);
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
        
        {/* Outstanding Accounts Payable */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>Outstanding AP Balance</span>
            <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <div className={`text-2xl font-black font-mono-code ${summary.outstandingPayableUSD > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
            {formatCurrency(summary.outstandingPayableUSD)}
          </div>
          <div className="text-[11px] text-slate-500">
            {summary.openBillsCount > 0 
              ? `${summary.openBillsCount} landed catch bill(s) pending settlement`
              : 'All harvester accounts settled'}
          </div>
        </div>

        {/* Total Harvester Payouts Disbursed */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>Total Disbursements Paid</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-700 font-mono-code">
            {formatCurrency(summary.totalDisbursedUSD)}
          </div>
          <div className="text-[11px] text-slate-500">
            {summary.disbursementsCount} settlement wire disbursement(s) posted
          </div>
        </div>

        {/* Total Inward Landed Catch (Billed) */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>Gross Landed Catch Value</span>
            <Anchor className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono-code">
            {formatCurrency(summary.totalBilledUSD)}
          </div>
          <div className="text-[11px] text-slate-500">
            {summary.openBillsCount + summary.settledBillsCount} total dock PO deliveries
          </div>
        </div>

        {/* Last Disbursement Information */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>Last Settlement Payout</span>
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-lg font-black text-slate-900 font-mono-code">
            {summary.lastPaymentAmount ? formatCurrency(summary.lastPaymentAmount) : 'None Recorded'}
          </div>
          <div className="text-[11px] text-slate-500">
            {summary.lastPaymentDate ? `Wire released on ${summary.lastPaymentDate}` : 'No past disbursements'}
          </div>
        </div>
      </div>

      {/* Action Bar: Filters, Search, Print, CSV, and Record Payment */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search PO #, Voucher #, species, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 md:pb-0">
          {(['all', 'Disbursement', 'Bill', 'Reversal'] as const).map(t => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                filterType === t
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t === 'all' 
                ? 'All Transactions' 
                : t === 'Disbursement' 
                ? 'Disbursements Only' 
                : t === 'Bill' 
                ? 'Catch Bills (POs) Only' 
                : 'Reversals'}
            </button>
          ))}
        </div>

        {/* Buttons: Export, Print, Disburse Payout */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            title="Download CSV Statement"
            className="p-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">CSV</span>
          </button>

          <button
            onClick={handlePrintLedger}
            title="Print AP Statement"
            className="p-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Print</span>
          </button>

          <button
            onClick={() => onOpenRecordPayment(supplier)}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <DollarSign className="w-4 h-4" />
            <span>Disburse Payment</span>
          </button>
        </div>
      </div>

      {/* Chronological AP Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-slate-600" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Chronological AP Settlement Ledger ({filteredEntries.length} Records)
            </h3>
          </div>
          <span className="text-[11px] text-slate-500">
            Terms: <strong>{supplier.paymentTerms}</strong> • Bank Ref: <strong>{supplier.bankAccountRef || 'ACH On File'}</strong>
          </span>
        </div>

        {filteredEntries.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="p-3 bg-slate-100 text-slate-400 rounded-full inline-block">
              <Receipt className="w-6 h-6" />
            </div>
            <div className="text-sm font-bold text-slate-700">No AP Ledger Transactions Found</div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {searchQuery || filterType !== 'all'
                ? 'Try adjusting your search criteria or transaction filter.'
                : 'No landed catch purchase orders or payment disbursements have been logged yet for this supplier.'}
            </p>
            {onOpenNewCatch && (
              <button
                onClick={() => onOpenNewCatch(supplier)}
                className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Log Inward Catch Haul
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Ref / Voucher #</th>
                  <th className="py-3 px-4">Transaction Details</th>
                  <th className="py-3 px-4">Payment Method</th>
                  <th className="py-3 px-4 text-right">Catch Bill (Credit)</th>
                  <th className="py-3 px-4 text-right">Disbursement (Debit)</th>
                  <th className="py-3 px-4 text-right">AP Balance</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEntries.map((entry) => {
                  const isBill = entry.type === 'Bill';
                  const isDisbursement = entry.type === 'Disbursement';
                  const isReversal = entry.type === 'Reversal';

                  return (
                    <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Date */}
                      <td className="py-3.5 px-4 font-mono-code text-slate-600 whitespace-nowrap text-[11px]">
                        {entry.date}
                      </td>

                      {/* Type Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isBill && (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-lg text-[10px] font-bold border border-blue-100 flex items-center gap-1 w-fit">
                            <Anchor className="w-3 h-3" />
                            <span>Catch Bill</span>
                          </span>
                        )}
                        {isDisbursement && (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-bold border border-emerald-100 flex items-center gap-1 w-fit">
                            <ArrowDownLeft className="w-3 h-3" />
                            <span>Disbursement</span>
                          </span>
                        )}
                        {isReversal && (
                          <span className="px-2 py-0.5 bg-rose-50 text-rose-700 rounded-lg text-[10px] font-bold border border-rose-100 flex items-center gap-1 w-fit">
                            <RotateCcw className="w-3 h-3" />
                            <span>Reversal</span>
                          </span>
                        )}
                      </td>

                      {/* Reference / Voucher # */}
                      <td className="py-3.5 px-4 font-mono-code font-bold text-slate-800 whitespace-nowrap">
                        <div>{entry.referenceId}</div>
                        {entry.voucherNumber && entry.voucherNumber !== entry.referenceId && (
                          <div className="text-[10px] text-slate-400 font-normal">{entry.voucherNumber}</div>
                        )}
                      </td>

                      {/* Description */}
                      <td className="py-3.5 px-4 text-slate-700 max-w-xs">
                        <div className="font-medium truncate" title={entry.description}>
                          {entry.description}
                        </div>
                        {entry.notes && (
                          <div className="text-[10px] text-slate-400 truncate italic">
                            Note: {entry.notes}
                          </div>
                        )}
                      </td>

                      {/* Payment Method */}
                      <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap text-[11px]">
                        {entry.paymentMethod || '—'}
                      </td>

                      {/* Catch Bill (Credit - increases AP) */}
                      <td className="py-3.5 px-4 text-right font-mono-code whitespace-nowrap">
                        {entry.credit > 0 ? (
                          <span className="font-bold text-rose-700">
                            +{formatCurrency(entry.credit)}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Disbursement (Debit - reduces AP) */}
                      <td className="py-3.5 px-4 text-right font-mono-code whitespace-nowrap">
                        {entry.debit > 0 ? (
                          <span className="font-bold text-emerald-700">
                            -{formatCurrency(entry.debit)}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Running Balance */}
                      <td className="py-3.5 px-4 text-right font-mono-code font-bold text-slate-900 whitespace-nowrap">
                        {formatCurrency(entry.runningBalance)}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          entry.status === 'Settled'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : entry.status === 'Reversed'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {entry.status}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {isDisbursement && (
                          <button
                            onClick={() => setSelectedVoucherEntry(entry)}
                            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
                            title="View AP Remittance Advice Voucher"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Voucher</span>
                          </button>
                        )}
                        {isBill && entry.status !== 'Settled' && (
                          <button
                            onClick={() => onOpenRecordPayment(supplier, entry.purchaseOrderId, entry.credit)}
                            className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                          >
                            Pay Bill
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Render Voucher Modal when clicked */}
      {selectedVoucherEntry && (
        <SupplierPaymentVoucherModal
          isOpen={!!selectedVoucherEntry}
          onClose={() => setSelectedVoucherEntry(null)}
          entry={selectedVoucherEntry}
          supplier={supplier}
          formatCurrency={formatCurrency}
          onReversePayment={onReversePayment}
        />
      )}
    </div>
  );
};
