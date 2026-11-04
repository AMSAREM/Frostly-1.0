import React, { useState } from 'react';
import { X, Plus, Trash2, Calculator, Check, AlertCircle, Sparkles } from 'lucide-react';
import { ClientOrder, OrderLineItem, InventoryBatch, AppSettings } from '../../types';
import { formatCurrency, formatWeight } from '../../utils/formatters';
import { evaluateMarginHealth, calculateDynamicWholesalePrice } from '../../utils/pricingEngine';

interface EditQuoteModalProps {
  order: ClientOrder;
  batches?: InventoryBatch[];
  settings?: AppSettings;
  onClose: () => void;
  onSaveQuote: (orderId: string, updatedItems: OrderLineItem[], newQuotedTotal: number) => Promise<void> | void;
  useImperial: boolean;
}

export const EditQuoteModal: React.FC<EditQuoteModalProps> = ({
  order,
  batches = [],
  settings,
  onClose,
  onSaveQuote,
  useImperial
}) => {
  const [items, setItems] = useState<OrderLineItem[]>(() => {
    return order.items && order.items.length > 0
      ? order.items.map(item => ({ ...item }))
      : [];
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dynamically calculate estimated quote total
  const liveTotal = items.reduce((sum, item) => {
    const qty = Number(item.requestedWeightKg) || 0;
    const rate = Number(item.pricePerKg) || 0;
    return sum + (qty * rate);
  }, 0);

  const totalWeightKg = items.reduce((sum, item) => sum + (Number(item.requestedWeightKg) || 0), 0);

  const handleWeightChange = (index: number, val: string) => {
    const num = parseFloat(val);
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      requestedWeightKg: isNaN(num) ? 0 : Math.max(0, num)
    };
    setItems(updated);
  };

  const bulkThresholdKg = settings?.bulkDiscountThresholdKg ?? 10;
  const bulkDiscountPct = settings?.bulkDiscountPct ?? 10;
  const isBulkDiscountEnabled = settings?.enableBulkDiscount ?? true;

  const handlePriceChange = (index: number, val: string) => {
    const num = parseFloat(val);
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      pricePerKg: isNaN(num) ? 0 : Math.max(0, num)
    };
    setItems(updated);
  };

  const applyBulkDiscountToItem = (index: number) => {
    const item = items[index];
    const batch = batches.find(b => b.id === item.lotId);
    const basePrice = batch ? batch.wholesalePricePerKg : item.pricePerKg;
    const discounted = parseFloat((basePrice * (1 - bulkDiscountPct / 100)).toFixed(2));
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      pricePerKg: discounted,
      notes: (updated[index].notes ? `${updated[index].notes} | ` : '') + `>${bulkThresholdKg}kg Bulk Rate (-${bulkDiscountPct}%)`
    };
    setItems(updated);
  };

  const handleBatchChange = (index: number, lotId: string) => {
    const batch = batches.find(b => b.id === lotId);
    if (!batch) return;
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      lotId: batch.id,
      speciesId: batch.speciesId,
      speciesName: batch.speciesName,
      grade: batch.grade,
      pricePerKg: batch.wholesalePricePerKg || updated[index].pricePerKg
    };
    setItems(updated);
  };

  const handleAddItem = () => {
    const defaultBatch = batches[0];
    const newItem: OrderLineItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      speciesId: defaultBatch?.speciesId || 'spec-landed',
      speciesName: defaultBatch?.speciesName || 'Seafood Lot',
      grade: defaultBatch?.grade || 'Grade #1',
      lotId: defaultBatch?.id || 'LOT-GENERAL',
      requestedWeightKg: 15,
      actualWeighedKg: null,
      pricePerKg: defaultBatch?.wholesalePricePerKg || 65,
      notes: ''
    };
    setItems([...items, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      setError('A quote must contain at least one line item.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onSaveQuote(order.id, items, liveTotal);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to update quote.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Edit Estimated Quote</span>
                <span className="font-mono text-indigo-400 text-xs px-2 py-0.5 rounded bg-white/10">
                  {order.id}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Client: <strong className="text-slate-200">{order.clientName}</strong>
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

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Quoted Items & Pricing Rates
            </span>
            <button
              type="button"
              onClick={handleAddItem}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Species Line</span>
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl bg-slate-50/50">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Species / Lot</th>
                  <th className="py-2.5 px-2 w-28">Weight ({useImperial ? 'lbs' : 'kg'})</th>
                  <th className="py-2.5 px-2 w-32">Rate ({formatCurrency(1).replace(/[\d.,]/g, '').trim()}/{useImperial ? 'lb' : 'kg'})</th>
                  <th className="py-2.5 px-3 text-right">Subtotal</th>
                  <th className="py-2.5 px-2 text-center w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {items.map((item, index) => {
                  const subtotal = (Number(item.requestedWeightKg) || 0) * (Number(item.pricePerKg) || 0);

                  return (
                    <tr key={item.id || index} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-3">
                        {batches.length > 0 ? (
                          <select
                            value={item.lotId}
                            onChange={(e) => handleBatchChange(index, e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            {batches.map(b => (
                              <option key={b.id} value={b.id}>
                                {b.speciesName} ({b.id})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="font-bold text-slate-900">{item.speciesName}</div>
                        )}
                      </td>

                      <td className="py-2.5 px-2">
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          value={item.requestedWeightKg}
                          onChange={(e) => handleWeightChange(index, e.target.value)}
                          className="w-full h-8 bg-slate-50 border border-slate-200 rounded-lg px-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-right"
                        />
                        {isBulkDiscountEnabled && item.requestedWeightKg >= bulkThresholdKg && (
                          <div className="mt-1 flex items-center justify-end gap-1">
                            <span className="px-1 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[9px] font-bold">
                              &gt;{bulkThresholdKg}kg Bulk
                            </span>
                          </div>
                        )}
                      </td>

                      <td className="py-2.5 px-2">
                        {(() => {
                          const batch = batches.find(b => b.id === item.lotId);
                          const batchCost = batch?.costPerKg ?? 0;
                          const targetMargin = settings?.targetMarginPct ?? 30;
                          const minFloor = settings?.minimumMarginFloorPct ?? 18;
                          const marginEval = evaluateMarginHealth(batchCost, item.pricePerKg, minFloor, targetMargin);

                          return (
                            <div>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.pricePerKg}
                                onChange={(e) => handlePriceChange(index, e.target.value)}
                                className={`w-full h-8 bg-slate-50 border rounded-lg px-2 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-right ${
                                  marginEval.isBelowFloor ? 'border-amber-400 text-amber-900 bg-amber-50/50' : 'border-slate-200 text-slate-800'
                                }`}
                              />
                              <div className="mt-1 flex flex-wrap items-center justify-end gap-1 text-[9px]">
                                {batchCost > 0 && (
                                  <span className={`px-1 py-0.2 rounded font-mono font-bold ${
                                    marginEval.status === 'healthy' 
                                      ? 'bg-emerald-100 text-emerald-800' 
                                      : 'bg-amber-100 text-amber-800'
                                  }`}>
                                    {marginEval.grossMarginPct}% Mgn
                                  </span>
                                )}
                                {marginEval.isBelowFloor && batchCost > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const suggested = calculateDynamicWholesalePrice(batchCost, targetMargin);
                                      handlePriceChange(index, String(suggested));
                                    }}
                                    className="text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer"
                                    title={`Reset to target ${targetMargin}% margin (${formatCurrency(marginEval.suggestedPrice)}/kg)`}
                                  >
                                    Recalibrate
                                  </button>
                                )}
                                {isBulkDiscountEnabled && item.requestedWeightKg >= bulkThresholdKg && (
                                  <button
                                    type="button"
                                    onClick={() => applyBulkDiscountToItem(index)}
                                    className="text-emerald-700 hover:text-emerald-900 font-bold underline cursor-pointer flex items-center gap-0.5"
                                    title="Calculate and apply bulk volume discount"
                                  >
                                    <Sparkles className="w-2.5 h-2.5" />
                                    -{bulkDiscountPct}%
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 text-xs">
                        {formatCurrency(subtotal)}
                      </td>

                      <td className="py-2.5 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Real-time Total Display Banner */}
          <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                <Calculator className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] text-indigo-700 font-bold uppercase tracking-wider">
                  Live Quoted Total Value
                </div>
                <div className="text-xs text-indigo-900">
                  Total Weight: <strong className="font-mono">{formatWeight(totalWeightKg, useImperial)}</strong> ({items.length} items)
                </div>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-indigo-600 font-semibold uppercase block">
                Total Value
              </span>
              <span className="text-2xl font-black font-mono text-indigo-950">
                {formatCurrency(liveTotal)}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Recalculating...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save Quoted Total ({formatCurrency(liveTotal)})</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
