import React, { useState } from 'react';
import { 
  ShieldCheck, 
  ThermometerSnowflake, 
  Scale, 
  Receipt, 
  FileSpreadsheet, 
  Clock, 
  CheckCircle2, 
  ArrowUpRight, 
  Layers, 
  RotateCcw, 
  TrendingUp, 
  FileText,
  Boxes,
  Zap,
  Building2,
  Ship
} from 'lucide-react';

interface LandingBentoGridProps {
  onExploreDemo: () => void;
  onGetStarted: () => void;
}

export const LandingBentoGrid: React.FC<LandingBentoGridProps> = ({
  onExploreDemo,
  onGetStarted
}) => {
  const [activeFdaTab, setActiveFdaTab] = useState<'kdes' | 'ctes' | 'spreadsheet'>('spreadsheet');

  return (
    <section id="bento-features" className="py-20 bg-slate-50 border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mb-14 text-left">
          <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-blue-700 mb-3">
            <span>Enterprise Architecture</span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span>Cold-Chain Capabilities</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight [text-wrap:balance]">
            Built Specifically for Seafood Processors, Cold Storage & High-Volume Fisheries
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed [text-wrap:balance]">
            Traditional ERPs fail at catch-weight variances, sub-zero sensor streams, and FDA food traceability requirements. Frostly was engineered from the dock up for commercial maritime cold-chains.
          </p>
        </div>

        {/* Asymmetric Bento Grid (4 Marquee Cards) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* ========================================================================= */}
          {/* CELL 1 (Col-span-2): FSMA 204 Regulatory Compliance Engine                */}
          {/* ========================================================================= */}
          <div className="lg:col-span-2 bg-white rounded-xl p-7 lg:p-8 border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5 text-blue-700">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-100">
                    <ShieldCheck className="w-5 h-5 text-blue-700" />
                  </div>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">FSMA Section 204</span>
                    <h3 className="text-xl font-bold text-slate-900">Food Traceability Final Rule Engine</h3>
                  </div>
                </div>
                <span className="text-xs font-mono font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                  24-Hour Mandate Ready
                </span>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed mb-6">
                Generate FDA-compliant Electronic Sortable Spreadsheets containing all required Key Data Elements (KDEs) across every Critical Tracking Event (CTE) within 24 hours of an official inquiry.
              </p>

              {/* Interactive KDE / Spreadsheet Tab Switcher */}
              <div className="bg-slate-50 rounded-lg p-1 border border-slate-200 flex items-center gap-1 mb-4 text-xs">
                <button
                  onClick={() => setActiveFdaTab('spreadsheet')}
                  className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                    activeFdaTab === 'spreadsheet' 
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Electronic Sortable Spreadsheet Preview
                </button>
                <button
                  onClick={() => setActiveFdaTab('kdes')}
                  className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                    activeFdaTab === 'kdes' 
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Mandatory Key Data Elements (KDEs)
                </button>
                <button
                  onClick={() => setActiveFdaTab('ctes')}
                  className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                    activeFdaTab === 'ctes' 
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Critical Tracking Events (CTEs)
                </button>
              </div>

              {/* Data Table Preview based on tab */}
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                {activeFdaTab === 'spreadsheet' && (
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100/80 text-slate-700 font-semibold border-b border-slate-200 font-mono">
                      <tr>
                        <th className="py-2.5 px-3">TLC Lot Code</th>
                        <th className="py-2.5 px-3">Commodity / Species</th>
                        <th className="py-2.5 px-3">Harvest Lat/Long</th>
                        <th className="py-2.5 px-3">Cooling Temp</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono tabular-nums text-slate-600">
                      <tr>
                        <td className="py-2 px-3 font-bold text-slate-900">TLC-2026-0914-AK</td>
                        <td className="py-2 px-3 font-sans">Pacific Cod (Gadus macrocephalus)</td>
                        <td className="py-2 px-3">54°18'N 165°51'W</td>
                        <td className="py-2 px-3 text-cyan-700 font-bold">-18.4°C</td>
                        <td className="py-2 px-3 text-emerald-600 font-sans font-medium">Verified Valid</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-bold text-slate-900">TLC-2026-0552-WA</td>
                        <td className="py-2 px-3 font-sans">Coho Salmon (Oncorhynchus kisutch)</td>
                        <td className="py-2 px-3">47°36'N 124°20'W</td>
                        <td className="py-2 px-3 text-cyan-700 font-bold">-21.2°C</td>
                        <td className="py-2 px-3 text-emerald-600 font-sans font-medium">Verified Valid</td>
                      </tr>
                    </tbody>
                  </table>
                )}

                {activeFdaTab === 'kdes' && (
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-2.5 bg-slate-50 rounded border border-slate-200/60">
                      <div className="font-bold text-slate-900">Traceability Lot Code (TLC) Generator</div>
                      <div className="text-slate-500 mt-1">GS1-compliant cryptographically signed lot identifiers assigned at first dock landing.</div>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded border border-slate-200/60">
                      <div className="font-bold text-slate-900">Traceability Lot Code Source (TLC Source)</div>
                      <div className="text-slate-500 mt-1">FDA Food Facility Registration Number (FFRN) & vessel maritime registration log.</div>
                    </div>
                  </div>
                )}

                {activeFdaTab === 'ctes' && (
                  <div className="p-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-700">
                      <span className="font-semibold">Harvesting & Cooling:</span>
                      <span className="font-mono text-slate-500">Date, time, vessel, chilling logs</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-700">
                      <span className="font-semibold">Initial Packing:</span>
                      <span className="font-mono text-slate-500">TLC assigned, tare calibration, net weight</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-700">
                      <span className="font-semibold">Shipping & Receiving:</span>
                      <span className="font-mono text-slate-500">Bill of lading, recipient FFRN, temperature upon arrival</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">Automates §118.300 - §118.400 documentation requirements</span>
              <button
                onClick={onExploreDemo}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-800 transition-colors cursor-pointer"
              >
                <span>Test Compliance Module</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* CELL 2 (Col-span-1): Continuous IoT Cold-Chain & Sub-Zero Telemetry       */}
          {/* ========================================================================= */}
          <div className="bg-white rounded-xl p-7 border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 rounded-lg bg-cyan-50 flex items-center justify-center border border-cyan-100 text-cyan-700 mb-4">
                <ThermometerSnowflake className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Hazard Prevention</span>
              <h3 className="text-xl font-bold text-slate-900 mt-1">IoT Cold-Chain Telemetry</h3>
              <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                Connect dockside wireless probe loggers, blast freezer monitors (-35°C), and refrigerated truck sensors with automated CCP excursion alarms.
              </p>

              <div className="mt-6 space-y-2.5">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-slate-900">Blast Freezer Vault 1</div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">Continuous Core Chilling</div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-cyan-700 text-sm tabular-nums">-34.8°C</span>
                    <div className="text-[10px] text-emerald-600 font-semibold">Active Pull</div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-slate-900">Master Holding Bay A</div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">Frozen Pallet Racks</div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-slate-900 text-sm tabular-nums">-19.2°C</span>
                    <div className="text-[10px] text-emerald-600 font-semibold">Stable</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Automated CCP Excursion Alerts via SMS/WhatsApp</span>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* CELL 3 (Col-span-1): Dockside Scales & HOG-to-Fillet Yield Margins       */}
          {/* ========================================================================= */}
          <div className="bg-white rounded-xl p-7 border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center border border-amber-100 text-amber-700 mb-4">
                <Scale className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Processing Margins</span>
              <h3 className="text-xl font-bold text-slate-900 mt-1">Catch Weighing & Yields</h3>
              <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                Direct integration with electronic bench and pallet scales. Automatic tare calibration for wet totes and precise HOG-to-fillet recovery tracking.
              </p>

              <div className="mt-6 p-3.5 bg-slate-50 rounded-lg border border-slate-200/80 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Input (Head-on/Gutted):</span>
                  <span className="font-mono font-bold text-slate-900">1,250.0 kg</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Output (Skinless Fillets):</span>
                  <span className="font-mono font-bold text-slate-900">712.5 kg</span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between font-semibold text-slate-900">
                  <span>Recovery Yield:</span>
                  <span className="font-mono font-bold text-emerald-600">57.0% (Optimal)</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>Real-time COGS allocation per processed lot</span>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* CELL 4 (Col-span-2): Dual Accounts Payable & Receivable Ledgers           */}
          {/* ========================================================================= */}
          <div className="lg:col-span-2 bg-white rounded-xl p-7 lg:p-8 border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5 text-indigo-700">
                  <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center border border-indigo-100">
                    <Receipt className="w-5 h-5 text-indigo-700" />
                  </div>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Financial Integrity</span>
                    <h3 className="text-xl font-bold text-slate-900">Integrated Customer & Supplier Ledgers</h3>
                  </div>
                </div>
                <span className="text-xs font-mono font-medium text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded border border-indigo-200">
                  Audit-Proof Balance
                </span>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed mb-6">
                Never lose track of vessel catch payments or wholesale customer credit limits. Every catch landing generates a supplier bill, and every disbursement logs a traceable remittance advice voucher.
              </p>

              {/* Dual Ledger Mini Comparison */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200/80">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 mb-2">
                    <Ship className="w-4 h-4 text-blue-600" />
                    <span>Supplier AP Ledger</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Tracks vessel landings, deductions for fuel/ice, recorded payouts, and printable disbursement remittance vouchers with check numbers.
                  </p>
                  <div className="mt-3 flex items-center gap-1.5 text-[11px] font-mono text-emerald-700">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Instant Reversal with Audit Trail</span>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200/80">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 mb-2">
                    <Building2 className="w-4 h-4 text-indigo-600" />
                    <span>Customer AR Ledger</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Tracks wholesale order invoices, payments collected, credit notes, running balances, and official formal customer account statements.
                  </p>
                  <div className="mt-3 flex items-center gap-1.5 text-[11px] font-mono text-indigo-700">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Automated Receipt & Credit Management</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">Eliminates payment disputes between vessel captains & wholesale buyers</span>
              <a
                href="#ledgers-showcase"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 hover:text-indigo-800 transition-colors cursor-pointer"
              >
                <span>View Live Interactive Ledgers</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
