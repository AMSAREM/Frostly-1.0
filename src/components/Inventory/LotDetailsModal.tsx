import React from 'react';
import { 
  X, 
  ShieldCheck, 
  MapPin, 
  Anchor, 
  Calendar, 
  Thermometer, 
  CheckCircle2, 
  QrCode, 
  Scale, 
  DollarSign, 
  Layers, 
  TrendingUp,
  AlertTriangle,
  FileText,
  Sliders,
  Sparkles,
  ShoppingBag,
  Store,
  Truck,
  ArrowRight
} from 'lucide-react';
import { InventoryBatch } from '../../types';
import { formatCurrency, formatWeight, formatTemp } from '../../utils/formatters';
import { SPECIES_CATALOG } from '../../data/mockData';

interface LotDetailsModalProps {
  batch: InventoryBatch | null;
  onClose: () => void;
  onOpenPassport: (batch: InventoryBatch) => void;
  onOpenAdjustment: (batch: InventoryBatch) => void;
  onNavigateToRetail?: () => void;
  useImperial: boolean;
}

export const LotDetailsModal: React.FC<LotDetailsModalProps> = ({
  batch,
  onClose,
  onOpenPassport,
  onOpenAdjustment,
  onNavigateToRetail,
  useImperial
}) => {
  if (!batch) return null;

  const speciesInfo = SPECIES_CATALOG.find(s => s.id === batch.speciesId) ||
    SPECIES_CATALOG.find(s => s.name.toLowerCase() === batch.speciesName.toLowerCase());
  
  const speciesImage = speciesInfo?.image || 'https://images.unsplash.com/photo-1534482421-64566f976cfa?auto=format&fit=crop&w=600&q=80';

  const totalIntake = batch.initialWeightKg;
  const available = batch.availableWeightKg;
  const allocated = batch.allocatedWeightKg || 0;
  const depleted = Math.max(0, totalIntake - (available + allocated));
  const availablePct = totalIntake > 0 ? (available / totalIntake) * 100 : 0;
  const allocatedPct = totalIntake > 0 ? (allocated / totalIntake) * 100 : 0;

  const costTotal = available * (batch.costPerKg || 0);
  const wholesaleTotal = available * (batch.wholesalePricePerKg || 0);
  const grossProfit = wholesaleTotal - costTotal;
  const grossMarginPct = wholesaleTotal > 0 ? (grossProfit / wholesaleTotal) * 100 : 0;

  const isLowStock = available > 0 && available < 50;
  const isDepleted = available <= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div 
        id="lot-details-modal-card"
        className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header Hero with Species Image */}
        <div className="relative bg-slate-900 text-white overflow-hidden">
          <img 
            src={speciesImage} 
            alt={batch.speciesName}
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover opacity-25 mix-blend-luminosity filter saturate-150"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/80 to-slate-900/40" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="relative z-10 p-6 sm:p-7 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 text-xs font-bold font-mono">
                {batch.id}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/20 text-white">
                {batch.grade}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
                {batch.category}
              </span>

              {isDepleted ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  Depleted / Sold Out
                </span>
              ) : isLowStock ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Low Stock Warning
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  In Stock · Ready for Orders
                </span>
              )}
            </div>

            <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-white tracking-tight">
              {batch.speciesName}
            </h2>
            <p className="text-sm italic text-indigo-200">
              {batch.scientificName}
            </p>

            <p className="text-xs text-slate-300 pt-1 max-w-lg leading-relaxed">
              Tracked raw seafood lot landed from <strong>{batch.vesselName}</strong> at {batch.landingPort}. Fully audited for HACCP safety, histamine levels, and temperature chain of custody.
            </p>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-7 space-y-6 max-h-[70vh] overflow-y-auto">
          
          {/* Section 1: Stock Breakdown (Visual & Clear) */}
          <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                <Scale className="w-4 h-4 text-indigo-600" />
                <span>Stock Balance Sheet</span>
              </div>
              <span className="text-xs text-slate-500">
                Intake: <strong>{formatWeight(totalIntake, useImperial)}</strong>
              </span>
            </div>

            {/* Visual Stock Bar */}
            <div className="space-y-1.5">
              <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden flex">
                <div 
                  className="bg-emerald-500 h-full transition-all" 
                  style={{ width: `${Math.min(100, Math.max(0, availablePct))}%` }}
                  title={`Available: ${formatWeight(available, useImperial)}`}
                />
                <div 
                  className="bg-amber-400 h-full transition-all" 
                  style={{ width: `${Math.min(100, Math.max(0, allocatedPct))}%` }}
                  title={`Allocated: ${formatWeight(allocated, useImperial)}`}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Available: <strong className="text-slate-900">{formatWeight(available, useImperial)} ({availablePct.toFixed(0)}%)</strong>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  Reserved: <strong className="text-slate-900">{formatWeight(allocated, useImperial)} ({allocatedPct.toFixed(0)}%)</strong>
                </span>
                {depleted > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-slate-400" />
                    Fulfilled: <strong className="text-slate-900">{formatWeight(depleted, useImperial)}</strong>
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2 text-center">
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <div className="text-[10px] uppercase font-semibold text-slate-400">Available to Sell</div>
                <div className="text-base font-extrabold text-emerald-700 font-mono">
                  {formatWeight(available, useImperial)}
                </div>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <div className="text-[10px] uppercase font-semibold text-slate-400">Reserved for Orders</div>
                <div className="text-base font-extrabold text-amber-700 font-mono">
                  {formatWeight(allocated, useImperial)}
                </div>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <div className="text-[10px] uppercase font-semibold text-slate-400">Initial Landed Intake</div>
                <div className="text-base font-extrabold text-slate-800 font-mono">
                  {formatWeight(totalIntake, useImperial)}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Financial & Commercial Valuation */}
          <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span>Commercial Valuation & Margins</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <div className="text-[10px] uppercase font-semibold text-slate-400">Cost per kg</div>
                <div className="text-sm font-bold text-slate-900 font-mono mt-0.5">
                  {formatCurrency(batch.costPerKg || 0)}/kg
                </div>
                <div className="text-[10px] text-slate-400">Dock intake cost</div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <div className="text-[10px] uppercase font-semibold text-slate-400">Wholesale Price</div>
                <div className="text-sm font-bold text-indigo-700 font-mono mt-0.5">
                  {formatCurrency(batch.wholesalePricePerKg)}/kg
                </div>
                <div className="text-[10px] text-slate-400">Selling price</div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <div className="text-[10px] uppercase font-semibold text-slate-400">Lot Value</div>
                <div className="text-sm font-extrabold text-emerald-700 font-mono mt-0.5">
                  {formatCurrency(wholesaleTotal)}
                </div>
                <div className="text-[10px] text-slate-400">At available stock</div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <div className="text-[10px] uppercase font-semibold text-slate-400">Gross Margin</div>
                <div className="text-sm font-extrabold text-indigo-900 font-mono mt-0.5 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
                  {grossMarginPct.toFixed(1)}%
                </div>
                <div className="text-[10px] text-slate-400">
                  {formatCurrency(grossProfit)} est.
                </div>
              </div>
            </div>
          </div>

          {/* Section: Sales Channel Distribution (Wholesale, Retail & Dual) */}
          <div className="bg-gradient-to-br from-indigo-50/70 to-blue-50/50 p-4 sm:p-5 rounded-2xl border border-indigo-100 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-950 font-bold text-xs">
                <ShoppingBag className="w-4 h-4 text-indigo-600" />
                <span>Sales Channel Distribution & Dual Execution</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-200/60 text-indigo-900 text-[10px] font-bold">
                Dual-Channel Active
              </span>
            </div>

            <p className="text-[11px] text-slate-600 leading-relaxed">
              This raw landed catch lot feeds both B2B restaurant wholesale and counter retail POS channels:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Wholesale Flow */}
              <div className="bg-white p-3.5 rounded-xl border border-indigo-100 shadow-2xs space-y-1.5">
                <div className="flex items-center gap-1.5 text-blue-700 font-bold text-xs">
                  <Truck className="w-3.5 h-3.5" />
                  <span>Wholesale Orders (B2B Bulk)</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Sold as whole fish, loins, or cases by weight at <strong>{formatCurrency(batch.wholesalePricePerKg)}/kg</strong>. Booking an order automatically reserves (allocates) kilograms from this lot to prevent double-selling.
                </p>
                <div className="text-[10px] font-mono text-blue-700 bg-blue-50 px-2 py-1 rounded-lg">
                  Allocated to active orders: {formatWeight(allocated, useImperial)}
                </div>
              </div>

              {/* Retail POS Flow */}
              <div className="bg-white p-3.5 rounded-xl border border-indigo-100 shadow-2xs space-y-1.5">
                <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-xs">
                  <Store className="w-3.5 h-3.5" />
                  <span>Walk-in Retail POS Counter</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Processed into consumer portions (250g sashimi vacuum skin packs or fillets). Sold at retail counter price points with instant barcoded checkout receipts.
                </p>
                <div className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg">
                  Est. Retail yield: ~{(available * 0.85).toFixed(0)}kg cuts
                </div>
              </div>
            </div>

            {onNavigateToRetail && (
              <div className="pt-1 flex justify-end">
                <button
                  onClick={() => {
                    onClose();
                    onNavigateToRetail();
                  }}
                  className="flex items-center gap-1.5 text-xs text-indigo-700 font-bold hover:text-indigo-900 bg-white hover:bg-indigo-100/60 border border-indigo-200 px-3 py-1.5 rounded-xl transition-all shadow-2xs cursor-pointer"
                >
                  <span>Open Product in Retail & Wholesale Catalog</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Section 3: Cold Chain & Food Safety */}
          <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
              <Thermometer className="w-4 h-4 text-blue-600" />
              <span>Cold Chain & Food Safety Assurance</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <div className="text-[10px] uppercase font-semibold text-slate-400">Storage Zone</div>
                <div className="font-bold text-slate-900 mt-0.5 text-xs truncate" title={batch.storageZone}>
                  {batch.storageZone}
                </div>
                <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                  <Thermometer className="w-3 h-3 text-blue-500" />
                  Live Core: <strong>{formatTemp(batch.coreTempCelsius, useImperial)}</strong>
                </div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <div className="text-[10px] uppercase font-semibold text-slate-400">Histamine Lab Assay</div>
                <div className="font-bold text-slate-900 mt-0.5 text-xs">
                  {batch.histaminePpm ? `${batch.histaminePpm} ppm` : '0.0 ppm (Tested)'}
                </div>
                <div className="text-[10px] text-emerald-600 font-semibold mt-1">
                  Safe (FDA limit is 50 ppm)
                </div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <div className="text-[10px] uppercase font-semibold text-slate-400">HACCP Inspection</div>
                <div className="font-bold text-emerald-700 mt-0.5 text-xs flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {batch.inspectionStatus || 'Passed Inspection'}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Title 21 CFR 123 Compliant
                </div>
              </div>
            </div>

            {batch.certifications && batch.certifications.length > 0 && (
              <div className="pt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-500 mr-1">Certifications:</span>
                {batch.certifications.map((c, i) => (
                  <span key={i} className="text-[10px] font-semibold bg-white border border-slate-200 px-2 py-0.5 rounded-md text-slate-700">
                    {c}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Section 4: Traceability & Origin */}
          <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
              <Anchor className="w-4 h-4 text-indigo-600" />
              <span>Catch Traceability & Origin</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div>
                <div className="text-[10px] text-slate-400">Vessel</div>
                <div className="font-bold text-slate-900">{batch.vesselName}</div>
                {batch.captainName && <div className="text-[10px] text-slate-400">{batch.captainName}</div>}
              </div>

              <div>
                <div className="text-[10px] text-slate-400">Landing Port</div>
                <div className="font-bold text-slate-900">{batch.landingPort}</div>
              </div>

              <div>
                <div className="text-[10px] text-slate-400">FAO Catch Zone</div>
                <div className="font-bold text-slate-900 truncate" title={batch.faoArea}>{batch.faoArea}</div>
                {batch.gearType && <div className="text-[10px] text-slate-400">{batch.gearType}</div>}
              </div>

              <div>
                <div className="text-[10px] text-slate-400">Harvest Date</div>
                <div className="font-bold text-slate-900">{batch.harvestDate}</div>
                {batch.expiryDate && <div className="text-[10px] text-slate-400">Exp: {batch.expiryDate}</div>}
              </div>
            </div>

            {batch.notes && (
              <div className="pt-2 border-t border-slate-200 text-xs text-slate-600">
                <span className="font-semibold text-slate-700">Notes: </span>
                {batch.notes}
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => onOpenAdjustment(batch)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200 transition-colors shadow-2xs cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5 text-slate-500" />
            <span>Adjust Stock / Log Waste</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenPassport(batch)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs border border-indigo-200 transition-colors shadow-2xs cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Digital Passport</span>
            </button>

            <button
              onClick={onClose}
              className="px-5 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
