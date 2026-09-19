import React, { useState } from 'react';
import { 
  Sparkles, 
  Clock, 
  ArrowRight, 
  AlertCircle, 
  X, 
  ShieldCheck,
  CreditCard 
} from 'lucide-react';
import { TenantOrganization, PlanTier } from '../data/auth';
import { SUBSCRIPTION_PLANS, formatPlanPrice } from '../services/billingService';

interface TrialCountdownBannerProps {
  organization?: TenantOrganization | null;
  onUpgradeClick: () => void;
}

export const TrialCountdownBanner: React.FC<TrialCountdownBannerProps> = ({
  organization,
  onUpgradeClick
}) => {
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    try {
      const stored = sessionStorage.getItem('frostly_trial_banner_dismissed');
      return stored === 'true';
    } catch {
      return false;
    }
  });

  // Calculate days remaining in evaluation trial
  let daysRemaining = 14;
  let isTrial = true;
  let isExpired = false;

  if (organization) {
    if (organization.subscription_status === 'trial') {
      isTrial = true;
      const trialEndTime = new Date(organization.trial_ends_at).getTime();
      const now = Date.now();
      const diffMs = trialEndTime - now;
      daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      isExpired = daysRemaining <= 0;
    } else {
      // If organization has active, past_due, canceled, or suspended status,
      // trial banner is not shown (they have past_due or lockout banners if needed)
      return null;
    }
  }

  // If dismissed and not expired, respect temporary session dismissal
  if (isDismissed && !isExpired) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      sessionStorage.setItem('frostly_trial_banner_dismissed', 'true');
    } catch {}
  };

  const planTier: PlanTier = organization?.plan_tier || 'starter';
  const planDetails = SUBSCRIPTION_PLANS[planTier] || SUBSCRIPTION_PLANS.starter;

  return (
    <div
      id="trial-countdown-banner"
      role="banner"
      aria-label="Evaluation trial status"
      className="bg-slate-900 text-white border-b border-slate-800 relative z-30 transition-all shadow-xs"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          {/* Left info & count */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0">
              <Clock className="w-3.5 h-3.5" />
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="font-bold tracking-tight text-white flex items-center gap-1.5">
                <span>Free Trial Active:</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-black bg-white text-slate-950 font-mono-code shadow-2xs">
                  {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left
                </span>
              </span>

              <span className="text-slate-300 hidden md:inline">
                • You have full access to HACCP traceability, POS registers, and inventory ledger.
              </span>
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button
              id="trial-upgrade-action-btn"
              type="button"
              onClick={onUpgradeClick}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-950 text-xs font-bold transition-all shadow-2xs cursor-pointer"
            >
              <CreditCard className="w-3.5 h-3.5 text-slate-800" />
              <span>Upgrade Plan</span>
              <ArrowRight className="w-3 h-3 text-slate-500" />
            </button>

            {!isExpired && (
              <button
                id="trial-banner-dismiss-btn"
                type="button"
                onClick={handleDismiss}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="Dismiss trial notice"
                aria-label="Dismiss trial notice"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
