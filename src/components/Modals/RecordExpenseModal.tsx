import React, { useState } from 'react';
import { 
  Receipt, 
  X, 
  DollarSign, 
  Calendar, 
  Tag, 
  Building2, 
  CreditCard, 
  FileText,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { FinancialEntryCategory, FinancialLedgerEntry } from '../../types';
import { formatCurrency } from '../../utils/formatters';

interface RecordExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddExpense: (expense: Omit<FinancialLedgerEntry, 'id'>) => void;
  currency?: string;
}

const EXPENSE_CATEGORIES: { label: string; value: FinancialEntryCategory; desc: string }[] = [
  { label: 'Logistics & Reefer Freight', value: 'Logistics & Reefer Freight', desc: 'Reefer truck transport, fuel & line hauls' },
  { label: 'Cold Storage Utilities & Cryo-Gas', value: 'Cold Storage Utilities', desc: 'Electricity, liquid nitrogen & facility cooling' },
  { label: 'Packaging, Dry Ice & Cartons', value: 'Packaging & Ice', desc: 'Wax boxes, insulated gel packs & styrofoam' },
  { label: 'Labor & Cutting Crew Wages', value: 'Labor & Cutting Crew', desc: 'Filleting team, dockworkers & handlers' },
  { label: 'Dock Fees & Port Taxes', value: 'Dock Fees & Port Taxes', desc: 'Harbor master dues, berth access & inspection' },
  { label: 'Inventory Adjustment (COGS)', value: 'COGS (Catch Intake)', desc: 'Direct landed seafood intake cost' }
];

const QUICK_AMOUNTS = [100, 250, 500, 1000, 2500, 5000];

export const RecordExpenseModal: React.FC<RecordExpenseModalProps> = ({
  isOpen,
  onClose,
  onAddExpense,
  currency = 'GHS'
}) => {
  const [category, setCategory] = useState<FinancialEntryCategory>('Logistics & Reefer Freight');
  const [description, setDescription] = useState('');
  const [vendor, setVendor] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<'Bank Transfer' | 'Cash on Dock' | 'Company Card' | 'Cheque' | 'Mobile Money'>('Bank Transfer');
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleQuickAddAmount = (val: number) => {
    const current = parseFloat(amount) || 0;
    setAmount((current + val).toString());
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please specify a valid expense amount greater than zero.');
      return;
    }

    if (!description.trim()) {
      setError('Please provide a brief description or memo for this expense.');
      return;
    }

    onAddExpense({
      date: date || new Date().toISOString().split('T')[0],
      type: 'OpEx',
      category,
      description: description.trim(),
      amount: parsedAmount,
      entityName: vendor.trim() || 'Operational Vendor',
      paymentMethod,
      orderId: reference.trim() || undefined
    });

    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-white max-w-lg w-full rounded-3xl p-5 sm:p-7 shadow-2xl border border-slate-200 space-y-5 max-h-[92vh] overflow-y-auto my-auto animate-in fade-in zoom-in-95 duration-150 box-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">Record Operating Expense</h3>
              <p className="text-xs text-slate-500">Log facility, logistics, packaging or labor disbursement</p>
            </div>
          </div>
          <button
            type="button"
            id="modal-close-record-expense"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Category Select */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-slate-400" />
              <span>Expense Category</span>
            </label>
            <select
              id="expense-category-select"
              value={category}
              onChange={(e) => setCategory(e.target.value as FinancialEntryCategory)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all cursor-pointer"
            >
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label} ({cat.desc})
                </option>
              ))}
            </select>
          </div>

          {/* Amount Input with Currency and Quick Fill Chips */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                <span>Expense Amount ({currency})</span>
              </span>
              {amount && !isNaN(parseFloat(amount)) && (
                <span className="text-[11px] font-mono font-bold text-rose-600">
                  {formatCurrency(parseFloat(amount), currency)}
                </span>
              )}
            </label>
            <div className="relative">
              <input
                id="expense-amount-input"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError(null);
                }}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-base font-black font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all"
                required
                autoFocus
              />
            </div>

            {/* Quick Amount Chips */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider shrink-0 mr-1">
                Quick Add:
              </span>
              {QUICK_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => handleQuickAddAmount(amt)}
                  className="px-2.5 py-1 text-[11px] font-mono font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80 transition-colors cursor-pointer"
                >
                  +{amt}
                </button>
              ))}
              {amount && (
                <button
                  type="button"
                  onClick={() => setAmount('')}
                  className="px-2 py-1 text-[10px] font-bold rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Description / Memo */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>Description / Memo</span>
            </label>
            <input
              id="expense-description-input"
              type="text"
              placeholder="e.g. Dry ice bulk refill for Reefer Truck 02"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setError(null);
              }}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all"
              required
            />
          </div>

          {/* Vendor & Date Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Vendor / Payee</span>
              </label>
              <input
                id="expense-vendor-input"
                type="text"
                placeholder="e.g. Pacific Cryo Logistics Inc"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Expense Date</span>
              </label>
              <input
                id="expense-date-input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all"
                required
              />
            </div>
          </div>

          {/* Payment Method & Receipt Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                <span>Payment Method</span>
              </label>
              <select
                id="expense-payment-method-select"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all cursor-pointer"
              >
                <option value="Bank Transfer">Bank Wire / Transfer</option>
                <option value="Cash on Dock">Cash on Dock / Drawer</option>
                <option value="Company Card">Company Debit/Credit Card</option>
                <option value="Mobile Money">Mobile Money (MoMo)</option>
                <option value="Cheque">Bank Cheque / Draft</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-slate-400" />
                <span>Receipt / Voucher # (Optional)</span>
              </label>
              <input
                id="expense-reference-input"
                type="text"
                placeholder="e.g. VOUCH-2026-904"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all font-mono"
              />
            </div>
          </div>

          {/* Footer Action Buttons */}
          <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="expense-submit-btn"
              className="flex-1 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Record Expense</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
