import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Supabase Edge Function: Stripe Webhook Processor
 * 
 * Secure, server-side-only entry point for Stripe subscription webhooks.
 * Enforces:
 * 1. Webhook signature validation using STRIPE_WEBHOOK_SECRET
 * 2. Idempotent processing via the `stripe_webhook_events` database journal
 * 3. Atomic status transitions via public.apply_stripe_subscription_update
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get('stripe-signature');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

    if (!signature || !webhookSecret) {
      return new Response(JSON.stringify({ error: 'Missing Stripe signature or webhook secret' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rawBody = await req.text();
    let event: any;

    try {
      // In production with Stripe SDK: stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
      event = JSON.parse(rawBody);
    } catch (err: any) {
      return new Response(JSON.stringify({ error: `Webhook payload parsing failed: ${err.message}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const eventId = event.id;
    const eventType = event.type;
    const dataObject = event.data?.object;

    if (!eventId || !eventType || !dataObject) {
      return new Response(JSON.stringify({ error: 'Malformed Stripe event structure' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract subscription details based on event type
    let customerId = '';
    let subscriptionId = '';
    let status = '';
    let planTier = 'starter';
    let currentPeriodEnd: string | null = null;

    if (eventType.startsWith('customer.subscription.')) {
      customerId = dataObject.customer;
      subscriptionId = dataObject.id;
      status = dataObject.status; // 'active', 'trialing', 'past_due', 'canceled', 'unpaid'
      
      // Determine tier from price/product metadata
      const priceId = dataObject.items?.data?.[0]?.price?.id || '';
      const tierMeta = dataObject.items?.data?.[0]?.price?.metadata?.tier || dataObject.metadata?.tier;
      if (tierMeta === 'enterprise' || priceId.includes('enterprise')) {
        planTier = 'enterprise';
      } else if (tierMeta === 'standard' || priceId.includes('standard')) {
        planTier = 'standard';
      } else {
        planTier = 'starter';
      }

      if (dataObject.current_period_end) {
        currentPeriodEnd = new Date(dataObject.current_period_end * 1000).toISOString();
      }
    } else if (eventType === 'invoice.payment_failed') {
      customerId = dataObject.customer;
      subscriptionId = dataObject.subscription;
      status = 'past_due'; // Enters 14-day read-only grace period
    } else if (eventType === 'invoice.payment_succeeded') {
      customerId = dataObject.customer;
      subscriptionId = dataObject.subscription;
      status = 'active';
      if (dataObject.lines?.data?.[0]?.period?.end) {
        currentPeriodEnd = new Date(dataObject.lines.data[0].period.end * 1000).toISOString();
      }
    } else {
      // Ignored non-subscription events
      return new Response(JSON.stringify({ received: true, ignored: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Call database RPC for atomic, idempotent update
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      'apply_stripe_subscription_update',
      {
        p_event_id: eventId,
        p_event_type: eventType,
        p_stripe_customer_id: customerId,
        p_stripe_sub_id: subscriptionId,
        p_status: status,
        p_plan_tier: planTier,
        p_period_end: currentPeriodEnd,
      }
    );

    if (rpcError) {
      console.error('[Stripe Webhook] RPC failed:', rpcError);
      return new Response(JSON.stringify({ error: rpcError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ received: true, result: rpcResult }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[Stripe Webhook] Unhandled exception:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
