import React, { useState, useEffect } from 'react';
import { Check, Sparkles, HelpCircle, ArrowRight } from 'lucide-react';
import { 
  PlatformPricingPlan, 
  fetchPublicPricingPlans, 
  DEFAULT_PRICING_PLANS 
} from '../../services/platformPricingService';

interface LandingPricingProps {
  onSelectPlan: (planName: string) => void;
}

export const LandingPricing: React.FC<LandingPricingProps> = ({ onSelectPlan }) => {
  const [annualBilling, setAnnualBilling] = useState(true);
  const [currency, setCurrency] = useState<'USD' | 'GHS'>('USD');
  const [plans, setPlans] = useState<PlatformPricingPlan[]>(DEFAULT_PRICING_PLANS);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    fetchPublicPricingPlans().then((loaded) => {
      if (isMounted && loaded && loaded.length > 0) {
        setPlans(loaded);
        setIsLoading(false);
      }
    }).catch(() => {
      if (isMounted) setIsLoading(false);
    });

    const handlePricingUpdated = () => {
      fetchPublicPricingPlans().then((loaded) => {
        if (isMounted && loaded && loaded.length > 0) {
          setPlans(loaded);
        }
      });
    };

    window.addEventListener('frostly-pricing-updated', handlePricingUpdated);
    return () => {
      isMounted = false;
      window.removeEventListener('frostly-pricing-updated', handlePricingUpdated);
    };
  }, []);

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

          {/* Controls: Billing Interval & Currency Switcher */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {/* Monthly / Annual Toggle */}
            <div className="inline-flex items-center gap-2 bg-white p-1 rounded-full border border-slate-200 shadow-xs">
              <button
                id="btn-pricing-monthly"
                type="button"
                onClick={() => setAnnualBilling(false)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  !annualBilling ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Monthly Billing
              </button>
              <button
                id="btn-pricing-annual"
                type="button"
                onClick={() => setAnnualBilling(true)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  annualBilling ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Annual Billing</span>
                <span className="bg-emerald-400 text-slate-950 text-[10px] font-extrabold px-1.5 py-0.2 rounded-full">
                  Save 20%
                </span>
              </button>
            </div>

            {/* Currency selector */}
            <div className="inline-flex items-center gap-1 bg-white p-1 rounded-full border border-slate-200 shadow-xs text-xs">
              <button
                id="btn-currency-usd"
                type="button"
                onClick={() => setCurrency('USD')}
                className={`px-3 py-1.5 rounded-full font-bold transition-all cursor-pointer ${
                  currency === 'USD' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                USD ($)
              </button>
              <button
                id="btn-currency-ghs"
                type="button"
                onClick={() => setCurrency('GHS')}
                className={`px-3 py-1.5 rounded-full font-bold transition-all cursor-pointer ${
                  currency === 'GHS' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                MoMo (GH₵)
              </button>
            </div>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="mt-14 grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {plans.map((tier) => {
            const rawPrice = annualBilling 
              ? (currency === 'GHS' ? tier.annual_price_ghs : tier.annual_price_usd)
              : (currency === 'GHS' ? tier.monthly_price_ghs : tier.monthly_price_usd);
            const symbol = currency === 'GHS' ? 'GH₵ ' : '$';

            return (
              <div
                key={tier.id}
                id={`card-pricing-tier-${tier.id}`}
                className={`rounded-2xl p-8 flex flex-col justify-between text-left transition-all duration-200 ${
                  tier.is_popular
                    ? 'bg-white border-2 border-blue-600 shadow-xl relative scale-100 lg:-translate-y-2'
                    : 'bg-white border border-slate-200 shadow-sm hover:shadow-md'
                }`}
              >
                {tier.is_popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[11px] font-bold uppercase tracking-wider px-3.5 py-1 rounded-full shadow-sm">
                    {tier.badge || 'Most Popular'}
                  </div>
                )}

                <div>
                  <h3 className="text-xl font-bold text-slate-900">{tier.tier_name}</h3>
                  <p className="mt-2 text-xs sm:text-sm text-slate-500 leading-relaxed min-h-[36px]">
                    {tier.tagline}
                  </p>

                  {/* Price display */}
                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight">
                      {symbol}{rawPrice.toLocaleString()}
                    </span>
                    <span className="text-sm font-medium text-slate-500">
                      / month {annualBilling && <span className="text-xs text-blue-600 font-semibold">(billed annually)</span>}
                    </span>
                  </div>

                  <div className="mt-2 text-xs text-slate-400 font-medium">
                    Seat limit: <span className="text-slate-700 font-semibold">{tier.max_staff_seats >= 9999 ? 'Unlimited seats' : `Up to ${tier.max_staff_seats} staff seats`}</span>
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
                    id={`btn-select-plan-${tier.id}`}
                    type="button"
                    onClick={() => onSelectPlan(tier.tier_name)}
                    className={`w-full py-3 px-4 rounded-lg font-semibold text-sm transition-all active:scale-[0.98] cursor-pointer ${
                      tier.button_style || 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {tier.button_text || 'Start 14-Day Free Trial'}
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
