/**
 * Stripe Webhook Processing Service
 * 
 * Handles incoming Stripe lifecycle events (subscriptions, payments, cancellations)
 * and dispatches them to the database RPC `public.apply_stripe_subscription_update`
 * to guarantee server-enforced, idempotent license status updates.
 */

export type PlanTier = 'starter' | 'standard' | 'enterprise';
export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'canceled' | 'suspended';

export interface StripeEvent<T = any> {
  id: string; // evt_xxx
  type: string;
  data: {
    object: T;
  };
}

export interface WebhookProcessingResult {
  success: boolean;
  status: 'already_processed' | 'updated' | 'ignored_unknown_customer' | 'ignored_event_type' | 'error';
  eventId: string;
  organizationId?: string;
  subscriptionStatus?: SubscriptionStatus;
  planTier?: PlanTier;
  maxStaffSeats?: number;
  error?: string;
}

/**
 * Normalizes a Stripe event into database parameters
 */
export function extractSubscriptionParamsFromEvent(event: StripeEvent): {
  customerId: string;
  subscriptionId: string;
  status: string;
  planTier: PlanTier;
  periodEnd: string | null;
} | null {
  const eventType = event.type;
  const obj = event.data?.object;

  if (!obj) return null;

  let customerId = '';
  let subscriptionId = '';
  let status = '';
  let planTier: PlanTier = 'starter';
  let periodEnd: string | null = null;

  if (eventType.startsWith('customer.subscription.')) {
    customerId = obj.customer || '';
    subscriptionId = obj.id || '';
    status = obj.status || '';

    const tierMeta = obj.items?.data?.[0]?.price?.metadata?.tier || obj.metadata?.tier || '';
    const priceId = obj.items?.data?.[0]?.price?.id || '';

    if (tierMeta === 'enterprise' || priceId.includes('enterprise')) {
      planTier = 'enterprise';
    } else if (tierMeta === 'standard' || priceId.includes('standard')) {
      planTier = 'standard';
    } else {
      planTier = 'starter';
    }

    if (obj.current_period_end) {
      periodEnd = new Date(obj.current_period_end * 1000).toISOString();
    }
  } else if (eventType === 'invoice.payment_failed') {
    customerId = obj.customer || '';
    subscriptionId = obj.subscription || '';
    status = 'past_due'; // 14-day read-only grace period
  } else if (eventType === 'invoice.payment_succeeded') {
    customerId = obj.customer || '';
    subscriptionId = obj.subscription || '';
    status = 'active';
    if (obj.lines?.data?.[0]?.period?.end) {
      periodEnd = new Date(obj.lines.data[0].period.end * 1000).toISOString();
    }
  } else {
    return null;
  }

  return { customerId, subscriptionId, status, planTier, periodEnd };
}
