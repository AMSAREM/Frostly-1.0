import React, { useState, useMemo } from 'react';
import { 
  X, 
  Sliders, 
  Scale, 
  AlertCircle, 
  Check, 
  Layers, 
  FileText,
  DollarSign,
  Database,
  Building2,
  TrendingDown,
  TrendingUp,
  ShieldCheck
} from 'lucide-react';
import { InventoryBatch, InventoryAdjustmentAccount } from '../../types';
import { formatWeight, formatCurrency as defaultFormatCurrency } from '../../utils/formatters';
import { isSupabaseConfigured } from '../../utils/supabase';

export interface StockAdjustmentData {
  deltaWeightKg: number;
  previousWeightKg: number;
  newWeightKg: number;
  unitCostUSD: number;
  valuationVarianceUSD: number;
  reason: string;
  adjustmentAccountId?: string;
  adjustmentAccountCode: string;
  adjustmentAccountName: string;
  notes: string;
  autoPostLedger: boolean;
}

interface StockAdjustmentModalProps {
  batch: InventoryBatch | null;
  onClose: () => void;
  onSave: (updatedBatch: InventoryBatch, adjustmentData?: StockAdjustmentData) => void;
  useImperial: boolean;
  adjustmentAccounts?: InventoryAdjustmentAccount[];
  defaultAccountCode?: string;
  formatCurrency?: (val: number) => string;
}

const ADJUSTMENT_REASONS = [
  { label: 'Processing Yield Loss / Trimming', defaultCode: '5155' },
  { label: 'Allocated to Retail / Saku Cutting', defaultCode: '1420' },
  { label: 'Certified Scale Calibration Correction', defaultCode: '5160' },
  { label: 'Quality Degradation / Trimmed Spoilage', defaultCode: '5150' },
  { label: 'Chef Quality Sample / Audit', defaultCode: '5150' },
  { label: 'Physical Vault Inventory Count Correction', defaultCode: '5160' },
  { label: 'Physical Audit Surplus / Weight Recovery', defaultCode: '4190' },
];

const DEFAULT_FALLBACK_ACCOUNTS: InventoryAdjustmentAccount[] = [
  {
    id: 'adj-acc-shrinkage-5150',
    accountCode: '5150',
    accountName: 'Inventory Shrinkage & Spoilage',
    accountType: 'COGS',
    description: 'Unavoidable drip loss, physical shrinkage, freezer burn, or spoilage write-down.',
    isDefault: true,
    isActive: true,
    balanceUSD: 0
  },
  {
    id: 'adj-acc-yield-5155',
    accountCode: '5155',
    accountName: 'Processing Yield & Trimming Loss',
    accountType: 'COGS',
    description: 'Biomass reduction from head removal, gutting, loin deboning, and sashimi trimming.',
    isDefault: false,
    isActive: true,
    balanceUSD: 0
  },
  {
    id: 'adj-acc-scale-5160',
    accountCode: '5160',
    accountName: 'Scale Calibration & Count Variance',
    accountType: 'COGS',
    description: 'Adjustments following periodic certified physical floor counts and crane scale recalibration.',
    isDefault: false,
    isActive: true,
    balanceUSD: 0
  },
  {
    id: 'adj-acc-retail-1420',
    accountCode: '1420',
    accountName: 'Retail Counter Stock Reallocation',
    accountType: 'Contra-Asset',
    description: 'Bulk cold-storage inventory allocated and transferred directly to retail fresh counter display.',
    isDefault: false,
    isActive: true,
    balanceUSD: 0
  },
  {
    id: 'adj-acc-surplus-4190',
    accountCode: '4190',
    accountName: 'Inventory Count Recovery Surplus',
    accountType: 'Income',
    description: 'Positive stock adjustments from physical audit surplus or weight recovery.',
    isDefault: false,
    isActive: true,
    balanceUSD: 0
  }
];

interface StockAdjustmentModalContentProps {
  batch: InventoryBatch;
  onClose: () => void;
  onSave: (updatedBatch: InventoryBatch, adjustmentData?: StockAdjustmentData) => void;
  useImperial: boolean;
  adjustmentAccounts?: InventoryAdjustmentAccount[];
  defaultAccountCode?: string;
  formatCurrency?: (val: number) => string;
}

const StockAdjustmentModalContent: React.FC<StockAdjustmentModalContentProps> = ({
  batch,
  onClose,
  onSave,
  useImperial,
  adjustmentAccounts = [],
  defaultAccountCode = '5150',
  formatCurrency = defaultFormatCurrency
}) => {
  const currentAvailable = batch.availableWeightKg;
  const [newAvailableKg, setNewAvailableKg] = useState<number>(currentAvailable);
  const [reason, setReason] = useState<string>(ADJUSTMENT_REASONS[0].label);
  const [notes, setNotes] = useState<string>('');
  const [autoPostLedger, setAutoPostLedger] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Available accounts (from Supabase or default fallback)
  const allAccounts = useMemo(() => {
    if (adjustmentAccounts && adjustmentAccounts.length > 0) {
      return adjustmentAccounts.filter(a => a.isActive !== false);
    }
    return DEFAULT_FALLBACK_ACCOUNTS;
  }, [adjustmentAccounts]);

  // Selected account state
  const [selectedAccountCode, setSelectedAccountCode] = useState<string>(() => {
    return defaultAccountCode || allAccounts[0]?.accountCode || '5150';
  });

  const activeAccount = useMemo(() => {
    return allAccounts.find(a => a.accountCode === selectedAccountCode) || allAccounts[0];
  }, [allAccounts, selectedAccountCode]);

  const delta = newAvailableKg - currentAvailable;
  const unitCostUSD = batch.costPerKg || 0;
  const valuationVarianceUSD = delta * unitCostUSD;

  // Smart adjustment account suggestion when reason changes
  const handleReasonChange = (newReason: string) => {
    setReason(newReason);
    const match = ADJUSTMENT_REASONS.find(r => r.label === newReason);
    if (match) {
      const targetAcc = allAccounts.find(a => a.accountCode === match.defaultCode);
      if (targetAcc) {
        setSelectedAccountCode(targetAcc.accountCode);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newAvailableKg < 0) return;

    setIsSubmitting(true);
    const updatedNotes = notes.trim()
      ? `${batch.notes ? batch.notes + ' | ' : ''}Adjustment: ${delta >= 0 ? '+' : ''}${delta.toFixed(1)}kg (${reason}: ${notes.trim()}) [Acc ${activeAccount?.accountCode || selectedAccountCode}]`
      : `${batch.notes ? batch.notes + ' | ' : ''}Adjustment: ${delta >= 0 ? '+' : ''}${delta.toFixed(1)}kg (${reason}) [Acc ${activeAccount?.accountCode || selectedAccountCode}]`;

    const updatedBatch: InventoryBatch = {
      ...batch,
      availableWeightKg: Number(newAvailableKg.toFixed(2)),
      notes: updatedNotes
    };

    const adjustmentData: StockAdjustmentData = {
      deltaWeightKg: Number(delta.toFixed(2)),
      previousWeightKg: Number(currentAvailable.toFixed(2)),
      newWeightKg: Number(newAvailableKg.toFixed(2)),
      unitCostUSD: unitCostUSD,
      valuationVarianceUSD: Number(valuationVarianceUSD.toFixed(2)),
      reason: reason,
      adjustmentAccountId: activeAccount?.id,
      adjustmentAccountCode: activeAccount?.accountCode || selectedAccountCode,
      adjustmentAccountName: activeAccount?.accountName || 'Inventory Adjustment',
      notes: notes.trim(),
      autoPostLedger: autoPostLedger
    };

    onSave(updatedBatch, adjustmentData);
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 sm:p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-inner">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-heading font-bold text-base text-white">
                  Inventory Stock Adjustment
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <Database className="w-2.5 h-2.5" />
                  Supabase DB
                </span>
              </div>
              <p className="text-xs text-indigo-200 font-mono">
                {batch.id} • {batch.speciesName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 text-xs">
          {/* Current Stock & Unit Cost Banner */}
          <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
            <div>
              <span className="text-slate-500 text-[10px] block uppercase font-bold tracking-wider">Current Stock</span>
              <strong className="text-sm sm:text-base font-bold text-slate-900 font-mono">
                {formatWeight(currentAvailable, useImperial)}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] block uppercase font-bold tracking-wider">Unit Cost Basis</span>
              <span className="text-xs font-semibold text-slate-700 font-mono">
                {formatCurrency(unitCostUSD)}/{useImperial ? 'lb' : 'kg'}
              </span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 text-[10px] block uppercase font-bold tracking-wider">Initial Intake</span>
              <span className="text-xs font-semibold text-slate-700 font-mono">
                {formatWeight(batch.initialWeightKg, useImperial)}
              </span>
            </div>
          </div>

          {/* New Available Weight Input */}
          <div>
            <label className="block text-slate-700 font-bold mb-1.5">
              New Available Weight ({useImperial ? 'lbs' : 'kg'})
            </label>
            <div className="relative">
              <Scale className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="number"
                step="0.1"
                min="0"
                value={useImperial ? Number((newAvailableKg * 2.20462).toFixed(1)) : newAvailableKg}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setNewAvailableKg(useImperial ? val / 2.20462 : val);
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                required
              />
            </div>

            {/* Live Variance Calculation & Financial Impact */}
            <div className="mt-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">Weight Variance:</span>
                <span className={`font-mono font-bold ${
                  delta > 0 ? 'text-emerald-700' : delta < 0 ? 'text-rose-600' : 'text-slate-500'
                }`}>
                  {delta > 0 ? `+${formatWeight(delta, useImperial)}` : delta < 0 ? `-${formatWeight(Math.abs(delta), useImperial)}` : '0 kg'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">Valuation Variance:</span>
                <span className={`font-mono font-bold inline-flex items-center gap-0.5 ${
                  valuationVarianceUSD > 0 
                    ? 'text-emerald-700' 
                    : valuationVarianceUSD < 0 
                    ? 'text-rose-600' 
                    : 'text-slate-500'
                }`}>
                  {valuationVarianceUSD < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : valuationVarianceUSD > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : null}
                  {valuationVarianceUSD > 0 
                    ? `+${formatCurrency(valuationVarianceUSD)}` 
                    : valuationVarianceUSD < 0 
                    ? `-${formatCurrency(Math.abs(valuationVarianceUSD))}` 
                    : formatCurrency(0)}
                </span>
              </div>
            </div>
          </div>

          {/* Reason Select */}
          <div>
            <label className="block text-slate-700 font-bold mb-1.5">
              Reason for Adjustment
            </label>
            <select
              value={reason}
              onChange={(e) => handleReasonChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
            >
              {ADJUSTMENT_REASONS.map((r) => (
                <option key={r.label} value={r.label}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* Adjustment Account Selector (Linked to Supabase) */}
          <div className="border border-indigo-100 bg-indigo-50/50 p-3.5 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-indigo-950 font-bold flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                Linked Adjustment Account
              </label>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                activeAccount?.accountType === 'Income'
                  ? 'bg-emerald-100 text-emerald-800'
                  : activeAccount?.accountType === 'Contra-Asset'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-rose-100 text-rose-800'
              }`}>
                {activeAccount?.accountType || 'COGS'} Account
              </span>
            </div>

            <select
              value={selectedAccountCode}
              onChange={(e) => setSelectedAccountCode(e.target.value)}
              className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              {allAccounts.map((acc) => (
                <option key={acc.id || acc.accountCode} value={acc.accountCode}>
                  [{acc.accountCode}] {acc.accountName} ({acc.accountType})
                </option>
              ))}
            </select>

            {activeAccount?.description && (
              <p className="text-[11px] text-indigo-900/80 italic leading-relaxed">
                {activeAccount.description}
              </p>
            )}

            {/* Auto Post to Ledger Toggle */}
            <label className="flex items-center gap-2 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={autoPostLedger}
                onChange={(e) => setAutoPostLedger(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
              />
              <span className="text-slate-700 text-[11px] font-medium">
                Automatically post valuation variance ({formatCurrency(Math.abs(valuationVarianceUSD))}) to General Financial Ledger in Supabase
              </span>
            </label>
          </div>

          {/* Audit Notes */}
          <div>
            <label className="block text-slate-700 font-bold mb-1.5">
              Audit Notes & HACCP Compliance Ref
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Saku loin trimming loss recorded during certified processing shift..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {/* Supabase Connection Status Bar */}
          <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 pt-1">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Immutable Audit Trail</span>
            </span>
            <span className="font-mono text-[10px] text-slate-400">
              Table: inventory_adjustments
            </span>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-200 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              Confirm & Post to Database
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = (props) => {
  if (!props.batch) {
    return null;
  }
  return <StockAdjustmentModalContent {...props} batch={props.batch} key={props.batch.id} />;
};
