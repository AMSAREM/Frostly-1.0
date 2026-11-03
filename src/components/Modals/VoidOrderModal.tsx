import React, { useState } from 'react';
import { AlertTriangle, X, ShieldAlert, ArrowLeftRight, PackageCheck, FileX } from 'lucide-react';
import { ClientOrder, Customer } from '../../types';

interface VoidOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: ClientOrder | null;
  customer?: Customer | null;
  formatCurrency: (amount: number) => string;
  onConfirmVoid: (orderId: string, reason: string, voidedBy: string) => Promise<void> | void;
}

const VOID_REASONS = [
  'Customer Cancelled Prior to Dispatch',
  'Billing Error / Duplicate Order Entry',
  'Quality / Grading Specification Mismatch',
  'Credit Limit Exceeded / Account On Hold',
  'Unfulfillable Cold Storage Stock Shortage',
  'Order Rescheduled / Replaced by New Order',
  'Other / Custom Administrative Override'
];

export const VoidOrderModal: React.FC<VoidOrderModalProps> = ({
  isOpen,
  onClose,
  order,
  customer,
  formatCurrency,
  onConfirmVoid
}) => {
  const [selectedReason, setSelectedReason] = useState<string>(VOID_REASONS[0]);
  const [customNote, setCustomNote] = useState<string>('');
  const [authorizerName, setAuthorizerName] = useState<string>('Operations Manager');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !order) return null;

  const totalAmount = order.adjustedTotalUSD || order.quotedTotalUSD || 0;
  const isPaid = order.paymentStatus === 'Paid' || order.paymentStatus === 'Paid in Full';
  const totalAllocatedWeight = order.items?.reduce((sum, item) => {
    return sum + (item.actualWeighedKg ?? item.requestedWeightKg ?? 0);
  }, 0) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authorizerName.trim()) {
      setErrorMsg('Please enter the name of the authorizing manager.');
      return;
    }

    const finalReason = selectedReason === 'Other / Custom Administrative Override' && customNote.trim()
      ? customNote.trim()
      : customNote.trim() 
        ? `${selectedReason} - ${customNote.trim()}`
        : selectedReason;

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await onConfirmVoid(order.id, finalReason, authorizerName.trim());
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to void the order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white max-w-lg w-full rounded-3xl p-6 shadow-2xl border border-rose-100 space-y-5 animate-in fade-in zoom-in-95 duration-150 my-auto">
        
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <FileX className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">Void Order</h2>
              <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5 font-mono">
                <span>#{order.id}</span>
                <span aria-hidden="true">·</span>
                <span>{customer?.name || order.clientName}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Audit Impact Notice Card */}
        <div className="p-4 bg-rose-50/70 border border-rose-200/80 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
            <span>Audit Trail & Balance Reversal Notice</span>
          </div>
          <p className="text-xs text-rose-900/90 leading-relaxed">
            Voiding preserves an immutable audit record of order <strong>#{order.id}</strong> while rolling back inventory allocations and financial liability:
          </p>

          <div className="grid grid-cols-2 gap-2 text-xs pt-1">
            <div className="bg-white/80 p-2.5 rounded-xl border border-rose-200/50">
              <div className="text-slate-500 text-[11px] flex items-center gap-1">
                <ArrowLeftRight className="w-3.5 h-3.5 text-rose-600" />
                <span>Customer Balance</span>
              </div>
              <div className="text-rose-700 font-mono font-black text-sm mt-0.5">
                {isPaid ? '$0.00 (Paid)' : `-${formatCurrency(totalAmount)}`}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {isPaid ? 'Payment already captured' : 'Deducted from open receivable'}
              </div>
            </div>

            <div className="bg-white/80 p-2.5 rounded-xl border border-rose-200/50">
              <div className="text-slate-500 text-[11px] flex items-center gap-1">
                <PackageCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Restored Lots</span>
              </div>
              <div className="text-emerald-700 font-mono font-black text-sm mt-0.5">
                +{totalAllocatedWeight.toFixed(1)} kg
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Unreserved to cold vault
              </div>
            </div>
          </div>
        </div>

        {/* Order Items Summary */}
        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2">
          <div className="flex justify-between items-center text-slate-500 text-[11px]">
            <span>Order Date: {order.orderDate}</span>
            <span>Current Status: <strong className="text-slate-700">{order.status}</strong></span>
          </div>
          <div className="font-medium text-slate-800">
            {order.items?.map(i => `${i.speciesName} (${i.actualWeighedKg ?? i.requestedWeightKg}kg)`).join(', ') || 'No item breakdown'}
          </div>
          <div className="flex justify-between items-center pt-1 border-t border-slate-200/70 font-mono">
            <span className="text-slate-500">Order Invoice Value:</span>
            <span className="font-bold text-slate-900">{formatCurrency(totalAmount)}</span>
          </div>
        </div>

        {/* Form Controls */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-100 border border-rose-300 text-rose-800 rounded-xl font-medium">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Reason for Voiding / Cancellation <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              required
            >
              {VOID_REASONS.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Additional Details / Operator Note (Optional)
            </label>
            <textarea
              rows={2}
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="Provide context regarding customer request or inventory inspection..."
              className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Authorizing Manager / Supervisor <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={authorizerName}
              onChange={(e) => setAuthorizerName(e.target.value)}
              placeholder="e.g. Elena Rostova (Commercial Lead)"
              required
              className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer transition-colors"
            >
              Keep Order
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white rounded-xl font-bold cursor-pointer transition-colors shadow-xs flex items-center gap-1.5"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>{isSubmitting ? 'Voiding...' : 'Confirm Void Order'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
