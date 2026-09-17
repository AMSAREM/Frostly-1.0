import React, { useState } from 'react';
import { 
  X, 
  Sliders, 
  Scale, 
  AlertCircle, 
  Check, 
  Layers, 
  FileText 
} from 'lucide-react';
import { InventoryBatch } from '../../types';
import { formatWeight } from '../../utils/formatters';

interface StockAdjustmentModalProps {
  batch: InventoryBatch | null;
  onClose: () => void;
  onSave: (updatedBatch: InventoryBatch) => void;
  useImperial: boolean;
}

const ADJUSTMENT_REASONS = [
  'Processing Yield Loss / Trimming',
  'Allocated to Retail / Saku Cutting',
  'Certified Scale Calibration Correction',
  'Quality Degradation / Trimmed Spoilage',
  'Chef Quality Sample / Audit',
  'Physical Vault Inventory Count Correction'
];

interface StockAdjustmentModalContentProps {
  batch: InventoryBatch;
  onClose: () => void;
  onSave: (updatedBatch: InventoryBatch) => void;
  useImperial: boolean;
}

const StockAdjustmentModalContent: React.FC<StockAdjustmentModalContentProps> = ({
  batch,
  onClose,
  onSave,
  useImperial
}) => {
  const currentAvailable = batch.availableWeightKg;
  const [newAvailableKg, setNewAvailableKg] = useState<number>(currentAvailable);
  const [reason, setReason] = useState<string>(ADJUSTMENT_REASONS[0]);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const delta = newAvailableKg - currentAvailable;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newAvailableKg < 0) return;

    setIsSubmitting(true);
    const updatedNotes = notes.trim()
      ? `${batch.notes ? batch.notes + ' | ' : ''}Adjustment: ${delta >= 0 ? '+' : ''}${delta.toFixed(1)}kg (${reason}: ${notes.trim()})`
      : `${batch.notes ? batch.notes + ' | ' : ''}Adjustment: ${delta >= 0 ? '+' : ''}${delta.toFixed(1)}kg (${reason})`;

    const updatedBatch: InventoryBatch = {
      ...batch,
      availableWeightKg: Number(newAvailableKg.toFixed(2)),
      notes: updatedNotes
    };

    onSave(updatedBatch);
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 sm:p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-base text-white">
                Adjust Lot Stock Weight
              </h3>
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
          {/* Current Stock Banner */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-slate-500 text-[11px] block">Current Available Stock</span>
              <strong className="text-base font-bold text-slate-900 font-mono">
                {formatWeight(currentAvailable, useImperial)}
              </strong>
            </div>
            <div className="text-right">
              <span className="text-slate-500 text-[11px] block">Initial Intake</span>
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

            {/* Delta explanation */}
            <div className="mt-1.5 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Weight Variance:</span>
              <span className={`font-mono font-bold ${
                delta > 0 ? 'text-emerald-700' : delta < 0 ? 'text-rose-600' : 'text-slate-500'
              }`}>
                {delta > 0 ? `+${formatWeight(delta, useImperial)}` : delta < 0 ? `-${formatWeight(Math.abs(delta), useImperial)}` : 'No change'}
              </span>
            </div>
          </div>

          {/* Reason Select */}
          <div>
            <label className="block text-slate-700 font-bold mb-1.5">
              Reason for Adjustment
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              {ADJUSTMENT_REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-slate-700 font-bold mb-1.5">
              Audit Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Thawed 25kg loin for retail counter display..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-end gap-2">
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
              className="px-5 py-2 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-200 transition-all cursor-pointer"
            >
              Confirm Adjustment
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
