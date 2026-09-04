import { PlanTier, TenantOrganization } from '../data/auth';
import { supabase, isSupabaseConfigured } from '../utils/supabase';

export type BillingGateway = 'paystack' | 'stripe';
export type BillingCurrency = 'GHS' | 'USD';

export interface PlanDetails {
  id: PlanTier;
  name: string;
  priceMonthlyUSD: number;
  priceMonthlyGHS: number;
  maxStaffSeats: number;
  description: string;
  features: string[];
  stripePriceId: string;
  paystackPlanCode: string;
  isPopular?: boolean;
}

export const SUBSCRIPTION_PLANS: Record<PlanTier, PlanDetails> = {
  starter: {
    id: 'starter',
    name: 'Starter Wharf',
    priceMonthlyUSD: 99,
    priceMonthlyGHS: 1200,
    maxStaffSeats: 5,
    description: 'Essential cold-chain compliance and traceability for artisanal docks and single-facility docks.',
    features: [
      'Up to 5 active staff seats',
      'End-to-end HACCP temperature logging',
      'Batch traceability & QR passport generation',
      'Offline-first PWA sync queue',
      'Mobile Money (MTN / Telecel / AT) & Card support',
      'Standard email support',
    ],
    stripePriceId: 'price_starter_monthly',
    paystackPlanCode: 'PLN_frostly_starter_ghs',
  },
  standard: {
    id: 'standard',
    name: 'Standard Processing',
    priceMonthlyUSD: 299,
    priceMonthlyGHS: 3800,
    maxStaffSeats: 20,
    description: 'Designed for commercial seafood processors, export packhouses, and multi-vessel fleet operations.',
    features: [
      'Up to 20 active staff seats',
      'IoT reefer telemetry & live sensor alerts',
      'Automated catch-weight invoice generator',
      'Wholesale & retail split-channel accounting',
      'Full regulatory compliance audit logs',
      'Automated recurring Mobile Money debits',
      'Priority support (24/7 during harvest season)',
    ],
    stripePriceId: 'price_standard_monthly',
    paystackPlanCode: 'PLN_frostly_standard_ghs',
    isPopular: true,
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise Cold-Chain',
    priceMonthlyUSD: 799,
    priceMonthlyGHS: 9900,
    maxStaffSeats: 9999,
    description: 'Mission-critical cold chain ERP for multi-facility operations, multinational exporters, and industrial fleets.',
    features: [
      'Unlimited staff seats',
      'Multi-tenant custom facility partition',
      'Custom ERP API & automated ledger webhooks',
      'EU & US-FDA pre-inspection validation reports',
      'Dedicated logistics account manager',
      '99.99% SLA guarantee',
    ],
    stripePriceId: 'price_enterprise_monthly',
    paystackPlanCode: 'PLN_frostly_enterprise_ghs',
  },
};

export interface SubscriptionDisplayInfo {
  tierName: string;
  badgeLabel: string;
  badgeVariant: 'success' | 'warning' | 'danger' | 'info';
  statusDescription: string;
  canWrite: boolean;
  isPastDue: boolean;
  isSuspended: boolean;
  daysRemaining?: number;
}

/**
 * Format plan price based on chosen currency
 */
export function formatPlanPrice(plan: PlanDetails, currency: BillingCurrency): string {
  if (currency === 'GHS') {
    return `GH₵ ${plan.priceMonthlyGHS.toLocaleString()}`;
  }
  return `$${plan.priceMonthlyUSD.toLocaleString()}`;
}

/**
 * Derives human-friendly UI state from the tenant's organization subscription record
 */
export function getSubscriptionDisplayInfo(org?: TenantOrganization | null): SubscriptionDisplayInfo {
  if (!org) {
    return {
      tierName: 'Starter (Trial)',
      badgeLabel: 'Trial',
      badgeVariant: 'info',
      statusDescription: '14-day evaluation trial',
      canWrite: true,
      isPastDue: false,
      isSuspended: false,
    };
  }

  const plan = SUBSCRIPTION_PLANS[org.plan_tier] || SUBSCRIPTION_PLANS.starter;

  if (org.subscription_status === 'trial') {
    const trialEnd = new Date(org.trial_ends_at).getTime();
    const now = Date.now();
    const diffDays = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return {
        tierName: plan.name,
        badgeLabel: 'Trial Expired',
        badgeVariant: 'danger',
        statusDescription: 'Your 14-day evaluation has concluded. Please activate a plan to restore write access.',
        canWrite: false,
        isPastDue: false,
        isSuspended: true,
        daysRemaining: 0,
      };
    }

    return {
      tierName: plan.name,
      badgeLabel: `Trial (${diffDays}d left)`,
      badgeVariant: 'info',
      statusDescription: `Full access to ${plan.name} features during the 14-day trial period.`,
      canWrite: true,
      isPastDue: false,
      isSuspended: false,
      daysRemaining: diffDays,
    };
  }

  if (org.subscription_status === 'active') {
    return {
      tierName: plan.name,
      badgeLabel: 'Active',
      badgeVariant: 'success',
      statusDescription: `Active ${plan.name} plan with up to ${org.max_staff_seats} staff seats.`,
      canWrite: true,
      isPastDue: false,
      isSuspended: false,
    };
  }

  if (org.subscription_status === 'past_due') {
    return {
      tierName: plan.name,
      badgeLabel: 'Past Due (Grace Period)',
      badgeVariant: 'warning',
      statusDescription:
        'Subscription payment is past due. 14-day read-only audit grace period is active for HACCP inspections. Write mutations are paused.',
      canWrite: false,
      isPastDue: true,
      isSuspended: false,
    };
  }

  return {
    tierName: plan.name,
    badgeLabel: 'Suspended',
    badgeVariant: 'danger',
    statusDescription: 'Account is suspended. Update your payment method to restore access.',
    canWrite: false,
    isPastDue: false,
    isSuspended: true,
  };
}

/**
 * Paystack Checkout Flow (GHS - Mobile Money & Card)
 * Supports MTN MoMo, Telecel Cash, AT Money, and Visa/Mastercard
 */
export async function redirectToPaystackCheckout(
  tier: PlanTier,
  orgId: string,
  userEmail: string
): Promise<{ success: boolean; redirectUrl?: string; reference?: string; error?: string }> {
  try {
    const plan = SUBSCRIPTION_PLANS[tier];
    if (!plan) {
      return { success: false, error: 'Invalid plan selected.' };
    }

    const reference = `fst_${tier}_${Date.now()}`;

    // Invoke backend Edge Function if configured
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.functions.invoke('paystack-initialize', {
        body: {
          email: userEmail,
          amount: plan.priceMonthlyGHS * 100, // in pesewas
          plan: plan.paystackPlanCode,
          currency: 'GHS',
          reference,
          metadata: {
            organization_id: orgId,
            plan_tier: tier,
            platform: 'frostly_erp',
          },
          channels: ['card', 'mobile_money'],
          callback_url: `${window.location.origin}/?tab=settings&billing=paystack_success`,
        },
      });

      if (!error && data?.data?.authorization_url) {
        window.location.href = data.data.authorization_url;
        return {
          success: true,
          redirectUrl: data.data.authorization_url,
          reference: data.data.reference,
        };
      }
    }

    // Sandbox / Test Mode Preview
    console.info(
      `[Paystack Billing] Initialized test payment for ${plan.name} (${tier}) - GH₵ ${plan.priceMonthlyGHS} for ${userEmail}. Reference: ${reference}`
    );

    return {
      success: true,
      reference,
      redirectUrl: `https://checkout.paystack.com/sandbox_pay_${tier}`,
    };
  } catch (err: any) {
    console.error('[Billing] Error launching Paystack checkout:', err);
    return { success: false, error: err.message || 'Unable to connect to Paystack payment gateway.' };
  }
}

/**
 * Client-Side Stripe Checkout Flow (USD - Credit/Debit Card)
 * Initiates checkout for international customers
 */
export async function redirectToStripeCheckout(
  tier: PlanTier,
  orgId: string,
  userEmail: string
): Promise<{ success: boolean; redirectUrl?: string; error?: string }> {
  try {
    const plan = SUBSCRIPTION_PLANS[tier];
    if (!plan) {
      return { success: false, error: 'Invalid plan selected.' };
    }

    // Call Supabase Edge Function or custom API if available
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.functions.invoke('stripe-checkout', {
        body: {
          priceId: plan.stripePriceId,
          tier: tier,
          organizationId: orgId,
          customerEmail: userEmail,
          returnUrl: `${window.location.origin}/?tab=settings&billing=stripe_success`,
        },
      });

      if (!error && data?.url) {
        window.location.href = data.url;
        return { success: true, redirectUrl: data.url };
      }
    }

    console.info(`[Billing] Stripe checkout initiated for ${plan.name} (${tier}) by ${userEmail}`);
    return {
      success: true,
      redirectUrl: `https://checkout.stripe.com/c/pay/cs_test_simulated_${tier}`,
    };
  } catch (err: any) {
    console.error('[Billing] Error launching Stripe checkout:', err);
    return { success: false, error: err.message || 'Unable to connect to Stripe payment gateway.' };
  }
}

/**
 * Customer Billing Portal Flow
 * Self-serve management for payment methods, tax invoices, and receipts
 */
export async function redirectToCustomerPortal(
  customerId?: string,
  provider: BillingGateway = 'paystack'
): Promise<{ success: boolean; redirectUrl?: string; error?: string }> {
  try {
    if (provider === 'paystack') {
      // Paystack customer portal or subscription manage link
      return {
        success: true,
        redirectUrl: 'https://paystack.com/manage-subscriptions',
      };
    }

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.functions.invoke('stripe-portal', {
        body: {
          customerId,
          returnUrl: `${window.location.origin}/?tab=settings`,
        },
      });

      if (!error && data?.url) {
        window.location.href = data.url;
        return { success: true, redirectUrl: data.url };
      }
    }

    console.info('[Billing] Stripe Customer Portal requested for customer:', customerId);
    return {
      success: true,
      redirectUrl: 'https://billing.stripe.com/p/session/test_portal_session',
    };
  } catch (err: any) {
    console.error('[Billing] Error launching customer portal:', err);
    return { success: false, error: err.message || 'Unable to connect to billing portal.' };
  }
}
