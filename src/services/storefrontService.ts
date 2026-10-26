import { supabase, isSupabaseConfigured } from '../utils/supabase';
import { getSession } from '../data/auth';
import {
  AmansoceanProduct,
  FEATURED_PRODUCTS,
  COOL_TREATS_PRODUCTS,
} from '../data/amansoceanProducts';

export type StorefrontFulfillmentStatus =
  | 'confirmed'
  | 'packing'
  | 'out_for_delivery'
  | 'delivered'
  | 'canceled';

export type StorefrontEventType =
  | 'page_view'
  | 'product_search'
  | 'favorite_toggle'
  | 'add_to_cart'
  | 'begin_checkout'
  | 'order_completed'
  | 'newsletter_signup';

export interface StorefrontOrderLine {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  weightLabel?: string | null;
}

export interface StorefrontOrderConfirmation {
  orderNumber: string;
  fulfillmentStatus: StorefrontFulfillmentStatus;
  erpStatus?: string;
  paymentStatus?: string;
  packagingRequirement?: string;
  requiredDeliveryDate?: string | null;
  orderChannel?: 'storefront' | 'wholesale';
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  deliveryAddress: string;
  deliveryNotes?: string | null;
  paymentMethod: string;
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
  createdAt: string;
  updatedAt?: string;
  items: StorefrontOrderLine[];
}

export interface ErpStorefrontOrder extends StorefrontOrderConfirmation {
  paymentStatus?: string;
}

export interface StorefrontCheckoutPayload {
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  deliveryAddress: string;
  deliveryNotes?: string;
  paymentMethod: string;
  items: Array<{ productId: string; quantity: number }>;
}

export interface RecentTrackedOrderRef {
  orderNumber: string;
  contact: string;
  totalAmount: number;
  createdAt: string;
}

export interface CreatorStorefrontAnalyticsData {
  organizationName: string;
  days: number;
  metrics: {
    uniqueVisitors: number;
    pageViews: number;
    searches: number;
    favoritesToggled: number;
    cartAdditions: number;
    checkoutsStarted: number;
    ordersCompleted: number;
    onlineRevenue: number;
    addToCartRate: number;
    purchaseConversionRate: number;
    newsletterSubscribersCount: number;
    feedbackCount: number;
    averageRating: number;
  };
  topProducts: Array<{
    productId: string;
    productName: string;
    cartAdds: number;
    favorites: number;
  }>;
  recentOrders: Array<{
    orderNumber: string;
    customerName: string;
    status: string;
    totalAmount: number;
    createdAt: string;
  }>;
  subscribers: Array<{
    email: string;
    subscribed_at: string;
  }>;
  feedbacks: Array<{
    id: string;
    rating: number;
    category: string;
    message: string;
    name: string | null;
    email: string | null;
    created_at: string;
  }>;
}

const VISITOR_STORAGE_KEY = 'amansocean_visitor_id';
const SESSION_STORAGE_KEY = 'amansocean_session_id';
const RECENT_ORDERS_KEY = 'amansocean_recent_orders_v1';

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ao-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getStorefrontVisitorId(): string {
  try {
    const existing = localStorage.getItem(VISITOR_STORAGE_KEY);
    if (existing) return existing;
    const created = generateId();
    localStorage.setItem(VISITOR_STORAGE_KEY, created);
    return created;
  } catch {
    return 'anon-visitor';
  }
}

export function getStorefrontSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;
    const created = generateId();
    sessionStorage.setItem(SESSION_STORAGE_KEY, created);
    return created;
  } catch {
    return 'anon-session';
  }
}

function detectDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop';
  const w = window.innerWidth;
  if (w < 768) return 'mobile';
  if (w < 1024) return 'tablet';
  return 'desktop';
}

async function buildOptionalAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  try {
    const session = await getSession();
    const token = session?.access_token;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  } catch {}
  return headers;
}

export function getRecentTrackedOrders(): RecentTrackedOrderRef[] {
  try {
    const raw = localStorage.getItem(RECENT_ORDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRecentTrackedOrder(ref: RecentTrackedOrderRef): void {
  try {
    const existing = getRecentTrackedOrders().filter((o) => o.orderNumber !== ref.orderNumber);
    const updated = [ref, ...existing].slice(0, 6);
    localStorage.setItem(RECENT_ORDERS_KEY, JSON.stringify(updated));
  } catch {}
}

export async function fetchStorefrontCatalog(): Promise<{
  source: string;
  organizationId: string | null;
  organizationName: string;
  products: AmansoceanProduct[];
}> {
  try {
    const res = await fetch('/api/storefront/catalog');
    if (!res.ok) {
      throw new Error(`Catalog request failed (${res.status})`);
    }
    const data = await res.json();
    if (Array.isArray(data.products) && data.products.length > 0) {
      return {
        source: data.source || 'supabase',
        organizationId: data.organizationId || null,
        organizationName: data.organizationName || 'Amansocean Coldstore',
        products: data.products,
      };
    }
  } catch (err) {
    console.warn('[Storefront Catalog Fallback]:', err);
  }

  return {
    source: 'seed_fallback',
    organizationId: null,
    organizationName: 'Amansocean Coldstore',
    products: [...FEATURED_PRODUCTS, ...COOL_TREATS_PRODUCTS],
  };
}

export async function fetchStorefrontFavorites(): Promise<string[]> {
  try {
    const visitorId = getStorefrontVisitorId();
    const headers = await buildOptionalAuthHeaders();
    const res = await fetch(
      `/api/storefront/favorites?visitorId=${encodeURIComponent(visitorId)}`,
      { headers }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.productIds) ? data.productIds : [];
  } catch {
    return [];
  }
}

export async function toggleStorefrontFavorite(
  productId: string,
  productName?: string
): Promise<{ productId: string; favorited: boolean }> {
  const visitorId = getStorefrontVisitorId();
  const headers = await buildOptionalAuthHeaders();
  const res = await fetch('/api/storefront/favorites', {
    method: 'POST',
    headers,
    body: JSON.stringify({ visitorId, productId, productName }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Could not update saved favorites.');
  }

  return {
    productId: data.productId || productId,
    favorited: Boolean(data.favorited),
  };
}

export class StorefrontStockError extends Error {
  productId?: string;
  availableStockKg?: number;

  constructor(message: string, productId?: string, availableStockKg?: number) {
    super(message);
    this.name = 'StorefrontStockError';
    this.productId = productId;
    this.availableStockKg = availableStockKg;
  }
}

export async function submitStorefrontOrder(
  payload: StorefrontCheckoutPayload
): Promise<StorefrontOrderConfirmation> {
  const visitorId = getStorefrontVisitorId();
  const headers = await buildOptionalAuthHeaders();

  const res = await fetch('/api/storefront/orders', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ...payload,
      visitorId,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 409 && data.code === 'INSUFFICIENT_STOCK') {
      throw new StorefrontStockError(
        data.error || 'Insufficient stock for one or more items.',
        data.productId,
        data.availableStockKg
      );
    }
    throw new Error(data.error || 'Unable to confirm order right now. Please try again.');
  }

  const order: StorefrontOrderConfirmation = data.order;
  const contact = (payload.customerPhone || payload.customerEmail || '').trim();
  if (order?.orderNumber && contact) {
    saveRecentTrackedOrder({
      orderNumber: order.orderNumber,
      contact,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt,
    });
  }

  return order;
}

export async function trackStorefrontOrder(
  orderNumber: string,
  contact: string
): Promise<StorefrontOrderConfirmation> {
  const cleanOrder = orderNumber.trim().toUpperCase();
  const cleanContact = contact.trim();

  const res = await fetch(
    `/api/storefront/orders/track?orderNumber=${encodeURIComponent(cleanOrder)}&contact=${encodeURIComponent(cleanContact)}`
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.order) {
    throw new Error(
      data.error || 'No matching order found. Check your order code and phone/email.'
    );
  }

  return data.order as StorefrontOrderConfirmation;
}

export async function subscribeStorefrontNewsletter(
  email: string
): Promise<{ alreadySubscribed: boolean; message: string }> {
  const visitorId = getStorefrontVisitorId();
  const res = await fetch('/api/storefront/newsletter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), visitorId }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Could not subscribe right now. Please check your email.');
  }

  return {
    alreadySubscribed: Boolean(data.alreadySubscribed),
    message: data.message || 'Subscribed to Fresh Catch Alerts!',
  };
}

export async function trackStorefrontEvent(
  eventType: StorefrontEventType,
  extra?: {
    productId?: string;
    productName?: string;
    cartValue?: number;
    metadata?: Record<string, any>;
  }
): Promise<void> {
  try {
    const visitorId = getStorefrontVisitorId();
    const sessionId = getStorefrontSessionId();
    const headers = await buildOptionalAuthHeaders();

    await fetch('/api/storefront/analytics', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        visitorId,
        sessionId,
        eventType,
        productId: extra?.productId,
        productName: extra?.productName,
        cartValue: extra?.cartValue,
        deviceType: detectDeviceType(),
        metadata: extra?.metadata || {},
      }),
    });
  } catch {
    // Non-blocking storefront funnel beacon
  }
}

export async function fetchErpStorefrontOrders(
  organizationId?: string
): Promise<ErpStorefrontOrder[]> {
  const headers = await buildOptionalAuthHeaders();
  const qs = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : '';
  const res = await fetch(`/api/erp/storefront-orders${qs}`, { headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to load online storefront orders.');
  }
  return Array.isArray(data.orders) ? data.orders : [];
}

export async function updateErpStorefrontOrderStatus(
  orderNumber: string,
  fulfillmentStatus: StorefrontFulfillmentStatus,
  organizationId?: string
): Promise<{
  orderNumber: string;
  fulfillmentStatus: StorefrontFulfillmentStatus;
  erpStatus: string;
}> {
  const headers = await buildOptionalAuthHeaders();
  const res = await fetch(
    `/api/erp/storefront-orders/${encodeURIComponent(orderNumber)}/status`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ fulfillmentStatus, organizationId }),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update storefront order status.');
  }
  return data;
}

export async function fetchCreatorStorefrontAnalytics(
  days = 30
): Promise<CreatorStorefrontAnalyticsData> {
  const headers = await buildOptionalAuthHeaders();
  const res = await fetch(`/api/creator/storefront-analytics?days=${days}`, { headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to load storefront conversion analytics.');
  }
  return data as CreatorStorefrontAnalyticsData;
}
