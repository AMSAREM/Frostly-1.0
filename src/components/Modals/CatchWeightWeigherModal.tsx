import React, { useState } from 'react';
import { 
  X, 
  Scale, 
  CheckCircle, 
  ArrowRight, 
  RotateCcw, 
  AlertCircle, 
  Layers, 
  CheckCheck,
  TrendingUp
} from 'lucide-react';
import { ClientOrder, InventoryBatch } from '../../types';
import { formatCurrency, formatWeight, getYieldVariance } from '../../utils/formatters';
import confetti from 'canvas-confetti';

interface CatchWeightWeigherModalProps {
  order: ClientOrder | null;
  batches: InventoryBatch[];
  onClose: () => void;
  onSaveWeighedItems: (orderId: string, updatedItems: ClientOrder['items'], adjustedTotal: number) => void;
  useImperial: boolean;
}

export const CatchWeightWeigherModal: React.FC<CatchWeightWeigherModalProps> = ({
  order,
  batches,
  onClose,
  onSaveWeighedItems,
  useImperial
}) => {
  // Local state for line items being weighed
  const [items, setItems] = useState(() => 
    (order?.items || []).map(item => ({
      ...item,
      actualWeighedKg: item.actualWeighedKg ?? item.requestedWeightKg
    }))
  );

  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [tareWeightKg, setTareWeightKg] = useState(0.8); // standard insulated carton + gel pack tare
  const [grossScaleReadingKg, setGrossScaleReadingKg] = useState<number>(
    ((order?.items || [])[0]?.actualWeighedKg ?? (order?.items || [])[0]?.requestedWeightKg ?? 10) + 0.8
  );

  if (!order) return null;

  const currentItem = items[activeItemIndex];

  // Recalculate net weight
  const netWeightKg = Math.max(0.1, Number((grossScaleReadingKg - tareWeightKg).toFixed(2)));

  const handleUpdateCurrentItemWeight = (newNetKg: number) => {
    const updated = [...items];
    updated[activeItemIndex] = {
      ...updated[activeItemIndex],
      actualWeighedKg: Number(newNetKg.toFixed(2))
    };
    setItems(updated);
  };

  const handleTare = () => {
    // Zero out tare on current gross
    setTareWeightKg(grossScaleReadingKg);
  };

  const handleResetTare = () => {
    setTareWeightKg(0.8);
  };

  // Calculate adjusted total
  const adjustedTotal = items.reduce((sum, item) => {
    const weight = item.actualWeighedKg ?? item.requestedWeightKg;
    return sum + weight * item.pricePerKg;
  }, 0);

  const quotedTotal = order.quotedTotalUSD;
  const varianceUSD = adjustedTotal - quotedTotal;
  const variancePct = (varianceUSD / quotedTotal) * 100;

  const handleSaveAndConfirm = () => {
    onSaveWeighedItems(order.id, items, adjustedTotal);
    confetti({
      particleCount: 70,
      spread: 60,
      origin: { y: 0.6 }
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-7 relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-3 py-1 rounded-full bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5" />
              Dynamic Catch-Weight Terminal
            </span>
            <span className="text-xs text-slate-300 font-mono-code">{order.id}</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-heading font-extrabold text-white">
            Precision Scale & Catch-Weight Yield Calibration
          </h2>
          <p className="text-xs text-indigo-200 mt-1">
            Client: <strong>{order.clientName}</strong> ({order.destinationCity})
          </p>
        </div>

        {/* Modal Content */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Item Selector Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {items.map((item, idx) => {
              const isSelected = idx === activeItemIndex;
              const hasWeighed = item.actualWeighedKg !== null;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveItemIndex(idx);
                    setGrossScaleReadingKg(
                      (item.actualWeighedKg ?? item.requestedWeightKg) + tareWeightKg
                    );
                  }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200 font-bold'
                      : hasWeighed
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-100'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>Line #{idx + 1}: {item.speciesName}</span>
                  {hasWeighed && (
                    <span className="px-1.5 py-0.5 rounded-md bg-emerald-200/60 text-emerald-900 text-[10px]">
                      {formatWeight(item.actualWeighedKg!, useImperial)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Active Item Scale Station */}
          {currentItem && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center p-6 rounded-3xl bg-slate-900 text-white shadow-xl">
              {/* Digital Scale LED Readout */}
              <div className="md:col-span-6 flex flex-col items-center justify-center p-6 bg-slate-950 rounded-2xl border border-slate-800 relative">
                <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1 flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-indigo-400" />
                  Mettler-Toledo Certified Dock Scale #04
                </div>

                {/* Main Large Digital Weight Display */}
                <div className="font-mono-code text-5xl font-extrabold text-emerald-400 tracking-tight my-2">
                  {netWeightKg.toFixed(2)}
                  <span className="text-xl text-emerald-600 ml-2">kg</span>
                </div>

                <div className="text-xs text-slate-400 flex items-center gap-3">
                  <span>Gross: {grossScaleReadingKg.toFixed(2)} kg</span>
                  <span>•</span>
                  <span>Tare: -{tareWeightKg.toFixed(2)} kg (Box/Ice)</span>
                </div>

                {/* Interactive Scale Controls */}
                <div className="flex items-center gap-2 mt-4">
                  <button
                    onClick={() => {
                      const next = Math.max(0.1, grossScaleReadingKg - 0.25);
                      setGrossScaleReadingKg(Number(next.toFixed(2)));
                      handleUpdateCurrentItemWeight(Math.max(0.1, next - tareWeightKg));
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition-colors cursor-pointer"
                  >
                    -0.25 kg
                  </button>
                  <button
                    onClick={() => {
                      const next = grossScaleReadingKg + 0.25;
                      setGrossScaleReadingKg(Number(next.toFixed(2)));
                      handleUpdateCurrentItemWeight(next - tareWeightKg);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition-colors cursor-pointer"
                  >
                    +0.25 kg
                  </button>
                  <button
                    onClick={handleTare}
                    className="px-3 py-1.5 rounded-lg bg-indigo-900 hover:bg-indigo-800 text-xs font-bold text-indigo-200 transition-colors cursor-pointer"
                  >
                    Zero Tare
                  </button>
                  <button
                    onClick={handleResetTare}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs transition-colors cursor-pointer"
                    title="Reset Default Packaging Tare"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Line Item Yield Breakdown */}
              <div className="md:col-span-6 space-y-3.5 text-xs">
                <div>
                  <h4 className="font-heading font-bold text-sm text-white">
                    {currentItem.speciesName}
                  </h4>
                  <div className="text-slate-400 text-[11px]">
                    Grade: <strong>{currentItem.grade}</strong> • Lot: <span className="font-mono-code text-indigo-300">{currentItem.lotId}</span>
                  </div>
                </div>

                <div className="space-y-2 bg-white/5 p-3.5 rounded-2xl border border-white/10">
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Chef Quoted Weight:</span>
                    <span className="font-bold text-white font-mono-code">
                      {formatWeight(currentItem.requestedWeightKg, useImperial)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-300">
                    <span>Actual Dock Weighed:</span>
                    <span className="font-bold text-emerald-400 font-mono-code text-sm">
                      {formatWeight(netWeightKg, useImperial)}
                    </span>
                  </div>

                  {(() => {
                    const variance = getYieldVariance(currentItem.requestedWeightKg, netWeightKg);
                    return (
                      <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[11px]">
                        <span className="text-slate-400">Yield Differential:</span>
                        <span className={`font-bold ${variance.isOver ? 'text-amber-400' : 'text-indigo-300'}`}>
                          {variance.diffKg > 0 ? `+${variance.diffKg.toFixed(2)}` : variance.diffKg.toFixed(2)} kg ({variance.pct > 0 ? `+${variance.pct.toFixed(1)}` : variance.pct.toFixed(1)}%)
                        </span>
                      </div>
                    );
                  })()}

                  <div className="flex items-center justify-between pt-1 border-t border-white/10">
                    <span className="text-slate-300">Line Subtotal:</span>
                    <span className="font-extrabold text-white font-mono-code text-sm">
                      {formatCurrency(netWeightKg * currentItem.pricePerKg)}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span>Dynamic billing updates invoice in real time with zero margin leakage.</span>
                </div>
              </div>
            </div>
          )}

          {/* Cumulative Financial Variance Summary */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-xs">
              <div>
                <span className="text-slate-500 font-medium">Original Quoted Total:</span>
                <div className="font-bold text-slate-700 text-sm font-mono-code">
                  {formatCurrency(quotedTotal)}
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400" />
              <div>
                <span className="text-slate-500 font-medium">Recalibrated Catch-Weight Total:</span>
                <div className="font-extrabold text-indigo-700 text-base font-mono-code">
                  {formatCurrency(adjustedTotal)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 ${
                varianceUSD >= 0 ? 'bg-amber-100 text-amber-900' : 'bg-indigo-100 text-indigo-900'
              }`}>
                <TrendingUp className="w-3.5 h-3.5" />
                Variance: {varianceUSD >= 0 ? `+${formatCurrency(varianceUSD)}` : formatCurrency(varianceUSD)} ({variancePct.toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            id="btn-confirm-catchweight-fulfillment"
            onClick={handleSaveAndConfirm}
            className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-md shadow-emerald-200 transition-all cursor-pointer"
          >
            <CheckCheck className="w-4 h-4" />
            <span>Confirm Weighed Yield & Update Invoice</span>
          </button>
        </div>
      </div>
    </div>
  );
};
