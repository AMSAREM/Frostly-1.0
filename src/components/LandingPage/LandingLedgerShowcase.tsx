import React, { useState } from 'react';
import { 
  Receipt, 
  Building2, 
  Ship, 
  DollarSign, 
  Plus, 
  RotateCcw, 
  Printer, 
  Download, 
  CheckCircle2, 
  FileText, 
  ArrowDownLeft, 
  ArrowUpRight,
  X,
  CreditCard,
  Hash,
  Eye,
  Check
} from 'lucide-react';

interface LedgerItem {
  id: string;
  date: string;
  type: 'Invoice' | 'Payment' | 'Catch Bill' | 'Disbursement' | 'Reversal';
  refNumber: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
  method?: string;
  voucherNumber?: string;
}

export const LandingLedgerShowcase: React.FC = () => {
  const [activeLedger, setActiveLedger] = useState<'customer' | 'supplier'>('customer');
  const [selectedReceipt, setSelectedReceipt] = useState<LedgerItem | null>(null);
  const [selectedVoucher, setSelectedVoucher] = useState<LedgerItem | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Initial customer entries
  const [customerEntries, setCustomerEntries] = useState<LedgerItem[]>([
    {
      id: 'cust-1',
      date: '2026-10-01',
      type: 'Invoice',
      refNumber: 'INV-2026-0418',
      description: 'Wholesale Dispatch: 850 kg Alaskan Pacific Cod (Fillets)',
      debit: 11475.00,
      credit: 0,
      runningBalance: 11475.00
    },
    {
      id: 'cust-2',
      date: '2026-10-05',
      type: 'Payment',
      refNumber: 'REC-2026-9042',
      description: 'Wire Transfer received - Ref #CITI-883921',
      debit: 0,
      credit: 8000.00,
      runningBalance: 3475.00,
      method: 'Bank Transfer'
    },
    {
      id: 'cust-3',
      date: '2026-10-10',
      type: 'Invoice',
      refNumber: 'INV-2026-0489',
      description: 'Wholesale Dispatch: 1,200 kg Coho Salmon (Headless Dressed)',
      debit: 16800.00,
      credit: 0,
      runningBalance: 20275.00
    },
    {
      id: 'cust-4',
      date: '2026-10-14',
      type: 'Payment',
      refNumber: 'REC-2026-9118',
      description: 'Electronic Check Payment - Harbor Bistro Group',
      debit: 0,
      credit: 12500.00,
      runningBalance: 7775.00,
      method: 'Check / Cheque'
    }
  ]);

  // Initial supplier entries
  const [supplierEntries, setSupplierEntries] = useState<LedgerItem[]>([
    {
      id: 'sup-1',
      date: '2026-10-02',
      type: 'Catch Bill',
      refNumber: 'PO-CATCH-4019',
      description: 'Catch Inward: 4,280 kg Alaskan Pacific Cod (F/V Bering Horizon)',
      debit: 0,
      credit: 14980.00,
      runningBalance: 14980.00
    },
    {
      id: 'sup-2',
      date: '2026-10-04',
      type: 'Disbursement',
      refNumber: 'VOUCH-2026-0184',
      description: 'Direct Vessel Payout (Fuel & Catch Advance) • Check #4492',
      debit: 10000.00,
      credit: 0,
      runningBalance: 4980.00,
      method: 'Check',
      voucherNumber: 'VOUCH-2026-0184'
    },
    {
      id: 'sup-3',
      date: '2026-10-08',
      type: 'Catch Bill',
      refNumber: 'PO-CATCH-4082',
      description: 'Catch Inward: 2,940 kg Coho Salmon (Pier 38 Offload)',
      debit: 0,
      credit: 17640.00,
      runningBalance: 22620.00
    },
    {
      id: 'sup-4',
      date: '2026-10-12',
      type: 'Disbursement',
      refNumber: 'VOUCH-2026-0210',
      description: 'Wire Remittance Settlement to Captain Eriksen Account',
      debit: 15000.00,
      credit: 0,
      runningBalance: 7620.00,
      method: 'ACH / Wire Transfer',
      voucherNumber: 'VOUCH-2026-0210'
    }
  ]);

  const triggerToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  // Simulate customer payment action
  const handleSimulateCustomerPayment = () => {
    const lastBal = customerEntries[customerEntries.length - 1].runningBalance;
    const paymentAmount = 3000.00;
    const newBal = Math.max(0, lastBal - paymentAmount);
    const newEntry: LedgerItem = {
      id: `cust-${Date.now()}`,
      date: '2026-10-16',
      type: 'Payment',
      refNumber: `REC-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      description: 'Customer Payment recorded via Terminal POS • Ref #WIRE-NEW',
      debit: 0,
      credit: paymentAmount,
      runningBalance: newBal,
      method: 'ACH Transfer'
    };
    setCustomerEntries(prev => [...prev, newEntry]);
    triggerToast(`Payment of $${paymentAmount.toLocaleString()} recorded! Receipt #${newEntry.refNumber} generated and customer balance updated.`);
  };

  // Simulate supplier disbursement action
  const handleSimulateSupplierDisbursement = () => {
    const lastBal = supplierEntries[supplierEntries.length - 1].runningBalance;
    const disbAmount = 4000.00;
    const newBal = Math.max(0, lastBal - disbAmount);
    const newEntry: LedgerItem = {
      id: `sup-${Date.now()}`,
      date: '2026-10-16',
      type: 'Disbursement',
      refNumber: `VOUCH-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      description: 'Disbursement Payout issued to Vessel Captain • Check #5088',
      debit: disbAmount,
      credit: 0,
      runningBalance: newBal,
      method: 'Company Check',
      voucherNumber: `VOUCH-2026-${Math.floor(1000 + Math.random() * 9000)}`
    };
    setSupplierEntries(prev => [...prev, newEntry]);
    triggerToast(`Disbursement of $${disbAmount.toLocaleString()} issued! Remittance Voucher #${newEntry.refNumber} generated.`);
  };

  // Summary calculations
  const customerTotalInvoiced = customerEntries.reduce((sum, e) => sum + e.debit, 0);
  const customerTotalPaid = customerEntries.reduce((sum, e) => sum + e.credit, 0);
  const customerBalance = customerEntries[customerEntries.length - 1]?.runningBalance || 0;

  const supplierTotalBilled = supplierEntries.reduce((sum, e) => sum + e.credit, 0);
  const supplierTotalDisbursed = supplierEntries.reduce((sum, e) => sum + e.debit, 0);
  const supplierBalance = supplierEntries[supplierEntries.length - 1]?.runningBalance || 0;

  return (
    <section id="ledgers-showcase" className="py-20 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-12">
          <div className="max-w-2xl text-left">
            <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-indigo-700 mb-3">
              <span>Dual Ledger Engine</span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span>Audit-Proof Accounting</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight [text-wrap:balance]">
              Dedicated Payment Ledgers & Immediate Actions for Every Customer and Supplier
            </h2>
            <p className="mt-3 text-base text-slate-600 leading-relaxed [text-wrap:balance]">
              Every customer profile and supplier fleet account includes a dedicated ledger tracking chronological billing, payments, running balance calculations, printable remittance vouchers, and audit reversals.
            </p>
          </div>

          {/* Toggle Tab */}
          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-lg border border-slate-200 shrink-0 self-start lg:self-auto">
            <button
              onClick={() => setActiveLedger('customer')}
              className={`px-4 py-2 rounded-md text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                activeLedger === 'customer'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-4 h-4 text-indigo-600" />
              <span>Customer Ledger (AR)</span>
            </button>
            <button
              onClick={() => setActiveLedger('supplier')}
              className={`px-4 py-2 rounded-md text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                activeLedger === 'supplier'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Ship className="w-4 h-4 text-blue-600" />
              <span>Supplier Ledger (AP)</span>
            </button>
          </div>
        </div>

        {/* Dynamic Ledger Card */}
        <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          
          {/* Card Top Info Bar */}
          <div className="p-6 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700">
                {activeLedger === 'customer' ? <Building2 className="w-5 h-5" /> : <Ship className="w-5 h-5" />}
              </div>
              <div>
                <div className="text-xs text-slate-400 font-medium">
                  {activeLedger === 'customer' ? 'Customer Account' : 'Supplier Vessel Fleet'}
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  {activeLedger === 'customer' ? 'Pacific Catch Wholesale Distributors' : 'F/V Bering Horizon • Capt. Erik Eriksen'}
                </h3>
              </div>
            </div>

            {/* Quick KPIs */}
            <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
              <div className="bg-slate-50 px-3 py-2 rounded border border-slate-200">
                <span className="text-slate-500 font-sans block text-[11px]">
                  {activeLedger === 'customer' ? 'Total Invoiced' : 'Total Catch Landed'}
                </span>
                <span className="font-bold text-slate-900 text-sm tabular-nums">
                  ${(activeLedger === 'customer' ? customerTotalInvoiced : supplierTotalBilled).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="bg-slate-50 px-3 py-2 rounded border border-slate-200">
                <span className="text-slate-500 font-sans block text-[11px]">
                  {activeLedger === 'customer' ? 'Payments Collected' : 'Disbursements Issued'}
                </span>
                <span className="font-bold text-emerald-600 text-sm tabular-nums">
                  ${(activeLedger === 'customer' ? customerTotalPaid : supplierTotalDisbursed).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="bg-slate-900 text-white px-3.5 py-2 rounded border border-slate-800">
                <span className="text-slate-300 font-sans block text-[11px]">
                  {activeLedger === 'customer' ? 'Net Receivable' : 'Outstanding Payable'}
                </span>
                <span className="font-bold text-sm tabular-nums text-amber-300">
                  ${(activeLedger === 'customer' ? customerBalance : supplierBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Direct Action Button */}
            <div className="flex items-center gap-2">
              {activeLedger === 'customer' ? (
                <button
                  onClick={handleSimulateCustomerPayment}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Record Customer Payment</span>
                </button>
              ) : (
                <button
                  onClick={handleSimulateSupplierDisbursement}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Disburse Supplier Payout</span>
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 font-mono">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Reference #</th>
                  <th className="py-3 px-4">Transaction Details</th>
                  <th className="py-3 px-4 text-right">
                    {activeLedger === 'customer' ? 'Debit (Invoiced)' : 'Payout (Debit)'}
                  </th>
                  <th className="py-3 px-4 text-right">
                    {activeLedger === 'customer' ? 'Credit (Payment)' : 'Catch Billed (Credit)'}
                  </th>
                  <th className="py-3 px-4 text-right">Running Balance</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 bg-white font-mono tabular-nums">
                {(activeLedger === 'customer' ? customerEntries : supplierEntries).map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 text-slate-600">{item.date}</td>
                    <td className="py-3 px-4 font-sans">
                      <span className={`inline-block font-medium ${
                        item.type.includes('Payment') || item.type.includes('Disbursement')
                          ? 'text-emerald-700 font-semibold'
                          : 'text-slate-900'
                      }`}>
                        {item.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">{item.refNumber}</td>
                    <td className="py-3 px-4 font-sans text-slate-600 max-w-xs truncate">
                      {item.description}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-900">
                      {item.debit > 0 ? `$${item.debit.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-emerald-600">
                      {item.credit > 0 ? `$${item.credit.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900 bg-slate-50/50">
                      ${item.runningBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-center font-sans">
                      {activeLedger === 'customer' ? (
                        item.type === 'Payment' ? (
                          <button
                            onClick={() => setSelectedReceipt(item)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded transition-colors cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Receipt</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Invoice Billed</span>
                        )
                      ) : (
                        item.type === 'Disbursement' ? (
                          <button
                            onClick={() => setSelectedVoucher(item)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded transition-colors cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Voucher</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Catch Logged</span>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table Footer Banner */}
          <div className="p-4 bg-slate-100/70 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Double-entry validated. Every debit/credit ties to verified purchase orders and receipt numbers.</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-slate-500">Auto-synchronized to Financial Ledger</span>
            </div>
          </div>
        </div>

        {/* Interactive Feedback Toast */}
        {successToast && (
          <div className="mt-4 p-3.5 bg-emerald-900 text-white rounded-lg text-xs flex items-center justify-between shadow-md animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-300" />
              <span>{successToast}</span>
            </div>
            <span className="text-[10px] font-mono uppercase bg-emerald-800 px-2 py-0.5 rounded text-emerald-200">
              Ledger Live
            </span>
          </div>
        )}

        {/* Customer Receipt Preview Modal */}
        {selectedReceipt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div className="flex items-center gap-2 text-indigo-700">
                  <Receipt className="w-5 h-5" />
                  <span className="font-bold text-sm">Customer Payment Receipt</span>
                </div>
                <button 
                  onClick={() => setSelectedReceipt(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="py-4 space-y-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Receipt Number:</span>
                  <span className="font-mono font-bold text-slate-900">{selectedReceipt.refNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Date Received:</span>
                  <span className="font-mono text-slate-700">{selectedReceipt.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Customer:</span>
                  <span className="font-semibold text-slate-900">Pacific Catch Wholesale</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Method:</span>
                  <span className="font-medium text-slate-700">{selectedReceipt.method || 'Bank Wire'}</span>
                </div>
                <div className="pt-2 border-t border-slate-100 flex justify-between text-sm">
                  <span className="font-bold text-slate-900">Amount Collected:</span>
                  <span className="font-mono font-bold text-emerald-600">${selectedReceipt.credit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  onClick={() => setSelectedReceipt(null)}
                  className="px-4 py-2 bg-slate-900 text-white rounded text-xs font-medium cursor-pointer"
                >
                  Close Receipt
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Supplier Remittance Voucher Preview Modal */}
        {selectedVoucher && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div className="flex items-center gap-2 text-blue-700">
                  <Ship className="w-5 h-5" />
                  <span className="font-bold text-sm">Supplier Accounts Payable Remittance Voucher</span>
                </div>
                <button 
                  onClick={() => setSelectedVoucher(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="py-4 space-y-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Remittance Voucher #:</span>
                  <span className="font-mono font-bold text-slate-900">{selectedVoucher.refNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Disbursement Date:</span>
                  <span className="font-mono text-slate-700">{selectedVoucher.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payee Vessel:</span>
                  <span className="font-semibold text-slate-900">F/V Bering Horizon (Capt. Eriksen)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Instrument:</span>
                  <span className="font-medium text-slate-700">{selectedVoucher.method || 'Check'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded border border-slate-200 font-mono text-[11px] space-y-1">
                  <div className="text-slate-500">Allocation Memo:</div>
                  <div className="text-slate-800">{selectedVoucher.description}</div>
                </div>
                <div className="pt-2 border-t border-slate-100 flex justify-between text-sm">
                  <span className="font-bold text-slate-900">Disbursed Amount:</span>
                  <span className="font-mono font-bold text-blue-700">${selectedVoucher.debit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  onClick={() => setSelectedVoucher(null)}
                  className="px-4 py-2 bg-slate-900 text-white rounded text-xs font-medium cursor-pointer"
                >
                  Close Voucher
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </section>
  );
};
