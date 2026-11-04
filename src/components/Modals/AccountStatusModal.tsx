import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Archive, 
  RotateCcw, 
  X, 
  AlertTriangle, 
  CheckCircle2, 
  AlertCircle,
  FileText
} from 'lucide-react';
import { CustomerStatus, SupplierStatus } from '../../types';

interface AccountStatusModalProps {
  isOpen: boolean;
  accountType: 'customer' | 'supplier';
  accountId: string;
  accountName: string;
  currentStatus: CustomerStatus | SupplierStatus | string;
  targetAction?: 'blacklist' | 'close' | 'reactivate' | 'manage';
  onClose: () => void;
  onConfirm: (newStatus: any, reason: string) => Promise<void> | void;
}

export const AccountStatusModal: React.FC<AccountStatusModalProps> = ({
  isOpen,
  accountType,
  accountId,
  accountName,
  currentStatus,
  targetAction = 'manage',
  onClose,
  onConfirm
}) => {
  const [selectedStatus, setSelectedStatus] = useState<string>('Active');
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (targetAction === 'blacklist') {
      setSelectedStatus('Blacklisted');
    } else if (targetAction === 'close') {
      setSelectedStatus('Closed');
    } else if (targetAction === 'reactivate') {
      setSelectedStatus('Active');
    } else {
      setSelectedStatus(currentStatus);
    }
    setReason('');
    setError(null);
  }, [isOpen, targetAction, currentStatus]);

  if (!isOpen) return null;

  const isCustomer = accountType === 'customer';

  const customerStatuses: { value: CustomerStatus; label: string; desc: string }[] = [
    { value: 'Active', label: 'Active', desc: 'Fully operational. Can place orders, receive invoices, and utilize credit.' },
    { value: 'Credit Hold', label: 'Credit Hold', desc: 'Blocks credit sales until overdue invoices are settled. Prepaid only.' },
    { value: 'Closed', label: 'Closed', desc: 'Account retired. Prevents new orders while preserving receivables history.' },
    { value: 'Blacklisted', label: 'Blacklisted', desc: 'Strict operational freeze due to default or fraud. Orders forbidden.' },
  ];

  const supplierStatuses: { value: SupplierStatus; label: string; desc: string }[] = [
    { value: 'Active', label: 'Active', desc: 'Fully operational harvester. Can supply catches and receive AP disbursements.' },
    { value: 'Preferred Partner', label: 'Preferred Partner', desc: 'Tier 1 priority vessel partner.' },
    { value: 'Under Audit', label: 'Under Audit', desc: 'Quality or HACCP compliance audit in progress.' },
    { value: 'Closed', label: 'Closed', desc: 'Ceased sourcing relationship. No new inward catch lots accepted.' },
    { value: 'Blacklisted', label: 'Blacklisted', desc: 'Strict block due to compliance failure or disputes. Catches blocked.' },
  ];

  const statuses = isCustomer ? customerStatuses : supplierStatuses;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((selectedStatus === 'Blacklisted' || selectedStatus === 'Closed') && !reason.trim()) {
      setError(`Please provide a reason for setting the account to ${selectedStatus}.`);
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await onConfirm(selectedStatus, reason.trim());
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const getHeaderDetails = () => {
    if (selectedStatus === 'Blacklisted') {
      return {
        bg: 'bg-gradient-to-r from-rose-900 to-rose-700',
        title: `Blacklist ${isCustomer ? 'Customer' : 'Supplier'} Account`,
        icon: <ShieldAlert className="w-5 h-5 text-white" />,
        warning: 'This action immediately blocks any new orders or purchasing transactions.'
      };
    }
    if (selectedStatus === 'Closed') {
      return {
        bg: 'bg-gradient-to-r from-slate-800 to-slate-900',
        title: `Close ${isCustomer ? 'Customer' : 'Supplier'} Account`,
        icon: <Archive className="w-5 h-5 text-white" />,
        warning: 'This account will be closed and disabled for new transactions.'
      };
    }
    if (selectedStatus === 'Active' && (currentStatus === 'Closed' || currentStatus === 'Blacklisted')) {
      return {
        bg: 'bg-gradient-to-r from-emerald-700 to-emerald-600',
        title: `Reactivate ${isCustomer ? 'Customer' : 'Supplier'} Account`,
        icon: <RotateCcw className="w-5 h-5 text-white" />,
        warning: 'Account will be restored to active status, re-enabling standard transactions.'
      };
    }
    return {
      bg: 'bg-gradient-to-r from-indigo-900 to-slate-900',
      title: `Update Account Status`,
      icon: <FileText className="w-5 h-5 text-white" />,
      warning: undefined
    };
  };

  const header = getHeaderDetails();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Header */}
        <div className={`p-6 text-white ${header.bg}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                {header.icon}
              </div>
              <div>
                <h3 className="font-heading font-extrabold text-lg text-white">
                  {header.title}
                </h3>
                <p className="text-xs text-white/80">
                  {accountName} ({accountId})
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {header.warning && (
            <div className={`p-3.5 rounded-2xl text-xs flex items-start gap-2.5 ${
              selectedStatus === 'Blacklisted' ? 'bg-rose-50 border border-rose-200 text-rose-800' :
              selectedStatus === 'Closed' ? 'bg-slate-100 border border-slate-200 text-slate-700' :
              'bg-emerald-50 border border-emerald-200 text-emerald-800'
            }`}>
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>{header.warning}</div>
            </div>
          )}

          {/* Status Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Select New Account Status
            </label>
            <div className="grid grid-cols-1 gap-2">
              {statuses.map((s) => {
                const isSelected = selectedStatus === s.value;
                const isDanger = s.value === 'Blacklisted';
                const isMuted = s.value === 'Closed';
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setSelectedStatus(s.value)}
                    className={`p-3 rounded-2xl text-left border transition-all cursor-pointer flex items-start justify-between ${
                      isSelected
                        ? isDanger
                          ? 'bg-rose-50 border-rose-500 ring-2 ring-rose-500/20'
                          : isMuted
                          ? 'bg-slate-100 border-slate-600 ring-2 ring-slate-400/20'
                          : 'bg-indigo-50 border-indigo-600 ring-2 ring-indigo-500/20'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${
                          s.value === 'Active' || s.value === 'Preferred Partner' ? 'bg-emerald-500' :
                          s.value === 'Blacklisted' ? 'bg-rose-600' :
                          s.value === 'Closed' ? 'bg-slate-500' : 'bg-amber-500'
                        }`} />
                        <span className={`text-xs font-bold ${
                          isSelected ? (isDanger ? 'text-rose-900' : isMuted ? 'text-slate-900' : 'text-indigo-950') : 'text-slate-800'
                        }`}>
                          {s.label}
                        </span>
                        {s.value === currentStatus && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 font-semibold">
                            Current
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 pl-4">
                        {s.desc}
                      </p>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${
                        isDanger ? 'text-rose-600' : isMuted ? 'text-slate-700' : 'text-indigo-600'
                      }`} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reason / Notes */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Reason / Audit Notes {(selectedStatus === 'Blacklisted' || selectedStatus === 'Closed') && <span className="text-rose-600">*</span>}
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                selectedStatus === 'Blacklisted' 
                  ? 'e.g., Unpaid Net-30 invoice 90+ days overdue, repeated delivery refusal...'
                  : selectedStatus === 'Closed'
                  ? 'e.g., Business retired, owner retirement, territory consolidated...'
                  : 'Optional note regarding status change...'
              }
              rows={3}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white resize-none"
            />
          </div>

          {/* Footer */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || selectedStatus === currentStatus}
              className={`px-4 py-2 text-xs font-bold text-white rounded-xl transition-colors cursor-pointer shadow-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${
                selectedStatus === 'Blacklisted'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : selectedStatus === 'Closed'
                  ? 'bg-slate-800 hover:bg-slate-900'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {isSubmitting ? 'Updating...' : `Confirm Set to ${selectedStatus}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
