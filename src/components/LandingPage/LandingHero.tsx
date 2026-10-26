import React, { useState } from 'react';
import { 
  ChevronRight, 
  CheckCircle2, 
  ThermometerSnowflake, 
  FileText, 
  Ship, 
  Scale, 
  ShieldCheck, 
  ArrowRight,
  Download,
  AlertTriangle,
  Clock,
  Layers,
  MapPin,
  Check
} from 'lucide-react';

interface LandingHeroProps {
  onSignIn: () => void;
  onGetStarted: () => void;
  onExploreDemo: () => void;
  onOpenFeedback?: () => void;
  onInstallApp?: () => void;
  isInstalled?: boolean;
}

interface DemoLot {
  id: string;
  species: string;
  vessel: string;
  dockTime: string;
  weightKg: number;
  grade: string;
  temperature: number;
  targetTemp: string;
  currentCte: string;
  cteStage: number;
  tlc: string; // Traceability Lot Code
  status: 'Compliant' | 'Warning' | 'Optimal';
  storageZone: string;
}

const DEMO_LOTS: DemoLot[] = [
  {
    id: 'LOT-2026-COD-914',
    species: 'Alaskan Pacific Cod',
    vessel: 'F/V Bering Horizon • Lic #AK-4029',
    dockTime: 'Today 06:40 AM',
    weightKg: 4280.5,
    grade: 'Grade A (H&G Whole)',
    temperature: -18.4,
    targetTemp: '-18°C to -24°C',
    currentCte: 'Master Bay Cold Storage',
    cteStage: 4,
    tlc: 'TLC-2026-0914-AK-BH',
    status: 'Optimal',
    storageZone: 'Zone B-02 (Sub-Zero Cold Bay)'
  },
  {
    id: 'LOT-2026-SALMON-552',
    species: 'Wild Pacific Coho Salmon',
    vessel: 'F/V Northern Crest • Lic #WA-8120',
    dockTime: 'Today 08:15 AM',
    weightKg: 2940.0,
    grade: 'Premium Fillet Grade',
    temperature: -21.2,
    targetTemp: '-18°C to -24°C',
    currentCte: 'Blast Chilling & Glazing',
    cteStage: 3,
    tlc: 'TLC-2026-0552-WA-NC',
    status: 'Optimal',
    storageZone: 'Blast Tunnel #3 (-35°C)'
  },
  {
    id: 'LOT-2026-TUNA-118',
    species: 'Yellowfin Tuna (Bigeye)',
    vessel: 'F/V Pacific Pioneer • Lic #CA-1904',
    dockTime: 'Yesterday 17:30 PM',
    weightKg: 6150.2,
    grade: 'Sashimi #1 High Fat',
    temperature: -28.6,
    targetTemp: '< -25°C Ultra-Low',
    currentCte: 'Wholesale Order Allocation',
    cteStage: 5,
    tlc: 'TLC-2026-0118-CA-PP',
    status: 'Optimal',
    storageZone: 'Super-Freezer Vault #1'
  }
];

export const LandingHero: React.FC<LandingHeroProps> = ({
  onSignIn,
  onGetStarted,
  onExploreDemo,
  onInstallApp,
  isInstalled = false
}) => {
  const [selectedLotIndex, setSelectedLotIndex] = useState(0);
  const [simulatedAlertActive, setSimulatedAlertActive] = useState(false);
  const [showFdaExportToast, setShowFdaExportToast] = useState(false);

  const activeLot = DEMO_LOTS[selectedLotIndex];

  const handleSimulateFdaExport = () => {
    setShowFdaExportToast(true);
    setTimeout(() => setShowFdaExportToast(false), 4000);
  };

  const scrollToAudit = () => {
    const el = document.getElementById('lead-audit-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    } else {
      onGetStarted();
    }
  };

  return (
    <section className="relative overflow-hidden bg-white pt-10 pb-16 lg:pt-16 lg:pb-24 border-b border-slate-200">
      
      {/* Subtle structural ambient grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#f1f5f9_1px,transparent_1px),linear-gradient(to_bottom,#f1f5f9_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* ========================================================================= */}
        {/* 1. HERO VALUE PROPOSITION & ACTION CONTROLS                              */}
        {/* ========================================================================= */}
        <div className="max-w-4xl mx-auto text-center">
          
          {/* Unboxed Metadata Kicker (Zero-pill discipline) */}
          <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-slate-500 mb-4">
            <span className="text-blue-700">Enterprise Cold-Chain</span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span>FSMA 204 Regulatory Ready</span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span>Sub-Zero IoT Telemetry</span>
          </div>

          {/* Marquee Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 tracking-tight leading-[1.08] [text-wrap:balance]">
            The Operating System for Seafood Cold-Chain & Traceability
          </h1>

          {/* Value Narrative */}
          <p className="mt-6 text-base sm:text-lg lg:text-xl text-slate-600 font-normal leading-relaxed max-w-3xl mx-auto [text-wrap:balance]">
            Unify dockside catch-weight weighing, automated FDA FSMA 204 Critical Tracking Events, real-time sub-zero temperature logs, and integrated customer and supplier payment ledgers in one audit-ready platform.
          </p>

          {/* Primary Action Buttons */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            <button
              onClick={onExploreDemo}
              id="hero-explore-demo-btn"
              className="bg-slate-900 hover:bg-slate-800 text-white font-medium text-base px-7 py-3.5 rounded-md shadow-sm transition-all active:scale-[0.98] cursor-pointer flex items-center gap-2"
            >
              <span>Sign In to Workspace</span>
              <ArrowRight className="w-4 h-4 text-slate-300" />
            </button>

            <button
              onClick={scrollToAudit}
              id="hero-book-audit-btn"
              className="border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-900 font-medium text-base px-6 py-3.5 rounded-md transition-all active:scale-[0.98] cursor-pointer"
            >
              Schedule Facility Audit
            </button>

            {!isInstalled && onInstallApp && (
              <button
                onClick={onInstallApp}
                id="hero-install-pwa-btn"
                className="hidden sm:inline-flex items-center gap-2 border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium text-base px-5 py-3.5 rounded-md transition-all cursor-pointer"
                title="Install Frostly on Desktop or Mobile Terminal"
              >
                <Download className="w-4 h-4 text-slate-500" />
                <span>Install PWA</span>
              </button>
            )}
          </div>

          {/* Key Quantitative Proof Metrics */}
          <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto pt-6 border-t border-slate-200/80 text-left">
            <div className="bg-slate-50/70 p-3.5 rounded-lg border border-slate-200/60">
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">&lt; 24h</div>
              <div className="text-xs text-slate-500 font-medium mt-0.5">FDA Sortable Export</div>
            </div>
            <div className="bg-slate-50/70 p-3.5 rounded-lg border border-slate-200/60">
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">-18°C</div>
              <div className="text-xs text-slate-500 font-medium mt-0.5">Sub-Zero Core Telemetry</div>
            </div>
            <div className="bg-slate-50/70 p-3.5 rounded-lg border border-slate-200/60">
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">100%</div>
              <div className="text-xs text-slate-500 font-medium mt-0.5">Offline Scale Sync</div>
            </div>
            <div className="bg-slate-50/70 p-3.5 rounded-lg border border-slate-200/60">
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">2-Way</div>
              <div className="text-xs text-slate-500 font-medium mt-0.5">Supplier & Customer Ledgers</div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. MARITIME & REGULATORY CLIENT TRUST BADGES BAR                          */}
        {/* ========================================================================= */}
        <div className="mt-14 pt-8 pb-4 border-t border-slate-200">
          <p className="text-center text-xs font-semibold tracking-wider uppercase text-slate-400 mb-6">
            Trusted by Commercial Fleets, Seafood Processors & Cold Storage Facilities
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 items-center justify-items-center opacity-80">
            {/* Badge 1: NOAA Seafood Inspection */}
            <div className="flex items-center gap-2.5 text-slate-700 hover:text-slate-900 transition-colors">
              <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0" />
              <div className="text-left">
                <div className="text-xs font-bold leading-tight">NOAA Fisheries</div>
                <div className="text-[10px] text-slate-400">Seafood Inspection Aligned</div>
              </div>
            </div>

            {/* Badge 2: MSC Marine Stewardship */}
            <div className="flex items-center gap-2.5 text-slate-700 hover:text-slate-900 transition-colors">
              <Ship className="w-5 h-5 text-teal-600 shrink-0" />
              <div className="text-left">
                <div className="text-xs font-bold leading-tight">MSC Certified</div>
                <div className="text-[10px] text-slate-400">Chain of Custody Compliant</div>
              </div>
            </div>

            {/* Badge 3: SQF Safe Quality Food */}
            <div className="flex items-center gap-2.5 text-slate-700 hover:text-slate-900 transition-colors">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="text-left">
                <div className="text-xs font-bold leading-tight">SQF Food Safety</div>
                <div className="text-[10px] text-slate-400">Level 3 Audit Ready</div>
              </div>
            </div>

            {/* Badge 4: GS1 EPCIS Standard */}
            <div className="flex items-center gap-2.5 text-slate-700 hover:text-slate-900 transition-colors">
              <Layers className="w-5 h-5 text-indigo-600 shrink-0" />
              <div className="text-left">
                <div className="text-xs font-bold leading-tight">GS1 EPCIS 1.2</div>
                <div className="text-[10px] text-slate-400">Traceability Data Standard</div>
              </div>
            </div>

            {/* Badge 5: Pier 38 Commercial Fleet */}
            <div className="flex items-center gap-2.5 text-slate-700 hover:text-slate-900 transition-colors">
              <MapPin className="w-5 h-5 text-slate-700 shrink-0" />
              <div className="text-left">
                <div className="text-xs font-bold leading-tight">Pier 38 Commercial</div>
                <div className="text-[10px] text-slate-400">Pacific Fleet Network</div>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. INTERACTIVE PRODUCT PREVIEW: LIVE COLD-CHAIN INSPECTOR                 */}
        {/* ========================================================================= */}
        <div id="traceability" className="mt-14 max-w-5xl mx-auto">
          
          <div className="bg-slate-900 text-white rounded-xl shadow-xl border border-slate-800 overflow-hidden">
            
            {/* Terminal Header Bar */}
            <div className="px-5 py-3.5 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-slate-700" />
                  <div className="w-3 h-3 rounded-full bg-slate-700" />
                  <div className="w-3 h-3 rounded-full bg-slate-700" />
                </div>
                <div className="h-4 w-px bg-slate-800 mx-1" />
                <span className="text-xs font-medium text-slate-300">
                  Frostly Live Cold-Chain Telemetry & FSMA 204 Inspector
                </span>
              </div>

              {/* Lot selector tabs */}
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                {DEMO_LOTS.map((lot, idx) => (
                  <button
                    key={lot.id}
                    onClick={() => {
                      setSelectedLotIndex(idx);
                      setSimulatedAlertActive(false);
                    }}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      selectedLotIndex === idx 
                        ? 'bg-blue-600 text-white' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {lot.id}
                  </button>
                ))}
              </div>
            </div>

            {/* Terminal Content Body */}
            <div className="p-6 lg:p-8">
              
              {/* Top Lot Meta & Telemetry Ribbon */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pb-6 border-b border-slate-800">
                
                {/* Lot Identification */}
                <div className="md:col-span-2">
                  <div className="text-xs text-slate-400 font-medium">Traceability Lot Code (TLC)</div>
                  <div className="text-xl font-bold font-mono text-white mt-1 flex items-center gap-2">
                    <span>{activeLot.tlc}</span>
                    <span className="text-xs font-normal text-slate-400 font-sans">({activeLot.species})</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                    <span>{activeLot.vessel}</span>
                    <span aria-hidden="true">·</span>
                    <span>{activeLot.dockTime}</span>
                  </div>
                </div>

                {/* Core Temperature Status */}
                <div className="bg-slate-800/80 p-3.5 rounded-lg border border-slate-700/80">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Sensor Core Temp</span>
                    <ThermometerSnowflake className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-cyan-300 mt-1">
                    {simulatedAlertActive ? '-12.8°C' : `${activeLot.temperature}°C`}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Target: {activeLot.targetTemp}
                  </div>
                </div>

                {/* Catch Weight & Grading */}
                <div className="bg-slate-800/80 p-3.5 rounded-lg border border-slate-700/80">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Certified Net Weight</span>
                    <Scale className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-white mt-1">
                    {activeLot.weightKg.toLocaleString()} kg
                  </div>
                  <div className="text-[11px] text-emerald-400 font-medium mt-0.5">
                    {activeLot.grade}
                  </div>
                </div>
              </div>

              {/* Critical Tracking Events (CTEs) Progress Path */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    FSMA 204 Critical Tracking Events (CTEs) Lifecycle
                  </span>
                  <span className="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Cryptographically Signed Chain</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs">
                  {[
                    { step: 1, name: '1. Harvesting', desc: 'Offshore Catch Coordinates' },
                    { step: 2, name: '2. Catch Inward', desc: 'Tare & Scales Verified' },
                    { step: 3, name: '3. Blast Freeze', desc: 'Core Sub-Zero Pull' },
                    { step: 4, name: '4. Cold Storage', desc: 'Continuous Telemetry' },
                    { step: 5, name: '5. Wholesale Exit', desc: 'Bill of Lading & KDEs' }
                  ].map((s) => {
                    const isCompleted = s.step <= activeLot.cteStage;
                    const isCurrent = s.step === activeLot.cteStage;
                    return (
                      <div
                        key={s.step}
                        className={`p-3 rounded-lg border transition-all ${
                          isCurrent
                            ? 'bg-blue-900/40 border-blue-500 text-white'
                            : isCompleted
                            ? 'bg-slate-800/60 border-slate-700 text-slate-300'
                            : 'bg-slate-900 border-slate-800 text-slate-500'
                        }`}
                      >
                        <div className="font-semibold flex items-center justify-between">
                          <span>{s.name}</span>
                          {isCompleted && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">{s.desc}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Interactive Telemetry Action Controls */}
              <div className="mt-8 pt-6 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
                
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Clock className="w-4 h-4 text-slate-500" />
                  <span>Current Bay Location: <strong className="text-slate-200">{activeLot.storageZone}</strong></span>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={() => setSimulatedAlertActive(!simulatedAlertActive)}
                    className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                      simulatedAlertActive
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{simulatedAlertActive ? 'Reset Temp Excursion' : 'Simulate Temp Excursion'}</span>
                  </button>

                  <button
                    onClick={handleSimulateFdaExport}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Export 24h FDA Electronic Spreadsheet</span>
                  </button>

                  <button
                    onClick={onExploreDemo}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-medium transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <span>Inspect In App</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Simulation feedback toast */}
              {showFdaExportToast && (
                <div className="mt-4 p-3 bg-emerald-950/80 border border-emerald-700 rounded-lg text-emerald-200 text-xs flex items-center justify-between animate-in fade-in duration-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>
                      <strong>FSMA 204 Sortable Spreadsheet Ready:</strong> All Key Data Elements (KDEs), Traceability Lot Code {activeLot.tlc}, harvest coordinates, and CCP temperature logs prepared in standardized format.
                    </span>
                  </div>
                  <span className="text-[10px] font-mono uppercase bg-emerald-900 px-2 py-0.5 rounded text-emerald-300">
                    24-Hour Rule Met
                  </span>
                </div>
              )}

              {simulatedAlertActive && (
                <div className="mt-4 p-3 bg-amber-950/80 border border-amber-700 rounded-lg text-amber-200 text-xs flex items-center justify-between animate-in fade-in duration-200">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span>
                      <strong>CCP Warning Triggered:</strong> Temperature rise to -12.8°C exceeded -18°C threshold in {activeLot.storageZone}. Automated WhatsApp/SMS alerts sent to QA Manager.
                    </span>
                  </div>
                  <span className="text-[10px] font-mono uppercase bg-amber-900 px-2 py-0.5 rounded text-amber-300">
                    Corrective Action Required
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
