import React, { useState } from 'react';
import { Trash2, AlertTriangle, X } from 'lucide-react';
import { ClientOrder } from '../../types';
import { formatCurrency } from '../../utils/formatters';

interface DeleteOrderModalProps {
  order: ClientOrder;
  onClose: () => void;
  onConfirmDelete: (orderId: string) => Promise<void> | void;
}

export const DeleteOrderModal: React.FC<DeleteOrderModalProps> = ({
  order,
  onClose,
  onConfirmDelete
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await onConfirmDelete(order.id);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete order.');
      setIsDeleting(false);
    }
  };

  const totalValue = order.adjustedTotalUSD || order.quotedTotalUSD;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div>
            <h3 className="text-base font-bold text-slate-900">
              Delete Order {order.id}?
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Are you sure you want to delete this order for <strong className="text-slate-800">{order.clientName}</strong>? This will remove all associated line items and invoices. This action cannot be undone.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
            <div className="flex justify-between text-slate-600">
              <span>Order Value:</span>
              <span className="font-mono font-bold text-slate-900">{formatCurrency(totalValue)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Status:</span>
              <span className="font-semibold text-slate-800">{order.status}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Payment Terms:</span>
              <span className="text-slate-700">{order.paymentStatus}</span>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isDeleting ? 'Deleting...' : 'Confirm Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
