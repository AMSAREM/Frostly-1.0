import React, { useState } from 'react';
import { 
  AlertTriangle, 
  Trash2, 
  X, 
  DollarSign, 
  Package, 
  ShieldAlert, 
  Archive,
  ArrowRight,
  Ship
} from 'lucide-react';
import { Supplier, PurchaseOrderLanding } from '../../types';

interface DeleteSupplierModalProps {
  supplier: Supplier | null;
  purchaseOrders: PurchaseOrderLanding[];
  isOpen: boolean;
  onClose: () => void;
  onConfirmDelete: (supplierId: string) => Promise<void> | void;
  onCloseAccount?: (supplier: Supplier) => void;
  formatCurrency: (amount: number) => string;
}

export const DeleteSupplierModal: React.FC<DeleteSupplierModalProps> = ({
  supplier,
  purchaseOrders,
  isOpen,
  onClose,
  onConfirmDelete,
  onCloseAccount,
  formatCurrency
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  if (!isOpen || !supplier) return null;

  // Determine blockers
  const hasOutstandingPayable = (supplier.outstandingPayableUSD || 0) > 0.01;
  const activePOs = purchaseOrders.filter(
    (po) => po.supplierId === supplier.id && po.paymentStatus !== 'Settled'
  );
  const hasActivePOs = activePOs.length > 0;
  const isBlocked = hasOutstandingPayable || hasActivePOs;

  const handleDelete = async () => {
    if (isBlocked) return;
    setIsDeleting(true);
    try {
      await onConfirmDelete(supplier.id);
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCloseAccount = () => {
    if (onCloseAccount) {
      onCloseAccount(supplier);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Header */}
        <div className={`p-6 text-white ${isBlocked ? 'bg-gradient-to-r from-amber-600 to-amber-700' : 'bg-gradient-to-r from-rose-600 to-rose-700'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                {isBlocked ? <ShieldAlert className="w-5 h-5 text-white" /> : <Trash2 className="w-5 h-5 text-white" />}
              </div>
              <div>
                <h3 className="font-heading font-extrabold text-lg text-white">
                  {isBlocked ? 'Deletion Blocked: Outstanding Payables' : 'Delete Harvester / Supplier'}
                </h3>
                <p className="text-xs text-white/80">
                  {supplier.name} ({supplier.id})
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isDeleting}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Blocked State Alert */}
          {isBlocked ? (
            <div className="space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs">
                    <p className="font-bold text-sm text-amber-950">
                      Cannot delete supplier with open payables or active catch records
                    </p>
                    <p className="text-amber-800 leading-relaxed">
                      To preserve financial compliance, accounts payable reconciliation, and vessel harvest traceability, supplier records cannot be deleted while unsettled bills or landed catches exist.
                    </p>
                  </div>
                </div>
              </div>

              {/* Specific Blockers List */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Unsettled Requirements
                </div>
                
                {hasOutstandingPayable && (
                  <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-rose-200 text-xs">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-rose-600" />
                      <div>
                        <div className="font-bold text-slate-900">Outstanding AP Payable</div>
                        <div className="text-[11px] text-slate-500">Requires payment voucher settlement</div>
                      </div>
                    </div>
                    <div className="font-mono-code font-bold text-rose-600">
                      {formatCurrency(supplier.outstandingPayableUSD)}
                    </div>
                  </div>
                )}

                {hasActivePOs && (
                  <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-amber-200 text-xs">
                    <div className="flex items-center gap-2">
                      <Ship className="w-4 h-4 text-amber-600" />
                      <div>
                        <div className="font-bold text-slate-900">{activePOs.length} Inward Catch Records / POs</div>
                        <div className="text-[11px] text-slate-500">
                          {activePOs.map((po) => po.id).slice(0, 3).join(', ')}
                          {activePOs.length > 3 ? ` +${activePOs.length - 3} more` : ''}
                        </div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                      Unsettled POs
                    </span>
                  </div>
                )}
              </div>

              {/* Recommendation to Close Account instead */}
              <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center justify-between gap-4">
                <div className="text-xs text-indigo-900 space-y-0.5">
                  <div className="font-bold flex items-center gap-1.5">
                    <Archive className="w-4 h-4 text-indigo-600" />
                    Recommended Alternative: Close Account
                  </div>
                  <p className="text-[11px] text-indigo-700">
                    Closing the supplier halts new inward catches while preserving AP vouchers, disbursement records, and batch harvest traceability.
                  </p>
                </div>
                {onCloseAccount && (
                  <button
                    type="button"
                    onClick={handleCloseAccount}
                    className="shrink-0 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                  >
                    Close Account
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Clear State: Allow Deletion */
            <div className="space-y-4">
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 text-xs space-y-2">
                <p className="font-bold text-rose-950 text-sm flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  Warning: This action is permanent and cannot be undone
                </p>
                <p className="text-rose-800 leading-relaxed">
                  You are about to permanently delete harvester supplier <strong className="font-semibold text-rose-950">{supplier.name}</strong> ({supplier.id}). This supplier profile will be removed from your directory.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs space-y-2">
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">Supplier ID</span>
                  <span className="font-mono-code font-bold text-slate-800">{supplier.id}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">Port Location</span>
                  <span className="font-bold text-slate-800">{supplier.portLocation || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">Outstanding Payable</span>
                  <span className="font-bold text-emerald-600">$0.00 (Settled)</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Lifetime Purchased</span>
                  <span className="font-bold text-slate-800">{formatCurrency(supplier.totalPurchasedUSD)}</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                  Type <span className="font-mono-code text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">DELETE</span> to confirm:
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono-code focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              {isBlocked ? 'Dismiss' : 'Cancel'}
            </button>
            {!isBlocked && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting || confirmText.trim().toUpperCase() !== 'DELETE'}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
              >
                {isDeleting ? (
                  <>Deleting...</>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    Permanently Delete
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
