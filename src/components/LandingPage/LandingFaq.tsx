import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

export const LandingFaq: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: 'How does the offline mode work when fishing vessels are dockside without internet?',
      a: 'Frostly operates as an advanced Progressive Web App (PWA) with a local in-browser database cache (PGLite / IndexedDB). Dockside workers can log vessel manifests, record gross and tare scale weights, and stamp lots completely offline. The moment the device reconnects to cellular data or Wi-Fi, changes are automatically and safely synchronized to the cloud with conflict resolution.'
    },
    {
      q: 'Does Frostly satisfy the new FDA FSMA 204 Food Traceability Rule?',
      a: 'Yes. Frostly is built from the ground up around FSMA 204 Key Data Elements (KDEs) and Critical Tracking Events (CTEs). It automatically records harvest vessel details, landing dates, cold chain temperatures, lot numbers, and location identifiers, enabling you to export compliant 24-hour electronic sortable spreadsheets during FDA or customer audits.'
    },
    {
      q: 'Can we connect existing digital catch-weight scales and thermal label printers?',
      a: 'Yes. Frostly includes a specialized Catch-Weight Weigher tool that supports manual tare deduction as well as standard USB, Bluetooth, and serial scale protocols. You can print GS1-128 barcode labels and QR traceability passports on standard thermal printer hardware.'
    },
    {
      q: 'How does the multi-tenant isolation protect our commercial data from competitors?',
      a: 'Every seafood company in Frostly operates within a strictly isolated multi-tenant organization boundary. All PostgreSQL queries enforce tenant-level Row Level Security (RLS) policies, ensuring staff and operators cannot access, query, or view data from any other organization.'
    },
    {
      q: 'Can we manage both retail counter sales and bulk restaurant wholesale in one platform?',
      a: 'Absolutely. Frostly provides an omnichannel dual fulfillment engine. Your retail fishmonger counter can run a touch-friendly POS with barcode scanning and receipt printing, while your sales team dispatches bulk wholesale orders with custom price tiers and net-30 terms—all pulling from the exact same live inventory lots.'
    },
    {
      q: 'Is there a long-term contract or setup fee?',
      a: 'No. All plans come with a 14-day full-access trial without needing a credit card. You can choose month-to-month flexibility or annual billing for a 20% discount. You retain complete ownership of all your catch data and can export it anytime.'
    }
  ];

  return (
    <section id="faq" className="py-20 bg-slate-50 border-t border-slate-200">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
            Frequently Asked Questions
          </span>
          <h2 className="mt-4 text-3xl sm:text-4xl font-semibold text-slate-900 tracking-tight">
            Everything you need to know about Frostly
          </h2>
        </div>

        <div className="mt-12 space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div 
                key={idx}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden transition-all shadow-2xs"
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="w-full px-6 py-5 text-left flex items-center justify-between gap-4 focus:outline-none"
                >
                  <span className="text-base font-semibold text-slate-900">
                    {faq.q}
                  </span>
                  <div className={`w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 transition-transform ${isOpen ? 'rotate-180 bg-blue-100 text-blue-700' : ''}`}>
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>

                {isOpen && (
                  <div className="px-6 pb-6 text-sm sm:text-base text-slate-600 leading-relaxed border-t border-slate-100 pt-4 animate-in fade-in duration-200">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
