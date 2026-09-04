import crypto from 'crypto';
import { PlanTier } from '../data/auth';

export interface PaystackWebhookPayload {
  event: string;
  data: {
    id?: number | string;
    domain?: string;
    status?: string;
    reference?: string;
    amount?: number;
    currency?: string;
    channel?: string;
    customer?: {
      id?: number;
      customer_code?: string;
      email?: string;
    };
    plan?: {
      id?: number;
      name?: string;
      plan_code?: string;
      amount?: number;
      interval?: string;
    };
    subscription_code?: string;
    email_token?: string;
    next_payment_date?: string;
    metadata?: {
      organization_id?: string;
      plan_tier?: string;
      [key: string]: any;
    };
    [key: string]: any;
  };
}

export interface ProcessedPaystackEvent {
  eventId: string;
  eventType: string;
  customerCode: string;
  subscriptionCode?: string;
  status: 'active' | 'past_due' | 'suspended';
  planTier: PlanTier;
  periodEnd?: string;
  organizationId?: string;
}

/**
 * Validates the HMAC-SHA512 signature sent in the x-paystack-signature header
 */
export function verifyPaystackSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secretKey: string
): boolean {
  if (!signatureHeader || !secretKey) {
    return false;
  }

  const hash = crypto
    .createHmac('sha512', secretKey)
    .update(rawBody)
    .digest('hex');

  // Constant-time buffer comparison to prevent timing attacks
  try {
    const signatureBuffer = Buffer.from(signatureHeader, 'hex');
    const hashBuffer = Buffer.from(hash, 'hex');
    if (signatureBuffer.length !== hashBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(signatureBuffer, hashBuffer);
  } catch {
    return false;
  }
}

/**
 * Maps a Paystack Plan Code or name to internal Frostly PlanTier
 */
export function mapPaystackPlanToTier(planCodeOrName?: string, metadataTier?: string): PlanTier {
  if (metadataTier === 'enterprise' || metadataTier === 'standard' || metadataTier === 'starter') {
    return metadataTier;
  }

  const str = (planCodeOrName || '').toLowerCase();
  if (str.includes('enterprise') || str.includes('pln_frostly_ent')) {
    return 'enterprise';
  }
  if (str.includes('standard') || str.includes('pln_frostly_std')) {
    return 'standard';
  }
  return 'starter';
}

/**
 * Extracts normalized licensing state from a Paystack webhook event
 */
export function extractPaystackSubscriptionEvent(
  payload: PaystackWebhookPayload
): ProcessedPaystackEvent | null {
  const { event, data } = payload;
  if (!event || !data) return null;

  const eventId = String(data.reference || data.id || `${event}_${Date.now()}`);
  const customerCode = data.customer?.customer_code || '';
  const subscriptionCode = data.subscription_code || data.reference;
  const periodEnd = data.next_payment_date;
  const organizationId = data.metadata?.organization_id;

  const planTier = mapPaystackPlanToTier(
    data.plan?.plan_code || data.plan?.name,
    data.metadata?.plan_tier
  );

  switch (event) {
    case 'subscription.create':
    case 'charge.success':
      return {
        eventId,
        eventType: event,
        customerCode,
        subscriptionCode,
        status: 'active',
        planTier,
        periodEnd,
        organizationId,
      };

    case 'invoice.payment_failed':
      return {
        eventId,
        eventType: event,
        customerCode,
        subscriptionCode,
        status: 'past_due', // 14-day HACCP grace period
        planTier,
        periodEnd,
        organizationId,
      };

    case 'subscription.disable':
    case 'subscription.not_renew':
      return {
        eventId,
        eventType: event,
        customerCode,
        subscriptionCode,
        status: 'suspended',
        planTier,
        periodEnd,
        organizationId,
      };

    default:
      return null;
  }
}
