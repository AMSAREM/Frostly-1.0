import React, { useState } from 'react';
import { 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  Snowflake, 
  Layers, 
  Scale, 
  ShoppingBag, 
  ArrowRight,
  Split,
  Store,
  Truck,
  Building2,
  CheckCircle2,
  GitFork,
  ArrowRightLeft
} from 'lucide-react';

interface InventoryExplainerBannerProps {
  onNavigateToRetail?: () => void;
}

type ExplainerTab = 'flow' | 'channels' | 'zones';

export const InventoryExplainerBanner: React.FC<InventoryExplainerBannerProps> = ({
  onNavigateToRetail
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<ExplainerTab>('flow');

  return (
    <div className="bg-gradient-to-r from-indigo-950/5 via-blue-900/5 to-slate-900/5 border border-indigo-100/90 rounded-3xl p-4 sm:p-6 transition-all shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-700 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-200">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-black text-indigo-950 tracking-tight">
                How Bulk Seafood Inventory Connects to Sales
              </h2>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 uppercase tracking-wider">
                Wholesale · Retail · Dual-Channel
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
              Understand how whole landed catch lots in cold storage turn into wholesale B2B contracts, counter POS retail packs, and dual-channel products.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          {onNavigateToRetail && (
            <button
              onClick={onNavigateToRetail}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200 transition-colors shadow-2xs cursor-pointer"
            >
              <span>Sales Catalog</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold border border-slate-200 transition-colors shadow-2xs cursor-pointer"
          >
            <span>{isExpanded ? 'Collapse' : 'Explain System'}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-5 pt-4 border-t border-indigo-100 space-y-4 animate-in fade-in duration-200">
          {/* Subtabs */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            <button
              onClick={() => setActiveTab('flow')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'flow'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
              }`}
            >
              <GitFork className="w-3.5 h-3.5" />
              <span>1. The End-to-End Inventory Flow</span>
            </button>
            <button
              onClick={() => setActiveTab('channels')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'channels'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
              }`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>2. Wholesale vs. Retail vs. Dual</span>
            </button>
            <button
              onClick={() => setActiveTab('zones')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'zones'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
              }`}
            >
              <Snowflake className="w-3.5 h-3.5" />
              <span>3. Cold-Chain Vault Zones</span>
            </button>
          </div>

          {/* TAB 1: FLOW DIAGRAM */}
          {activeTab === 'flow' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
              {/* Step 1 */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2 relative">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Step 1: Intake</span>
                  <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center">1</span>
                </div>
                <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs">
                  <Layers className="w-4 h-4" />
                  <span>Vessel Landing (Raw Lot)</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Fish arrive in bulk from vessels or aquaculture pens. They are logged as an <strong>Inventory Batch Lot</strong> with vessel ID, harvest GPS, and FDA HACCP assay.
                </p>
                <div className="pt-2 text-[10px] text-indigo-600 font-semibold bg-indigo-50/50 p-2 rounded-xl">
                  Example: 1,200 kg Pacific Bluefin Tuna landed at Port of San Francisco.
                </div>
              </div>

              {/* Step 2 */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2 relative">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Step 2: Vault Storage</span>
                  <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center">2</span>
                </div>
                <div className="flex items-center gap-2 text-blue-700 font-bold text-xs">
                  <Snowflake className="w-4 h-4" />
                  <span>Storage & Safe Temp</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Lots are placed in regulated storage: <strong>-60°C Super-Cryo</strong> for sashimi, <strong>-22°C Commercial</strong> for frozen blocks, or <strong>0°C Slush</strong> for fresh.
                </p>
                <div className="pt-2 text-[10px] text-blue-600 font-semibold bg-blue-50/50 p-2 rounded-xl">
                  Tuna core temperature maintained at -59.4°C to preserve sashimi grade.
                </div>
              </div>

              {/* Step 3 */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2 relative">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Step 3: Channel Allocation</span>
                  <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center">3</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs">
                  <Split className="w-4 h-4" />
                  <span>Cut & Allocation</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  The lot is split into <strong>Wholesale</strong> (whole loins), <strong>Retail</strong> (consumer trays), or <strong>Dual</strong> (available for both). Available vs Reserved weight updates live.
                </p>
                <div className="pt-2 text-[10px] text-emerald-600 font-semibold bg-emerald-50/50 p-2 rounded-xl">
                  800 kg allocated to restaurants; 400 kg cut into 250g retail vacuum packs.
                </div>
              </div>

              {/* Step 4 */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2 relative flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Step 4: Depletion</span>
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center">4</span>
                  </div>
                  <div className="flex items-center gap-2 text-violet-700 font-bold text-xs mt-2">
                    <ShoppingBag className="w-4 h-4" />
                    <span>Fulfilled & Deducted</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed mt-1">
                    When wholesale orders ship or POS counter sales complete, lot stock automatically deducts. Real-time gross margin and COGS are recorded.
                  </p>
                </div>
                {onNavigateToRetail && (
                  <button
                    onClick={onNavigateToRetail}
                    className="mt-3 w-full py-1.5 px-3 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-800 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>View In Retail & Wholesale</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: WHOLESALE VS RETAIL VS DUAL */}
          {activeTab === 'channels' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {/* Channel: Wholesale */}
              <div className="bg-white p-4 rounded-2xl border border-blue-200 shadow-2xs space-y-2.5">
                <div className="flex items-center gap-2 text-blue-700 font-bold text-xs">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                    <Truck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">Wholesale Channel (B2B)</h3>
                    <span className="text-[10px] text-blue-600 font-semibold">Bulk by Weight (kg/lb)</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  For restaurants, sushi bars, hotels, and seafood markets. Buyers purchase <strong>whole loins, H&G round fish, or 10kg+ cases</strong> with minimum order quantities (MOQ).
                </p>
                <div className="space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-[11px]">
                  <div className="flex justify-between text-slate-700">
                    <span className="text-slate-500">Inventory Link:</span>
                    <span className="font-semibold">Depletes bulk lot kg directly</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span className="text-slate-500">Pricing Model:</span>
                    <span className="font-semibold">Wholesale $/kg with volume discounts</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span className="text-slate-500">Workflow:</span>
                    <span className="font-semibold">Order placed &rarr; Allocated &rarr; Weighed & Invoiced</span>
                  </div>
                </div>
              </div>

              {/* Channel: Retail */}
              <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-2xs space-y-2.5">
                <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Store className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">Retail Channel (B2C POS)</h3>
                    <span className="text-[10px] text-emerald-600 font-semibold">Packaged Portions & Trays</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  For walk-in counter customers and retail shoppers. Bulk fish from cold storage is trimmed and packaged into <strong>250g sashimi blocks, 500g trays, or single fillets</strong>.
                </p>
                <div className="space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-[11px]">
                  <div className="flex justify-between text-slate-700">
                    <span className="text-slate-500">Inventory Link:</span>
                    <span className="font-semibold">Converted into catalog SKUs / packs</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span className="text-slate-500">Pricing Model:</span>
                    <span className="font-semibold">Retail $/unit with counter sales tax</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span className="text-slate-500">Workflow:</span>
                    <span className="font-semibold">Scan barcode / select item &rarr; POS register receipt</span>
                  </div>
                </div>
              </div>

              {/* Channel: Dual-Channel */}
              <div className="bg-white p-4 rounded-2xl border border-violet-200 shadow-2xs space-y-2.5">
                <div className="flex items-center gap-2 text-violet-700 font-bold text-xs">
                  <div className="w-7 h-7 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center">
                    <ArrowRightLeft className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">Dual-Channel Products</h3>
                    <span className="text-[10px] text-violet-600 font-semibold">Sold to Both B2B & B2C</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  High-velocity cuts (e.g. Atlantic Salmon loins, King Crab legs) available in <strong>both channels simultaneously</strong> from the same shared raw lot inventory.
                </p>
                <div className="space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-[11px]">
                  <div className="flex justify-between text-slate-700">
                    <span className="text-slate-500">Shared Pool:</span>
                    <span className="font-semibold">Either channel depletes available lot</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span className="text-slate-500">Price Book:</span>
                    <span className="font-semibold">Dual matrix ($35/kg wholesale vs $48/kg retail)</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span className="text-slate-500">Advantage:</span>
                    <span className="font-semibold">Zero waste; maximizes shelf-life turnover</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: STORAGE ZONES */}
          {activeTab === 'zones' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="bg-white p-3.5 rounded-2xl border border-sky-100 shadow-2xs space-y-1.5">
                <div className="flex items-center gap-2 text-sky-700 font-bold text-xs">
                  <Snowflake className="w-4 h-4" />
                  <span>Super-Cryo (-60°C)</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Deep freezing that stops cellular breakdown and oxidation. Mandatory for raw consumption (sashimi AAA bluefin and yellowfin tuna).
                </p>
              </div>

              <div className="bg-white p-3.5 rounded-2xl border border-blue-100 shadow-2xs space-y-1.5">
                <div className="flex items-center gap-2 text-blue-700 font-bold text-xs">
                  <Snowflake className="w-4 h-4" />
                  <span>Commercial Cold (-22°C)</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Standard blast freezer vault for long-term frozen cartons, king crab clusters, and wholesale frozen loins (12–24 months shelf life).
                </p>
              </div>

              <div className="bg-white p-3.5 rounded-2xl border border-cyan-100 shadow-2xs space-y-1.5">
                <div className="flex items-center gap-2 text-cyan-700 font-bold text-xs">
                  <Scale className="w-4 h-4" />
                  <span>Slush Ice Vault (0–2°C)</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Wet chilling on food-grade shaved ice for fresh daily catch (halibut, fresh salmon, cod). Strict 5–7 day turnaround window.
                </p>
              </div>

              <div className="bg-white p-3.5 rounded-2xl border border-emerald-100 shadow-2xs space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Live Shellfish (+8°C)</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Recirculating chilled seawater tanks with continuous oxygenation for live Maine lobsters and live Dungeness crab.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
