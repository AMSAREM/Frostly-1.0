import React, { useState } from 'react';
import { 
  CreditCard, 
  ShieldAlert, 
  Check, 
  ExternalLink, 
  Users, 
  Sparkles, 
  ArrowRight,
  Clock,
  Lock,
  RefreshCw,
  Building,
  Smartphone,
  Globe,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Ban,
  X,
  AlertOctagon
} from 'lucide-react';
import { StaffProfile, PlanTier, signOut } from '../data/auth';
import { 
  SUBSCRIPTION_PLANS, 
  BillingGateway,
  BillingCurrency,
  formatPlanPrice,
  getSubscriptionDisplayInfo, 
  redirectToPaystackCheckout,
  redirectToStripeCheckout, 
  redirectToCustomerPortal 
} from '../services/billingService';
import { 
  revokePlatformOrganization, 
  deletePlatformOrganization 
} from '../services/platformAdminService';

interface SubscriptionBillingPanelProps {
  staffProfile: StaffProfile | null;
  onRefreshProfile?: () => Promise<void>;
}

export const SubscriptionBillingPanel: React.FC<SubscriptionBillingPanelProps> = ({
  staffProfile,
  onRefreshProfile
}) => {
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedGateway, setSelectedGateway] = useState<BillingGateway>('paystack');
  const [selectedCurrency, setSelectedCurrency] = useState<BillingCurrency>('GHS');

  // Danger Zone Modals State
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [deactivateReason, setDeactivateReason] = useState('');
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [dangerError, setDangerError] = useState<string | null>(null);

  const org = staffProfile?.organization;
  const displayInfo = getSubscriptionDisplayInfo(org);
  const currentTier: PlanTier = org?.plan_tier || 'starter';
  const maxSeats = org?.max_staff_seats || 5;

  // Assume admin if not specified or role is admin
  const isAdmin = staffProfile?.role === 'admin';

  const handleGatewayChange = (gateway: BillingGateway) => {
    setSelectedGateway(gateway);
    setSelectedCurrency(gateway === 'paystack' ? 'GHS' : 'USD');
    setFeedbackMessage(null);
  };

  const handleSelectPlan = async (tier: PlanTier) => {
    if (!isAdmin) {
      setFeedbackMessage({
        type: 'error',
        text: 'Only organization administrators can upgrade or modify subscription tiers.'
      });
      return;
    }

    if (tier === currentTier && org?.subscription_status === 'active') {
      return;
    }

    setIsProcessing(tier);
    setFeedbackMessage(null);

    if (selectedGateway === 'paystack') {
      const res = await redirectToPaystackCheckout(
        tier,
        staffProfile?.organization_id || '',
        staffProfile?.email || ''
      );

      setIsProcessing(null);
      if (!res.success) {
        setFeedbackMessage({ type: 'error', text: res.error || 'Failed to initiate Paystack checkout.' });
      } else {
        setFeedbackMessage({
          type: 'success',
          text: `Paystack sandbox checkout initiated for ${SUBSCRIPTION_PLANS[tier].name} (${formatPlanPrice(SUBSCRIPTION_PLANS[tier], 'GHS')}). Ready for test Mobile Money & Card debits.`
        });
      }
    } else {
      const res = await redirectToStripeCheckout(
        tier,
        staffProfile?.organization_id || '',
        staffProfile?.email || ''
      );

      setIsProcessing(null);
      if (!res.success) {
        setFeedbackMessage({ type: 'error', text: res.error || 'Failed to initiate Stripe checkout.' });
      } else {
        setFeedbackMessage({
          type: 'success',
          text: `Stripe checkout initiated for ${SUBSCRIPTION_PLANS[tier].name} (${formatPlanPrice(SUBSCRIPTION_PLANS[tier], 'USD')}). In live production, Stripe webhooks update your seat limit automatically.`
        });
      }
    }
  };

  const handleOpenPortal = async () => {
    setIsProcessing('portal');
    setFeedbackMessage(null);

    const res = await redirectToCustomerPortal(undefined, selectedGateway);
    setIsProcessing(null);

    if (!res.success) {
      setFeedbackMessage({ type: 'error', text: res.error || 'Failed to open billing portal.' });
    } else {
      setFeedbackMessage({
        type: 'success',
        text: `Redirecting to ${selectedGateway === 'paystack' ? 'Paystack' : 'Stripe'} customer portal to manage payment methods and download tax invoices.`
      });
    }
  };

  const handleConfirmDeactivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org?.id) return;

    if (!deactivateReason.trim()) {
      setDangerError('A mandatory reason is required to deactivate company operations.');
      return;
    }

    setIsDeactivating(true);
    setDangerError(null);

    try {
      await revokePlatformOrganization(org.id, deactivateReason.trim());
      setShowDeactivateModal(false);
      setFeedbackMessage({
        type: 'success',
        text: `Organization ${org.name} operations have been suspended.`
      });
      if (onRefreshProfile) {
        await onRefreshProfile();
      }
    } catch (err: any) {
      setDangerError(err.message || 'Failed to suspend company operations');
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleConfirmDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org?.id) return;

    if (deleteConfirmName.trim().toLowerCase() !== org.name.trim().toLowerCase()) {
      setDangerError(`Please type "${org.name}" exactly to confirm deletion.`);
      return;
    }

    if (!deleteReason.trim()) {
      setDangerError('A mandatory reason is required to permanently delete the company.');
      return;
    }

    setIsDeleting(true);
    setDangerError(null);

    try {
      await deletePlatformOrganization(org.id, deleteReason.trim(), deleteConfirmName.trim());
      setShowDeleteModal(false);
      // Automatically log out since this company no longer exists
      await signOut();
      window.location.reload();
    } catch (err: any) {
      setDangerError(err.message || 'Failed to delete company');
      setIsDeleting(false);
    }
  };

  return (
    <div id="subscription-billing-panel" className="space-y-6">
      {/* 1. Grace Period / Lockout Warning Banner */}
      {displayInfo.isPastDue && (
        <div id="past-due-grace-banner" className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg shrink-0 mt-0.5">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-amber-200 uppercase tracking-wide">
                HACCP Audit Grace Period Active
              </h4>
              <p className="text-xs text-amber-300/80 mt-1 max-w-2xl leading-relaxed">
                Your payment is past due. In accordance with cold-chain food safety compliance, full read-only access to all inventory, HACCP temperature records, and customer balances remains available. Write operations are temporarily paused.
              </p>
            </div>
          </div>
          <button
            id="resolve-billing-btn"
            onClick={handleOpenPortal}
            disabled={isProcessing === 'portal'}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg shadow-sm whitespace-nowrap transition-colors flex items-center gap-1.5 shrink-0"
          >
            <CreditCard className="w-4 h-4" />
            Resolve Payment Now
          </button>
        </div>
      )}

      {displayInfo.isSuspended && (
        <div id="suspended-lockout-banner" className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2 bg-rose-500/20 text-rose-400 rounded-lg shrink-0 mt-0.5">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-rose-200 uppercase tracking-wide">
                Subscription Suspended
              </h4>
              <p className="text-xs text-rose-300/80 mt-1 max-w-2xl leading-relaxed">
                Your organization's evaluation period has expired or subscription has been suspended. Please activate a subscription tier to restore staff access.
              </p>
            </div>
          </div>
          <button
            id="reactivate-subscription-btn"
            onClick={() => handleSelectPlan('standard')}
            disabled={isProcessing !== null}
            className="px-4 py-2 bg-rose-500 hover:bg-rose-400 text-white text-xs font-semibold rounded-lg shadow-sm whitespace-nowrap transition-colors flex items-center gap-1.5 shrink-0"
          >
            <Sparkles className="w-4 h-4" />
            Reactivate Organization
          </button>
        </div>
      )}

      {/* 2. Current Organization Licensing Card */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-lg">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-white">
                  {staffProfile?.organization_name || 'Organization Workspace'}
                </h3>
                <span
                  id="subscription-status-badge"
                  className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium tracking-wide ${
                    displayInfo.badgeVariant === 'success'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : displayInfo.badgeVariant === 'warning'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      : displayInfo.badgeVariant === 'danger'
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                  }`}
                >
                  {displayInfo.badgeLabel}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Current Tier: <span className="text-slate-200 font-medium">{displayInfo.tierName}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onRefreshProfile && (
              <button
                id="refresh-subscription-btn"
                onClick={async () => {
                  setIsProcessing('refresh');
                  await onRefreshProfile();
                  setIsProcessing(null);
                }}
                disabled={isProcessing === 'refresh'}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5"
                title="Sync latest subscription status"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isProcessing === 'refresh' ? 'animate-spin' : ''}`} />
                Sync Status
              </button>
            )}

            <button
              id="customer-portal-btn"
              onClick={handleOpenPortal}
              disabled={isProcessing === 'portal'}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-cyan-300 text-xs font-medium rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5"
            >
              <CreditCard className="w-3.5 h-3.5" />
              Manage Invoices
              <ExternalLink className="w-3 h-3 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Quota & Capacity Meter */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-5">
          <div>
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-500" />
                Staff Seat Capacity Ceiling
              </span>
              <span className="text-slate-300 font-mono font-medium">
                Up to {maxSeats >= 9999 ? 'Unlimited' : `${maxSeats} seats`}
              </span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-cyan-500 h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, (1 / maxSeats) * 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              Enforced at database level. Extra staff invites are rejected when limit is reached.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                Licensing Policy
              </span>
              <span className="text-emerald-400 font-medium">
                {displayInfo.canWrite ? 'Read + Write Permitted' : 'Read-Only Audit Mode'}
              </span>
            </div>
            <p className="text-xs text-slate-300 bg-slate-800/60 p-2.5 rounded-lg border border-slate-800 leading-relaxed">
              {displayInfo.statusDescription}
            </p>
          </div>
        </div>

        {feedbackMessage && (
          <div
            className={`mt-4 p-3 rounded-lg text-xs flex items-center gap-2 ${
              feedbackMessage.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
            }`}
          >
            <span>{feedbackMessage.text}</span>
          </div>
        )}
      </div>

      {/* 3. Gateway & Currency Switcher Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        <div>
          <h4 className="text-sm font-semibold text-white">Select Organization Subscription</h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Choose your preferred billing gateway. Test mode sandbox is enabled with no real money required.
          </p>
        </div>

        {/* Dual Gateway Tabs */}
        <div className="inline-flex p-1 bg-slate-900 border border-slate-800 rounded-xl">
          <button
            id="gateway-paystack-tab"
            type="button"
            onClick={() => handleGatewayChange('paystack')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              selectedGateway === 'paystack'
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>🇬🇭 Paystack (GHS / MoMo)</span>
          </button>
          <button
            id="gateway-stripe-tab"
            type="button"
            onClick={() => handleGatewayChange('stripe')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              selectedGateway === 'stripe'
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>🌐 Stripe (USD / Card)</span>
          </button>
        </div>
      </div>

      {/* Gateway Feature Badges Banner */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        {selectedGateway === 'paystack' ? (
          <>
            <div className="flex items-center gap-2 text-slate-300">
              <span className="font-semibold text-cyan-400">Supported Channels:</span>
              <span className="px-2 py-0.5 bg-yellow-500/10 text-yellow-300 rounded border border-yellow-500/20 text-[11px] font-medium">
                MTN Mobile Money
              </span>
              <span className="px-2 py-0.5 bg-red-500/10 text-red-300 rounded border border-red-500/20 text-[11px] font-medium">
                Telecel Cash
              </span>
              <span className="px-2 py-0.5 bg-blue-500/10 text-blue-300 rounded border border-blue-500/20 text-[11px] font-medium">
                AT Money
              </span>
              <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700 text-[11px]">
                Visa / Mastercard
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-400 font-mono text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Sandbox Test Mode Ready</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-slate-300">
              <span className="font-semibold text-cyan-400">Supported Channels:</span>
              <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700 text-[11px]">
                Visa
              </span>
              <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700 text-[11px]">
                Mastercard
              </span>
              <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700 text-[11px]">
                American Express
              </span>
              <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700 text-[11px]">
                Global USD ACH
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-400 font-mono text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Stripe Test Mode Ready</span>
            </div>
          </>
        )}
      </div>

      {/* 4. Tier Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {(Object.keys(SUBSCRIPTION_PLANS) as PlanTier[]).map((tierKey) => {
          const plan = SUBSCRIPTION_PLANS[tierKey];
          const isCurrent = currentTier === tierKey;
          const isSelected = isProcessing === tierKey;
          const formattedPrice = formatPlanPrice(plan, selectedCurrency);

          return (
            <div
              key={tierKey}
              id={`tier-card-${tierKey}`}
              className={`relative rounded-xl p-5 border flex flex-col justify-between transition-all ${
                isCurrent
                  ? 'bg-cyan-950/20 border-cyan-500/50 ring-1 ring-cyan-500/30 shadow-lg shadow-cyan-950/40'
                  : plan.isPopular
                  ? 'bg-slate-900/80 border-slate-700 hover:border-slate-600'
                  : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
              }`}
            >
              {plan.isPopular && !isCurrent && (
                <span className="absolute -top-2.5 right-4 bg-cyan-500 text-slate-950 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Recommended
                </span>
              )}
              {isCurrent && (
                <span className="absolute -top-2.5 right-4 bg-emerald-500 text-slate-950 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Current Plan
                </span>
              )}

              <div>
                <h5 className="text-base font-semibold text-white">{plan.name}</h5>
                <p className="text-xs text-slate-400 mt-1 min-h-[32px]">{plan.description}</p>

                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-white font-mono">{formattedPrice}</span>
                  <span className="text-xs text-slate-400 font-normal">/ month</span>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-2.5">
                  <div className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-cyan-400" />
                    <span>
                      Capacity: {plan.maxStaffSeats >= 9999 ? 'Unlimited Seats' : `Up to ${plan.maxStaffSeats} Seats`}
                    </span>
                  </div>
                  {plan.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-slate-400">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800/60">
                <button
                  id={`select-plan-${tierKey}-btn`}
                  onClick={() => handleSelectPlan(tierKey)}
                  disabled={isCurrent || isSelected}
                  className={`w-full py-2 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                    isCurrent
                      ? 'bg-slate-800 text-slate-400 cursor-default'
                      : plan.isPopular
                      ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-md shadow-cyan-500/20 cursor-pointer'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer'
                  }`}
                >
                  {isCurrent ? (
                    'Active Plan'
                  ) : isSelected ? (
                    `Connecting to ${selectedGateway === 'paystack' ? 'Paystack' : 'Stripe'}...`
                  ) : (
                    <>
                      {selectedGateway === 'paystack' ? `Pay with MoMo (${formattedPrice})` : `Upgrade via Stripe (${formattedPrice})`}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Danger Zone: Company Deactivation & Deletion */}
      {isAdmin && (
        <div id="company-danger-zone" className="mt-8 pt-6 border-t border-slate-800 space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <h4 className="text-xs font-bold text-rose-300 uppercase tracking-wider">
              Tenant Lifecycle &amp; Danger Zone
            </h4>
          </div>

          <div className="bg-rose-950/20 border border-rose-900/40 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h5 className="text-xs font-bold text-rose-200">
                Suspend Company Operations or Delete Tenant Account
              </h5>
              <p className="text-[11px] text-rose-300/70 max-w-xl leading-relaxed">
                As an organization administrator, you can voluntarily revoke and suspend operational access for your team, or permanently delete your company account and all associated cold-chain records.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                id="btn-open-deactivate-modal"
                onClick={() => {
                  setDeactivateReason('');
                  setDangerError(null);
                  setShowDeactivateModal(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-rose-300 border border-rose-900/50 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Suspend Operations</span>
              </button>

              <button
                type="button"
                id="btn-open-delete-company-modal"
                onClick={() => {
                  setDeleteConfirmName('');
                  setDeleteReason('');
                  setDangerError(null);
                  setShowDeleteModal(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md shadow-rose-950 cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Company</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DEACTIVATE / SUSPEND COMPANY */}
      {showDeactivateModal && org && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl max-w-md w-full overflow-hidden text-slate-100">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
                  <Ban className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Suspend Company Operations</h3>
                  <p className="text-[11px] text-slate-400">{org.name}</p>
                </div>
              </div>
              <button
                onClick={() => setShowDeactivateModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmDeactivate} className="p-5 space-y-4 text-xs">
              {dangerError && (
                <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200">
                  {dangerError}
                </div>
              )}

              <p className="text-slate-300 leading-relaxed">
                Suspending operations will place your company in <strong>Suspended</strong> status. Staff logins will be restricted from entering transactions or dispatching lots until your subscription is reactivated.
              </p>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  Reason for voluntary suspension <span className="text-rose-400">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="e.g. Seasonal fishing hiatus or temporary facility maintenance"
                  value={deactivateReason}
                  onChange={(e) => setDeactivateReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeactivateModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDeactivating || !deactivateReason.trim()}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer disabled:opacity-50"
                >
                  {isDeactivating ? 'Suspending...' : 'Confirm Suspension'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PERMANENTLY DELETE COMPANY */}
      {showDeleteModal && org && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-slate-900 rounded-3xl border border-rose-900/50 shadow-2xl max-w-md w-full overflow-hidden text-slate-100">
            <div className="p-5 border-b border-rose-900/40 bg-rose-950/30 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
                  <AlertOctagon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Permanently Delete Company</h3>
                  <p className="text-[11px] text-rose-300">{org.name}</p>
                </div>
              </div>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmDelete} className="p-5 space-y-4 text-xs">
              {dangerError && (
                <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200">
                  {dangerError}
                </div>
              )}

              <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-900/50 text-rose-200 text-[11px] space-y-1">
                <p className="font-bold">Warning: Irreversible Account Deprovisioning</p>
                <p className="text-rose-300/80">
                  Deleting your company account will permanently remove all organization settings, staff accounts, and pending invites. You will be signed out immediately.
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  Type <span className="text-rose-400 font-mono-code select-all">"{org.name}"</span> to confirm:
                </label>
                <input
                  type="text"
                  required
                  placeholder={org.name}
                  value={deleteConfirmName}
                  onChange={(e) => setDeleteConfirmName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-600 focus:outline-none focus:border-rose-500 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  Reason for deletion <span className="text-rose-400">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="e.g. Closing business or migrating away"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer font-semibold"
                >
                  Cancel
                </button>
                <button
                  id="btn-confirm-delete-own-company"
                  type="submit"
                  disabled={
                    isDeleting || 
                    !deleteReason.trim() || 
                    deleteConfirmName.trim().toLowerCase() !== org.name.trim().toLowerCase()
                  }
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer disabled:opacity-40"
                >
                  {isDeleting ? 'Deleting...' : 'Delete Company Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
