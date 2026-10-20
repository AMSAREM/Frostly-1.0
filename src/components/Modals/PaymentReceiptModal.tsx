import React, { useState } from 'react';
import { 
  Receipt, 
  Printer, 
  Copy, 
  Check, 
  Send, 
  RotateCcw, 
  X, 
  Building2, 
  CheckCircle2, 
  AlertTriangle,
  FileText,
  Calendar,
  CreditCard,
  Hash
} from 'lucide-react';
import { Customer, CustomerLedgerEntry } from '../../types';

interface PaymentReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: CustomerLedgerEntry | null;
  customer: Customer | null;
  formatCurrency: (val: number) => string;
  onReversePayment?: (paymentEntryId: string, customerId: string, amount: number, reason: string) => void;
}

export const PaymentReceiptModal: React.FC<PaymentReceiptModalProps> = ({
  isOpen,
  onClose,
  entry,
  customer,
  formatCurrency,
  onReversePayment
}) => {
  const [copied, setCopied] = useState(false);
  const [sentNotification, setSentNotification] = useState(false);
  const [isReverseModalOpen, setIsReverseModalOpen] = useState(false);
  const [reverseReason, setReverseReason] = useState('Bounced / Dishonored Check');
  const [reverseNotes, setReverseNotes] = useState('');

  if (!isOpen || !entry || !customer) return null;

  const receiptNumber = entry.receiptNumber || entry.referenceId || `REC-${entry.id.replace('LEDG-', '')}`;
  const paymentAmount = entry.credit || entry.debit || 0;

  const handleCopySummary = () => {
    const text = `--- FROSTLY SEAFOOD COLD-CHAIN ERP ---
OFFICIAL PAYMENT RECEIPT & SETTLEMENT VOUCHER
Receipt #: ${receiptNumber}
Date: ${entry.date}
Customer: ${customer.companyName || customer.name} (${customer.id})
Amount Received: ${formatCurrency(paymentAmount)}
Payment Method: ${entry.paymentMethod || 'Bank Wire Transfer'}
Reference ID: ${entry.referenceId}
Status: ${entry.status}
Account Balance After Payment: ${formatCurrency(entry.runningBalance)}
Authorized by: Frostly Accounts Receivable Desk`;

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
    
    onReversePayment(entry.financialEntryId, customer.id, paymentAmount, finalReason);
    setIsReverseModalOpen(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white max-w-2xl w-full rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Top Actions Header (Hidden in Print) */}
        <div className="print:hidden flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <Receipt className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-sm font-black tracking-tight uppercase">Payment Settlement Voucher</h3>
              <p className="text-[11px] text-slate-400">Official Accounts Receivable Transaction Record</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
              title="Print Voucher"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print</span>
            </button>

            <button
              onClick={handleCopySummary}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
              title="Copy Summary"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Voucher Body */}
        <div className="p-6 sm:p-8 space-y-6 bg-white text-slate-900 print:p-0">
          
          {/* Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black text-slate-900 tracking-tight">FROSTLY SEAFOOD</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  AR SETTLED
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Cold-Chain Distribution & Commercial Operations</p>
              <p className="text-[11px] text-slate-400">Facility FAC-001 • FDA Reg. #184920412</p>
            </div>

            <div className="sm:text-right space-y-1">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Voucher / Receipt No.</div>
              <div className="text-base font-black font-mono-code text-slate-900">{receiptNumber}</div>
              <div className="flex items-center sm:justify-end gap-1.5 text-xs text-slate-600">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Date: <strong>{entry.date}</strong></span>
              </div>
            </div>
          </div>

          {/* Payer and Payee Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Received From (Customer)
              </div>
              <div className="font-black text-sm text-slate-900">{customer.companyName || customer.name}</div>
              <div className="text-slate-600 mt-0.5">Account ID: <span className="font-mono-code font-bold">{customer.id}</span></div>
              <div className="text-slate-600">Attn: {customer.contactPerson}</div>
              <div className="text-slate-500 mt-1">{customer.address}, {customer.city}</div>
              <div className="text-slate-500">{customer.email} • {customer.phone}</div>
            </div>

            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Beneficiary & Clearing Desk
              </div>
              <div className="font-black text-sm text-slate-900">Frostly Seafood B2B Accounts</div>
              <div className="text-slate-600 mt-0.5">Clearing: <span className="font-semibold text-slate-800">Direct AR Settlement Desk</span></div>
              <div className="text-slate-600">Terms: <span className="font-bold text-indigo-700">{customer.paymentTerms}</span></div>
              <div className="text-slate-500 mt-1">Status: Active Commercial Credit Facility</div>
            </div>
          </div>

          {/* Amount Paid Callout */}
          <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-800">Total Payment Amount Received</div>
              <div className="text-3xl font-black text-emerald-950 font-mono-code mt-0.5">
                {formatCurrency(paymentAmount)}
              </div>
              <div className="text-xs text-emerald-700 mt-1">
                Status: <span className="font-bold">Cleared & Reconciled in General Ledger</span>
              </div>
            </div>

            <div className="sm:text-right space-y-1">
              <div className="text-[11px] font-bold text-emerald-800 uppercase">Payment Method</div>
              <div className="text-sm font-black text-slate-900 flex items-center sm:justify-end gap-1.5">
                <CreditCard className="w-4 h-4 text-emerald-700" />
                <span>{entry.paymentMethod || 'Bank Wire Transfer'}</span>
              </div>
              <div className="text-xs font-mono-code text-slate-500">Ref: {entry.referenceId}</div>
            </div>
          </div>

          {/* Transaction Allocation Details */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Allocation & Account Impact</h4>
            <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 text-xs">
              <div className="p-3 bg-slate-50/80 font-bold text-slate-500 flex justify-between">
                <span>Description</span>
                <span>Amount Applied</span>
              </div>

              <div className="p-3 flex justify-between items-center">
                <div>
                  <div className="font-bold text-slate-900">{entry.description || 'Customer AR Settlement'}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {entry.orderId ? `Applied directly to Wholesale Order #${entry.orderId}` : 'Applied to overall outstanding customer receivable balance'}
                  </div>
                </div>
                <div className="font-mono-code font-bold text-emerald-700">
                  {formatCurrency(paymentAmount)}
                </div>
              </div>

              <div className="p-3 bg-slate-50/50 flex justify-between items-center text-slate-600">
                <span>Customer Remaining Outstanding Balance</span>
                <span className="font-mono-code font-black text-slate-900">
                  {formatCurrency(entry.runningBalance)}
                </span>
              </div>
            </div>
          </div>

          {/* Verification Seal & Signature */}
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>Electronically signed & sealed by Frostly Automated Accounting Ledger.</span>
            </div>

            <div className="text-center sm:text-right">
              <div className="font-mono-code text-[11px] text-slate-400">HASH: {Math.random().toString(36).substring(2, 12).toUpperCase()}</div>
              <div className="text-[11px] text-slate-500">Authorized Comptroller Signature</div>
            </div>
          </div>

        </div>

        {/* Modal Bottom Action Footer (Hidden in Print) */}
        <div className="print:hidden px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {onReversePayment && entry.financialEntryId && entry.type !== 'Reversal' && (
              <button
                onClick={() => setIsReverseModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 rounded-xl text-xs font-bold border border-rose-200 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Void / Reverse Payment</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSendEmail}
              disabled={sentNotification}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{sentNotification ? 'Receipt Sent to Customer!' : `Send Receipt to ${customer.email}`}</span>
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

      </div>

      {/* Reverse Payment Confirmation Modal */}
      {isReverseModalOpen && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-700">
              <div className="p-2.5 bg-rose-100 rounded-2xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Void / Reverse Payment</h3>
                <p className="text-xs text-slate-500">Restore receivable balance and void receipt</p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900">
              This action will reverse the credit of <strong>{formatCurrency(paymentAmount)}</strong> and add it back to customer <strong>{customer.name}</strong>'s balance. A reversal transaction will be logged in the financial ledger.
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Reason for Reversal</label>
                <select
                  value={reverseReason}
                  onChange={(e) => setReverseReason(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                >
                  <option value="Bounced / Dishonored Check">Bounced / Dishonored Check</option>
                  <option value="Duplicate Payment Entry">Duplicate Payment Entry</option>
                  <option value="Customer Dispute / Chargeback">Customer Dispute / Chargeback</option>
                  <option value="Incorrect Allocation / Wrong Customer">Incorrect Allocation / Wrong Customer</option>
                  <option value="Payment Method Failure (ACH Return)">Payment Method Failure (ACH Return)</option>
                  <option value="Other Accounting Adjustment">Other Accounting Adjustment</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Audit Notes / Comments</label>
                <textarea
                  rows={2}
                  placeholder="Optional audit notes regarding why this payment was voided..."
                  value={reverseNotes}
                  onChange={(e) => setReverseNotes(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setIsReverseModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReverse}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-xs cursor-pointer"
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
