import React, { useState } from 'react';
import { 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  Snowflake, 
  Layers, 
  Scale, 
  ShoppingBag, 
  ShieldCheck,
  ArrowRight
} from 'lucide-react';

interface InventoryExplainerBannerProps {
  onNavigateToRetail?: () => void;
}

export const InventoryExplainerBanner: React.FC<InventoryExplainerBannerProps> = ({
  onNavigateToRetail
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-gradient-to-r from-indigo-900/5 via-blue-900/5 to-slate-900/5 border border-indigo-100 rounded-3xl p-4 sm:p-5 transition-all">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-indigo-200">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-indigo-900 font-heading">
                New to Seafood Inventory?
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                Quick Guide
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Learn how bulk landed catch lots, cold-chain storage zones, and order allocation work together.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-slate-50 text-indigo-700 text-xs font-bold border border-indigo-200 transition-colors shadow-2xs shrink-0 cursor-pointer"
        >
          <span>{isExpanded ? 'Hide Guide' : 'Explain How It Works'}</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-indigo-100/80 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Card 1: What is a Lot? */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1.5">
            <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs">
              <Layers className="w-4 h-4" />
              <span>1. What is a "Lot"?</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              A <strong>Lot</strong> is a distinct batch of raw or loined seafood landed from a fishing vessel or supplier. Each lot retains its catch date, vessel registration, harvest coordinates, and lab safety assay.
            </p>
          </div>

          {/* Card 2: Cold-Chain Storage */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1.5">
            <div className="flex items-center gap-2 text-blue-600 font-bold text-xs">
              <Snowflake className="w-4 h-4" />
              <span>2. Cold Storage Zones</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Lots are segregated into 4 monitored environments: <strong>Super-Cryo (-60°C)</strong> for sashimi, <strong>Commercial (-22°C)</strong> for frozen boxes, <strong>Slush Ice (0–2°C)</strong> for fresh, and <strong>Live Tanks (+8°C)</strong> for shellfish.
            </p>
          </div>

          {/* Card 3: Available vs Allocated */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1.5">
            <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs">
              <Scale className="w-4 h-4" />
              <span>3. Available vs Reserved</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              <strong>Available Stock</strong> is on-hand and ready to sell. When wholesale orders are booked, weight is <strong>Allocated (Reserved)</strong> so lots never accidentally get double-sold.
            </p>
          </div>

          {/* Card 4: Catch Lots vs Retail SKUs */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-violet-600 font-bold text-xs">
                <ShoppingBag className="w-4 h-4" />
                <span>4. Catch vs. Retail SKUs</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed mt-1">
                This page shows <em>bulk whole fish / lots</em>. Processed consumer cuts (saku blocks, fillets, 500g retail trays) are managed under <strong>Retail & Wholesale</strong>.
              </p>
            </div>
            {onNavigateToRetail && (
              <button
                onClick={onNavigateToRetail}
                className="mt-2 flex items-center justify-between gap-1 w-full text-[11px] text-violet-700 font-bold hover:text-violet-900 bg-violet-50 hover:bg-violet-100 py-1 px-2.5 rounded-lg transition-colors cursor-pointer"
              >
                <span>View Packaged Retail Products</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
