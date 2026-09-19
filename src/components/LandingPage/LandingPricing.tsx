import React, { useState } from 'react';
import { Check, Sparkles, HelpCircle, ArrowRight } from 'lucide-react';

interface LandingPricingProps {
  onSelectPlan: (planName: string) => void;
}

export const LandingPricing: React.FC<LandingPricingProps> = ({ onSelectPlan }) => {
  const [annualBilling, setAnnualBilling] = useState(true);

  const tiers = [
    {
      name: 'Starter Fishery',
      tagline: 'Ideal for independent fishing vessels & single cold-room docks.',
      monthlyPrice: 49,
      annualPrice: 39,
      popular: false,
      features: [
        'Up to 2 fishing vessels or dock stations',
        'Catch Inward & Weighing with tare deduction',
        'Cold storage lot tracking with basic alerts',
        'Mobile PWA with offline logging',
        'Standard PDF invoices & receipts',
        'Email customer support'
      ],
      buttonText: 'Start 14-Day Free Trial',
      buttonStyle: 'bg-white text-slate-900 border border-slate-300 hover:bg-slate-50'
    },
    {
      name: 'Commercial Fleet',
      tagline: 'For commercial seafood processors, wholesalers & fleet managers.',
      monthlyPrice: 149,
      annualPrice: 119,
      popular: true,
      badge: 'Most Popular',
      features: [
        'Unlimited vessels, dock stations & staff accounts',
        'Full FSMA 204 & HACCP digital QR passports',
        'Dual fulfillment: Retail Touch POS + B2B Wholesale',
        'AI Catch Intelligence (Frostly Copilot)',
        'Yield recovery & dynamic HOG-to-fillet COGS',
        'Automated AR/AP ledger with customer credit aging',
        'Multi-zone IoT temperature continuous monitoring',
        'Priority 24/7 dockside support'
      ],
      buttonText: 'Start Commercial Trial',
      buttonStyle: 'bg-blue-600 hover:bg-blue-700 text-white shadow-md'
    },
    {
      name: 'Enterprise Processor',
      tagline: 'Custom infrastructure for multi-terminal processing plants & exporters.',
      monthlyPrice: 399,
      annualPrice: 319,
      popular: false,
      features: [
        'Multi-facility & multi-port operational clustering',
        'Custom ERP / SAP / NetSuite API integrations',
        'Dedicated isolated database tenancy',
        'Custom hardware catch-weight scale driver protocols',
        'Custom HACCP hazard analysis workflows',
        'Dedicated Technical Account Manager',
        '99.99% uptime Service Level Agreement (SLA)'
      ],
      buttonText: 'Contact Enterprise Sales',
      buttonStyle: 'bg-slate-900 hover:bg-slate-800 text-white'
    }
  ];

  return (
    <section id="pricing" className="py-20 bg-slate-50 border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Title */}
        <div className="text-center max-w-3xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
            Simple, Transparent Pricing
          </span>
          <h2 className="mt-4 text-3xl sm:text-4xl font-semibold text-slate-900 tracking-tight">
            Predictable plans designed to scale with your harvest volume
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600">
            Every plan includes our 100% offline-first PWA engine, automated tare deduction, and cryptographic audit security. No surprise per-ton fees.
          </p>

          {/* Billing Interval Toggle */}
          <div className="mt-8 inline-flex items-center gap-3 bg-white p-1 rounded-full border border-slate-200 shadow-xs">
            <button
              onClick={() => setAnnualBilling(false)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                !annualBilling ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Monthly Billing
            </button>
            <button
              onClick={() => setAnnualBilling(true)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
                annualBilling ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Annual Billing</span>
              <span className="bg-emerald-400 text-slate-950 text-[10px] font-extrabold px-1.5 py-0.2 rounded-full">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="mt-14 grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {tiers.map((tier, idx) => {
            const price = annualBilling ? tier.annualPrice : tier.monthlyPrice;
            return (
              <div
                key={idx}
                className={`rounded-2xl p-8 flex flex-col justify-between text-left transition-all duration-200 ${
                  tier.popular
                    ? 'bg-white border-2 border-blue-600 shadow-xl relative scale-100 lg:-translate-y-2'
                    : 'bg-white border border-slate-200 shadow-sm hover:shadow-md'
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[11px] font-bold uppercase tracking-wider px-3.5 py-1 rounded-full shadow-sm">
                    {tier.badge}
                  </div>
                )}

                <div>
                  <h3 className="text-xl font-bold text-slate-900">{tier.name}</h3>
                  <p className="mt-2 text-xs sm:text-sm text-slate-500 leading-relaxed">
                    {tier.tagline}
                  </p>

                  {/* Price display */}
                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-4xl sm:text-5xl font-extrabold text-slate-900">
                      ${price}
                    </span>
                    <span className="text-sm font-medium text-slate-500">
                      / month {annualBilling && <span className="text-xs text-blue-600 font-semibold">(billed annually)</span>}
                    </span>
                  </div>

                  {/* Feature Checklist */}
                  <div className="mt-8 pt-6 border-t border-slate-100 space-y-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Included Capabilities:
                    </div>
                    {tier.features.map((feat, fIdx) => (
                      <div key={fIdx} className="flex items-start gap-3 text-xs sm:text-sm text-slate-700">
                        <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Plan Action Button */}
                <div className="mt-8 pt-6 border-t border-slate-100">
                  <button
                    onClick={() => onSelectPlan(tier.name)}
                    className={`w-full py-3 px-4 rounded-lg font-semibold text-sm transition-all active:scale-[0.98] ${tier.buttonStyle}`}
                  >
                    {tier.buttonText}
                  </button>
                  <p className="mt-2 text-[11px] text-center text-slate-400">
                    14-day full feature trial • No credit card required
                  </p>
                </div>

              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
