import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShoppingBag,
  Search,
  Plus,
  Minus,
  Trash2,
  Printer,
  RefreshCw,
  Lock,
  CheckCircle2,
  AlertCircle,
  Truck,
  FileText,
  Receipt,
  Package,
  RotateCcw,
  ThermometerSnowflake,
  X,
} from 'lucide-react';
import { signOut as authSignOut } from '../data/auth';
import {
  PosRegisterSessionState,
  PosDualCatalogProduct,
  PosCustomerAccountLookupResponse,
  PosCompletedReceiptSummary,
  PosCustomerReceiptRecord,
  PosCustomerInvoiceRecord,
  fetchPosRegisterSession,
  performCustomerBasketAction,
  subscribePosRegisterUpdates,
  readCachedPosSession,
  fetchPosDualCatalog,
  lookupPosCustomerAccount,
  submitPosCustomerOrder,
  preparePosSecurityExitToLogin,
} from '../services/posCustomerService';
import {
  trackStorefrontOrder,
  getRecentTrackedOrders,
  StorefrontOrderConfirmation,
} from '../services/storefrontService';

export type PosCustomerTab = 'checkout' | 'catalog' | 'tracking' | 'billing';

export interface PosCustomerViewProps {
  registerId?: string;
  initialTab?: PosCustomerTab;
  initialCustomerContact?: string;
  initialCustomerId?: string;
  onExitToCashier?: () => void;
  formatCurrency?: (amount: number) => string;
}

type PrintableDocument =
  | { kind: 'receipt'; data: PosCompletedReceiptSummary | PosCustomerReceiptRecord }
  | { kind: 'invoice'; data: PosCustomerInvoiceRecord }
  | { kind: 'statement'; data: PosCustomerAccountLookupResponse };

const defaultFormatCurrency = (amount: number): string => {
  const num = Number.isFinite(amount) ? amount : 0;
  return `GH₵ ${num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const ProductThumbnail: React.FC<{
  src?: string;
  alt: string;
  className?: string;
}> = ({ src, alt, className = 'w-full h-full' }) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-slate-100 text-slate-500 p-3 text-center select-none ${className}`}
      >
        <ThermometerSnowflake className="w-6 h-6 text-slate-400 mb-1.5 stroke-[1.75]" />
        <span className="text-[11px] font-medium text-slate-500 line-clamp-2 leading-tight">
          {alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
};

export const PosCustomerView: React.FC<PosCustomerViewProps> = ({
  registerId = 'REG-1',
  initialTab = 'checkout',
  initialCustomerContact = '',
  initialCustomerId = '',
  onExitToCashier,
  formatCurrency = defaultFormatCurrency,
}) => {
  const normalizedReg = registerId.trim().toUpperCase() || 'REG-1';
  const [activeTab, setActiveTab] = useState<PosCustomerTab>(initialTab);

  // 1. Live Register Session State
  const [session, setSession] = useState<PosRegisterSessionState>(() => {
    const cached = readCachedPosSession(normalizedReg);
    if (cached) return cached;
    return {
      registerId: normalizedReg,
      organizationId: null,
      pricingMode: 'retail',
      customerName: 'Walk-in Customer',
      customerAccount: null,
      items: [],
      discountPct: 0,
      subtotal: 0,
      discountAmount: 0,
      taxAmount: 0,
      grandTotal: 0,
      paymentMethod: 'Credit Card',
      allowCustomerBasketEdits: true,
      lastCompletedReceipt: null,
      sourceId: 'init',
      version: 0,
      updatedAt: new Date().toISOString(),
    };
  });
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(true);
  const [basketBusyId, setBasketBusyId] = useState<string | null>(null);
  const [basketFeedback, setBasketFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);

  // Kiosk Self-Checkout Form State
  const [showSelfCheckoutForm, setShowSelfCheckoutForm] = useState<boolean>(false);
  const [checkoutName, setCheckoutName] = useState<string>('');
  const [checkoutPhone, setCheckoutPhone] = useState<string>('');
  const [checkoutEmail, setCheckoutEmail] = useState<string>('');
  const [checkoutFulfillment, setCheckoutFulfillment] = useState<'pickup' | 'delivery'>('pickup');
  const [checkoutAddress, setCheckoutAddress] = useState<string>('');
  const [checkoutPayment, setCheckoutPayment] = useState<string>(
    'Pay at Counter (Card / Cash / Mobile Money)'
  );
  const [checkoutState, setCheckoutState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // 2. Dual-Channel Catalog & Reorder State
  const [catalogProducts, setCatalogProducts] = useState<PosDualCatalogProduct[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState<boolean>(true);
  const [catalogPricingMode, setCatalogPricingMode] = useState<'retail' | 'wholesale'>('retail');
  const [catalogCategory, setCatalogCategory] = useState<string>('All');
  const [catalogSearch, setCatalogSearch] = useState<string>('');
  const [reorderContact, setReorderContact] = useState<string>(initialCustomerContact);
  const [isLoadingReorderLookup, setIsLoadingReorderLookup] = useState<boolean>(false);
  const [reorderAccountData, setReorderAccountData] =
    useState<PosCustomerAccountLookupResponse | null>(null);
  const [reorderError, setReorderError] = useState<string | null>(null);

  // 3. Cold-Chain Order Tracking State
  const [trackOrderNum, setTrackOrderNum] = useState<string>('');
  const [trackContact, setTrackContact] = useState<string>(initialCustomerContact);
  const [isTrackingLoading, setIsTrackingLoading] = useState<boolean>(false);
  const [trackedOrder, setTrackedOrder] = useState<StorefrontOrderConfirmation | null>(null);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [recentOrders, setRecentOrders] = useState(() => getRecentTrackedOrders());

  // 4. Receipts, Wholesale Invoices & B2B Credit Statement State
  const [billingContact, setBillingContact] = useState<string>(initialCustomerContact);
  const [isLoadingBilling, setIsLoadingBilling] = useState<boolean>(false);
  const [billingData, setBillingData] = useState<PosCustomerAccountLookupResponse | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [billingSection, setBillingSection] = useState<'receipts' | 'invoices' | 'statement'>(
    'receipts'
  );
  const [billingStatusFilter, setBillingStatusFilter] = useState<
    'all' | 'paid' | 'pending' | 'overdue'
  >('all');

  // Active Document for Clean Print View
  const [printDoc, setPrintDoc] = useState<PrintableDocument | null>(null);

  // Sync Register Session on Mount + BroadcastChannel + Periodic Server Sync
  const refreshSessionFromServer = useCallback(async () => {
    try {
      const remote = await fetchPosRegisterSession(normalizedReg);
      setSession((prev) => {
        if (remote.version >= prev.version || remote.updatedAt >= prev.updatedAt) {
          return remote;
        }
        return prev;
      });
    } catch {
      // Retain cached session if momentarily offline
    } finally {
      setIsLoadingSession(false);
    }
  }, [normalizedReg]);

  useEffect(() => {
    refreshSessionFromServer();
    const unsubBroadcast = subscribePosRegisterUpdates(normalizedReg, (incoming) => {
      setSession(incoming);
    });
    const pollTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshSessionFromServer();
      }
    }, 2500);

    return () => {
      unsubBroadcast();
      window.clearInterval(pollTimer);
    };
  }, [normalizedReg, refreshSessionFromServer]);

  // Keep catalog pricing mode aligned when cashier links a wholesale B2B customer
  useEffect(() => {
    if (session.pricingMode === 'wholesale') {
      setCatalogPricingMode('wholesale');
      setCheckoutPayment('B2B Net-Terms Credit');
    }
    if (session.customerAccount) {
      if (!checkoutName && session.customerAccount.companyName) {
        setCheckoutName(session.customerAccount.companyName);
      }
      if (!checkoutEmail && session.customerAccount.email) {
        setCheckoutEmail(session.customerAccount.email);
      }
      if (!checkoutPhone && session.customerAccount.phone) {
        setCheckoutPhone(session.customerAccount.phone);
      }
    }
  }, [session.pricingMode, session.customerAccount]);

  // Load Dual Catalog
  const loadCatalog = useCallback(async () => {
    setIsLoadingCatalog(true);
    try {
      const res = await fetchPosDualCatalog();
      setCatalogProducts(res.products);
    } finally {
      setIsLoadingCatalog(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  // Auto-load billing account if staff launched Customer View with a selected customer
  useEffect(() => {
    const autoContact =
      initialCustomerContact ||
      session.customerAccount?.email ||
      session.customerAccount?.phone ||
      '';
    const autoCustId = initialCustomerId || session.customerAccount?.id || '';
    if ((autoContact || autoCustId) && !billingData && !isLoadingBilling) {
      setBillingContact(autoContact);
      setReorderContact(autoContact);
      setIsLoadingBilling(true);
      lookupPosCustomerAccount(autoContact, autoCustId)
        .then((res) => {
          setBillingData(res);
          setReorderAccountData(res);
          if (res.account.isWholesaleB2B) {
            setBillingSection('statement');
          }
        })
        .catch(() => {})
        .finally(() => setIsLoadingBilling(false));
    }
  }, [initialCustomerContact, initialCustomerId, session.customerAccount?.id]);

  // Trigger Browser Print cleanly when printDoc is staged
  const triggerPrintDocument = (doc: PrintableDocument) => {
    setPrintDoc(doc);
    window.setTimeout(() => {
      window.print();
    }, 80);
  };

  // Handlers: Basket Mutations
  const handleAddProductToBasket = async (product: PosDualCatalogProduct) => {
    setBasketBusyId(product.id);
    setBasketFeedback(null);
    const defaultStep =
      catalogPricingMode === 'wholesale' ? Math.max(1, product.wholesaleMinQty || 5) : 1;
    try {
      const result = await performCustomerBasketAction({
        registerId: normalizedReg,
        action: 'add_item',
        productId: product.id,
        quantity: defaultStep,
        pricingMode: catalogPricingMode,
      });
      setSession(result.session);
      if (result.stockNotices.length > 0) {
        setBasketFeedback({ type: 'warning', message: result.stockNotices.join(' ') });
      } else {
        setBasketFeedback({
          type: 'success',
          message: `Added ${defaultStep} ${catalogPricingMode === 'wholesale' ? 'kg' : 'pack(s)'} of ${product.name} to Register ${normalizedReg}.`,
        });
      }
    } catch (err: any) {
      setBasketFeedback({
        type: 'error',
        message: err?.message || 'Unable to add item to counter basket.',
      });
    } finally {
      setBasketBusyId(null);
    }
  };

  const handleUpdateLineQty = async (productId: string, nextQty: number) => {
    setBasketBusyId(productId);
    setBasketFeedback(null);
    try {
      const result = await performCustomerBasketAction({
        registerId: normalizedReg,
        action: 'update_qty',
        productId,
        quantity: Number(Math.max(0, nextQty).toFixed(2)),
      });
      setSession(result.session);
      if (result.stockNotices.length > 0) {
        setBasketFeedback({ type: 'warning', message: result.stockNotices.join(' ') });
      }
    } catch (err: any) {
      setBasketFeedback({
        type: 'error',
        message: err?.message || 'Unable to update item quantity.',
      });
    } finally {
      setBasketBusyId(null);
    }
  };

  const handleClearOrStartNewBasket = async (clearItems = false) => {
    setBasketBusyId('reset');
    setBasketFeedback(null);
    try {
      const result = await performCustomerBasketAction({
        registerId: normalizedReg,
        action: clearItems ? 'clear_basket' : 'start_new_basket',
      });
      setSession(result.session);
      setCheckoutState('idle');
      setShowSelfCheckoutForm(false);
    } catch (err: any) {
      setBasketFeedback({
        type: 'error',
        message: err?.message || 'Unable to reset basket.',
      });
    } finally {
      setBasketBusyId(null);
    }
  };

  const handleSwitchPricingMode = async (mode: 'retail' | 'wholesale') => {
    setCatalogPricingMode(mode);
    if (session.items.length > 0 && session.allowCustomerBasketEdits) {
      try {
        const res = await performCustomerBasketAction({
          registerId: normalizedReg,
          action: 'set_pricing_mode',
          pricingMode: mode,
        });
        setSession(res.session);
      } catch {}
    }
  };

  // Handler: One-Click Reorder
  const handleOneClickReorder = async (
    items: Array<{ productId: string; productName?: string; quantity: number }>,
    mode: 'retail' | 'wholesale',
    customerLabel?: string
  ) => {
    setBasketBusyId('reorder');
    setBasketFeedback(null);
    try {
      const res = await performCustomerBasketAction({
        registerId: normalizedReg,
        action: 'load_reorder',
        items,
        pricingMode: mode,
        customerName: customerLabel,
      });
      setSession(res.session);
      setCatalogPricingMode(mode);
      setActiveTab('checkout');
      setBasketFeedback({
        type: res.stockNotices.length > 0 ? 'warning' : 'success',
        message:
          res.stockNotices.length > 0
            ? `Loaded past order into basket. ${res.stockNotices.join(' ')}`
            : `Loaded ${res.session.items.length} item(s) into Counter Register ${normalizedReg}.`,
      });
    } catch (err: any) {
      setBasketFeedback({
        type: 'error',
        message: err?.message || 'Could not load reorder items.',
      });
    } finally {
      setBasketBusyId(null);
    }
  };

  // Handler: Self-Service Counter / Wholesale Order Submit
  const handleSelfOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (session.items.length === 0) return;
    setCheckoutState('saving');
    setCheckoutError(null);

    try {
      const result = await submitPosCustomerOrder({
        registerId: normalizedReg,
        orderMode: session.pricingMode,
        customerName: checkoutName.trim() || session.customerName || 'Counter Customer',
        customerPhone: checkoutPhone.trim(),
        customerEmail: checkoutEmail.trim(),
        deliveryAddress:
          checkoutFulfillment === 'delivery' && checkoutAddress.trim()
            ? checkoutAddress.trim()
            : `Counter Pickup — Amansocean Coldstore (${normalizedReg})`,
        paymentMethod: checkoutPayment,
        items: session.items.map((it) => ({
          productId: it.productId,
          quantity: it.quantity,
        })),
      });

      setSession(result.session);
      setCheckoutState('saved');
      setShowSelfCheckoutForm(false);
      setRecentOrders(getRecentTrackedOrders());
      await loadCatalog();
    } catch (err: any) {
      setCheckoutState('error');
      setCheckoutError(err?.message || 'Order submission failed. Please retry.');
    }
  };

  // Handler: Past Order Reorder Lookup
  const handleLookupReorderHistory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reorderContact.trim()) return;
    setIsLoadingReorderLookup(true);
    setReorderError(null);
    try {
      const res = await lookupPosCustomerAccount(reorderContact.trim());
      setReorderAccountData(res);
      setBillingData(res);
      setBillingContact(reorderContact.trim());
    } catch (err: any) {
      setReorderAccountData(null);
      setReorderError(err?.message || 'No past orders found for that phone or email.');
    } finally {
      setIsLoadingReorderLookup(false);
    }
  };

  // Handler: Cold-Chain Order Tracking Lookup
  const handleTrackOrderSubmit = async (
    e?: React.FormEvent,
    overrideOrder?: string,
    overrideContact?: string
  ) => {
    if (e) e.preventDefault();
    const ord = (overrideOrder ?? trackOrderNum).trim().toUpperCase();
    const cnt = (overrideContact ?? trackContact).trim();
    if (!ord || !cnt) {
      setTrackingError('Enter both your Order Reference (AO-XXXXX or ORD-XXXX) and phone or email.');
      return;
    }
    setIsTrackingLoading(true);
    setTrackingError(null);
    try {
      const res = await trackStorefrontOrder(ord, cnt);
      setTrackedOrder(res);
    } catch (err: any) {
      setTrackedOrder(null);
      setTrackingError(err?.message || 'Order not found. Check your order code and phone/email.');
    } finally {
      setIsTrackingLoading(false);
    }
  };

  // Handler: Billing & B2B Credit Lookup
  const handleBillingLookupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billingContact.trim()) {
      setBillingError('Enter your registered email address or phone number.');
      return;
    }
    setIsLoadingBilling(true);
    setBillingError(null);
    try {
      const res = await lookupPosCustomerAccount(billingContact.trim());
      setBillingData(res);
      setReorderAccountData(res);
      if (res.account.isWholesaleB2B && res.receipts.length === 0) {
        setBillingSection('statement');
      }
    } catch (err: any) {
      setBillingData(null);
      setBillingError(err?.message || 'No billing records matched that phone or email.');
    } finally {
      setIsLoadingBilling(false);
    }
  };

  // Filtered Dual Catalog
  const filteredCatalog = useMemo(() => {
    return catalogProducts.filter((p) => {
      const matchesMode =
        catalogPricingMode === 'wholesale' ? p.isAvailableForWholesale : p.isAvailableForRetail;
      const matchesCat = catalogCategory === 'All' || p.storefrontCategory === catalogCategory;
      const q = catalogSearch.trim().toLowerCase();
      const matchesQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.cutType.toLowerCase().includes(q) ||
        p.origin.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q);
      return matchesMode && matchesCat && matchesQuery;
    });
  }, [catalogProducts, catalogPricingMode, catalogCategory, catalogSearch]);

  // Filtered Billing Records
  const filteredReceipts = useMemo(() => {
    if (!billingData) return [];
    if (billingStatusFilter === 'all' || billingStatusFilter === 'paid') {
      return billingData.receipts;
    }
    return [];
  }, [billingData, billingStatusFilter]);

  const filteredInvoices = useMemo(() => {
    if (!billingData) return [];
    return billingData.invoices.filter((inv) => {
      if (billingStatusFilter === 'all') return true;
      const st = inv.paymentStatus.toLowerCase();
      if (billingStatusFilter === 'paid') return st === 'paid';
      if (billingStatusFilter === 'overdue') return st.includes('overdue');
      if (billingStatusFilter === 'pending') return st.includes('pending') || st.includes('invoiced');
      return true;
    });
  }, [billingData, billingStatusFilter]);

  const filteredLedger = useMemo(() => {
    if (!billingData) return [];
    return billingData.creditLedger.filter((row) => {
      if (billingStatusFilter === 'all') return true;
      const st = row.status.toLowerCase();
      if (billingStatusFilter === 'paid') return st === 'settled';
      if (billingStatusFilter === 'overdue') return st === 'overdue';
      if (billingStatusFilter === 'pending') return st === 'pending';
      return true;
    });
  }, [billingData, billingStatusFilter]);

  const totalItemUnits = useMemo(
    () => Number(session.items.reduce((s, i) => s + i.quantity, 0).toFixed(2)),
    [session.items]
  );

  // Active Credit Account (either linked on POS register by cashier or verified by customer)
  const activeCreditAccount = useMemo(() => {
    if (session.customerAccount && session.customerAccount.creditLimitUSD > 0) {
      return session.customerAccount;
    }
    if (billingData?.account && billingData.account.creditLimitUSD > 0) {
      return {
        id: billingData.account.id,
        name: billingData.account.name,
        companyName: billingData.account.companyName,
        type: billingData.account.type,
        tier: billingData.account.tier,
        email: billingData.account.email,
        phone: billingData.account.phone,
        paymentTerms: billingData.account.paymentTerms,
        creditLimitUSD: billingData.account.creditLimitUSD,
        outstandingBalanceUSD: billingData.account.outstandingBalanceUSD,
        availableCreditUSD: billingData.account.availableCreditUSD,
        status: billingData.account.status,
      };
    }
    return null;
  }, [session.customerAccount, billingData]);

  const navTabs: Array<{ id: PosCustomerTab; label: string }> = [
    { id: 'checkout', label: 'Live Checkout' },
    { id: 'catalog', label: 'Catalog & Reorder' },
    { id: 'tracking', label: 'Track Order' },
    { id: 'billing', label: 'Receipts & Credit' },
  ];

  return (
    <div className="min-h-screen bg-[#FBF3E4] text-slate-900 flex flex-col">
      {/* =====================================================================
          STRICT 1-ROW, 3-ZONE TOP BAR CONTRACT (print:hidden)
         ===================================================================== */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 print:hidden">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-8 px-4 sm:px-6 lg:px-8 h-16">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('checkout')}
            className="font-heading text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            Amansocean
          </button>

          {/* Zone 2: 4 Concise Single-Line Navigation Links */}
          <nav
            aria-label="POS Customer Navigation"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
          >
            {navTabs.map((t) => {
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  id={`pos-cust-nav-${t.id}`}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'border-[#C8102E] text-slate-900 font-semibold'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Single Primary Action — Secure Exit to Blank Staff Login */}
          <div className="flex items-center shrink-0">
            <button
              id="pos-cust-exit-btn"
              type="button"
              onClick={async () => {
                if (onExitToCashier) {
                  await onExitToCashier();
                  return;
                }
                preparePosSecurityExitToLogin();
                try {
                  await authSignOut();
                } catch {}
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new HashChangeEvent('hashchange'));
                }
              }}
              className="min-h-[44px] sm:min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              title="Sign out of counter session and require staff credentials"
            >
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span>Exit to Staff Login</span>
            </button>
          </div>
        </div>

        {/* Mobile / Compact Tablet Single-Line Tab Strip */}
        <div className="md:hidden flex items-center gap-4 overflow-x-auto px-4 border-t border-slate-100 bg-white">
          {navTabs.map((t) => {
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`py-2.5 text-xs border-b-2 whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'border-[#C8102E] text-slate-900 font-semibold'
                    : 'border-transparent text-slate-600'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* =====================================================================
          MAIN CUSTOMER TERMINAL WORKSPACE (print:hidden)
         ===================================================================== */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 print:hidden">
        {/* Global Basket / Stock Feedback Banner */}
        {basketFeedback && (
          <div
            role="status"
            className={`mb-6 px-4 py-3 rounded-xl border flex items-center justify-between gap-4 text-sm ${
              basketFeedback.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : basketFeedback.type === 'warning'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {basketFeedback.type === 'error' || basketFeedback.type === 'warning' ? (
                <AlertCircle className="w-4 h-4 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              )}
              <span>{basketFeedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setBasketFeedback(null)}
              className="p-1.5 text-current opacity-70 hover:opacity-100 cursor-pointer"
              aria-label="Dismiss notice"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ===================================================================
            TAB 1: LIVE REGISTER CHECKOUT & POST-SALE RECEIPT
           =================================================================== */}
        {activeTab === 'checkout' && (
          <div className="space-y-6">
            {/* Workspace Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 mb-1">
                  <span className="font-mono tabular-nums">Register {session.registerId}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {session.pricingMode === 'wholesale'
                      ? 'Wholesale B2B Bulk Pricing (kg)'
                      : 'Retail Counter Pack Pricing'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{session.customerName}</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight [text-wrap:balance]">
                  {session.lastCompletedReceipt
                    ? `Receipt Confirmed — ${session.lastCompletedReceipt.receiptNumber}`
                    : 'Live Counter Basket'}
                </h1>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('catalog')}
                  className="min-h-[44px] px-4 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Browse Catalog &amp; Reorder
                </button>
              </div>
            </div>

            {/* Post-Sale Completed Receipt View */}
            {session.lastCompletedReceipt ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>Payment &amp; Cold-Chain Allocation Complete</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono tabular-nums">
                        {session.lastCompletedReceipt.receiptNumber}
                      </span>
                      {session.lastCompletedReceipt.orderNumber && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            Order {session.lastCompletedReceipt.orderNumber}
                          </span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span>{session.lastCompletedReceipt.customerName}</span>
                      <span aria-hidden="true">·</span>
                      <span>{session.lastCompletedReceipt.paymentMethod}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        triggerPrintDocument({
                          kind: 'receipt',
                          data: session.lastCompletedReceipt!,
                        })
                      }
                      className="min-h-[44px] px-4 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Print Receipt</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleClearOrStartNewBasket(false)}
                      disabled={basketBusyId === 'reset'}
                      className="min-h-[44px] px-5 py-2 text-xs font-semibold text-white bg-[#C8102E] hover:bg-[#9B0B20] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Start New Basket
                    </button>
                  </div>
                </div>

                {/* Receipt Line Items Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs text-slate-500 font-medium">
                        <th className="py-3 pr-4">Item</th>
                        <th className="py-3 px-4 text-right">Qty</th>
                        <th className="py-3 px-4 text-right">Unit Price</th>
                        <th className="py-3 pl-4 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {session.lastCompletedReceipt.items.map((item, idx) => (
                        <tr key={`${item.productId}-${idx}`} className="min-h-[44px]">
                          <td className="py-3.5 pr-4 font-medium text-slate-900">
                            {item.productName}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700">
                            {item.quantity} {item.unit}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700">
                            {formatCurrency(item.unitPrice)}
                          </td>
                          <td className="py-3.5 pl-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                            {formatCurrency(item.lineTotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals Footer */}
                <div className="pt-4 border-t border-slate-200 flex flex-col items-end space-y-1.5 text-sm">
                  <div className="flex items-center justify-between w-full max-w-xs text-slate-600">
                    <span>Subtotal</span>
                    <span className="font-mono tabular-nums">
                      {formatCurrency(session.lastCompletedReceipt.subtotal)}
                    </span>
                  </div>
                  {session.lastCompletedReceipt.discountAmount > 0 && (
                    <div className="flex items-center justify-between w-full max-w-xs text-emerald-700">
                      <span>Discount</span>
                      <span className="font-mono tabular-nums">
                        −{formatCurrency(session.lastCompletedReceipt.discountAmount)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between w-full max-w-xs text-slate-600">
                    <span>Tax</span>
                    <span className="font-mono tabular-nums">
                      {formatCurrency(session.lastCompletedReceipt.taxAmount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between w-full max-w-xs pt-2 border-t border-slate-100 text-lg font-bold text-slate-900">
                    <span>Total Paid / Charged</span>
                    <span className="font-mono tabular-nums">
                      {formatCurrency(session.lastCompletedReceipt.totalAmount)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* Active Counter Checkout Grid (Left 7 Cols Basket | Right 5 Cols Totals & Credit) */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Left 7 Columns: Itemized Register Lines */}
                <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-900">
                      Itemized Cuts &amp; Packs ({session.items.length})
                    </div>
                    {session.items.length > 0 && session.allowCustomerBasketEdits && (
                      <button
                        type="button"
                        onClick={() => handleClearOrStartNewBasket(true)}
                        className="text-xs font-medium text-rose-700 hover:text-rose-900 cursor-pointer"
                      >
                        Clear Basket
                      </button>
                    )}
                  </div>

                  {isLoadingSession ? (
                    <div className="p-6 space-y-4">
                      {[1, 2, 3].map((n) => (
                        <div
                          key={n}
                          className="h-16 bg-slate-100 rounded-xl animate-pulse"
                        />
                      ))}
                    </div>
                  ) : session.items.length === 0 ? (
                    <div className="px-6 py-16 text-center space-y-4">
                      <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto stroke-[1.5]" />
                      <div className="space-y-1 max-w-md mx-auto">
                        <h2 className="text-base font-semibold text-slate-900">
                          Ready for Your Selection
                        </h2>
                        <p className="text-sm text-slate-500">
                          Items scanned at the counter appear here automatically, or you can add
                          retail packs and wholesale bulk cuts directly from our live coldstore
                          catalog.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => setActiveTab('catalog')}
                          className="min-h-[44px] px-5 py-2.5 text-xs font-semibold text-white bg-[#C8102E] hover:bg-[#9B0B20] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                        >
                          Shop Live Catalog
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab('billing')}
                          className="min-h-[44px] px-5 py-2.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                        >
                          View Past Receipts &amp; Credit
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {session.items.map((item) => {
                        const step = session.pricingMode === 'wholesale' ? 1 : 1;
                        const isBusy = basketBusyId === item.productId;
                        return (
                          <div
                            key={item.productId}
                            className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                          >
                            <div className="flex items-center gap-4 min-w-0">
                              <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 shrink-0 bg-slate-100">
                                <ProductThumbnail src={item.imageUrl} alt={item.name} />
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-slate-900 truncate">
                                  {item.name}
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                                  <span>{item.cutType}</span>
                                  <span aria-hidden="true">·</span>
                                  <span>{item.grade}</span>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-mono tabular-nums">
                                    {formatCurrency(item.unitPrice)}/{item.unit}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0">
                              {session.allowCustomerBasketEdits ? (
                                <div className="flex items-center border border-slate-200 rounded-lg bg-white">
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() =>
                                      handleUpdateLineQty(item.productId, item.quantity - step)
                                    }
                                    className="w-10 h-10 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-50 cursor-pointer disabled:opacity-40"
                                    aria-label={`Decrease ${item.name} quantity`}
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <span className="px-3 text-xs font-semibold font-mono tabular-nums text-slate-900 min-w-[3.25rem] text-center">
                                    {item.quantity} {item.unit}
                                  </span>
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() =>
                                      handleUpdateLineQty(item.productId, item.quantity + step)
                                    }
                                    className="w-10 h-10 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-50 cursor-pointer disabled:opacity-40"
                                    aria-label={`Increase ${item.name} quantity`}
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs font-mono tabular-nums text-slate-600">
                                  Qty: {item.quantity} {item.unit}
                                </span>
                              )}

                              <div className="text-right min-w-[5.5rem]">
                                <div className="text-sm font-bold font-mono tabular-nums text-slate-900">
                                  {formatCurrency(item.lineTotal)}
                                </div>
                              </div>

                              {session.allowCustomerBasketEdits && (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handleUpdateLineQty(item.productId, 0)}
                                  className="p-2 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                  aria-label={`Remove ${item.name}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Right 5 Columns: Order Totals, B2B Credit Standing & Self-Submit */}
                <div className="lg:col-span-5 space-y-6">
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <span className="text-sm font-semibold text-slate-900">
                        Checkout Summary
                      </span>
                      <span className="text-xs text-slate-500 font-mono tabular-nums">
                        {totalItemUnits} total units
                      </span>
                    </div>

                    <div className="space-y-2.5 text-sm">
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Subtotal</span>
                        <span className="font-mono tabular-nums">
                          {formatCurrency(session.subtotal)}
                        </span>
                      </div>

                      {session.discountPct > 0 && (
                        <div className="flex items-center justify-between text-emerald-700">
                          <span>Tier / VIP Discount ({session.discountPct}%)</span>
                          <span className="font-mono tabular-nums">
                            −{formatCurrency(session.discountAmount)}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-slate-600">
                        <span>Sales Tax (8.75%)</span>
                        <span className="font-mono tabular-nums">
                          {formatCurrency(session.taxAmount)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-slate-600">
                        <span>Tender Method</span>
                        <span className="font-medium text-slate-900">{session.paymentMethod}</span>
                      </div>

                      <div className="pt-4 border-t border-slate-200 flex items-baseline justify-between">
                        <span className="text-base font-bold text-slate-900">Total Due</span>
                        <span className="text-3xl font-bold font-mono tabular-nums text-slate-900">
                          {formatCurrency(session.grandTotal)}
                        </span>
                      </div>
                    </div>

                    {/* Linked B2B Wholesale Credit Standing Strip */}
                    {activeCreditAccount && (
                      <div className="pt-4 border-t border-slate-100 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-900">
                            B2B Credit Account — {activeCreditAccount.companyName}
                          </span>
                          <span className="text-xs text-slate-500">
                            {activeCreditAccount.paymentTerms}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-3 text-xs pt-1">
                          <div>
                            <div className="text-slate-500">Credit Limit</div>
                            <div className="font-semibold font-mono tabular-nums text-slate-900 mt-0.5">
                              {formatCurrency(activeCreditAccount.creditLimitUSD)}
                            </div>
                          </div>
                          <div>
                            <div className="text-slate-500">Current Balance</div>
                            <div className="font-semibold font-mono tabular-nums text-slate-900 mt-0.5">
                              {formatCurrency(activeCreditAccount.outstandingBalanceUSD)}
                            </div>
                          </div>
                          <div>
                            <div className="text-slate-500">Available Credit</div>
                            <div
                              className={`font-semibold font-mono tabular-nums mt-0.5 ${
                                activeCreditAccount.availableCreditUSD >= session.grandTotal
                                  ? 'text-emerald-700'
                                  : 'text-rose-700'
                              }`}
                            >
                              {formatCurrency(activeCreditAccount.availableCreditUSD)}
                            </div>
                          </div>
                        </div>

                        <div className="text-xs flex items-center gap-1.5">
                          {activeCreditAccount.status === 'Credit Hold' ? (
                            <span className="text-rose-700 font-medium flex items-center gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              Account on Credit Hold — Cashier manager approval required
                            </span>
                          ) : activeCreditAccount.availableCreditUSD < session.grandTotal ? (
                            <span className="text-amber-700 font-medium flex items-center gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              Basket exceeds remaining Net-Terms credit limit
                            </span>
                          ) : (
                            <span className="text-emerald-700 font-medium flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              Approved for Net-Terms billing ({activeCreditAccount.paymentTerms})
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Kiosk Direct Order Submission Toggle */}
                    {session.items.length > 0 && (
                      <div className="pt-3 border-t border-slate-100">
                        {!showSelfCheckoutForm ? (
                          <button
                            id="pos-cust-open-self-checkout"
                            type="button"
                            onClick={() => setShowSelfCheckoutForm(true)}
                            className="w-full min-h-[44px] px-4 py-2.5 text-xs font-semibold text-white bg-[#C8102E] hover:bg-[#9B0B20] rounded-lg transition-colors cursor-pointer"
                          >
                            Submit Order from Counter Kiosk
                          </button>
                        ) : (
                          <form onSubmit={handleSelfOrderSubmit} className="space-y-3 pt-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-slate-900">
                                Counter Pickup / B2B Dispatch Details
                              </span>
                              <button
                                type="button"
                                onClick={() => setShowSelfCheckoutForm(false)}
                                className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>

                            <div>
                              <label
                                htmlFor="kiosk-cust-name"
                                className="block text-xs font-medium text-slate-700 mb-1"
                              >
                                Full Name or Company Name
                              </label>
                              <input
                                id="kiosk-cust-name"
                                type="text"
                                required
                                value={checkoutName}
                                onChange={(e) => setCheckoutName(e.target.value)}
                                placeholder="e.g. Mensah Seafoods / Harbor Grill"
                                className="w-full min-h-[44px] px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                              />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label
                                  htmlFor="kiosk-cust-phone"
                                  className="block text-xs font-medium text-slate-700 mb-1"
                                >
                                  Phone Number
                                </label>
                                <input
                                  id="kiosk-cust-phone"
                                  type="tel"
                                  value={checkoutPhone}
                                  onChange={(e) => setCheckoutPhone(e.target.value)}
                                  placeholder="+233 24 000 0000"
                                  className="w-full min-h-[44px] px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                                />
                              </div>
                              <div>
                                <label
                                  htmlFor="kiosk-cust-email"
                                  className="block text-xs font-medium text-slate-700 mb-1"
                                >
                                  Email Address
                                </label>
                                <input
                                  id="kiosk-cust-email"
                                  type="email"
                                  value={checkoutEmail}
                                  onChange={(e) => setCheckoutEmail(e.target.value)}
                                  placeholder="buyer@restaurant.com"
                                  className="w-full min-h-[44px] px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                                />
                              </div>
                            </div>

                            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                              <button
                                type="button"
                                onClick={() => setCheckoutFulfillment('pickup')}
                                className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                                  checkoutFulfillment === 'pickup'
                                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                Counter Pickup
                              </button>
                              <button
                                type="button"
                                onClick={() => setCheckoutFulfillment('delivery')}
                                className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                                  checkoutFulfillment === 'delivery'
                                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                Cold-Chain Delivery
                              </button>
                            </div>

                            {checkoutFulfillment === 'delivery' && (
                              <div>
                                <label
                                  htmlFor="kiosk-cust-address"
                                  className="block text-xs font-medium text-slate-700 mb-1"
                                >
                                  Delivery Address
                                </label>
                                <input
                                  id="kiosk-cust-address"
                                  type="text"
                                  required
                                  value={checkoutAddress}
                                  onChange={(e) => setCheckoutAddress(e.target.value)}
                                  placeholder="Street, Landmark, City"
                                  className="w-full min-h-[44px] px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                                />
                              </div>
                            )}

                            <div>
                              <label
                                htmlFor="kiosk-payment-method"
                                className="block text-xs font-medium text-slate-700 mb-1"
                              >
                                Payment Method
                              </label>
                              <select
                                id="kiosk-payment-method"
                                value={checkoutPayment}
                                onChange={(e) => setCheckoutPayment(e.target.value)}
                                className="w-full min-h-[44px] px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                              >
                                <option value="Pay at Counter (Card / Cash / Mobile Money)">
                                  Pay at Counter (Card / Cash / Mobile Money)
                                </option>
                                <option value="Cash / Mobile Money on Delivery">
                                  Cash / Mobile Money on Delivery
                                </option>
                                <option value="B2B Net-Terms Credit">
                                  B2B Net-Terms Credit Account
                                </option>
                              </select>
                            </div>

                            {checkoutError && (
                              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>{checkoutError}</span>
                              </div>
                            )}

                            <button
                              id="kiosk-confirm-order-btn"
                              type="submit"
                              disabled={checkoutState === 'saving'}
                              className="w-full min-h-[44px] px-4 py-2.5 text-xs font-semibold text-white bg-[#C8102E] hover:bg-[#9B0B20] disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
                            >
                              {checkoutState === 'saving'
                                ? 'Saving Order to Coldstore...'
                                : checkoutState === 'error'
                                ? `Retry Order (${formatCurrency(session.grandTotal)})`
                                : `Confirm Order (${formatCurrency(session.grandTotal)})`}
                            </button>
                          </form>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================================================================
            TAB 2: DUAL-CHANNEL CATALOG & ONE-CLICK REORDER
           =================================================================== */}
        {activeTab === 'catalog' && (
          <div className="space-y-8">
            {/* Catalog Header & Retail vs Wholesale Mode Switcher */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              <div>
                <div className="text-xs text-slate-600 mb-1">
                  Live Coldstore Inventory · Verified Stock Deduction
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight [text-wrap:balance]">
                  Coldstore Catalog &amp; Quick Reorder
                </h1>
              </div>

              {/* Retail Packs vs Wholesale B2B Bulk Segmented Control */}
              <div className="inline-flex items-center p-1 bg-white border border-slate-200 rounded-xl self-start lg:self-auto">
                <button
                  id="catalog-mode-retail"
                  type="button"
                  onClick={() => handleSwitchPricingMode('retail')}
                  className={`min-h-[40px] px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    catalogPricingMode === 'retail'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Retail Packs (Home Shoppers)
                </button>
                <button
                  id="catalog-mode-wholesale"
                  type="button"
                  onClick={() => handleSwitchPricingMode('wholesale')}
                  className={`min-h-[40px] px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    catalogPricingMode === 'wholesale'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Wholesale Bulk kg (B2B Accounts)
                </button>
              </div>
            </div>

            {/* One-Click Past Order Reorder Lookup Strip */}
            <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    One-Click Past Order Reorder
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Enter your phone number or B2B account email to reload your previous packs or
                    wholesale catch allocations into the counter basket.
                  </p>
                </div>

                <form
                  onSubmit={handleLookupReorderHistory}
                  className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto"
                >
                  <label htmlFor="reorder-lookup-input" className="sr-only">
                    Customer phone or email
                  </label>
                  <input
                    id="reorder-lookup-input"
                    type="text"
                    value={reorderContact}
                    onChange={(e) => setReorderContact(e.target.value)}
                    placeholder="Phone or email address..."
                    className="min-h-[44px] sm:w-64 px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                  <button
                    id="reorder-lookup-submit"
                    type="submit"
                    disabled={isLoadingReorderLookup}
                    className="min-h-[44px] px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {isLoadingReorderLookup ? 'Searching...' : 'Find Past Orders'}
                  </button>
                </form>
              </div>

              {reorderError && (
                <div className="text-xs text-rose-700 flex items-center gap-1.5 pt-1">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{reorderError}</span>
                </div>
              )}

              {reorderAccountData &&
                (reorderAccountData.invoices.length > 0 ||
                  reorderAccountData.receipts.length > 0) && (
                  <div className="pt-4 border-t border-slate-100 space-y-3">
                    <div className="text-xs text-slate-600">
                      Showing recent purchases for{' '}
                      <span className="font-semibold text-slate-900">
                        {reorderAccountData.account.companyName || reorderAccountData.account.name}
                      </span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {reorderAccountData.invoices.slice(0, 3).map((inv) => (
                        <div
                          key={inv.orderNumber}
                          className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div>
                            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                              <span className="font-mono tabular-nums">{inv.orderNumber}</span>
                              <span aria-hidden="true" className="text-slate-400">
                                ·
                              </span>
                              <span className="font-mono tabular-nums">
                                {formatCurrency(inv.totalAmount)}
                              </span>
                              <span aria-hidden="true" className="text-slate-400">
                                ·
                              </span>
                              <span className="text-xs font-normal text-slate-500">
                                {inv.orderDate}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {inv.items
                                .map((i) => `${i.quantity}× ${i.productName}`)
                                .join(' · ')}
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={basketBusyId === 'reorder'}
                            onClick={() =>
                              handleOneClickReorder(
                                inv.items.map((i) => ({
                                  productId: i.productId,
                                  productName: i.productName,
                                  quantity: i.quantity,
                                })),
                                inv.channel === 'wholesale' ? 'wholesale' : 'retail',
                                reorderAccountData.account.companyName ||
                                  reorderAccountData.account.name
                              )
                            }
                            className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-[#C8102E] hover:bg-[#9B0B20] rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0 self-start sm:self-auto cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Reorder Items</span>
                          </button>
                        </div>
                      ))}

                      {reorderAccountData.invoices.length === 0 &&
                        reorderAccountData.receipts.slice(0, 3).map((rec) => (
                          <div
                            key={rec.id}
                            className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div>
                              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                                <span className="font-mono tabular-nums">{rec.receiptNumber}</span>
                                <span aria-hidden="true" className="text-slate-400">
                                  ·
                                </span>
                                <span className="font-mono tabular-nums">
                                  {formatCurrency(rec.totalAmount)}
                                </span>
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5">
                                {rec.items
                                  .map((i) => `${i.quantity}× ${i.productName}`)
                                  .join(' · ')}
                              </div>
                            </div>
                            <button
                              type="button"
                              disabled={basketBusyId === 'reorder'}
                              onClick={() =>
                                handleOneClickReorder(
                                  rec.items.map((i) => ({
                                    productId: i.productId,
                                    productName: i.productName,
                                    quantity: i.quantity,
                                  })),
                                  'retail',
                                  rec.customerName
                                )
                              }
                              className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-[#C8102E] hover:bg-[#9B0B20] rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0 self-start sm:self-auto cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Reorder Items</span>
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
            </section>

            {/* Search & Category Filter Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-xl overflow-x-auto">
                {[
                  'All',
                  'Whole Fish',
                  'Fillets & Chunks',
                  'Shrimps, Prawns & Shellfish',
                  'Fish & Shrimp Powders',
                ].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCatalogCategory(cat)}
                    className={`min-h-[38px] px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      catalogCategory === cat
                        ? 'bg-slate-900 text-white font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="relative w-full md:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder="Search cuts, species, origin..."
                  aria-label="Search coldstore catalog"
                  className="w-full min-h-[44px] pl-10 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            {/* 3-Column Product Collection Grid */}
            {isLoadingCatalog ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <div
                    key={n}
                    className="h-96 bg-white border border-slate-200 rounded-2xl animate-pulse"
                  />
                ))}
              </div>
            ) : filteredCatalog.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
                <Package className="w-9 h-9 text-slate-300 mx-auto stroke-[1.5]" />
                <div className="text-base font-semibold text-slate-900">
                  No matching cuts found
                </div>
                <p className="text-sm text-slate-500">
                  Try clearing your search or switching category filters.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCatalogCategory('All');
                    setCatalogSearch('');
                  }}
                  className="min-h-[44px] px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCatalog.map((prod) => {
                  const unitPrice =
                    catalogPricingMode === 'wholesale'
                      ? prod.wholesalePricePerUnit
                      : prod.retailPricePerUnit;
                  const unitLabel =
                    catalogPricingMode === 'wholesale' ? 'kg' : prod.retailPackSize || prod.unit;
                  const addStep =
                    catalogPricingMode === 'wholesale'
                      ? Math.max(1, prod.wholesaleMinQty || 5)
                      : 1;
                  const inBasketLine = session.items.find((i) => i.productId === prod.id);

                  return (
                    <article
                      key={prod.id}
                      className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col justify-between transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div>
                        <div className="aspect-[4/3] w-full bg-slate-100 border-b border-slate-100 overflow-hidden">
                          <ProductThumbnail src={prod.imageUrl} alt={prod.name} />
                        </div>

                        <div className="p-5 space-y-2">
                          {/* Clean Unboxed Metadata */}
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                            <span>{prod.storefrontCategory}</span>
                            <span aria-hidden="true">·</span>
                            <span>{prod.origin}</span>
                            <span aria-hidden="true">·</span>
                            <span>{prod.grade}</span>
                          </div>

                          <h3 className="text-base font-semibold text-slate-900 leading-snug">
                            {prod.name}
                          </h3>

                          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                            {prod.description}
                          </p>
                        </div>
                      </div>

                      <div className="px-5 pb-5 pt-3 border-t border-slate-100 space-y-3">
                        <div className="flex items-baseline justify-between gap-2">
                          <div>
                            <span className="text-lg font-bold font-mono tabular-nums text-slate-900">
                              {formatCurrency(unitPrice)}
                            </span>
                            <span className="text-xs text-slate-500 ml-1">/ {unitLabel}</span>
                          </div>
                          <div className="text-xs font-mono tabular-nums text-slate-600">
                            {prod.inStock ? `${prod.stockKg} in cold vault` : 'Sold out'}
                          </div>
                        </div>

                        {catalogPricingMode === 'wholesale' && (
                          <div className="text-xs text-slate-500">
                            B2B Bulk Minimum: {addStep} kg · {prod.storageZone}
                          </div>
                        )}

                        <button
                          type="button"
                          disabled={!prod.inStock || basketBusyId === prod.id}
                          onClick={() => handleAddProductToBasket(prod)}
                          className="w-full min-h-[44px] px-4 py-2.5 text-xs font-semibold text-white bg-[#C8102E] hover:bg-[#9B0B20] disabled:bg-slate-200 disabled:text-slate-500 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer tabular-nums"
                        >
                          <Plus className="w-4 h-4" />
                          <span>
                            {!prod.inStock
                              ? 'Out of Stock'
                              : inBasketLine
                              ? `Add +${addStep} (${inBasketLine.quantity} in Basket)`
                              : `Add ${addStep > 1 ? `${addStep} kg ` : ''}to Counter Basket`}
                          </span>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===================================================================
            TAB 3: REAL-TIME COLD-CHAIN ORDER & DELIVERY TRACKING
           =================================================================== */}
        {activeTab === 'tracking' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div>
              <div className="text-xs text-slate-600 mb-1">
                Storefront Home Delivery (AO-XXXXX) · Wholesale Reefer Dispatch (ORD-XXXX)
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight [text-wrap:balance]">
                Real-Time Order &amp; Cold-Chain Tracking
              </h1>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
              <form
                onSubmit={(e) => handleTrackOrderSubmit(e)}
                className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end"
              >
                <div className="sm:col-span-5">
                  <label
                    htmlFor="pos-track-order-id"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    Order Reference
                  </label>
                  <input
                    id="pos-track-order-id"
                    type="text"
                    required
                    value={trackOrderNum}
                    onChange={(e) => setTrackOrderNum(e.target.value)}
                    placeholder="AO-12345 or ORD-9421"
                    className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono uppercase bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div className="sm:col-span-5">
                  <label
                    htmlFor="pos-track-contact"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    Customer Phone or Email
                  </label>
                  <input
                    id="pos-track-contact"
                    type="text"
                    required
                    value={trackContact}
                    onChange={(e) => setTrackContact(e.target.value)}
                    placeholder="Phone or email used on order"
                    className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div className="sm:col-span-2">
                  <button
                    id="pos-track-submit-btn"
                    type="submit"
                    disabled={isTrackingLoading}
                    className="w-full min-h-[44px] px-4 py-2 text-xs font-semibold text-white bg-[#C8102E] hover:bg-[#9B0B20] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                  >
                    {isTrackingLoading ? 'Checking...' : 'Track Order'}
                  </button>
                </div>
              </form>

              {recentOrders.length > 0 && (
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-slate-500">Recent orders on this terminal:</span>
                  {recentOrders.map((r) => (
                    <button
                      key={r.orderNumber}
                      type="button"
                      onClick={() => {
                        setTrackOrderNum(r.orderNumber);
                        setTrackContact(r.contact);
                        handleTrackOrderSubmit(undefined, r.orderNumber, r.contact);
                      }}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md font-mono tabular-nums cursor-pointer"
                    >
                      {r.orderNumber}
                    </button>
                  ))}
                </div>
              )}

              {trackingError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{trackingError}</span>
                </div>
              )}
            </div>

            {trackedOrder && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-1">
                      <span className="font-mono tabular-nums">{trackedOrder.orderNumber}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {trackedOrder.orderChannel === 'wholesale'
                          ? 'Wholesale Cold-Chain Dispatch'
                          : 'Retail Coldstore Order'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{trackedOrder.paymentStatus || trackedOrder.paymentMethod}</span>
                    </div>
                    <h2 className="text-xl font-bold text-slate-900">
                      {trackedOrder.erpStatus || 'Confirmed'}
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleOneClickReorder(
                        trackedOrder.items.map((i) => ({
                          productId: i.productId,
                          productName: i.productName,
                          quantity: i.quantity,
                        })),
                        trackedOrder.orderChannel === 'wholesale' ? 'wholesale' : 'retail',
                        trackedOrder.customerName
                      )
                    }
                    className="min-h-[44px] px-4 py-2 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-2 whitespace-nowrap shrink-0 self-start sm:self-auto cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reorder These Items</span>
                  </button>
                </div>

                {/* 4-Stage Cold-Chain Milestone Stepper */}
                {trackedOrder.fulfillmentStatus === 'canceled' ? (
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-800 font-medium">
                    This order was cancelled. Please contact counter staff if you need a
                    replacement allocation.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    {[
                      { key: 'confirmed', label: '01. Order Confirmed' },
                      { key: 'packing', label: '02. Weighing & Cryo-Pack' },
                      { key: 'out_for_delivery', label: '03. In Reefer Transit' },
                      { key: 'delivered', label: '04. Delivered' },
                    ].map((stage, idx, arr) => {
                      const stageOrder = arr.map((a) => a.key);
                      const currentIdx = Math.max(
                        0,
                        stageOrder.indexOf(trackedOrder.fulfillmentStatus)
                      );
                      const isDone = idx <= currentIdx;
                      return (
                        <div
                          key={stage.key}
                          className={`p-3.5 rounded-xl border ${
                            isDone
                              ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                              : 'bg-slate-50 border-slate-200 text-slate-400'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 text-xs font-semibold">
                            <span>{stage.label}</span>
                            {isDone && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Cold-Chain Metadata Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-4 border-y border-slate-100 text-xs">
                  <div>
                    <div className="text-slate-500">Customer / Account</div>
                    <div className="font-semibold text-slate-900 mt-0.5">
                      {trackedOrder.customerName}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Destination / Pickup</div>
                    <div className="font-semibold text-slate-900 mt-0.5">
                      {trackedOrder.deliveryAddress}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Cold-Chain Packaging</div>
                    <div className="font-semibold text-slate-900 mt-0.5">
                      {trackedOrder.packagingRequirement ||
                        'Insulated Cold-Chain Box (-18°C Gel Packs)'}
                    </div>
                  </div>
                </div>

                {/* Tracked Items Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs text-slate-500 font-medium">
                        <th className="py-2.5 pr-4">Product</th>
                        <th className="py-2.5 px-4 text-right">Quantity</th>
                        <th className="py-2.5 px-4 text-right">Unit Price</th>
                        <th className="py-2.5 pl-4 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {trackedOrder.items.map((item, idx) => (
                        <tr key={`${item.productId}-${idx}`}>
                          <td className="py-3 pr-4 font-medium text-slate-900">
                            {item.productName}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                            {item.quantity} {item.weightLabel || ''}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                            {formatCurrency(item.unitPrice)}
                          </td>
                          <td className="py-3 pl-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                            {formatCurrency(item.lineTotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-end gap-6 pt-2 text-sm">
                  <span className="text-slate-600">Order Total:</span>
                  <span className="text-xl font-bold font-mono tabular-nums text-slate-900">
                    {formatCurrency(trackedOrder.totalAmount)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================================================================
            TAB 4: RECEIPTS, COMMERCIAL INVOICES & B2B CREDIT STATEMENTS
           =================================================================== */}
        {activeTab === 'billing' && (
          <div className="space-y-6">
            <div>
              <div className="text-xs text-slate-600 mb-1">
                Counter POS Receipts · Commercial Wholesale Invoices · B2B Net-Terms Credit Ledger
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight [text-wrap:balance]">
                Receipts, Invoices &amp; B2B Credit Statements
              </h1>
            </div>

            {/* Verified Lookup Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6">
              <form
                onSubmit={handleBillingLookupSubmit}
                className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3"
              >
                <div className="flex-1">
                  <label
                    htmlFor="pos-billing-contact"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    Verify Customer Email or Phone Number
                  </label>
                  <input
                    id="pos-billing-contact"
                    type="text"
                    required
                    value={billingContact}
                    onChange={(e) => setBillingContact(e.target.value)}
                    placeholder="Enter your phone number or B2B billing email..."
                    className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <button
                  id="pos-billing-submit-btn"
                  type="submit"
                  disabled={isLoadingBilling}
                  className="min-h-[44px] px-5 py-2 text-xs font-semibold text-white bg-[#C8102E] hover:bg-[#9B0B20] rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {isLoadingBilling ? 'Loading Records...' : 'Load Billing & Statements'}
                </button>
              </form>

              {billingError && (
                <div className="mt-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{billingError}</span>
                </div>
              )}
            </div>

            {billingData && (
              <div className="space-y-6">
                {/* Full-Width 4-Column KPI Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white border border-slate-200 rounded-2xl p-5">
                    <div className="text-xs text-slate-500">Customer Account</div>
                    <div className="text-base font-bold text-slate-900 mt-1 truncate">
                      {billingData.account.companyName || billingData.account.name}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {billingData.account.type} · {billingData.account.paymentTerms}
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-5">
                    <div className="text-xs text-slate-500">B2B Credit Limit</div>
                    <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                      {billingData.account.creditLimitUSD > 0
                        ? formatCurrency(billingData.account.creditLimitUSD)
                        : 'Direct Settlement'}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Standing: {billingData.account.status}
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-5">
                    <div className="text-xs text-slate-500">Outstanding AR Balance</div>
                    <div
                      className={`text-2xl font-bold font-mono tabular-nums mt-1 ${
                        billingData.account.outstandingBalanceUSD > 0
                          ? 'text-amber-700'
                          : 'text-slate-900'
                      }`}
                    >
                      {formatCurrency(billingData.account.outstandingBalanceUSD)}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {billingData.account.totalOrdersCount} recorded orders
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-5">
                    <div className="text-xs text-slate-500">
                      {billingData.account.creditLimitUSD > 0
                        ? 'Available Credit'
                        : 'Cumulative Spend'}
                    </div>
                    <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
                      {billingData.account.creditLimitUSD > 0
                        ? formatCurrency(billingData.account.availableCreditUSD)
                        : formatCurrency(billingData.account.totalSpendUSD)}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Verified from Supabase Ledger
                    </div>
                  </div>
                </div>

                {/* Section Switcher & Status Filter */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="inline-flex items-center p-1 bg-white border border-slate-200 rounded-xl self-start">
                    <button
                      type="button"
                      onClick={() => setBillingSection('receipts')}
                      className={`min-h-[38px] px-4 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 cursor-pointer ${
                        billingSection === 'receipts'
                          ? 'bg-slate-900 text-white font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      POS Receipts ({billingData.receipts.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillingSection('invoices')}
                      className={`min-h-[38px] px-4 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 cursor-pointer ${
                        billingSection === 'invoices'
                          ? 'bg-slate-900 text-white font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Wholesale &amp; Delivery Invoices ({billingData.invoices.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillingSection('statement')}
                      className={`min-h-[38px] px-4 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 cursor-pointer ${
                        billingSection === 'statement'
                          ? 'bg-slate-900 text-white font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      B2B Credit Statement ({billingData.creditLedger.length})
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center p-1 bg-white border border-slate-200 rounded-xl">
                      {(
                        [
                          { id: 'all', label: 'All' },
                          { id: 'paid', label: 'Paid / Settled' },
                          { id: 'pending', label: 'On Account' },
                          { id: 'overdue', label: 'Overdue' },
                        ] as const
                      ).map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setBillingStatusFilter(f.id)}
                          className={`px-3 py-1.5 text-xs rounded-lg whitespace-nowrap shrink-0 cursor-pointer ${
                            billingStatusFilter === f.id
                              ? 'bg-slate-100 text-slate-900 font-semibold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>

                    {billingSection === 'statement' && (
                      <button
                        type="button"
                        onClick={() =>
                          triggerPrintDocument({ kind: 'statement', data: billingData })
                        }
                        className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print Credit Statement</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Sub-View A: POS Receipts Table */}
                {billingSection === 'receipts' && (
                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                    {filteredReceipts.length === 0 ? (
                      <div className="p-10 text-center text-sm text-slate-500">
                        No POS counter receipts match the selected filter.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 text-xs text-slate-500 font-medium bg-slate-50/70">
                              <th className="py-3 px-5">Receipt #</th>
                              <th className="py-3 px-4">Date</th>
                              <th className="py-3 px-4">Items</th>
                              <th className="py-3 px-4">Payment</th>
                              <th className="py-3 px-4 text-right">Total</th>
                              <th className="py-3 px-5 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredReceipts.map((rec) => (
                              <tr key={rec.id} className="hover:bg-slate-50/70">
                                <td className="py-3.5 px-5 font-mono tabular-nums font-semibold text-slate-900">
                                  {rec.receiptNumber}
                                </td>
                                <td className="py-3.5 px-4 font-mono tabular-nums text-xs text-slate-600">
                                  {rec.date.slice(0, 10)}
                                </td>
                                <td className="py-3.5 px-4 text-xs text-slate-600 max-w-xs truncate">
                                  {rec.items.map((i) => `${i.quantity}× ${i.productName}`).join(', ') ||
                                    'Counter Sale'}
                                </td>
                                <td className="py-3.5 px-4 text-xs text-slate-700">
                                  {rec.paymentMethod}
                                </td>
                                <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                                  {formatCurrency(rec.totalAmount)}
                                </td>
                                <td className="py-3.5 px-5 text-right">
                                  <div className="inline-flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        triggerPrintDocument({ kind: 'receipt', data: rec })
                                      }
                                      className="px-3 py-1.5 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg whitespace-nowrap cursor-pointer"
                                    >
                                      Print
                                    </button>
                                    {rec.items.length > 0 && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleOneClickReorder(
                                            rec.items.map((i) => ({
                                              productId: i.productId,
                                              productName: i.productName,
                                              quantity: i.quantity,
                                            })),
                                            'retail',
                                            rec.customerName
                                          )
                                        }
                                        className="px-3 py-1.5 text-xs font-semibold text-[#C8102E] hover:bg-rose-50 rounded-lg whitespace-nowrap cursor-pointer"
                                      >
                                        Reorder
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-View B: Wholesale & Storefront Commercial Invoices */}
                {billingSection === 'invoices' && (
                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                    {filteredInvoices.length === 0 ? (
                      <div className="p-10 text-center text-sm text-slate-500">
                        No invoices match the selected payment filter.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 text-xs text-slate-500 font-medium bg-slate-50/70">
                              <th className="py-3 px-5">Invoice / Order</th>
                              <th className="py-3 px-4">Date</th>
                              <th className="py-3 px-4">Channel &amp; Stage</th>
                              <th className="py-3 px-4">Billing Status</th>
                              <th className="py-3 px-4 text-right">Amount</th>
                              <th className="py-3 px-5 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredInvoices.map((inv) => (
                              <tr key={inv.orderNumber} className="hover:bg-slate-50/70">
                                <td className="py-3.5 px-5 font-mono tabular-nums font-semibold text-slate-900">
                                  {inv.orderNumber}
                                </td>
                                <td className="py-3.5 px-4 font-mono tabular-nums text-xs text-slate-600">
                                  {inv.orderDate}
                                </td>
                                <td className="py-3.5 px-4 text-xs text-slate-600">
                                  {inv.channel === 'wholesale' ? 'Wholesale B2B' : 'Storefront'} ·{' '}
                                  {inv.status}
                                </td>
                                <td className="py-3.5 px-4 text-xs font-medium">
                                  <span
                                    className={
                                      inv.paymentStatus === 'Paid'
                                        ? 'text-emerald-700'
                                        : inv.paymentStatus.includes('Overdue')
                                        ? 'text-rose-700'
                                        : 'text-amber-700'
                                    }
                                  >
                                    {inv.paymentStatus}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                                  {formatCurrency(inv.totalAmount)}
                                </td>
                                <td className="py-3.5 px-5 text-right">
                                  <div className="inline-flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        triggerPrintDocument({ kind: 'invoice', data: inv })
                                      }
                                      className="px-3 py-1.5 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg whitespace-nowrap cursor-pointer"
                                    >
                                      Print Invoice
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleOneClickReorder(
                                          inv.items.map((i) => ({
                                            productId: i.productId,
                                            productName: i.productName,
                                            quantity: i.quantity,
                                          })),
                                          inv.channel === 'wholesale' ? 'wholesale' : 'retail',
                                          inv.customerName
                                        )
                                      }
                                      className="px-3 py-1.5 text-xs font-semibold text-[#C8102E] hover:bg-rose-50 rounded-lg whitespace-nowrap cursor-pointer"
                                    >
                                      Reorder
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-View C: B2B Credit Statement Ledger */}
                {billingSection === 'statement' && (
                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                    {filteredLedger.length === 0 ? (
                      <div className="p-10 text-center text-sm text-slate-500">
                        No ledger transactions match the selected filter.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 text-xs text-slate-500 font-medium bg-slate-50/70">
                              <th className="py-3 px-5">Date</th>
                              <th className="py-3 px-4">Reference</th>
                              <th className="py-3 px-4">Description</th>
                              <th className="py-3 px-4 text-right">Charges (Debit)</th>
                              <th className="py-3 px-4 text-right">Payments (Credit)</th>
                              <th className="py-3 px-5 text-right">Running AR Balance</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredLedger.map((row) => (
                              <tr key={row.id} className="hover:bg-slate-50/70">
                                <td className="py-3.5 px-5 font-mono tabular-nums text-xs text-slate-600">
                                  {row.date}
                                </td>
                                <td className="py-3.5 px-4 font-mono tabular-nums text-xs font-semibold text-slate-900">
                                  {row.referenceId}
                                </td>
                                <td className="py-3.5 px-4 text-xs text-slate-700">
                                  {row.description} · {row.status}
                                </td>
                                <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-900">
                                  {row.debit > 0 ? formatCurrency(row.debit) : '—'}
                                </td>
                                <td className="py-3.5 px-4 text-right font-mono tabular-nums text-emerald-700">
                                  {row.credit > 0 ? formatCurrency(row.credit) : '—'}
                                </td>
                                <td className="py-3.5 px-5 text-right font-mono tabular-nums font-semibold text-slate-900">
                                  {formatCurrency(row.runningBalance)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* =====================================================================
          CLEAN FOOTER (print:hidden)
         ===================================================================== */}
      <footer className="border-t border-slate-200/80 bg-white py-4 px-6 text-xs text-slate-500 print:hidden">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Amansocean Seafoods &amp; Coldstore · Counter Terminal {normalizedReg}</span>
          <span>Cold-Chain Certified (-22°C to -60°C)</span>
        </div>
      </footer>

      {/* =====================================================================
          DEDICATED PRINTABLE DOCUMENT SHEET (ONLY VISIBLE IN @media print)
         ===================================================================== */}
      {printDoc && (
        <section className="hidden print:block bg-white text-black p-8 max-w-3xl mx-auto font-sans">
          <div className="flex items-start justify-between pb-6 border-b border-black">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Amansocean Seafoods &amp; Coldstore
              </h1>
              <p className="text-xs mt-1">
                Certified Cold-Chain Distribution &amp; Retail Counter ({normalizedReg})
              </p>
            </div>
            <div className="text-right text-xs font-mono tabular-nums">
              <div className="font-bold uppercase">
                {printDoc.kind === 'receipt'
                  ? 'POS Sales Receipt'
                  : printDoc.kind === 'invoice'
                  ? 'Commercial Invoice'
                  : 'B2B Account Credit Statement'}
              </div>
              <div className="mt-1">Printed: {new Date().toISOString().slice(0, 16).replace('T', ' ')}</div>
            </div>
          </div>

          {printDoc.kind === 'receipt' && (
            <div className="py-6 space-y-6">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <div>Customer: {printDoc.data.customerName}</div>
                  <div>Payment: {printDoc.data.paymentMethod}</div>
                </div>
                <div className="text-right font-mono tabular-nums">
                  <div>Receipt: {printDoc.data.receiptNumber}</div>
                  <div>Date: {printDoc.data.date.slice(0, 16).replace('T', ' ')}</div>
                </div>
              </div>

              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-black">
                    <th className="py-2 text-left">Item</th>
                    <th className="py-2 text-right">Qty</th>
                    <th className="py-2 text-right">Unit Price</th>
                    <th className="py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-300">
                  {printDoc.data.items.map((it, i) => (
                    <tr key={i}>
                      <td className="py-2">{it.productName}</td>
                      <td className="py-2 text-right font-mono tabular-nums">
                        {it.quantity} {it.unit}
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums">
                        {formatCurrency(it.unitPrice)}
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums">
                        {formatCurrency(it.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="pt-4 border-t border-black text-right text-sm font-bold font-mono tabular-nums">
                Total: {formatCurrency(printDoc.data.totalAmount)}
              </div>
            </div>
          )}

          {printDoc.kind === 'invoice' && (
            <div className="py-6 space-y-6">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="font-bold">{printDoc.data.customerName}</div>
                  <div>Address: {printDoc.data.deliveryAddress}</div>
                  <div>Terms: {printDoc.data.paymentTerms}</div>
                </div>
                <div className="text-right font-mono tabular-nums">
                  <div>Invoice: {printDoc.data.orderNumber}</div>
                  <div>Date: {printDoc.data.orderDate}</div>
                  <div>Status: {printDoc.data.paymentStatus}</div>
                </div>
              </div>

              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-black">
                    <th className="py-2 text-left">Description</th>
                    <th className="py-2 text-right">Quantity</th>
                    <th className="py-2 text-right">Unit Rate</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-300">
                  {printDoc.data.items.map((it, i) => (
                    <tr key={i}>
                      <td className="py-2">{it.productName}</td>
                      <td className="py-2 text-right font-mono tabular-nums">
                        {it.quantity} {it.weightLabel || ''}
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums">
                        {formatCurrency(it.unitPrice)}
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums">
                        {formatCurrency(it.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="pt-4 border-t border-black text-right text-sm font-bold font-mono tabular-nums">
                Invoice Total: {formatCurrency(printDoc.data.totalAmount)}
              </div>
            </div>
          )}

          {printDoc.kind === 'statement' && (
            <div className="py-6 space-y-6">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="font-bold">
                    {printDoc.data.account.companyName || printDoc.data.account.name}
                  </div>
                  <div>Terms: {printDoc.data.account.paymentTerms}</div>
                  <div>Contact: {printDoc.data.account.email || printDoc.data.account.phone}</div>
                </div>
                <div className="text-right font-mono tabular-nums">
                  <div>Credit Limit: {formatCurrency(printDoc.data.account.creditLimitUSD)}</div>
                  <div>
                    Outstanding Balance:{' '}
                    {formatCurrency(printDoc.data.account.outstandingBalanceUSD)}
                  </div>
                  <div>
                    Available Credit: {formatCurrency(printDoc.data.account.availableCreditUSD)}
                  </div>
                </div>
              </div>

              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-black">
                    <th className="py-2 text-left">Date</th>
                    <th className="py-2 text-left">Ref</th>
                    <th className="py-2 text-left">Description</th>
                    <th className="py-2 text-right">Debit</th>
                    <th className="py-2 text-right">Credit</th>
                    <th className="py-2 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-300">
                  {printDoc.data.creditLedger.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2 font-mono tabular-nums">{r.date}</td>
                      <td className="py-2 font-mono tabular-nums">{r.referenceId}</td>
                      <td className="py-2">{r.description}</td>
                      <td className="py-2 text-right font-mono tabular-nums">
                        {r.debit > 0 ? formatCurrency(r.debit) : '—'}
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums">
                        {r.credit > 0 ? formatCurrency(r.credit) : '—'}
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums">
                        {formatCurrency(r.runningBalance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
