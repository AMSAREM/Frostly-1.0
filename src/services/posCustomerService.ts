import { supabase, isSupabaseConfigured } from '../utils/supabase';
import {
  AmansoceanCategory,
  AMANSOCEAN_OFFICIAL_CATALOG,
} from '../data/amansoceanProducts';
import { saveRecentTrackedOrder, StorefrontFulfillmentStatus } from './storefrontService';
import { getAuthHeaders } from '../data/auth';

export interface PosRegisterLine {
  productId: string;
  sku: string;
  name: string;
  cutType: string;
  grade: string;
  unit: string;
  quantity: number;
  retailPricePerUnit: number;
  wholesalePricePerUnit: number;
  unitPrice: number;
  lineTotal: number;
  storageZone: string;
  imageUrl: string;
}

export interface PosRegisterCustomerSummary {
  id: string;
  name: string;
  companyName: string;
  type: string;
  tier: string;
  email?: string;
  phone?: string;
  paymentTerms: string;
  creditLimitUSD: number;
  outstandingBalanceUSD: number;
  availableCreditUSD: number;
  status: string;
}

export interface PosCompletedReceiptSummary {
  id: string;
  receiptNumber: string;
  orderNumber?: string;
  date: string;
  customerName: string;
  saleType: string;
  creditTerms?: string;
  paymentMethod: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  items: Array<{
    productId: string;
    productName: string;
    cutType?: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    lineTotal: number;
  }>;
}

export interface PosRegisterSessionState {
  registerId: string;
  organizationId: string | null;
  pricingMode: 'retail' | 'wholesale';
  customerName: string;
  customerAccount: PosRegisterCustomerSummary | null;
  items: PosRegisterLine[];
  discountPct: number;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  grandTotal: number;
  paymentMethod: string;
  allowCustomerBasketEdits: boolean;
  lastCompletedReceipt: PosCompletedReceiptSummary | null;
  sourceId: string;
  version: number;
  updatedAt: string;
}

export interface PosDualCatalogProduct {
  id: string;
  sku: string;
  speciesId: string;
  name: string;
  cutType: string;
  category: string;
  storefrontCategory: AmansoceanCategory;
  description: string;
  grade: string;
  unit: string;
  retailPackSize: string;
  retailPricePerUnit: number;
  wholesalePricePerUnit: number;
  wholesaleMinQty: number;
  stockKg: number;
  inStock: boolean;
  origin: string;
  storageZone: string;
  imageUrl: string;
  isAvailableForRetail: boolean;
  isAvailableForWholesale: boolean;
}

export interface PosCustomerAccountProfile {
  id: string;
  name: string;
  companyName: string;
  type: string;
  tier: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  paymentTerms: string;
  creditLimitUSD: number;
  outstandingBalanceUSD: number;
  availableCreditUSD: number;
  totalOrdersCount: number;
  totalSpendUSD: number;
  status: string;
  isWholesaleB2B: boolean;
}

export interface PosCustomerReceiptRecord {
  id: string;
  receiptNumber: string;
  date: string;
  customerName: string;
  paymentMethod: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  cashierName: string;
  status: string;
  items: Array<{
    productId: string;
    productName: string;
    cutType: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    lineTotal: number;
  }>;
}

export interface PosCustomerInvoiceRecord {
  orderNumber: string;
  channel: 'storefront' | 'wholesale';
  customerName: string;
  orderDate: string;
  requiredDeliveryDate: string;
  status: string;
  fulfillmentStatus: StorefrontFulfillmentStatus;
  paymentStatus: string;
  paymentTerms: string;
  deliveryAddress: string;
  packagingRequirement: string;
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    weightLabel?: string;
  }>;
}

export interface PosCreditLedgerRecord {
  id: string;
  date: string;
  referenceId: string;
  type: 'Payment' | 'Credit Invoice' | 'Paid Sale';
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
  paymentMethod: string;
  status: string;
}

export interface PosCustomerAccountLookupResponse {
  account: PosCustomerAccountProfile;
  receipts: PosCustomerReceiptRecord[];
  invoices: PosCustomerInvoiceRecord[];
  creditLedger: PosCreditLedgerRecord[];
}

const POS_BROADCAST_CHANNEL = 'amansocean_pos_register_v1';
const POS_LOCAL_STORAGE_PREFIX = 'amansocean_pos_reg_snapshot_';

const CLIENT_SOURCE_ID =
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? `pos-tab-${crypto.randomUUID().slice(0, 8)}`
    : `pos-tab-${Math.random().toString(36).slice(2, 10)}`;

export function getPosTabSourceId(): string {
  return CLIENT_SOURCE_ID;
}

async function buildAuthHeaders(): Promise<Record<string, string>> {
  return await getAuthHeaders(true);
}

export function broadcastPosSessionLocally(session: PosRegisterSessionState): void {
  if (typeof window === 'undefined') return;
  const regKey = `${POS_LOCAL_STORAGE_PREFIX}${session.registerId}`;
  try {
    localStorage.setItem(regKey, JSON.stringify(session));
  } catch {}
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(POS_BROADCAST_CHANNEL);
      bc.postMessage({ type: 'POS_SESSION_SYNC', session });
      bc.close();
    }
  } catch {}
}

export function readCachedPosSession(registerId = 'REG-1'): PosRegisterSessionState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${POS_LOCAL_STORAGE_PREFIX}${registerId.toUpperCase()}`);
    if (!raw) return null;
    return JSON.parse(raw) as PosRegisterSessionState;
  } catch {
    return null;
  }
}

export function subscribePosRegisterUpdates(
  registerId: string,
  onUpdate: (session: PosRegisterSessionState) => void
): () => void {
  if (typeof window === 'undefined') return () => {};
  const normalizedReg = registerId.trim().toUpperCase();
  const storageKey = `${POS_LOCAL_STORAGE_PREFIX}${normalizedReg}`;

  let bc: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(POS_BROADCAST_CHANNEL);
      bc.onmessage = (event) => {
        const incoming = event?.data?.session as PosRegisterSessionState | undefined;
        if (
          incoming &&
          incoming.registerId === normalizedReg &&
          incoming.sourceId !== CLIENT_SOURCE_ID
        ) {
          onUpdate(incoming);
        }
      };
    }
  } catch {}

  const handleStorage = (e: StorageEvent) => {
    if (e.key === storageKey && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue) as PosRegisterSessionState;
        if (parsed && parsed.sourceId !== CLIENT_SOURCE_ID) {
          onUpdate(parsed);
        }
      } catch {}
    }
  };
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener('storage', handleStorage);
    if (bc) {
      try {
        bc.close();
      } catch {}
    }
  };
}

export async function fetchPosRegisterSession(
  registerId = 'REG-1'
): Promise<PosRegisterSessionState> {
  const headers = await buildAuthHeaders();
  const res = await fetch(
    `/api/pos/register-session?registerId=${encodeURIComponent(registerId.trim().toUpperCase())}`,
    { headers }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.session) {
    throw new Error(data.error || 'Unable to connect to POS register session.');
  }
  return data.session as PosRegisterSessionState;
}

export async function pushCashierPosSession(payload: {
  registerId?: string;
  pricingMode: 'retail' | 'wholesale';
  customerName: string;
  customerAccount: PosRegisterCustomerSummary | null;
  items: PosRegisterLine[];
  discountPct: number;
  paymentMethod: string;
  allowCustomerBasketEdits?: boolean;
  lastCompletedReceipt?: PosCompletedReceiptSummary | null;
}): Promise<PosRegisterSessionState> {
  const headers = await buildAuthHeaders();
  const res = await fetch('/api/pos/register-session', {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      ...payload,
      registerId: (payload.registerId || 'REG-1').toUpperCase(),
      sourceId: CLIENT_SOURCE_ID,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.session) {
    throw new Error(data.error || 'Failed to sync POS register state.');
  }
  const session = data.session as PosRegisterSessionState;
  broadcastPosSessionLocally(session);
  return session;
}

export async function performCustomerBasketAction(payload: {
  registerId?: string;
  action: 'add_item' | 'update_qty' | 'clear_basket' | 'start_new_basket' | 'load_reorder' | 'set_pricing_mode';
  productId?: string;
  quantity?: number;
  pricingMode?: 'retail' | 'wholesale';
  customerName?: string;
  customerAccount?: PosRegisterCustomerSummary | null;
  items?: Array<{ productId: string; productName?: string; quantity: number }>;
}): Promise<{
  session: PosRegisterSessionState;
  stockNotices: string[];
}> {
  const headers = await buildAuthHeaders();
  const res = await fetch('/api/pos/register-session/customer-action', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ...payload,
      registerId: (payload.registerId || 'REG-1').toUpperCase(),
      sourceId: CLIENT_SOURCE_ID,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.session) {
    throw new Error(data.error || 'Could not update the counter basket.');
  }
  const session = data.session as PosRegisterSessionState;
  broadcastPosSessionLocally(session);
  return {
    session,
    stockNotices: Array.isArray(data.stockNotices) ? data.stockNotices : [],
  };
}

export async function fetchPosDualCatalog(): Promise<{
  source: string;
  organizationName: string;
  products: PosDualCatalogProduct[];
}> {
  try {
    const headers = await buildAuthHeaders();
    const res = await fetch('/api/pos/customer-catalog', { headers });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.products) && data.products.length > 0) {
        return {
          source: data.source || 'supabase',
          organizationName: data.organizationName || 'Amansocean Coldstore',
          products: data.products,
        };
      }
    }
  } catch (err) {
    console.warn('[POS Dual Catalog Fallback]:', err);
  }

  const fallback: PosDualCatalogProduct[] = AMANSOCEAN_OFFICIAL_CATALOG.map((p) => ({
    id: p.id,
    sku: p.sku,
    speciesId: p.species_id,
    name: p.name,
    cutType: p.cut_type,
    category: p.db_category,
    storefrontCategory: p.storefront_category,
    description: p.description,
    grade: p.grade,
    unit: p.unit,
    retailPackSize: p.retail_pack_size,
    retailPricePerUnit: p.retail_price_per_unit,
    wholesalePricePerUnit: p.wholesale_price_per_unit,
    wholesaleMinQty: p.wholesale_min_qty,
    stockKg: p.stock_kg,
    inStock: p.stock_kg > 0,
    origin: p.origin,
    storageZone: 'Commercial Cold Storage (-22°C)',
    imageUrl: p.image_url,
    isAvailableForRetail: true,
    isAvailableForWholesale: true,
  }));

  return {
    source: 'seed_fallback',
    organizationName: 'Amansocean Coldstore',
    products: fallback,
  };
}

export async function lookupPosCustomerAccount(
  contact: string,
  customerId?: string
): Promise<PosCustomerAccountLookupResponse> {
  const headers = await buildAuthHeaders();
  const params = new URLSearchParams();
  if (contact.trim()) params.set('contact', contact.trim());
  if (customerId?.trim()) params.set('customerId', customerId.trim());

  const res = await fetch(`/api/pos/customer-account?${params.toString()}`, { headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.account) {
    throw new Error(
      data.error || 'No customer account, receipts, or invoices matched that phone or email.'
    );
  }

  return {
    account: data.account,
    receipts: Array.isArray(data.receipts) ? data.receipts : [],
    invoices: Array.isArray(data.invoices) ? data.invoices : [],
    creditLedger: Array.isArray(data.creditLedger) ? data.creditLedger : [],
  };
}

export async function submitPosCustomerOrder(payload: {
  registerId?: string;
  orderMode: 'retail' | 'wholesale';
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  deliveryAddress?: string;
  paymentMethod: string;
  items: Array<{ productId: string; quantity: number }>;
}): Promise<{
  orderNumber: string;
  receiptNumber: string;
  paymentStatus: string;
  receipt: PosCompletedReceiptSummary;
  session: PosRegisterSessionState;
}> {
  const headers = await buildAuthHeaders();
  const res = await fetch('/api/pos/customer-order', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ...payload,
      registerId: (payload.registerId || 'REG-1').toUpperCase(),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Unable to submit order right now. Please try again.');
  }

  const contact = (payload.customerPhone || payload.customerEmail || '').trim();
  if (data.orderNumber && contact) {
    saveRecentTrackedOrder({
      orderNumber: data.orderNumber,
      contact,
      totalAmount: Number(data.receipt?.totalAmount || 0),
      createdAt: new Date().toISOString(),
    });
  }

  if (data.session) {
    broadcastPosSessionLocally(data.session);
  }

  return {
    orderNumber: data.orderNumber,
    receiptNumber: data.receiptNumber,
    paymentStatus: data.paymentStatus,
    receipt: data.receipt,
    session: data.session,
  };
}

// ============================================================================
// POS Customer View Security Boundary Helpers
// ============================================================================

export const POS_KIOSK_LOCK_KEY = 'frostly_pos_kiosk_lock';
export const POS_POST_LOGIN_TAB_KEY = 'frostly_post_login_tab';
export const POS_SECURITY_REAUTH_KEY = 'frostly_pos_security_reauth';

function resolveSessionStorage(
  customStorage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null
): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null {
  if (customStorage !== undefined) return customStorage;
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null;
  } catch {
    return null;
  }
}

/**
 * Activates the Customer View kiosk lock so refreshing the page keeps the
 * terminal inside Customer View instead of exposing the staff ERP.
 */
export function activatePosCustomerKioskLock(
  customStorage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null,
  win?: Window | null
): void {
  const store = resolveSessionStorage(customStorage);
  try {
    store?.setItem(POS_KIOSK_LOCK_KEY, 'true');
  } catch {}

  const targetWin = win !== undefined ? win : typeof window !== 'undefined' ? window : null;
  if (targetWin) {
    try {
      if (targetWin.location.hash.toLowerCase() !== '#pos-customer') {
        const nextUrl = `${targetWin.location.pathname}${targetWin.location.search}#pos-customer`;
        targetWin.history.replaceState(null, '', nextUrl);
      }
    } catch {}
  }
}

export function isPosCustomerKioskLocked(
  customStorage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null
): boolean {
  const store = resolveSessionStorage(customStorage);
  try {
    return store?.getItem(POS_KIOSK_LOCK_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Prepares a secure exit from Customer View to a completely blank Staff Login screen:
 * - Clears the Customer View kiosk lock
 * - Records 'retail_wholesale' as the post-login destination tab
 * - Marks POS security re-authentication active (hides passwordless demo shortcuts)
 * - Strips kiosk and email-prefill query parameters and sets #login hash
 */
export function preparePosSecurityExitToLogin(
  customStorage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null,
  win?: Window | null
): void {
  const store = resolveSessionStorage(customStorage);
  try {
    store?.removeItem(POS_KIOSK_LOCK_KEY);
    store?.setItem(POS_POST_LOGIN_TAB_KEY, 'retail_wholesale');
    store?.setItem(POS_SECURITY_REAUTH_KEY, 'true');
  } catch {}

  const targetWin = win !== undefined ? win : typeof window !== 'undefined' ? window : null;
  if (targetWin) {
    try {
      const params = new URLSearchParams(targetWin.location.search);
      const stripKeys = [
        'view',
        'register',
        'email',
        'activated',
        'org',
        'invite',
        'token_hash',
        'type',
        'auth',
        'tab',
      ];
      stripKeys.forEach((k) => params.delete(k));
      const remainingQuery = params.toString();
      const nextUrl = `${targetWin.location.pathname}${
        remainingQuery ? `?${remainingQuery}` : ''
      }#login`;
      targetWin.history.replaceState(null, '', nextUrl);
    } catch {
      try {
        targetWin.location.hash = '#login';
      } catch {}
    }
  }
}

export function isPosSecurityReauthActive(
  customStorage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null
): boolean {
  const store = resolveSessionStorage(customStorage);
  try {
    return store?.getItem(POS_SECURITY_REAUTH_KEY) === 'true';
  } catch {
    return false;
  }
}

export function clearPosSecurityReauth(
  customStorage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null
): void {
  const store = resolveSessionStorage(customStorage);
  try {
    store?.removeItem(POS_SECURITY_REAUTH_KEY);
  } catch {}
}

/**
 * Reads and clears the one-time post-login target tab (e.g. 'retail_wholesale')
 * once a verified staff member signs back in.
 */
export function consumePosPostLoginTab(
  customStorage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null
): string | null {
  const store = resolveSessionStorage(customStorage);
  try {
    const target = store?.getItem(POS_POST_LOGIN_TAB_KEY) || null;
    if (target) {
      store?.removeItem(POS_POST_LOGIN_TAB_KEY);
    }
    store?.removeItem(POS_SECURITY_REAUTH_KEY);
    return target;
  } catch {
    return null;
  }
}

