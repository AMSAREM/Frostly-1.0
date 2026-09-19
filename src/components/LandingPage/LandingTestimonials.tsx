import React from 'react';
import { Ship, Building2, Anchor, Star, Quote } from 'lucide-react';

export const LandingTestimonials: React.FC = () => {
  const reviews = [
    {
      quote: "Before Frostly, our dockside weighers used wet paper clipboards and transcribed weights into spreadsheets each evening. We lost thousands of dollars in tare discrepancies every quarter. Now, our tare deduction is automatic and synchronizes instantly to our cold store.",
      author: "Captain Kwesi Mensah",
      role: "Operations Director",
      company: "Tema Deepsea Fishery Fleet",
      icon: Ship,
      metric: "0% Weighing Discrepancy",
      metricSub: "Saved ~$34k annually"
    },
    {
      quote: "When European buyers requested our FSMA 204 Key Data Elements and core temperature history, generating the report took three days of manual binder digging. With Frostly, we printed a cryptographic QR code in 5 seconds showing the exact dock, boat, and temperature profile.",
      author: "Elena Rostova",
      role: "Quality Assurance & HACCP Lead",
      company: "North Atlantic Seafood Processors",
      icon: Anchor,
      metric: "100% Export Pass Rate",
      metricSub: "EU & FDA Audits Passed"
    },
    {
      quote: "We run both a busy waterfront retail fish market and a bulk wholesale supply business for 40+ local restaurants. Frostly handles counter touch sales seamlessly while auto-decrementing whole lots from our wholesale inventory in real time.",
      author: "Marcus Vance",
      role: "Founder & General Manager",
      company: "Harbor Catch Provisions",
      icon: Building2,
      metric: "3.2x Faster Checkout",
      metricSub: "Dual POS & Wholesale Sync"
    }
  ];

  return (
    <section className="py-20 bg-white border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center max-w-3xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
            Field-Proven Reliability
          </span>
          <h2 className="mt-4 text-3xl sm:text-4xl font-semibold text-slate-900 tracking-tight">
            Trusted by commercial fleets, cold storage facilities, and seafood distributors
          </h2>
        </div>

        <div className="mt-14 grid grid-cols-1 lg:grid-cols-3 gap-8">
          {reviews.map((r, i) => {
            const Icon = r.icon;
            return (
              <div 
                key={i} 
                className="bg-slate-50/70 border border-slate-200 rounded-2xl p-8 flex flex-col justify-between text-left shadow-xs hover:shadow-md transition-shadow"
              >
                <div>
                  {/* Star Rating */}
                  <div className="flex items-center gap-1 text-amber-400 mb-4">
                    {[...Array(5)].map((_, idx) => (
                      <Star key={idx} className="w-4 h-4 fill-amber-400" />
                    ))}
                  </div>

                  <p className="text-sm text-slate-700 leading-relaxed italic">
                    "{r.quote}"
                  </p>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-200/80">
                  {/* Metric Highlight */}
                  <div className="mb-4 bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-700">{r.metric}</span>
                    <span className="text-[11px] text-slate-500 font-medium">{r.metricSub}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900">{r.author}</div>
                      <div className="text-xs text-slate-500">{r.role} • {r.company}</div>
                    </div>
                  </div>
                </div>

              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
