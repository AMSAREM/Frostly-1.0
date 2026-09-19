import React, { useState } from 'react';
import { 
  Anchor, 
  ThermometerSnowflake, 
  Scale, 
  ShoppingBag, 
  FileText, 
  TrendingUp, 
  ShieldCheck, 
  QrCode, 
  WifiOff, 
  CheckCircle2, 
  ArrowRight, 
  Boxes,
  Truck
} from 'lucide-react';

export const LandingFeatures: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'inward' | 'coldchain' | 'fulfillment' | 'yields'>('inward');

  const tabs = [
    {
      id: 'inward' as const,
      label: 'Catch Inward & Weighing',
      icon: Anchor,
      tag: 'Dockside Ops',
      headline: 'Instant vessel logging with integrated catch-weight weighing',
      description: 'Log offshore catch manifests the moment boats dock. Built-in gross, tare, and net calculation ensures every kilogram is accounted for before heading into cold storage.',
      highlights: [
        'Automatic tare calculation for crates, totes, and pallets',
        'Vessel harvest logging with captain signatures and license numbers',
        'Grade classification (A, B, Processing) with instant quality stamping',
        'Dockside offline PWA mode for zero-latency weighing in poor reception zones'
      ],
      mockupData: {
        title: 'Catch Inward Station #01',
        subtitle: 'Dockside Terminal • Pier 38 Fishing Harbour',
        stats: [
          { label: 'Gross Weight', val: '2,485.4 kg' },
          { label: 'Tare Weight', val: '35.0 kg' },
          { label: 'Net Catch', val: '2,450.4 kg', highlight: true }
        ],
        badge: 'HACCP Standard Met'
      }
    },
    {
      id: 'coldchain' as const,
      label: 'Cold Chain & HACCP',
      icon: ThermometerSnowflake,
      tag: 'Food Safety',
      headline: 'Sub-zero lot tracking with automated FSMA 204 traceability',
      description: 'Protect your catch and brand reputation with continuous core-temperature monitoring, multi-zone cold storage mapping, and cryptographically verified digital QR traceability passports.',
      highlights: [
        'Multi-zone facility mapping (Sub-Zero -24°C, Blast Chill -35°C, Fresh Chilled 0-2°C)',
        'Automated critical control point (CCP) breach alerts before shrinkage occurs',
        'FSMA 204 Key Data Elements (KDEs) generated automatically on each lot move',
        'Customer-scannable QR passports showing catch coordinates, harvest dates, and temperature history'
      ],
      mockupData: {
        title: 'Zone A-04 Sub-Zero Bay',
        subtitle: 'Continuous Sensor Stream • Active Lot #4028',
        stats: [
          { label: 'Core Temp', val: '-18.6°C', highlight: true },
          { label: 'Target Range', val: '-18°C to -22°C' },
          { label: 'HACCP CCP 1', val: 'Compliant' }
        ],
        badge: 'FSMA 204 Verified'
      }
    },
    {
      id: 'fulfillment' as const,
      label: 'Dual POS & Wholesale',
      icon: ShoppingBag,
      tag: 'Omnichannel Sales',
      headline: 'Sell directly over the counter or dispatch multi-ton wholesale orders',
      description: 'Eliminate dual systems. Frostly powers high-speed retail touch POS for walk-in counter seafood sales while simultaneously managing bulk wholesale dispatches with custom customer price sheets.',
      highlights: [
        'Touch-optimized retail POS with quick cash, card, and mobile money checkout',
        'Wholesale purchase order dispatch with catch-weight variance adjustments',
        'Automated inventory deduction across retail cuts and whole fish lots',
        'Instant branded PDF invoices and thermal receipt printing'
      ],
      mockupData: {
        title: 'Dual Fulfillment Dispatch',
        subtitle: 'Order #WH-8842 • Harbor Bistro & Raw Bar',
        stats: [
          { label: 'Ordered', val: '450.0 kg' },
          { label: 'Actual Catch', val: '452.3 kg' },
          { label: 'Net Invoice', val: '$3,844.55', highlight: true }
        ],
        badge: 'Ready for Dispatch'
      }
    },
    {
      id: 'yields' as const,
      label: 'Yields & Financials',
      icon: TrendingUp,
      tag: 'Profit Intelligence',
      headline: 'Live recovery rates, real-time COGS, and automated AR/AP',
      description: 'Stop guessing your processing margins. Track live yield conversion rates from Head-On/Gutted (HOG) to skinless fillets, allocate overhead, and automate your profit and loss ledger.',
      highlights: [
        'Real-time HOG-to-fillet recovery percentage calculation and shrinkage alerts',
        'Automated cost-of-goods-sold (COGS) tracking factoring dock purchase price + ice + storage',
        'Customer credit accounts with aging analysis and automated invoice reminders',
        'Daily, weekly, and monthly P&L statements exportable in CSV and Excel'
      ],
      mockupData: {
        title: 'Yield Conversion Engine',
        subtitle: 'Batch #4028 Processing Run • Atlantic Cod',
        stats: [
          { label: 'Input HOG', val: '2,450 kg' },
          { label: 'Fillet Output', val: '1,372 kg' },
          { label: 'Recovery Rate', val: '56.0%', highlight: true }
        ],
        badge: 'Above Target Margin'
      }
    }
  ];

  const current = tabs.find(t => t.id === activeTab)!;

  return (
    <section id="features" className="py-20 bg-white border-y border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
            End-to-End Seafood Architecture
          </span>
          <h2 className="mt-4 text-3xl sm:text-4xl font-semibold text-slate-900 tracking-tight">
            Engineered specifically for the harsh realities of the seafood cold chain
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600">
            From the moment the fishing vessel ties up at the pier to final customer delivery, Frostly eliminates manual clipboards, inventory leakage, and cold chain blind spots.
          </p>
        </div>

        {/* Feature Pill Tabs */}
        <div className="mt-12 flex flex-wrap justify-center gap-2 p-1.5 bg-slate-100/80 rounded-xl max-w-3xl mx-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Active Feature Showcase Box */}
        <div className="mt-12 bg-slate-50/70 border border-slate-200 rounded-2xl p-6 sm:p-10 lg:p-12 shadow-sm">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            {/* Left Feature Description */}
            <div className="lg:col-span-6 text-left">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                {current.tag}
              </span>
              <h3 className="mt-2 text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight leading-snug">
                {current.headline}
              </h3>
              <p className="mt-4 text-base text-slate-600 leading-relaxed">
                {current.description}
              </p>

              {/* Highlights Checklist */}
              <ul className="mt-6 space-y-3">
                {current.highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-slate-700">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right Interactive Mockup Card */}
            <div className="lg:col-span-6">
              <div className="bg-white rounded-xl border border-slate-200 shadow-xl p-6 text-left relative overflow-hidden">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div>
                    <h4 className="font-bold text-base text-slate-900">{current.mockupData.title}</h4>
                    <p className="text-xs text-slate-500">{current.mockupData.subtitle}</p>
                  </div>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    {current.mockupData.badge}
                  </span>
                </div>

                {/* Metrics Visual Display */}
                <div className="grid grid-cols-3 gap-3 my-6">
                  {current.mockupData.stats.map((s, idx) => (
                    <div 
                      key={idx} 
                      className={`p-3 rounded-lg border text-center ${
                        s.highlight 
                          ? 'bg-blue-50/80 border-blue-200 text-blue-900' 
                          : 'bg-slate-50 border-slate-100 text-slate-700'
                      }`}
                    >
                      <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">{s.label}</div>
                      <div className={`text-base sm:text-lg font-bold mt-1 ${s.highlight ? 'text-blue-700' : 'text-slate-800'}`}>
                        {s.val}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Interactive Status Footer */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-slate-600">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    <span>Cryptographic Audit Trail Active</span>
                  </div>
                  <span className="font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer">
                    Live Telemetry <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
};
