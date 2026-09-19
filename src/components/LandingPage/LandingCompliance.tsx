import React from 'react';
import { 
  ShieldCheck, 
  QrCode, 
  FileCheck2, 
  ThermometerSnowflake, 
  Lock, 
  Server, 
  WifiOff, 
  CheckCircle2 
} from 'lucide-react';

export const LandingCompliance: React.FC = () => {
  const certifications = [
    {
      icon: ShieldCheck,
      title: 'FDA FSMA 204 Ready',
      desc: 'Generates Key Data Elements (KDEs) across all Critical Tracking Events (CTEs) including Harvesting, Cooling, Initial Packing, and Shipping.'
    },
    {
      icon: ThermometerSnowflake,
      title: 'HACCP Level 4 Critical Control',
      desc: 'Automatic continuous core-temperature alerts ensure fish core temperatures remain strictly below 4.4°C for fresh chilled and -18°C for frozen.'
    },
    {
      icon: QrCode,
      title: 'Cryptographic QR Passports',
      desc: 'Every wholesale crate and retail carton features an unforgeable QR code linking to dockside coordinates, harvest vessel, and species taxonomy.'
    },
    {
      icon: WifiOff,
      title: '100% Offline PWA Resilience',
      desc: 'Full offline local caching and background sync ensure dock workers and vessel crews never lose data, even in offshore dead-zones.'
    }
  ];

  return (
    <section id="traceability" className="py-20 bg-slate-900 text-white relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Title */}
        <div className="text-center max-w-3xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-wider text-sky-400 bg-sky-950/80 px-3 py-1 rounded-full border border-sky-800">
            Enterprise Trust & Regulation
          </span>
          <h2 className="mt-4 text-3xl sm:text-4xl font-semibold text-white tracking-tight">
            Built to satisfy the world's strictest food safety auditors
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-300">
            From the US FDA Food Traceability Rule (FSMA 204) to EU Catch Certificate regulations, Frostly transforms regulatory compliance from a manual paperwork burden into automated real-time proof.
          </p>
        </div>

        {/* 4 Cards Grid */}
        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {certifications.map((c, i) => {
            const Icon = c.icon;
            return (
              <div 
                key={i} 
                className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-6 text-left hover:border-slate-600 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 text-sky-400 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white mb-2">{c.title}</h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{c.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Live Export Verification Banner */}
        <div className="mt-12 bg-gradient-to-r from-blue-900/60 via-slate-800/80 to-indigo-900/60 border border-blue-500/30 rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 text-left">
          <div className="space-y-1">
            <div className="text-xs font-bold uppercase tracking-wider text-sky-400">
              One-Click Regulatory Audit Export
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-white">
              Produce 24-hour FSMA 204 electronic spreadsheets instantly
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
              When food safety inspectors request traceability records, generate complete end-to-end audit spreadsheets in under 60 seconds with full lot genealogy.
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-3">
            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 bg-emerald-950/60 px-3 py-1.5 rounded-full border border-emerald-800">
              <CheckCircle2 className="w-4 h-4" />
              <span>Zero Defect Record</span>
            </span>
          </div>
        </div>

      </div>
    </section>
  );
};
