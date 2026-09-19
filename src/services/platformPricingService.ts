import { supabase, isSupabaseConfigured } from '../utils/supabase';

export interface PlatformPricingPlan {
  id: string; // 'starter' | 'standard' | 'enterprise'
  tier_name: string;
  tagline: string;
  monthly_price_usd: number;
  annual_price_usd: number;
  monthly_price_ghs: number;
  annual_price_ghs: number;
  max_staff_seats: number;
  is_popular: boolean;
  badge?: string | null;
  features: string[];
  button_text: string;
  button_style: string;
  sort_order: number;
  is_active: boolean;
  updated_at?: string;
}

export const DEFAULT_PRICING_PLANS: PlatformPricingPlan[] = [
  {
    id: 'starter',
    tier_name: 'Starter Fishery',
    tagline: 'Ideal for independent fishing vessels & single cold-room docks.',
    monthly_price_usd: 49,
    annual_price_usd: 39,
    monthly_price_ghs: 650,
    annual_price_ghs: 520,
    max_staff_seats: 5,
    is_popular: false,
    badge: null,
    features: [
      'Up to 2 fishing vessels or dock stations',
      'Catch Inward & Weighing with tare deduction',
      'Cold storage lot tracking with basic alerts',
      'Mobile PWA with offline logging',
      'Standard PDF invoices & receipts',
      'Email customer support'
    ],
    button_text: 'Start 14-Day Free Trial',
    button_style: 'bg-white text-slate-900 border border-slate-300 hover:bg-slate-50',
    sort_order: 1,
    is_active: true
  },
  {
    id: 'standard',
    tier_name: 'Commercial Fleet',
    tagline: 'For commercial seafood processors, wholesalers & fleet managers.',
    monthly_price_usd: 149,
    annual_price_usd: 119,
    monthly_price_ghs: 1950,
    annual_price_ghs: 1560,
    max_staff_seats: 20,
    is_popular: true,
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
    button_text: 'Start Commercial Trial',
    button_style: 'bg-blue-600 hover:bg-blue-700 text-white shadow-md',
    sort_order: 2,
    is_active: true
  },
  {
    id: 'enterprise',
    tier_name: 'Enterprise Processor',
    tagline: 'Custom infrastructure for multi-terminal processing plants & exporters.',
    monthly_price_usd: 399,
    annual_price_usd: 319,
    monthly_price_ghs: 5200,
    annual_price_ghs: 4160,
    max_staff_seats: 9999,
    is_popular: false,
    badge: null,
    features: [
      'Multi-facility & multi-port operational clustering',
      'Custom ERP / SAP / NetSuite API integrations',
      'Dedicated isolated database tenancy',
      'Custom hardware catch-weight scale driver protocols',
      'Custom HACCP hazard analysis workflows',
      'Dedicated Technical Account Manager',
      '99.99% uptime Service Level Agreement (SLA)'
    ],
    button_text: 'Contact Enterprise Sales',
    button_style: 'bg-slate-900 hover:bg-slate-800 text-white',
    sort_order: 3,
    is_active: true
  }
];

const STORAGE_CACHE_KEY = 'frostly_platform_pricing_plans_cache_v1';

/**
 * Fetch all active pricing plans from Supabase for public display on the landing page
 */
export async function fetchPublicPricingPlans(): Promise<PlatformPricingPlan[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('platform_pricing_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (!error && data && data.length > 0) {
        const mapped: PlatformPricingPlan[] = data.map((row: any) => ({
          id: row.id,
          tier_name: row.tier_name,
          tagline: row.tagline,
          monthly_price_usd: Number(row.monthly_price_usd),
          annual_price_usd: Number(row.annual_price_usd),
          monthly_price_ghs: Number(row.monthly_price_ghs || row.monthly_price_usd * 13),
          annual_price_ghs: Number(row.annual_price_ghs || row.annual_price_usd * 13),
          max_staff_seats: Number(row.max_staff_seats || 5),
          is_popular: Boolean(row.is_popular),
          badge: row.badge,
          features: Array.isArray(row.features) ? row.features : (typeof row.features === 'string' ? JSON.parse(row.features) : []),
          button_text: row.button_text || 'Start 14-Day Free Trial',
          button_style: row.button_style || 'bg-white text-slate-900 border border-slate-300 hover:bg-slate-50',
          sort_order: Number(row.sort_order || 0),
          is_active: Boolean(row.is_active),
          updated_at: row.updated_at
        }));

        try {
          localStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(mapped));
        } catch {
          // ignore quota error
        }

        return mapped;
      }
    } catch (err) {
      console.warn('[platformPricingService] Error fetching pricing plans from Supabase:', err);
    }
  }

  // Fallback to local cache if offline or error
  try {
    const cached = localStorage.getItem(STORAGE_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }

  return DEFAULT_PRICING_PLANS;
}

/**
 * Save or update a pricing plan from the Creator Console
 */
export async function savePlatformPricingPlan(
  plan: PlatformPricingPlan,
  reason: string = 'Updated via Creator Platform'
): Promise<{ success: boolean; plan: PlatformPricingPlan; error?: string }> {
  if (!isSupabaseConfigured) {
    // Update local cache for offline/dev operation
    updateLocalPlanCache(plan);
    dispatchPricingUpdatedEvent(plan);
    return { success: true, plan };
  }

  try {
    // Try RPC first for authoritative creator audit logging
    const { data: rpcData, error: rpcError } = await supabase.rpc('platform_save_pricing_plan', {
      p_id: plan.id,
      p_tier_name: plan.tier_name,
      p_tagline: plan.tagline,
      p_monthly_price_usd: plan.monthly_price_usd,
      p_annual_price_usd: plan.annual_price_usd,
      p_monthly_price_ghs: plan.monthly_price_ghs,
      p_annual_price_ghs: plan.annual_price_ghs,
      p_max_staff_seats: plan.max_staff_seats,
      p_is_popular: plan.is_popular,
      p_badge: plan.badge || null,
      p_features: plan.features,
      p_button_text: plan.button_text,
      p_button_style: plan.button_style,
      p_reason: reason
    });

    if (!rpcError && rpcData) {
      const updated: PlatformPricingPlan = {
        ...plan,
        updated_at: rpcData.updated_at || new Date().toISOString()
      };
      updateLocalPlanCache(updated);
      dispatchPricingUpdatedEvent(updated);
      return { success: true, plan: updated };
    }

    // Direct upsert fallback if RPC has not been migrated yet
    const { data: upsertData, error: upsertError } = await supabase
      .from('platform_pricing_plans')
      .upsert({
        id: plan.id,
        tier_name: plan.tier_name,
        tagline: plan.tagline,
        monthly_price_usd: plan.monthly_price_usd,
        annual_price_usd: plan.annual_price_usd,
        monthly_price_ghs: plan.monthly_price_ghs,
        annual_price_ghs: plan.annual_price_ghs,
        max_staff_seats: plan.max_staff_seats,
        is_popular: plan.is_popular,
        badge: plan.badge || null,
        features: plan.features,
        button_text: plan.button_text,
        button_style: plan.button_style,
        sort_order: plan.sort_order,
        is_active: plan.is_active,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })
      .select()
      .maybeSingle();

    if (upsertError) {
      console.error('[platformPricingService] Failed to upsert pricing plan:', upsertError);
      return { success: false, plan, error: upsertError.message };
    }

    const savedPlan = upsertData ? { ...plan, ...upsertData } : plan;
    updateLocalPlanCache(savedPlan);
    dispatchPricingUpdatedEvent(savedPlan);
    return { success: true, plan: savedPlan };
  } catch (err: any) {
    console.error('[platformPricingService] Exception saving pricing plan:', err);
    // Still update local cache so creator sees their work immediately
    updateLocalPlanCache(plan);
    dispatchPricingUpdatedEvent(plan);
    return { success: true, plan, error: err.message };
  }
}

function updateLocalPlanCache(plan: PlatformPricingPlan) {
  try {
    const raw = localStorage.getItem(STORAGE_CACHE_KEY);
    let list: PlatformPricingPlan[] = raw ? JSON.parse(raw) : [...DEFAULT_PRICING_PLANS];
    const idx = list.findIndex(p => p.id === plan.id);
    if (idx >= 0) {
      list[idx] = plan;
    } else {
      list.push(plan);
    }
    localStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

function dispatchPricingUpdatedEvent(plan: PlatformPricingPlan) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('frostly-pricing-updated', { detail: plan }));
  }
}
