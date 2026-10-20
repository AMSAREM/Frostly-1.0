import React, { useState } from 'react';
import { 
  Receipt, 
  Printer, 
  Copy, 
  Check, 
  Send, 
  RotateCcw, 
  X, 
  Ship, 
  Building2, 
  CheckCircle2, 
  AlertTriangle,
  FileText,
  Calendar,
  CreditCard,
  Hash,
  Anchor,
  Download
} from 'lucide-react';
import { Supplier, SupplierLedgerEntry } from '../../types';

interface SupplierPaymentVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: SupplierLedgerEntry | null;
  supplier: Supplier | null;
  formatCurrency: (val: number) => string;
  onReversePayment?: (paymentEntryId: string, supplierId: string, amount: number, reason: string) => void;
}

export const SupplierPaymentVoucherModal: React.FC<SupplierPaymentVoucherModalProps> = ({
  isOpen,
  onClose,
  entry,
  supplier,
  formatCurrency,
  onReversePayment
}) => {
  const [copied, setCopied] = useState(false);
  const [sentNotification, setSentNotification] = useState(false);
  const [isReverseModalOpen, setIsReverseModalOpen] = useState(false);
  const [reverseReason, setReverseReason] = useState('Duplicate Wire Submission');
  const [reverseNotes, setReverseNotes] = useState('');

  if (!isOpen || !entry || !supplier) return null;

  const voucherNumber = entry.voucherNumber || entry.referenceId || `VOUCH-${entry.id.replace('LEDG-', '')}`;
  const disbursementAmount = entry.debit || entry.credit || 0;

  const handleCopySummary = () => {
    const text = `--- FROSTLY SEAFOOD COLD-CHAIN ERP ---
ACCOUNTS PAYABLE DISBURSEMENT VOUCHER & REMITTANCE ADVICE
Voucher #: ${voucherNumber}
Date: ${entry.date}
Supplier / Fleet: ${supplier.name} (${supplier.id})
Category: ${supplier.type}
Home Port: ${supplier.portLocation}, ${supplier.country}
Bank Account Ref: ${supplier.bankAccountRef || 'On File (Fedwire / ACH)'}
Disbursement Amount: ${formatCurrency(disbursementAmount)}
Payment Method: ${entry.paymentMethod || 'Federal Wire Transfer / ACH'}
Reference ID: ${entry.referenceId}
Status: ${entry.status}
Remaining AP Balance: ${formatCurrency(entry.runningBalance)}
Authorized by: Frostly Seafood Cold-Chain Treasury Desk`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSendEmail = () => {
    setSentNotification(true);
    setTimeout(() => setSentNotification(false), 3000);
  };

  const handleConfirmReverse = () => {
    if (!onReversePayment || !entry.financialEntryId) return;
    const finalReason = reverseNotes.trim() 
      ? `${reverseReason} - ${reverseNotes.trim()}` 
      : reverseReason;
    
    onReversePayment(entry.financialEntryId, supplier.id, disbursementAmount, finalReason);
    setIsReverseModalOpen(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white max-w-2xl w-full rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Top Actions Header (Hidden in Print) */}
        <div className="print:hidden flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-500/20 text-blue-400 rounded-xl">
              <Receipt className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-sm font-black tracking-tight uppercase">AP Disbursement Voucher</h3>
              <p className="text-[11px] text-slate-400">Official Accounts Payable Remittance Advice</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopySummary}
              title="Copy voucher details to clipboard"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span className="hidden sm:inline text-xs">{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              onClick={handlePrint}
              title="Print voucher"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline text-xs">Print</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Formal Printable Remittance Document */}
        <div className="p-6 sm:p-8 space-y-6 text-slate-800 bg-white">
          {/* Header Brand */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-slate-200">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-blue-600 text-white rounded-lg font-black text-sm">F</span>
                <span className="text-xl font-black tracking-tight text-slate-900">FROSTLY SEAFOOD COLD-CHAIN</span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Wholesale Logistics, Deep Cryo Storage & Fleet Intake</p>
              <p className="text-[11px] text-slate-400">Facility Pier 91 Dockmaster Building • Port of Seattle, WA 98119</p>
              <p className="text-[11px] text-slate-400">FDA Reg #192847291 • EU Export Approval Code US-SEA-88</p>
            </div>

            <div className="text-left sm:text-right space-y-1 bg-slate-50 sm:bg-transparent p-3 sm:p-0 rounded-2xl border sm:border-0 border-slate-200">
              <span className="inline-block px-2.5 py-1 bg-blue-100 text-blue-900 text-xs font-black uppercase tracking-wider rounded-lg mb-1">
                Disbursement Voucher
              </span>
              <div className="text-base font-mono-code font-black text-slate-900">{voucherNumber}</div>
              <div className="text-xs text-slate-500 flex items-center sm:justify-end gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Date: {entry.date}</span>
              </div>
              <div className="text-xs text-slate-500 flex items-center sm:justify-end gap-1">
                <Hash className="w-3.5 h-3.5 text-slate-400" />
                <span>Ref: {entry.referenceId}</span>
              </div>
            </div>
          </div>

          {/* Supplier Payee & Payment Method Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Ship className="w-3.5 h-3.5 text-blue-600" />
                <span>Payee / Fleet Partner</span>
              </div>
              <div>
                <div className="font-bold text-slate-900 text-sm">{supplier.name}</div>
                <div className="text-xs text-slate-600 mt-0.5">{supplier.type}</div>
              </div>
              <div className="text-xs text-slate-500 space-y-0.5 pt-1 border-t border-slate-200/60">
                <div>Port: {supplier.portLocation}, {supplier.country}</div>
                <div>Contact: {supplier.contactPerson} ({supplier.phone})</div>
                <div>Terms: {supplier.paymentTerms}</div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                <span>Disbursement Details</span>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-slate-500">Payment Channel:</div>
                <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{entry.paymentMethod || 'Federal Wire Transfer / ACH'}</span>
                </div>
              </div>
              <div className="text-xs text-slate-500 space-y-0.5 pt-1 border-t border-slate-200/60">
                <div>Bank Account Ref: <span className="font-mono-code font-bold text-slate-700">{supplier.bankAccountRef || 'ACH Wire Profile Active'}</span></div>
                <div>Status: <span className="font-bold text-emerald-700">{entry.status}</span></div>
                {entry.notes && (
                  <div className="text-[11px] text-slate-600 italic">Notes: "{entry.notes}"</div>
                )}
              </div>
            </div>
          </div>

          {/* Allocation Breakdown Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <div className="bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200 flex justify-between">
              <span>Item Description & Allocation</span>
              <span>Settled Amount</span>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 flex-1">
                  <div className="font-bold text-slate-900 text-sm">
                    {entry.description}
                  </div>
                  <div className="text-xs text-slate-500 flex flex-wrap gap-2">
                    {entry.purchaseOrderId && (
                      <span className="font-mono-code text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-bold">
                        PO #{entry.purchaseOrderId}
                      </span>
                    )}
                    {entry.lotAssignedId && (
                      <span className="font-mono-code text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded font-bold">
                        Lot: {entry.lotAssignedId}
                      </span>
                    )}
                    <span>Direct-to-Dock Harvester Catch Intake Settlement</span>
                  </div>
                </div>
                <div className="text-right font-mono-code font-black text-slate-900 text-base shrink-0">
                  {formatCurrency(disbursementAmount)}
                </div>
              </div>

              {/* Net Calculations */}
              <div className="pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Gross Landed Catch Value:</span>
                  <span className="font-mono-code font-bold text-slate-800">{formatCurrency(disbursementAmount)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Withholding / Dock Deductions:</span>
                  <span className="font-mono-code font-bold text-slate-800">$0.00</span>
                </div>
                <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-200">
                  <span className="text-emerald-700">Total Net Disbursed:</span>
                  <span className="font-mono-code text-emerald-700 text-xl">{formatCurrency(disbursementAmount)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Running AP Balance Footer */}
          <div className="p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="text-xs font-bold text-emerald-900">Remaining Supplier Accounts Payable (AP):</div>
              <div className="text-[11px] text-emerald-700">Net outstanding harvester balance due following this wire release.</div>
            </div>
            <div className="font-mono-code font-black text-lg text-emerald-900">
              {formatCurrency(entry.runningBalance)}
            </div>
          </div>

          {/* Signatures & Audit Stamp */}
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between gap-6 text-[11px] text-slate-400">
            <div className="space-y-1">
              <div className="font-bold text-slate-600">Disbursed By:</div>
              <div>Frostly Seafood Treasury & Harvester Accounts Desk</div>
              <div className="font-mono-code text-[10px]">AUTH-DIGITAL-SIGNATURE: {voucherNumber.replace(/[^A-Z0-9]/g, '')}-7102</div>
            </div>

            <div className="space-y-1 sm:text-right">
              <div className="font-bold text-slate-600">Audit Compliance:</div>
              <div>GAAP / Cold-Chain COGS Procurement Standard</div>
              <div>Direct-to-Harvester Fair Pricing Certified</div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions (Hidden in Print) */}
        <div className="print:hidden px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {onReversePayment && entry.financialEntryId && entry.type === 'Disbursement' && (
              <button
                type="button"
                onClick={() => setIsReverseModalOpen(true)}
                className="px-3 py-2 text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Void / Reverse Wire</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSendEmail}
              className="px-4 py-2 border border-slate-200 hover:bg-white text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{sentNotification ? 'Advice Dispatched!' : 'Email Remittance'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Official Voucher</span>
            </button>
          </div>
        </div>
      </div>

      {/* Reverse Payment Confirmation Modal */}
      {isReverseModalOpen && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-100 text-rose-700 rounded-2xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">Void / Reverse Disbursement?</h4>
                <p className="text-xs text-slate-500">This will restore {formatCurrency(disbursementAmount)} to {supplier.name}'s AP balance.</p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Reversal Reason</label>
                <select
                  value={reverseReason}
                  onChange={(e) => setReverseReason(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-medium"
                >
                  <option value="Duplicate Wire Submission">Duplicate Wire Submission</option>
                  <option value="Dock Inspection Price Variance">Dock Inspection Price Variance</option>
                  <option value="Incorrect Bank Routing Code">Incorrect Bank Routing Code</option>
                  <option value="Fleet Quota Excursion Hold">Fleet Quota Excursion Hold</option>
                  <option value="Administrative Re-allocation">Administrative Re-allocation</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Audit Notes / Explanation</label>
                <textarea
                  rows={2}
                  placeholder="Explain why this disbursement is being voided or recalled..."
                  value={reverseNotes}
                  onChange={(e) => setReverseNotes(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsReverseModalOpen(false)}
                className="flex-1 py-2.5 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReverse}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
              >
                Confirm Reversal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
