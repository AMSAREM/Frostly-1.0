import React, { useState } from 'react';
import { 
  Building2, 
  Mail, 
  User, 
  CheckCircle2, 
  ShieldCheck, 
  ArrowRight,
  Send,
  Ship,
  ThermometerSnowflake,
  FileCheck
} from 'lucide-react';

export const LandingLeadCapture: React.FC = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    facilityName: '',
    facilityType: 'Seafood Processing Plant',
    dailyVolume: '5 - 25 Tons / Day',
    notes: ''
  });

  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Basic email validation
    if (!formData.fullName.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      setErrorMsg('Please enter a valid work email address.');
      return;
    }
    if (!formData.facilityName.trim()) {
      setErrorMsg('Please enter your facility or company name.');
      return;
    }

    setSubmitted(true);
  };

  return (
    <section id="lead-audit-section" className="py-20 bg-slate-900 text-white relative overflow-hidden">
      
      {/* Background ambient accents */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column: Context & Guarantees */}
          <div className="lg:col-span-6 text-left">
            <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-cyan-400 mb-3">
              <span>Plant Audit & Enterprise Consultation</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span>FSMA 204 Readiness</span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight [text-wrap:balance]">
              Schedule a Custom Cold-Chain & Traceability Assessment
            </h2>

            <p className="mt-4 text-base text-slate-300 leading-relaxed [text-wrap:balance]">
              Speak directly with our seafood systems specialists. We will analyze your dockside receiving, scale tare workflows, sub-zero holding bays, and current compliance records.
            </p>

            <div className="mt-8 space-y-4 text-sm text-slate-300">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">FSMA 204 Gap Analysis:</strong> We map your existing receiving logs to required Critical Tracking Events (CTEs) and Key Data Elements (KDEs).
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">IoT Sensor & Probe Deployment Plan:</strong> Hardware recommendations for Bluetooth & LoRaWAN dockside probes and blast freezer monitors.
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">Custom Tenant Ledger Setup:</strong> Multi-currency supplier catch disbursement setup and customer wholesale payment rules.
                </div>
              </div>
            </div>

            <div className="mt-10 pt-6 border-t border-slate-800 flex items-center gap-6 text-xs text-slate-400 font-mono">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>NDA & Confidentiality Protected</span>
              </div>
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-cyan-400" />
                <span>Zero Commitment Assessment</span>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Consultation Form */}
          <div className="lg:col-span-6">
            <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-8 shadow-2xl backdrop-blur-md">
              
              {!submitted ? (
                <form onSubmit={handleSubmit} className="space-y-4 text-left">
                  <h3 className="text-lg font-bold text-white mb-2">Request Facility Consultation</h3>
                  <p className="text-xs text-slate-400 mb-4">
                    Our team responds within 4 business hours to schedule your session.
                  </p>

                  {errorMsg && (
                    <div className="p-3 bg-red-950/80 border border-red-700 text-red-200 text-xs rounded-md">
                      {errorMsg}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      placeholder="e.g. Captain David Reynolds"
                      className="w-full px-3.5 py-2.5 rounded-md bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-hidden focus:border-cyan-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Work Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="e.g. operations@pier38seafood.com"
                      className="w-full px-3.5 py-2.5 rounded-md bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-hidden focus:border-cyan-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Facility / Fleet Organization *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.facilityName}
                      onChange={(e) => setFormData({ ...formData, facilityName: e.target.value })}
                      placeholder="e.g. Pacific Harbors Cold Storage LLC"
                      className="w-full px-3.5 py-2.5 rounded-md bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-hidden focus:border-cyan-500 transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Facility Operation
                      </label>
                      <select
                        value={formData.facilityType}
                        onChange={(e) => setFormData({ ...formData, facilityType: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-md bg-slate-900 border border-slate-700 text-white text-xs focus:outline-hidden focus:border-cyan-500 transition-colors"
                      >
                        <option>Seafood Processing Plant</option>
                        <option>Cold Storage Warehouse</option>
                        <option>Commercial Fishing Fleet</option>
                        <option>Wholesale Seafood Distributor</option>
                        <option>Dockside Receiving Station</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Daily Throughput Volume
                      </label>
                      <select
                        value={formData.dailyVolume}
                        onChange={(e) => setFormData({ ...formData, dailyVolume: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-md bg-slate-900 border border-slate-700 text-white text-xs focus:outline-hidden focus:border-cyan-500 transition-colors"
                      >
                        <option>Under 5 Tons / Day</option>
                        <option>5 - 25 Tons / Day</option>
                        <option>25 - 100 Tons / Day</option>
                        <option>100+ Tons / Day</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full mt-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold py-3 px-4 rounded-md text-sm transition-all shadow-md active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Schedule Cold-Chain Assessment</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                <div className="py-8 text-center space-y-4 animate-in fade-in duration-200">
                  <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/40">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Consultation Request Confirmed</h3>
                  <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
                    Thank you, <strong className="text-white">{formData.fullName}</strong>. A dedicated Frostly cold-chain operations specialist has received your request for <strong className="text-white">{formData.facilityName}</strong>.
                  </p>
                  <div className="p-3 bg-slate-900 rounded border border-slate-700 text-xs font-mono text-cyan-300 inline-block">
                    Reference: AUDIT-REQ-{Math.floor(100000 + Math.random() * 900000)}
                  </div>
                  <div className="pt-4">
                    <button
                      onClick={() => setSubmitted(false)}
                      className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
                    >
                      Submit another inquiry
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
