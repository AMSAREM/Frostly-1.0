// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This code runs on Supabase Edge Functions (Deno runtime)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

/**
 * Computes HMAC-SHA512 using Web Crypto API in Deno
 */
async function verifyHmacSha512(rawBody: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  );

  const signatureBytes = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    encoder.encode(rawBody)
  );

  const hashHex = Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return hashHex.toLowerCase() === signature.toLowerCase();
}

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const signature = req.headers.get('x-paystack-signature');
    const rawBody = await req.text();

    if (!signature) {
      return new Response(JSON.stringify({ error: 'Missing x-paystack-signature header' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify signature with Paystack secret key if configured
    if (PAYSTACK_SECRET_KEY) {
      const isValid = await verifyHmacSha512(rawBody, signature, PAYSTACK_SECRET_KEY);
      if (!isValid) {
        return new Response(JSON.stringify({ error: 'Invalid webhook signature' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    const payload = JSON.parse(rawBody);
    const { event, data } = payload;

    if (!event || !data) {
      return new Response(JSON.stringify({ received: true, ignored: 'empty payload' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const eventId = String(data.reference || data.id || `${event}_${Date.now()}`);
    const customerCode = data.customer?.customer_code || '';
    const subscriptionCode = data.subscription_code || data.reference;
    const periodEnd = data.next_payment_date ? new Date(data.next_payment_date).toISOString() : null;

    let targetStatus = 'active';
    if (event === 'invoice.payment_failed') {
      targetStatus = 'attention'; // triggers past_due grace period in DB
    } else if (event === 'subscription.disable' || event === 'subscription.not_renew') {
      targetStatus = 'disabled'; // triggers suspended
    }

    let planTier = 'starter';
    const planIdentifier = (data.plan?.plan_code || data.plan?.name || data.metadata?.plan_tier || '').toLowerCase();
    if (planIdentifier.includes('enterprise') || planIdentifier.includes('ent')) {
      planTier = 'enterprise';
    } else if (planIdentifier.includes('standard') || planIdentifier.includes('std')) {
      planTier = 'standard';
    }

    // Initialize Supabase Admin Client
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Call PostgreSQL idempotent synchronization RPC
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc(
      'apply_paystack_subscription_update',
      {
        p_event_id: eventId,
        p_event_type: event,
        p_customer_code: customerCode,
        p_subscription_code: subscriptionCode,
        p_status: targetStatus,
        p_plan_tier: planTier,
        p_period_end: periodEnd,
      }
    );

    if (rpcError) {
      console.error('[Paystack Webhook] RPC execution error:', rpcError);
      return new Response(JSON.stringify({ error: rpcError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        received: true,
        event,
        result: rpcResult,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    console.error('[Paystack Webhook] Internal server error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
