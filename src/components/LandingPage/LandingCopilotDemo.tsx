import React, { useState } from 'react';
import { 
  Sparkles, 
  Send, 
  Paperclip, 
  AtSign, 
  Bot, 
  CheckCircle2, 
  ThermometerSnowflake, 
  TrendingUp, 
  Scale, 
  ShieldAlert,
  ArrowRight,
  RefreshCw
} from 'lucide-react';

interface CopilotPreset {
  id: string;
  label: string;
  prompt: string;
  responseTitle: string;
  badge: string;
  badgeColor: string;
  analysis: string;
  metrics: { label: string; value: string; positive?: boolean }[];
  recommendation: string;
}

const PRESETS: CopilotPreset[] = [
  {
    id: 'yield',
    label: 'Analyze Catch Yield',
    prompt: 'Analyze today’s Atlantic Cod catch inward yield and flag any recovery variance against seasonal benchmarks.',
    responseTitle: 'Batch #4028 Harvest Yield Analysis',
    badge: 'Yield Optimal (+2.4%)',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    analysis: 'F/V Northern Star landed 2,450 kg net of Grade-A Atlantic Cod. Processing into skinless boneless fillets resulted in 1,372 kg output (56.0% recovery rate), exceeding the Q3 seasonal benchmark of 53.6% by 2.4%. No visceral parasite defects detected.',
    metrics: [
      { label: 'Gross Landed', value: '2,485 kg' },
      { label: 'Fillet Recovery', value: '56.0%', positive: true },
      { label: 'Estimated Margin', value: '$4,120.00', positive: true },
      { label: 'Shrinkage', value: '0.8%', positive: true }
    ],
    recommendation: 'Recommend allocating 60% of fillets to high-margin wholesale restaurant accounts and flash-freezing the remaining 40% in blast hold Bay 2 for retail counter demand.'
  },
  {
    id: 'coldchain',
    label: 'Cold Chain Compliance',
    prompt: 'Audit core temperature logs for Pier 38 cold storage holds and verify FSMA 204 critical tracking events.',
    responseTitle: 'HACCP CCP #1 Continuous Cold Audit',
    badge: '100% Compliant',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    analysis: 'All 8 sub-zero and blast-freeze zones at Tema Fishing Harbour operated strictly within the safe threshold (-18°C to -24°C) over the preceding 72 hours. Digital temperature sensors recorded zero excursions exceeding 15 minutes.',
    metrics: [
      { label: 'Average Core Temp', value: '-19.2°C', positive: true },
      { label: 'Max Excursion', value: '0.4°C (4 min)', positive: true },
      { label: 'FSMA 204 KDEs', value: '18 / 18 Signed', positive: true },
      { label: 'Audit Risk Score', value: 'Zero Risk', positive: true }
    ],
    recommendation: 'Digital traceability QR passport is verified and cryptographically stamped for European Union & FDA export release.'
  },
  {
    id: 'pricing',
    label: 'Wholesale Price Elasticity',
    prompt: 'Recommend wholesale pricing for Yellowfin Tuna loins based on current dock purchase COGS and competitor market rates.',
    responseTitle: 'Dynamic Margin Optimization Model',
    badge: '34.2% Gross Margin Target',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    analysis: 'Dock procurement cost settled at $6.80/kg. Factoring ice, labor, blast freezing, and cold holding, total landed COGS is $8.45/kg. Current regional wholesale spot rate is averaging $12.80 - $13.50/kg.',
    metrics: [
      { label: 'Landed COGS', value: '$8.45 / kg' },
      { label: 'Suggested Wholesale', value: '$12.85 / kg' },
      { label: 'Gross Spread', value: '+$4.40 / kg', positive: true },
      { label: 'Breakeven Vol', value: '380 kg' }
    ],
    recommendation: 'Set contract price at $12.85/kg for Tier-1 restaurant distributors with a 3% volume discount on orders exceeding 500 kg.'
  }
];

export const LandingCopilotDemo: React.FC = () => {
  const [selectedPreset, setSelectedPreset] = useState<CopilotPreset>(PRESETS[0]);
  const [isSimulating, setIsSimulating] = useState(false);

  const handleSelectPreset = (preset: CopilotPreset) => {
    setIsSimulating(true);
    setTimeout(() => {
      setSelectedPreset(preset);
      setIsSimulating(false);
    }, 400);
  };

  return (
    <section id="copilot" className="py-20 bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header with Copilot emblem */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>AI Catch Intelligence (Frostly Copilot)</span>
          </div>
          <h2 className="mt-4 text-3xl sm:text-4xl font-semibold text-slate-900 tracking-tight">
            Your personal seafood operations analyst, available 24/7
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600">
            Ask complex questions about your catch yields, cold-chain temperature telemetry, FSMA 204 export compliance, and wholesale margins in plain English.
          </p>
        </div>

        {/* Interactive Copilot Playground Card */}
        <div className="mt-12 max-w-4xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden text-left">
          
          {/* Top Bar with Prompt Chips */}
          <div className="p-4 sm:p-6 bg-slate-50 border-b border-slate-200">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
              Try a sample operational query:
            </div>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => {
                const isSelected = selectedPreset.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => handleSelectPreset(p)}
                    className={`text-xs font-semibold px-3.5 py-2 rounded-lg border transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <Sparkles className={`w-3 h-3 ${isSelected ? 'text-white' : 'text-blue-600'}`} />
                    <span>{p.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Prompt Input Box (Matching reference style) */}
            <div className="mt-4 bg-white rounded-xl border border-slate-300 p-3 flex items-center justify-between gap-3 shadow-inner">
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-indigo-600 flex items-center justify-center text-white shrink-0">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <span className="text-sm font-medium text-slate-800 truncate">
                  {selectedPreset.prompt}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0 text-slate-400">
                <Paperclip className="w-4 h-4 hover:text-slate-600 cursor-pointer hidden sm:block" />
                <AtSign className="w-4 h-4 hover:text-slate-600 cursor-pointer hidden sm:block" />
                <button
                  onClick={() => handleSelectPreset(selectedPreset)}
                  className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs hover:bg-blue-700 transition-colors"
                >
                  <Send className="w-3.5 h-3.5 ml-0.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Response Container */}
          <div className="p-6 sm:p-8">
            {isSimulating ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                <span className="text-sm font-medium">Querying real-time catch telemetry and cold chain logs...</span>
              </div>
            ) : (
              <div className="space-y-6">
                
                {/* Result Title & Badge */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                      <Bot className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-slate-900">{selectedPreset.responseTitle}</h3>
                      <p className="text-xs text-slate-500">Verified against official seafood enterprise schema</p>
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full border ${selectedPreset.badgeColor}`}>
                    {selectedPreset.badge}
                  </span>
                </div>

                {/* Analysis Body */}
                <p className="text-sm sm:text-base text-slate-700 leading-relaxed">
                  {selectedPreset.analysis}
                </p>

                {/* Quantitative Metric Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {selectedPreset.metrics.map((m, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 text-center">
                      <div className="text-[10px] uppercase font-semibold text-slate-500">{m.label}</div>
                      <div className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">{m.value}</div>
                    </div>
                  ))}
                </div>

                {/* Actionable Executive Recommendation */}
                <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div className="text-xs sm:text-sm text-slate-800">
                    <span className="font-bold text-blue-900">Recommended Action: </span>
                    {selectedPreset.recommendation}
                  </div>
                </div>

              </div>
            )}
          </div>

        </div>

      </div>
    </section>
  );
};
