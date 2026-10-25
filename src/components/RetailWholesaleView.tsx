import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  ShoppingBag, 
  Truck, 
  Tag, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  CreditCard, 
  DollarSign, 
  Receipt, 
  CheckCircle2, 
  Percent, 
  Layers, 
  Scale, 
  Building2, 
  Package, 
  ArrowRight,
  TrendingUp,
  UserCheck,
  ChevronRight,
  Edit2,
  AlertCircle,
  ShieldAlert,
  Clock,
  AlertTriangle,
  Image as ImageIcon,
  Globe,
  RefreshCw,
  MapPin,
  Phone,
  Mail,
  XCircle,
  Monitor,
  Copy,
  Check,
  FileText,
  ZoomIn
} from 'lucide-react';
import { 
  RetailWholesaleProduct, 
  RetailTransaction, 
  ClientOrder, 
  Customer, 
  RetailSaleItem, 
  QualityGrade,
  InventoryBatch 
} from '../types';
import { ProductModal } from './Modals/ProductModal';
import { resolveProductImage } from '../utils/productImageResolver';
import { ImageLightboxModal, ImageLightboxDetails } from './Common/ImageLightboxModal';
import {
  ErpStorefrontOrder,
  StorefrontFulfillmentStatus,
  fetchErpStorefrontOrders,
  updateErpStorefrontOrderStatus,
} from '../services/storefrontService';
import {
  PosRegisterSessionState,
  fetchPosRegisterSession,
  pushCashierPosSession,
  subscribePosRegisterUpdates,
  readCachedPosSession,
} from '../services/posCustomerService';
import {
  AMANSOCEAN_PRICE_LIST_PDF_URL,
  AMANSOCEAN_LOCATION,
  AMANSOCEAN_CONTACT_PHONE,
} from '../data/amansoceanProducts';

interface RetailWholesaleViewProps {
  products: RetailWholesaleProduct[];
  retailSales: RetailTransaction[];
  wholesaleOrders: ClientOrder[];
  customers: Customer[];
  batches?: InventoryBatch[];
  onCompleteRetailSale: (sale: RetailTransaction) => void;
  onOpenNewWholesaleOrder: () => void;
  onOpenWeigher: (order: ClientOrder) => void;
  onOpenInvoice: (order: ClientOrder) => void;
  onUpdateProductPricing: (productId: string, wholesalePrice: number, retailPrice: number) => void;
  onSaveProduct?: (product: RetailWholesaleProduct) => Promise<void> | void;
  onDeleteProduct?: (productId: string) => Promise<void> | void;
  onSyncOfficialPriceList?: () => Promise<void> | void;
  onNavigateToInventory?: () => void;
  onOpenPosCustomerView?: (options?: { customerContact?: string; customerId?: string }) => void;
  formatCurrency: (amount: number) => string;
}

export const RetailWholesaleView: React.FC<RetailWholesaleViewProps> = ({
  products = [],
  retailSales = [],
  wholesaleOrders = [],
  customers = [],
  batches = [],
  onCompleteRetailSale,
  onOpenNewWholesaleOrder,
  onOpenWeigher,
  onOpenInvoice,
  onUpdateProductPricing,
  onSaveProduct,
  onDeleteProduct,
  onSyncOfficialPriceList,
  onNavigateToInventory,
  onOpenPosCustomerView,
  formatCurrency
}) => {
  const [activeChannelTab, setActiveChannelTab] = useState<'retail_pos' | 'online_storefront' | 'wholesale_orders' | 'price_matrix'>('retail_pos');
  const [matrixSearch, setMatrixSearch] = useState<string>('');
  const [matrixCategory, setMatrixCategory] = useState<string>('all');
  const [syncingPriceList, setSyncingPriceList] = useState<boolean>(false);
  const [showFlyerPdfModal, setShowFlyerPdfModal] = useState<boolean>(false);
  const [lightboxDetails, setLightboxDetails] = useState<ImageLightboxDetails | null>(null);
  
  // Online Storefront Queue State
  const [storefrontOrders, setStorefrontOrders] = useState<ErpStorefrontOrder[]>([]);
  const [loadingStorefrontOrders, setLoadingStorefrontOrders] = useState<boolean>(false);
  const [storefrontError, setStorefrontError] = useState<string | null>(null);
  const [updatingOrderNumber, setUpdatingOrderNumber] = useState<string | null>(null);
  const [storefrontStatusFilter, setStorefrontStatusFilter] = useState<'all' | StorefrontFulfillmentStatus>('all');
  const [storefrontSearch, setStorefrontSearch] = useState<string>('');

  const loadStorefrontOrders = useCallback(async () => {
    setLoadingStorefrontOrders(true);
    setStorefrontError(null);
    try {
      const orders = await fetchErpStorefrontOrders();
      setStorefrontOrders(orders);
    } catch (err: any) {
      // Fallback: derive AO-XXXXX storefront orders from synced wholesaleOrders when running without an active staff API token
      const derivedFromClientOrders: ErpStorefrontOrder[] = wholesaleOrders
        .filter((o) => o.id.startsWith('AO-'))
        .map((o) => {
          let meta: any = {};
          try {
            meta = o.specialInstructions ? JSON.parse(o.specialInstructions) : {};
          } catch {}
          const statusMap: Record<string, StorefrontFulfillmentStatus> = {
            Delivered: 'delivered',
            Cancelled: 'canceled',
            'In Reefer Transit': 'out_for_delivery',
            'Cryo-Packed & Iced': 'packing',
            'Weighing & Grading': 'packing',
          };
          const resolvedStatus: StorefrontFulfillmentStatus =
            statusMap[o.status] || meta.fulfillment_status || 'confirmed';
          return {
            orderNumber: o.id,
            fulfillmentStatus: resolvedStatus,
            erpStatus: o.status,
            paymentStatus: o.paymentStatus,
            customerName: o.clientName,
            customerPhone: meta.customer_phone || o.contactPhone,
            customerEmail: meta.customer_email || o.contactEmail,
            deliveryAddress: o.deliveryAddress,
            deliveryNotes: meta.delivery_notes || null,
            paymentMethod: meta.payment_method || 'Cash / Mobile Money on Delivery',
            subtotal: Number(meta.subtotal ?? o.quotedTotalUSD),
            deliveryFee: Number(meta.delivery_fee ?? 0),
            totalAmount: Number(o.adjustedTotalUSD || o.quotedTotalUSD),
            createdAt: o.orderDate,
            items: Array.isArray(meta.items)
              ? meta.items
              : o.items.map((it) => ({
                  productId: it.speciesId,
                  productName: it.speciesName,
                  quantity: it.requestedWeightKg,
                  unitPrice: it.pricePerKg,
                  lineTotal: Number((it.requestedWeightKg * it.pricePerKg).toFixed(2)),
                  weightLabel: it.notes || '1 pack',
                })),
          };
        });
      setStorefrontOrders(derivedFromClientOrders);
      if (derivedFromClientOrders.length === 0 && err?.message && !/Missing or invalid Authorization/i.test(err.message)) {
        setStorefrontError(err.message);
      }
    } finally {
      setLoadingStorefrontOrders(false);
    }
  }, [wholesaleOrders]);

  useEffect(() => {
    loadStorefrontOrders();
  }, [loadStorefrontOrders]);

  const handleAdvanceStorefrontStatus = async (
    orderNumber: string,
    nextStatus: StorefrontFulfillmentStatus
  ) => {
    setUpdatingOrderNumber(orderNumber);
    setStorefrontError(null);
    try {
      const updated = await updateErpStorefrontOrderStatus(orderNumber, nextStatus);
      setStorefrontOrders((prev) =>
        prev.map((order) =>
          order.orderNumber === orderNumber
            ? {
                ...order,
                fulfillmentStatus: updated.fulfillmentStatus,
                erpStatus: updated.erpStatus,
                paymentStatus:
                  updated.fulfillmentStatus === 'delivered' ? 'Paid' : order.paymentStatus,
              }
            : order
        )
      );
    } catch (err: any) {
      setStorefrontError(err?.message || 'Unable to update storefront order fulfillment stage.');
    } finally {
      setUpdatingOrderNumber(null);
    }
  };

  // Product & Image Management Modal State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<RetailWholesaleProduct | null>(null);
  
  // POS State
  const [posSearch, setPosSearch] = useState('');
  const [posCategory, setPosCategory] = useState<string>('all');
  const [posPricingMode, setPosPricingMode] = useState<'retail' | 'wholesale'>('retail');
  const [copiedDisplayLink, setCopiedDisplayLink] = useState<boolean>(false);
  const [posCart, setPosCart] = useState<{ product: RetailWholesaleProduct; quantity: number }[]>([]);
  const [posCustomerName, setPosCustomerName] = useState('Walk-in Customer');
  const [posDiscountPct, setPosDiscountPct] = useState<number>(0);
  const [posPaymentMethod, setPosPaymentMethod] = useState<'Credit Card' | 'Cash' | 'Apple Pay / Contactless' | 'Store Credit' | 'Customer Credit Account'>('Credit Card');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [overrideAuthorizedBy, setOverrideAuthorizedBy] = useState<string>('');
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [isOverrideAcknowledged, setIsOverrideAcknowledged] = useState<boolean>(false);
  const [wholesaleFilter, setWholesaleFilter] = useState<'all' | 'credit' | 'paid'>('all');
  const [completedReceiptModal, setCompletedReceiptModal] = useState<RetailTransaction | null>(null);

  const isApplyingRemotePosRef = useRef<boolean>(false);
  const lastAppliedPosVersionRef = useRef<number>(0);

  const getActivePosUnitPrice = useCallback(
    (product: RetailWholesaleProduct): number => {
      if (posPricingMode === 'wholesale' && Number(product.wholesalePricePerUnit) > 0) {
        return Number(product.wholesalePricePerUnit);
      }
      return Number(product.retailPricePerUnit);
    },
    [posPricingMode]
  );

  // Selected customer for credit accounts
  const selectedCreditCustomer = customers.find(c => c.id === selectedCustomerId);
  const creditAvailable = selectedCreditCustomer ? Math.max(0, selectedCreditCustomer.creditLimitUSD - selectedCreditCustomer.outstandingBalanceUSD) : 0;
  const isCustomerCreditHold = selectedCreditCustomer?.status === 'Credit Hold';

  // Price Matrix Edit State
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editWholesalePrice, setEditWholesalePrice] = useState<string>('');
  const [editRetailPrice, setEditRetailPrice] = useState<string>('');

  // POS Cart Calculations
  const cartSubtotal = posCart.reduce((sum, item) => sum + (getActivePosUnitPrice(item.product) * item.quantity), 0);
  const discountAmount = (cartSubtotal * posDiscountPct) / 100;
  const taxableAmount = cartSubtotal - discountAmount;
  const taxAmount = taxableAmount * 0.0875; // 8.75% local sales tax
  const cartGrandTotal = taxableAmount + taxAmount;
  const cartCostTotal = posCart.reduce((sum, item) => sum + (item.product.costPricePerUnit * item.quantity), 0);

  // Reconcile incoming Customer View / Kiosk basket actions into Cashier POS state
  const applyRemoteSessionToPos = useCallback(
    (session: PosRegisterSessionState) => {
      if (!session || session.version <= lastAppliedPosVersionRef.current) return;
      lastAppliedPosVersionRef.current = session.version;
      isApplyingRemotePosRef.current = true;

      setPosPricingMode(session.pricingMode === 'wholesale' ? 'wholesale' : 'retail');
      if (session.customerName) {
        setPosCustomerName(session.customerName);
      }
      if (typeof session.discountPct === 'number') {
        setPosDiscountPct(session.discountPct);
      }
      if (session.customerAccount?.id) {
        setSelectedCustomerId(session.customerAccount.id);
      }

      const mappedCart: { product: RetailWholesaleProduct; quantity: number }[] = session.items
        .filter((line) => line.quantity > 0)
        .map((line) => {
          const existingProd = products.find(
            (p) => p.id === line.productId || p.sku === line.sku
          );
          const fallbackProduct: RetailWholesaleProduct = existingProd || {
            id: line.productId,
            sku: line.sku || line.productId.toUpperCase(),
            speciesId: 'spec-prawns',
            name: line.name,
            cutType: 'IQF Flash Frozen Box',
            category: 'Crustacean',
            grade: (line.grade as QualityGrade) || 'Grade #1',
            unit: line.unit === 'pack' ? 'pack' : 'kg',
            retailPackSize: line.unit,
            wholesalePricePerUnit: line.wholesalePricePerUnit || line.unitPrice,
            retailPricePerUnit: line.retailPricePerUnit || line.unitPrice,
            costPricePerUnit: Number(((line.wholesalePricePerUnit || line.unitPrice) * 0.72).toFixed(2)),
            stockKg: 50,
            wholesaleMinQty: 5,
            origin: 'Amansocean Coldstore',
            isAvailableForRetail: true,
            isAvailableForWholesale: true,
            imageUrl: line.imageUrl || '',
          };
          return {
            product: fallbackProduct,
            quantity: line.quantity,
          };
        });

      setPosCart(mappedCart);

      setTimeout(() => {
        isApplyingRemotePosRef.current = false;
      }, 60);
    },
    [products]
  );

  // Hydrate initial register state & subscribe to Customer View / Secondary Kiosk updates
  useEffect(() => {
    const cached = readCachedPosSession('REG-1');
    if (cached && cached.items.length > 0 && posCart.length === 0) {
      applyRemoteSessionToPos(cached);
    }

    const unsubscribe = subscribePosRegisterUpdates('REG-1', (incoming) => {
      applyRemoteSessionToPos(incoming);
    });

    const pollInterval = window.setInterval(async () => {
      try {
        const remote = await fetchPosRegisterSession('REG-1');
        if (remote && remote.sourceId !== 'cashier-pos' && remote.version > lastAppliedPosVersionRef.current) {
          applyRemoteSessionToPos(remote);
        }
      } catch {
        // Ignore transient offline poll errors
      }
    }, 3500);

    return () => {
      unsubscribe();
      window.clearInterval(pollInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyRemoteSessionToPos]);

  // Push Cashier POS basket, customer account, pricing tier & completed receipt to Customer View
  useEffect(() => {
    if (isApplyingRemotePosRef.current) return;

    const timer = window.setTimeout(() => {
      const customerSummary = selectedCreditCustomer
        ? {
            id: selectedCreditCustomer.id,
            name: selectedCreditCustomer.name,
            companyName: selectedCreditCustomer.companyName,
            type: selectedCreditCustomer.type,
            tier: selectedCreditCustomer.tier,
            email: selectedCreditCustomer.email,
            phone: selectedCreditCustomer.phone,
            paymentTerms: selectedCreditCustomer.paymentTerms,
            creditLimitUSD: selectedCreditCustomer.creditLimitUSD,
            outstandingBalanceUSD: selectedCreditCustomer.outstandingBalanceUSD,
            availableCreditUSD: Math.max(
              0,
              selectedCreditCustomer.creditLimitUSD - selectedCreditCustomer.outstandingBalanceUSD
            ),
            status: selectedCreditCustomer.status,
          }
        : null;

      const receiptSummary = completedReceiptModal
        ? {
            id: completedReceiptModal.id,
            receiptNumber: completedReceiptModal.receiptNumber,
            date: completedReceiptModal.date,
            customerName: completedReceiptModal.customerName,
            saleType: completedReceiptModal.saleType || 'Direct Payment',
            creditTerms: completedReceiptModal.creditTerms,
            paymentMethod: completedReceiptModal.paymentMethod,
            subtotal: completedReceiptModal.subtotal,
            discountAmount: completedReceiptModal.discountAmount,
            taxAmount: completedReceiptModal.taxAmount,
            totalAmount: completedReceiptModal.totalAmount,
            items: completedReceiptModal.items.map((it) => ({
              productId: it.productId,
              productName: it.productName,
              cutType: it.cutType,
              quantity: it.quantity,
              unit: it.unit,
              unitPrice: it.unitPrice,
              lineTotal: it.lineTotal,
            })),
          }
        : null;

      pushCashierPosSession({
        registerId: 'REG-1',
        pricingMode: posPricingMode,
        customerName:
          selectedCreditCustomer
            ? `${selectedCreditCustomer.name} (${selectedCreditCustomer.companyName})`
            : posCustomerName || 'Walk-in Customer',
        customerAccount: customerSummary,
        items: posCart.map((item) => {
          const activePrice = getActivePosUnitPrice(item.product);
          return {
            productId: item.product.id,
            sku: item.product.sku,
            name: item.product.name,
            cutType: item.product.cutType,
            grade: item.product.grade,
            unit: posPricingMode === 'wholesale' ? 'kg' : item.product.unit,
            quantity: item.quantity,
            retailPricePerUnit: item.product.retailPricePerUnit,
            wholesalePricePerUnit: item.product.wholesalePricePerUnit,
            unitPrice: activePrice,
            lineTotal: Number((activePrice * item.quantity).toFixed(2)),
            storageZone: item.product.storageZone || 'Commercial Cold Storage (-22°C)',
            imageUrl: item.product.imageUrl || '',
          };
        }),
        discountPct: posDiscountPct,
        paymentMethod: posPaymentMethod,
        allowCustomerBasketEdits: true,
        lastCompletedReceipt: receiptSummary,
      })
        .then((synced) => {
          if (synced?.version) {
            lastAppliedPosVersionRef.current = Math.max(
              lastAppliedPosVersionRef.current,
              synced.version
            );
          }
        })
        .catch(() => {});
    }, 150);

    return () => window.clearTimeout(timer);
  }, [
    posCart,
    posPricingMode,
    posCustomerName,
    posDiscountPct,
    posPaymentMethod,
    selectedCreditCustomer,
    completedReceiptModal,
    getActivePosUnitPrice,
  ]);

  const handleCopyCounterDisplayLink = async () => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('view', 'pos-customer');
    url.searchParams.set('register', 'REG-1');
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopiedDisplayLink(true);
      window.setTimeout(() => setCopiedDisplayLink(false), 2400);
    } catch {
      setCopiedDisplayLink(true);
      window.setTimeout(() => setCopiedDisplayLink(false), 2400);
    }
  };

  // Credit check logic
  const isCreditAccountSale = posPaymentMethod === 'Customer Credit Account';
  const exceedsCreditLimit = isCreditAccountSale && selectedCreditCustomer 
    ? (selectedCreditCustomer.outstandingBalanceUSD + cartGrandTotal > selectedCreditCustomer.creditLimitUSD)
    : false;
  const requiresCreditOverride = isCreditAccountSale && (isCustomerCreditHold || exceedsCreditLimit);
  const canSubmitCreditSale = !isCreditAccountSale || (
    selectedCreditCustomer && (!requiresCreditOverride || (isOverrideAcknowledged && overrideAuthorizedBy.trim().length > 0))
  );

  // Add Item to POS Cart
  const handleAddToCart = (product: RetailWholesaleProduct) => {
    setPosCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: parseFloat((item.quantity + (product.unit === 'pack' ? 1 : 0.5)).toFixed(2)) }
            : item
        );
      }
      return [...prev, { product, quantity: product.unit === 'pack' ? 1 : 1.0 }];
    });
  };

  const handleUpdateCartQty = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      setPosCart(prev => prev.filter(item => item.product.id !== productId));
    } else {
      setPosCart(prev => prev.map(item => item.product.id === productId ? { ...item, quantity: newQty } : item));
    }
  };

  const handleRemoveFromCart = (productId: string) => {
    setPosCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const handleClearCart = () => {
    setPosCart([]);
    setPosDiscountPct(0);
    setPosCustomerName('Walk-in Customer');
    setSelectedCustomerId('');
    setOverrideAuthorizedBy('');
    setOverrideReason('');
    setIsOverrideAcknowledged(false);
  };

  const handleCheckoutSubmit = () => {
    if (posCart.length === 0) return;
    if (isCreditAccountSale && !canSubmitCreditSale) return;

    const saleItems: RetailSaleItem[] = posCart.map(item => {
      const unitPrice = getActivePosUnitPrice(item.product);
      return {
        productId: item.product.id,
        productName: item.product.name,
        cutType: item.product.cutType,
        quantity: item.quantity,
        unit: posPricingMode === 'wholesale' ? 'kg' : item.product.unit,
        unitPrice,
        costPrice: item.product.costPricePerUnit,
        lineTotal: parseFloat((unitPrice * item.quantity).toFixed(2))
      };
    });

    const finalCustName = isCreditAccountSale && selectedCreditCustomer 
      ? `${selectedCreditCustomer.name} (${selectedCreditCustomer.companyName})` 
      : (posCustomerName.trim() || 'Counter Walk-in');

    const newSale: RetailTransaction = {
      id: `REC-${(5020 + retailSales.length + 1).toString()}`,
      receiptNumber: `POS-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      date: new Date().toISOString().replace('T', ' ').slice(0, 16),
      customerId: isCreditAccountSale && selectedCreditCustomer ? selectedCreditCustomer.id : undefined,
      customerName: finalCustName,
      saleType: isCreditAccountSale ? 'Credit Sale (On Account)' : 'Direct Payment',
      creditTerms: isCreditAccountSale && selectedCreditCustomer ? selectedCreditCustomer.paymentTerms : undefined,
      creditAuthorizedBy: isCreditAccountSale && requiresCreditOverride ? overrideAuthorizedBy.trim() : undefined,
      creditOverrideNote: isCreditAccountSale && requiresCreditOverride ? overrideReason.trim() : undefined,
      items: saleItems,
      subtotal: cartSubtotal,
      discountAmount: discountAmount,
      taxAmount: taxAmount,
      totalAmount: cartGrandTotal,
      costTotal: cartCostTotal,
      grossMargin: cartGrandTotal - cartCostTotal,
      paymentMethod: posPaymentMethod,
      cashierName: 'Anna Vance (Lead Fishmonger)',
      status: 'Completed'
    };

    onCompleteRetailSale(newSale);
    setCompletedReceiptModal(newSale);
    handleClearCart();
  };

  const handleSavePriceEdit = (productId: string) => {
    const ws = parseFloat(editWholesalePrice);
    const rt = parseFloat(editRetailPrice);
    if (!isNaN(ws) && !isNaN(rt) && ws > 0 && rt > 0) {
      onUpdateProductPricing(productId, ws, rt);
    }
    setEditingPriceId(null);
  };

  const filteredPOSProducts = products.filter(p => {
    const matchesCategory = posCategory === 'all' || p.category === posCategory;
    const matchesSearch = p.name.toLowerCase().includes(posSearch.toLowerCase()) ||
                          p.cutType.toLowerCase().includes(posSearch.toLowerCase()) ||
                          p.sku.toLowerCase().includes(posSearch.toLowerCase());
    return p.isAvailableForRetail && matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Channel Navigation Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 xl:gap-6 bg-white p-4 sm:p-5 lg:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs min-w-0 max-w-full overflow-hidden">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="p-2 bg-indigo-100/80 text-indigo-700 rounded-xl shrink-0">
              <ShoppingBag className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight min-w-0 break-words">
              Retail &amp; Wholesale Sales Hub
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-relaxed max-w-2xl">
            Dual-channel execution: Walk-in counter POS, B2B restaurant bulk contracts, and dual price matrices.
          </p>
        </div>

        <div
          role="group"
          aria-label="Sales Hub Channels and POS Customer Display"
          className="bg-slate-100 p-1.5 rounded-2xl border border-slate-200 grid grid-cols-1 min-[360px]:grid-cols-2 sm:grid-cols-3 gap-1.5 lg:flex lg:flex-wrap lg:items-center lg:gap-1 w-full lg:w-auto lg:self-start xl:self-auto min-w-0 max-w-full"
        >
          <button
            id="tab-retail-pos"
            type="button"
            aria-pressed={activeChannelTab === 'retail_pos'}
            onClick={() => setActiveChannelTab('retail_pos')}
            className={`w-full lg:w-auto min-w-0 min-h-[44px] lg:min-h-[40px] px-3 sm:px-3.5 xl:px-4 py-2 rounded-xl text-[11px] sm:text-xs font-bold leading-tight text-left lg:text-center transition-all duration-150 active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 cursor-pointer flex items-center justify-start lg:justify-center gap-2 whitespace-normal lg:whitespace-nowrap lg:shrink-0 ${
              activeChannelTab === 'retail_pos'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <ShoppingBag className="w-4 h-4 shrink-0" />
            <span>Retail Counter POS</span>
          </button>

          <button
            id="tab-online-storefront"
            type="button"
            aria-pressed={activeChannelTab === 'online_storefront'}
            onClick={() => {
              setActiveChannelTab('online_storefront');
              loadStorefrontOrders();
            }}
            className={`w-full lg:w-auto min-w-0 min-h-[44px] lg:min-h-[40px] px-3 sm:px-3.5 xl:px-4 py-2 rounded-xl text-[11px] sm:text-xs font-bold leading-tight text-left lg:text-center tabular-nums transition-all duration-150 active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 cursor-pointer flex items-center justify-start lg:justify-center gap-2 whitespace-normal lg:whitespace-nowrap lg:shrink-0 ${
              activeChannelTab === 'online_storefront'
                ? 'bg-sky-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Globe className="w-4 h-4 shrink-0" />
            <span>Online Storefront ({storefrontOrders.length})</span>
          </button>

          <button
            id="tab-wholesale-orders"
            type="button"
            aria-pressed={activeChannelTab === 'wholesale_orders'}
            onClick={() => setActiveChannelTab('wholesale_orders')}
            className={`w-full lg:w-auto min-w-0 min-h-[44px] lg:min-h-[40px] px-3 sm:px-3.5 xl:px-4 py-2 rounded-xl text-[11px] sm:text-xs font-bold leading-tight text-left lg:text-center tabular-nums transition-all duration-150 active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 cursor-pointer flex items-center justify-start lg:justify-center gap-2 whitespace-normal lg:whitespace-nowrap lg:shrink-0 ${
              activeChannelTab === 'wholesale_orders'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Truck className="w-4 h-4 shrink-0" />
            <span>Wholesale Bulk ({wholesaleOrders.length})</span>
          </button>

          <button
            id="tab-price-matrix"
            type="button"
            aria-pressed={activeChannelTab === 'price_matrix'}
            onClick={() => setActiveChannelTab('price_matrix')}
            className={`w-full lg:w-auto min-w-0 min-h-[44px] lg:min-h-[40px] px-3 sm:px-3.5 xl:px-4 py-2 rounded-xl text-[11px] sm:text-xs font-bold leading-tight text-left lg:text-center transition-all duration-150 active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 cursor-pointer flex items-center justify-start lg:justify-center gap-2 whitespace-normal lg:whitespace-nowrap lg:shrink-0 ${
              activeChannelTab === 'price_matrix'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Tag className="w-4 h-4 shrink-0" />
            <span>Dual Price Book</span>
          </button>

          {onOpenPosCustomerView && (
            <button
              id="btn-launch-pos-customer-view"
              type="button"
              onClick={() =>
                onOpenPosCustomerView({
                  customerContact:
                    selectedCreditCustomer?.email || selectedCreditCustomer?.phone || '',
                  customerId: selectedCreditCustomer?.id || '',
                })
              }
              className="min-[360px]:col-span-2 sm:col-span-2 w-full lg:w-auto min-w-0 min-h-[44px] lg:min-h-[40px] px-3.5 xl:px-4 py-2 rounded-xl text-[11px] sm:text-xs font-bold leading-tight bg-[#C8102E] hover:bg-[#9B0B20] text-white shadow-xs transition-all duration-150 active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8102E] cursor-pointer flex items-center justify-center gap-2 whitespace-normal lg:whitespace-nowrap lg:shrink-0"
              title="Open POS Customer View Display & Kiosk"
            >
              <Monitor className="w-4 h-4 shrink-0" />
              <span>Customer View</span>
            </button>
          )}
        </div>
      </div>

      {/* 1. RETAIL POINT-OF-SALE (POS) VIEW */}
      {activeChannelTab === 'retail_pos' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 7 Cols: Product Selection Grid */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:max-w-xs">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search retail fish cuts..."
                  value={posSearch}
                  onChange={(e) => setPosSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                {['all', 'Pelagic', 'Groundfish', 'Crustacean', 'Mollusk', 'Salmonid'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setPosCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                      posCategory === cat
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat === 'all' ? 'All Cuts' : cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Product Card Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredPOSProducts.map(prod => {
                const linkedBatch = batches.find(b => 
                  (prod.linkedBatchId && b.id === prod.linkedBatchId) ||
                  (b.linkedProductId && b.linkedProductId === prod.id) ||
                  (b.productSku && prod.sku && b.productSku.toLowerCase() === prod.sku.toLowerCase()) ||
                  b.id === `LOT-RET-${prod.id.replace('prod-', '')}`
                );
                const resolvedImg = resolveProductImage(prod, linkedBatch);

                return (
                <div 
                  key={prod.id}
                  onClick={() => handleAddToCart(prod)}
                  className="bg-white rounded-3xl border border-slate-200 p-4 shadow-xs hover:border-emerald-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-3 group"
                >
                  <div className="flex items-start gap-3">
                    {resolvedImg.url ? (
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          setLightboxDetails({
                            imageUrl: resolvedImg.url!,
                            title: prod.name,
                            subtitle: `${prod.cutType} · SKU: ${prod.sku}`,
                            sourceLabel: resolvedImg.source === 'product' ? 'Product Catalog Photo' : 'Intake Catch Photo',
                            sourceType: resolvedImg.source === 'product' ? 'product' : 'batch',
                            sku: prod.sku,
                            lotId: linkedBatch?.id,
                            grade: prod.grade,
                            origin: prod.origin || linkedBatch?.landingPort,
                          });
                        }}
                        className="relative group/thumb shrink-0 cursor-zoom-in rounded-2xl overflow-hidden"
                        title="Click to preview high-resolution image"
                      >
                        <img 
                          src={resolvedImg.url} 
                          alt={resolvedImg.alt} 
                          loading="lazy"
                          decoding="async"
                          className="w-16 h-16 rounded-2xl object-cover border border-slate-200 shrink-0 bg-slate-100 group-hover/thumb:scale-105 transition-transform"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/logofrostly1.png';
                          }}
                        />
                        <div className="absolute inset-0 bg-slate-950/30 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center text-white">
                          <ZoomIn className="w-4 h-4 drop-shadow" />
                        </div>
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-2xl border border-slate-200 shrink-0 bg-slate-100 flex items-center justify-center text-slate-400">
                        <Package className="w-6 h-6" />
                      </div>
                    )}
                    <div>
                      <div className="font-bold text-slate-900 text-xs leading-snug group-hover:text-emerald-700 transition-colors">
                        {prod.name}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{prod.cutType}</div>
                      <span className="inline-block mt-1 px-2 py-0.5 bg-emerald-50 text-emerald-800 text-[10px] font-bold rounded-md">
                        {prod.grade}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">
                        {posPricingMode === 'wholesale' ? 'Wholesale Tier' : 'Retail Price'}
                      </div>
                      <div className="text-base font-black text-slate-900 font-mono-code">
                        {formatCurrency(getActivePosUnitPrice(prod))}
                        <span className="text-[11px] font-normal text-slate-500">
                          /{posPricingMode === 'wholesale' ? 'kg' : prod.unit}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">In Stock</div>
                      <div className="text-xs font-bold text-slate-700 font-mono-code">{prod.stockKg} kg</div>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          </div>

          {/* Right 5 Cols: Interactive POS Counter Checkout Cart */}
          <div id="pos-cart-container" className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4 sticky top-24">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Counter Order Cart</h2>
                  <p className="text-[11px] text-slate-400">Direct POS Register #1 · Live Customer Sync</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyCounterDisplayLink}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  title="Copy URL for secondary customer-facing tablet/screen"
                >
                  {copiedDisplayLink ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>Link Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Pair Screen</span>
                    </>
                  )}
                </button>

                {posCart.length > 0 && (
                  <button
                    onClick={handleClearCart}
                    className="text-xs text-rose-600 hover:text-rose-800 font-bold cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* POS Pricing Tier Toggle: Retail Pack vs Wholesale Bulk */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setPosPricingMode('retail')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  posPricingMode === 'retail'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Retail Pack Tier
              </button>
              <button
                type="button"
                onClick={() => setPosPricingMode('wholesale')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  posPricingMode === 'wholesale'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Wholesale B2B Tier
              </button>
            </div>

            {/* Customer Type / VIP Selector */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-500 uppercase">Customer Name / VIP Club</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Walk-in Customer"
                  value={posCustomerName}
                  onChange={(e) => setPosCustomerName(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium"
                />
                <select
                  value={posDiscountPct}
                  onChange={(e) => setPosDiscountPct(Number(e.target.value))}
                  className="px-2.5 py-1.5 text-xs bg-indigo-50 text-indigo-900 border border-indigo-200 rounded-xl font-bold cursor-pointer"
                >
                  <option value={0}>0% Disc</option>
                  <option value={5}>VIP 5%</option>
                  <option value={10}>VIP 10%</option>
                  <option value={15}>Chef 15%</option>
                </select>
              </div>
            </div>

            {/* Cart Items List */}
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {posCart.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  <ShoppingBag className="w-8 h-8 mx-auto mb-2 text-slate-300 stroke-1" />
                  Cart is empty. Click any seafood item on the left to add.
                </div>
              ) : (
                posCart.map(item => {
                  const linkedBatch = batches.find(b => 
                    (item.product.linkedBatchId && b.id === item.product.linkedBatchId) ||
                    (b.linkedProductId && b.linkedProductId === item.product.id) ||
                    (b.productSku && item.product.sku && b.productSku.toLowerCase() === item.product.sku.toLowerCase()) ||
                    b.id === `LOT-RET-${item.product.id.replace('prod-', '')}`
                  );
                  const resolvedImg = resolveProductImage(item.product, linkedBatch);

                  return (
                  <div 
                    key={item.product.id}
                    className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-2.5 text-xs"
                  >
                    {/* Item Thumbnail */}
                    {resolvedImg.url ? (
                      <button
                        type="button"
                        onClick={() => setLightboxDetails({
                          imageUrl: resolvedImg.url!,
                          title: item.product.name,
                          subtitle: `${item.product.cutType} · SKU: ${item.product.sku}`,
                          sourceLabel: resolvedImg.source === 'product' ? 'Product Catalog Photo' : 'Intake Catch Photo',
                          sourceType: resolvedImg.source === 'product' ? 'product' : 'batch',
                          sku: item.product.sku,
                          lotId: linkedBatch?.id,
                          grade: item.product.grade,
                          origin: item.product.origin || linkedBatch?.landingPort,
                        })}
                        className="relative group/thumb shrink-0 rounded-xl overflow-hidden border border-slate-200 cursor-zoom-in"
                        title="Click to preview enlarged photo"
                      >
                        <img
                          src={resolvedImg.url}
                          alt={item.product.name}
                          loading="lazy"
                          decoding="async"
                          className="w-10 h-10 object-cover bg-slate-100 group-hover/thumb:scale-105 transition-transform"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/logofrostly1.png';
                          }}
                        />
                        <div className="absolute inset-0 bg-slate-950/30 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center text-white">
                          <ZoomIn className="w-3.5 h-3.5" />
                        </div>
                      </button>
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-slate-200/60 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                        <Package className="w-4 h-4" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-900 truncate">{item.product.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {formatCurrency(getActivePosUnitPrice(item.product))}/{posPricingMode === 'wholesale' ? 'kg' : item.product.unit}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5">
                        <button
                          onClick={() => handleUpdateCartQty(item.product.id, parseFloat((item.quantity - (item.product.unit === 'pack' ? 1 : 0.25)).toFixed(2)))}
                          className="w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-12 text-center font-mono-code font-bold text-slate-900 text-xs">
                          {item.quantity} {posPricingMode === 'wholesale' ? 'kg' : item.product.unit}
                        </span>
                        <button
                          onClick={() => handleUpdateCartQty(item.product.id, parseFloat((item.quantity + (item.product.unit === 'pack' ? 1 : 0.25)).toFixed(2)))}
                          className="w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="font-mono-code font-black text-slate-900 w-16 text-right">
                        {formatCurrency(getActivePosUnitPrice(item.product) * item.quantity)}
                      </div>

                      <button
                        onClick={() => handleRemoveFromCart(item.product.id)}
                        className="text-slate-400 hover:text-rose-600 cursor-pointer p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
            </div>

            {/* Calculations Breakdown */}
            {posCart.length > 0 && (
              <div className="pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal:</span>
                  <span className="font-mono-code text-slate-800 font-bold">{formatCurrency(cartSubtotal)}</span>
                </div>

                {posDiscountPct > 0 && (
                  <div className="flex justify-between text-indigo-600 font-bold">
                    <span>VIP Member Discount ({posDiscountPct}%):</span>
                    <span className="font-mono-code">-{formatCurrency(discountAmount)}</span>
                  </div>
                )}

                <div className="flex justify-between text-slate-500">
                  <span>Sales Tax (8.75%):</span>
                  <span className="font-mono-code text-slate-800">{formatCurrency(taxAmount)}</span>
                </div>

                <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-200">
                  <span>Total Amount:</span>
                  <span className="font-mono-code text-emerald-700 text-xl">{formatCurrency(cartGrandTotal)}</span>
                </div>

                {/* Payment Method Selector */}
                <div className="pt-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Payment Method</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {(['Credit Card', 'Cash', 'Apple Pay / Contactless', 'Store Credit', 'Customer Credit Account'] as const).map(method => (
                      <button
                        key={method}
                        onClick={() => setPosPaymentMethod(method)}
                        className={`py-1.5 px-2 rounded-xl text-[10px] sm:text-[11px] font-bold transition-all cursor-pointer truncate ${
                          posPaymentMethod === method
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        } ${method === 'Customer Credit Account' ? 'col-span-2 sm:col-span-2 border border-indigo-200 text-indigo-900' : ''}`}
                      >
                        {method === 'Customer Credit Account' ? '🏛️ Customer Credit Account' : method}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Customer Account Credit Facility Panel */}
                {isCreditAccountSale && (
                  <div className="p-3 bg-indigo-50/70 rounded-2xl border border-indigo-100 space-y-3 animate-in fade-in duration-150">
                    <div>
                      <label className="block text-[10px] font-bold text-indigo-900 uppercase mb-1">
                        Select Commercial Credit Account
                      </label>
                      <select
                        value={selectedCustomerId}
                        onChange={(e) => {
                          setSelectedCustomerId(e.target.value);
                          setIsOverrideAcknowledged(false);
                          setOverrideAuthorizedBy('');
                          setOverrideReason('');
                        }}
                        className="w-full px-3 py-2 text-xs bg-white border border-indigo-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">-- Choose Customer Facility --</option>
                        {customers.map(cust => (
                          <option key={cust.id} value={cust.id}>
                            {cust.name} ({cust.companyName}) • Terms: {cust.paymentTerms}
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedCreditCustomer ? (
                      <div className="space-y-2 text-xs">
                        <div className="p-2.5 bg-white rounded-xl border border-indigo-100 space-y-1.5">
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-slate-500">Facility Terms:</span>
                            <span className="font-bold text-indigo-700">{selectedCreditCustomer.paymentTerms}</span>
                          </div>
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-slate-500">Credit Limit:</span>
                            <span className="font-mono-code font-bold text-slate-800">{formatCurrency(selectedCreditCustomer.creditLimitUSD)}</span>
                          </div>
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-slate-500">Current Balance Due:</span>
                            <span className="font-mono-code font-bold text-rose-600">{formatCurrency(selectedCreditCustomer.outstandingBalanceUSD)}</span>
                          </div>
                          <div className="flex justify-between items-center text-[11px] pt-1 border-t border-slate-100">
                            <span className="text-slate-600 font-semibold">Available Credit:</span>
                            <span className={`font-mono-code font-bold ${creditAvailable >= cartGrandTotal ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {formatCurrency(creditAvailable)}
                            </span>
                          </div>

                          {/* Credit bar */}
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden mt-1">
                            <div 
                              className={`h-full rounded-full ${
                                (selectedCreditCustomer.outstandingBalanceUSD + cartGrandTotal) > selectedCreditCustomer.creditLimitUSD
                                  ? 'bg-rose-500'
                                  : 'bg-indigo-600'
                              }`}
                              style={{
                                width: `${Math.min(100, ((selectedCreditCustomer.outstandingBalanceUSD + cartGrandTotal) / (selectedCreditCustomer.creditLimitUSD || 1)) * 100)}%`
                              }}
                            />
                          </div>
                        </div>

                        {/* Credit Hold or Limit Exceeded Warning */}
                        {requiresCreditOverride && (
                          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-2 text-rose-900 text-xs">
                            <div className="flex items-center gap-1.5 font-bold text-rose-800">
                              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                              <span>
                                {isCustomerCreditHold ? 'Customer is on Credit Hold' : 'Charge Exceeds Approved Credit Limit'}
                              </span>
                            </div>
                            <p className="text-[11px] text-rose-700 leading-snug">
                              {isCustomerCreditHold 
                                ? 'Account has administrative hold. Manager authorization is required to post this credit sale.'
                                : `Adding ${formatCurrency(cartGrandTotal)} exceeds credit line by ${formatCurrency((selectedCreditCustomer.outstandingBalanceUSD + cartGrandTotal) - selectedCreditCustomer.creditLimitUSD)}.`
                              }
                            </p>

                            <div className="pt-2 border-t border-rose-200/80 space-y-2">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isOverrideAcknowledged}
                                  onChange={(e) => setIsOverrideAcknowledged(e.target.checked)}
                                  className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                                />
                                <span className="text-[11px] font-bold text-slate-800">
                                  Authorize Manager Credit Override
                                </span>
                              </label>

                              {isOverrideAcknowledged && (
                                <div className="space-y-1.5 pt-1">
                                  <input
                                    type="text"
                                    placeholder="Manager Name / PIN (Required)"
                                    value={overrideAuthorizedBy}
                                    onChange={(e) => setOverrideAuthorizedBy(e.target.value)}
                                    className="w-full px-2.5 py-1.5 bg-white border border-rose-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:ring-1 focus:ring-rose-500"
                                  />
                                  <input
                                    type="text"
                                    placeholder="Override reason / authorization memo"
                                    value={overrideReason}
                                    onChange={(e) => setOverrideReason(e.target.value)}
                                    className="w-full px-2.5 py-1.5 bg-white border border-rose-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:ring-1 focus:ring-rose-500"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] text-indigo-600">
                        Select a registered customer account above to bill against their approved payment terms.
                      </p>
                    )}
                  </div>
                )}

                <button
                  onClick={handleCheckoutSubmit}
                  disabled={isCreditAccountSale && !canSubmitCreditSale}
                  className={`w-full mt-3 py-3 rounded-2xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 ${
                    isCreditAccountSale && !canSubmitCreditSale
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                      : isCreditAccountSale
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                  }`}
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>
                    {isCreditAccountSale
                      ? `Bill to Credit Account (${formatCurrency(cartGrandTotal)})`
                      : `Charge & Complete Sale (${formatCurrency(cartGrandTotal)})`}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Floating Mobile Cart Action Bar */}
          {posCart.length > 0 && (
            <div className="lg:hidden fixed bottom-20 left-4 right-4 z-30 bg-slate-900/95 backdrop-blur-md text-white p-3 sm:p-3.5 rounded-2xl shadow-2xl flex items-center justify-between border border-slate-700 animate-in slide-in-from-bottom-4">
              <div>
                <div className="text-[11px] text-slate-300">
                  {posCart.reduce((sum, item) => sum + item.quantity, 0).toFixed(1)} cuts in Cart
                </div>
                <div className="text-base font-extrabold text-emerald-400 font-mono-code">
                  {formatCurrency(cartGrandTotal)}
                </div>
              </div>
              <button
                onClick={() => {
                  const el = document.getElementById('pos-cart-container');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <span>Review Cart</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* 1B. ONLINE D2C STOREFRONT FULFILLMENT QUEUE (AO-XXXXX) */}
      {activeChannelTab === 'online_storefront' && (() => {
        const activePackCount = storefrontOrders.filter(
          (o) => o.fulfillmentStatus === 'confirmed' || o.fulfillmentStatus === 'packing'
        ).length;
        const inTransitCount = storefrontOrders.filter(
          (o) => o.fulfillmentStatus === 'out_for_delivery'
        ).length;
        const deliveredCount = storefrontOrders.filter(
          (o) => o.fulfillmentStatus === 'delivered'
        ).length;
        const onlineGrossRevenue = storefrontOrders
          .filter((o) => o.fulfillmentStatus !== 'canceled')
          .reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);

        const filteredStorefrontOrders = storefrontOrders.filter((order) => {
          const matchesStatus =
            storefrontStatusFilter === 'all' || order.fulfillmentStatus === storefrontStatusFilter;
          const q = storefrontSearch.trim().toLowerCase();
          const matchesQuery =
            !q ||
            order.orderNumber.toLowerCase().includes(q) ||
            order.customerName.toLowerCase().includes(q) ||
            (order.customerPhone || '').toLowerCase().includes(q) ||
            (order.customerEmail || '').toLowerCase().includes(q) ||
            order.deliveryAddress.toLowerCase().includes(q);
          return matchesStatus && matchesQuery;
        });

        const statusMeta: Record<
          StorefrontFulfillmentStatus,
          { label: string; textClass: string; icon: React.ReactNode }
        > = {
          confirmed: {
            label: 'Confirmed · Awaiting Pack',
            textClass: 'text-amber-700',
            icon: <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />,
          },
          packing: {
            label: 'Cryo-Packed & Iced',
            textClass: 'text-sky-700',
            icon: <Package className="w-3.5 h-3.5 text-sky-600 shrink-0" />,
          },
          out_for_delivery: {
            label: 'Out for Cold-Fleet Delivery',
            textClass: 'text-indigo-700',
            icon: <Truck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />,
          },
          delivered: {
            label: 'Delivered',
            textClass: 'text-emerald-700',
            icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />,
          },
          canceled: {
            label: 'Canceled',
            textClass: 'text-rose-700',
            icon: <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />,
          },
        };

        return (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Amansocean Online Storefront Queue
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Direct-to-consumer cold-chain orders synced from Supabase with automatic FEFO lot deduction and live customer tracking.
                </p>
              </div>

              <button
                onClick={loadStorefrontOrders}
                disabled={loadingStorefrontOrders}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${loadingStorefrontOrders ? 'animate-spin text-sky-600' : 'text-slate-500'}`}
                />
                <span>Refresh Queue</span>
              </button>
            </div>

            {storefrontError && (
              <div className="p-3.5 rounded-2xl border border-rose-200 bg-rose-50 text-xs text-rose-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{storefrontError}</span>
                </div>
                <button
                  onClick={loadStorefrontOrders}
                  className="px-3 py-1 rounded-lg bg-white border border-rose-200 text-rose-700 font-bold hover:bg-rose-100 cursor-pointer whitespace-nowrap shrink-0"
                >
                  Retry
                </button>
              </div>
            )}

            {/* KPI Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-xs text-slate-500 font-medium">Awaiting Pack &amp; Ice</div>
                <div className="text-xl font-black text-slate-900 font-mono tabular-nums mt-1">
                  {activePackCount}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Confirmed · Packing</div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-xs text-slate-500 font-medium">In Reefer Transit</div>
                <div className="text-xl font-black text-slate-900 font-mono tabular-nums mt-1">
                  {inTransitCount}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Dispatched to doorstep</div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-xs text-slate-500 font-medium">Delivered Orders</div>
                <div className="text-xl font-black text-emerald-700 font-mono tabular-nums mt-1">
                  {deliveredCount}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Completed cold-chain drops</div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-xs text-slate-500 font-medium">Online D2C Volume</div>
                <div className="text-xl font-black text-slate-900 font-mono tabular-nums mt-1">
                  {formatCurrency(onlineGrossRevenue)}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {storefrontOrders.length} total online orders
                </div>
              </div>
            </div>

            {/* Search & Segmented Status Filter */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1 border-b border-slate-100 pb-4">
              <div className="relative w-full lg:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search AO-XXXXX, customer, phone, or address..."
                  value={storefrontSearch}
                  onChange={(e) => setStorefrontSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto no-scrollbar">
                {(
                  [
                    { id: 'all', label: `All (${storefrontOrders.length})` },
                    { id: 'confirmed', label: 'Confirmed' },
                    { id: 'packing', label: 'Packing' },
                    { id: 'out_for_delivery', label: 'Out for Delivery' },
                    { id: 'delivered', label: 'Delivered' },
                    { id: 'canceled', label: 'Canceled' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setStorefrontStatusFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      storefrontStatusFilter === tab.id
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Loading / Empty / Data Table */}
            {loadingStorefrontOrders && storefrontOrders.length === 0 ? (
              <div className="space-y-3 py-4">
                {[1, 2, 3].map((row) => (
                  <div
                    key={row}
                    className="h-16 rounded-2xl bg-slate-100 animate-pulse border border-slate-200/60"
                  />
                ))}
              </div>
            ) : filteredStorefrontOrders.length === 0 ? (
              <div className="py-12 px-4 text-center bg-slate-50/70 rounded-2xl border border-slate-200/80 space-y-2">
                <Globe className="w-8 h-8 text-slate-400 mx-auto stroke-1" />
                <div className="text-sm font-bold text-slate-900">
                  {storefrontOrders.length === 0
                    ? 'No Online Storefront Orders Yet'
                    : 'No Matching Storefront Orders'}
                </div>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  {storefrontOrders.length === 0
                    ? 'Customer orders placed on the public Amansocean storefront appear here automatically with deducted cold-storage inventory and AO-XXXXX tracking codes.'
                    : 'Adjust your search query or fulfillment status filter above to view other orders.'}
                </p>
              </div>
            ) : (
              <>
                {/* Mobile Cards */}
                <div className="space-y-3 md:hidden">
                  {filteredStorefrontOrders.map((order) => {
                    const meta = statusMeta[order.fulfillmentStatus] || statusMeta.confirmed;
                    const isBusy = updatingOrderNumber === order.orderNumber;
                    return (
                      <div
                        key={order.orderNumber}
                        className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-mono tabular-nums font-black text-slate-900 text-sm">
                              {order.orderNumber}
                            </div>
                            <div className="text-xs font-semibold text-slate-800 mt-0.5">
                              {order.customerName}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono tabular-nums font-black text-slate-900 text-sm">
                              {formatCurrency(order.totalAmount)}
                            </div>
                            <div
                              className={`inline-flex items-center gap-1 text-[11px] font-semibold mt-0.5 ${meta.textClass}`}
                            >
                              {meta.icon}
                              <span>{meta.label}</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-xs text-slate-600 space-y-1">
                          <div className="flex items-start gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                            <span>{order.deliveryAddress}</span>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {[order.customerPhone, order.customerEmail, order.paymentMethod]
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 text-xs text-slate-700 space-y-1">
                          {order.items.map((it, idx) => (
                            <div
                              key={`${order.orderNumber}-${it.productId}-${idx}`}
                              className="flex items-center justify-between gap-2"
                            >
                              <span className="truncate">
                                <span className="font-mono tabular-nums font-bold">
                                  {it.quantity}×
                                </span>{' '}
                                {it.productName}
                              </span>
                              <span className="font-mono tabular-nums text-slate-600 shrink-0">
                                {formatCurrency(it.lineTotal)}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                          {order.fulfillmentStatus === 'confirmed' && (
                            <button
                              disabled={isBusy}
                              onClick={() =>
                                handleAdvanceStorefrontStatus(order.orderNumber, 'packing')
                              }
                              className="flex-1 py-2 px-3 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-xs font-bold cursor-pointer disabled:opacity-50 whitespace-nowrap"
                            >
                              {isBusy ? 'Saving...' : 'Pack & Ice'}
                            </button>
                          )}
                          {(order.fulfillmentStatus === 'confirmed' ||
                            order.fulfillmentStatus === 'packing') && (
                            <button
                              disabled={isBusy}
                              onClick={() =>
                                handleAdvanceStorefrontStatus(
                                  order.orderNumber,
                                  'out_for_delivery'
                                )
                              }
                              className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50 whitespace-nowrap"
                            >
                              {isBusy ? 'Saving...' : 'Dispatch Cold-Fleet'}
                            </button>
                          )}
                          {order.fulfillmentStatus === 'out_for_delivery' && (
                            <button
                              disabled={isBusy}
                              onClick={() =>
                                handleAdvanceStorefrontStatus(order.orderNumber, 'delivered')
                              }
                              className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50 whitespace-nowrap"
                            >
                              {isBusy ? 'Saving...' : 'Mark Delivered'}
                            </button>
                          )}
                          {order.fulfillmentStatus !== 'delivered' &&
                            order.fulfillmentStatus !== 'canceled' && (
                              <button
                                disabled={isBusy}
                                onClick={() =>
                                  handleAdvanceStorefrontStatus(order.orderNumber, 'canceled')
                                }
                                className="py-2 px-3 rounded-xl border border-slate-200 hover:bg-rose-50 hover:text-rose-700 text-slate-600 text-xs font-semibold cursor-pointer disabled:opacity-50 whitespace-nowrap"
                              >
                                Cancel
                              </button>
                            )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop High-Density Fulfillment Table */}
                <div className="overflow-x-auto hidden md:block">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-y border-slate-200">
                      <tr>
                        <th className="py-3 px-4">Order Code</th>
                        <th className="py-3 px-4">Customer &amp; Delivery</th>
                        <th className="py-3 px-4">Cold-Chain Pack List</th>
                        <th className="py-3 px-4">Payment</th>
                        <th className="py-3 px-4 text-right">Total</th>
                        <th className="py-3 px-4">Fulfillment Stage</th>
                        <th className="py-3 px-4 text-right">Stage Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredStorefrontOrders.map((order) => {
                        const meta = statusMeta[order.fulfillmentStatus] || statusMeta.confirmed;
                        const isBusy = updatingOrderNumber === order.orderNumber;
                        return (
                          <tr
                            key={order.orderNumber}
                            className="hover:bg-slate-50/70 transition-colors"
                          >
                            <td className="py-3.5 px-4 align-top">
                              <div className="font-mono tabular-nums font-bold text-slate-900 text-sm">
                                {order.orderNumber}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono tabular-nums mt-0.5">
                                {order.createdAt
                                  ? new Date(order.createdAt).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })
                                  : 'Today'}
                              </div>
                            </td>

                            <td className="py-3.5 px-4 align-top max-w-xs">
                              <div className="font-bold text-slate-900">{order.customerName}</div>
                              <div className="text-[11px] text-slate-600 mt-0.5 truncate" title={order.deliveryAddress}>
                                {order.deliveryAddress}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono tabular-nums mt-0.5 truncate">
                                {[order.customerPhone, order.customerEmail]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </div>
                              {order.deliveryNotes && (
                                <div className="text-[11px] text-slate-500 italic mt-0.5 truncate">
                                  Note: {order.deliveryNotes}
                                </div>
                              )}
                            </td>

                            <td className="py-3.5 px-4 align-top">
                              <div className="space-y-0.5">
                                {order.items.map((item, idx) => (
                                  <div
                                    key={`${order.orderNumber}-row-${idx}`}
                                    className="text-slate-800"
                                  >
                                    <span className="font-mono tabular-nums font-bold text-slate-900">
                                      {item.quantity}×
                                    </span>{' '}
                                    <span>{item.productName}</span>
                                    {item.weightLabel && (
                                      <span className="text-slate-400"> · {item.weightLabel}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </td>

                            <td className="py-3.5 px-4 align-top">
                              <div className="font-medium text-slate-800">
                                {order.paymentMethod}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                {order.paymentStatus || 'Pending Settlement'}
                              </div>
                            </td>

                            <td className="py-3.5 px-4 align-top text-right font-mono tabular-nums font-black text-sm text-slate-900">
                              {formatCurrency(order.totalAmount)}
                            </td>

                            <td className="py-3.5 px-4 align-top">
                              <div
                                className={`inline-flex items-center gap-1.5 font-semibold ${meta.textClass}`}
                              >
                                {meta.icon}
                                <span>{meta.label}</span>
                              </div>
                            </td>

                            <td className="py-3.5 px-4 align-top text-right">
                              <div className="inline-flex items-center justify-end gap-1.5">
                                {order.fulfillmentStatus === 'confirmed' && (
                                  <button
                                    disabled={isBusy}
                                    onClick={() =>
                                      handleAdvanceStorefrontStatus(order.orderNumber, 'packing')
                                    }
                                    className="px-3 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-xs font-bold cursor-pointer disabled:opacity-50 whitespace-nowrap"
                                  >
                                    {isBusy ? 'Saving...' : 'Pack & Ice'}
                                  </button>
                                )}
                                {order.fulfillmentStatus === 'packing' && (
                                  <button
                                    disabled={isBusy}
                                    onClick={() =>
                                      handleAdvanceStorefrontStatus(
                                        order.orderNumber,
                                        'out_for_delivery'
                                      )
                                    }
                                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50 whitespace-nowrap"
                                  >
                                    {isBusy ? 'Saving...' : 'Dispatch Fleet'}
                                  </button>
                                )}
                                {order.fulfillmentStatus === 'out_for_delivery' && (
                                  <button
                                    disabled={isBusy}
                                    onClick={() =>
                                      handleAdvanceStorefrontStatus(
                                        order.orderNumber,
                                        'delivered'
                                      )
                                    }
                                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50 whitespace-nowrap"
                                  >
                                    {isBusy ? 'Saving...' : 'Mark Delivered'}
                                  </button>
                                )}
                                {order.fulfillmentStatus !== 'delivered' &&
                                  order.fulfillmentStatus !== 'canceled' && (
                                    <button
                                      disabled={isBusy}
                                      onClick={() =>
                                        handleAdvanceStorefrontStatus(
                                          order.orderNumber,
                                          'canceled'
                                        )
                                      }
                                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 hover:text-rose-700 text-slate-600 text-xs font-semibold cursor-pointer disabled:opacity-50 whitespace-nowrap"
                                    >
                                      Cancel
                                    </button>
                                  )}
                                {(order.fulfillmentStatus === 'delivered' ||
                                  order.fulfillmentStatus === 'canceled') && (
                                  <span className="text-[11px] text-slate-400">Closed</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        );
      })()}

      {/* 2. WHOLESALE BULK ORDERS VIEW */}
      {activeChannelTab === 'wholesale_orders' && (() => {
        const totalWholesaleVol = wholesaleOrders.reduce((sum, o) => sum + (o.adjustedTotalUSD || o.quotedTotalUSD), 0);
        const creditOrders = wholesaleOrders.filter(o => o.saleType === 'Credit Sale (On Account)' || o.paymentTerms);
        const pendingCreditReceivables = wholesaleOrders
          .filter(o => (o.saleType === 'Credit Sale (On Account)' || o.paymentTerms) && o.paymentStatus !== 'Paid')
          .reduce((sum, o) => sum + (o.adjustedTotalUSD || o.quotedTotalUSD), 0);
        const paidWholesaleVol = wholesaleOrders
          .filter(o => o.paymentStatus === 'Paid')
          .reduce((sum, o) => sum + (o.adjustedTotalUSD || o.quotedTotalUSD), 0);

        const filteredOrders = wholesaleOrders.filter(order => {
          if (wholesaleFilter === 'credit') {
            return (order.saleType === 'Credit Sale (On Account)' || order.paymentTerms) && order.paymentStatus !== 'Paid';
          }
          if (wholesaleFilter === 'paid') {
            return order.paymentStatus === 'Paid';
          }
          return true;
        });

        return (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Wholesale B2B Catch-Weight Orders</h2>
                <p className="text-xs text-slate-500">Commercial restaurant and distributor purchase orders, credit terms, and invoices.</p>
              </div>

              <button
                onClick={onOpenNewWholesaleOrder}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer w-full sm:w-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Create Wholesale Order</span>
              </button>
            </div>

            {/* Wholesale Credit & Receivables Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Total Wholesale Volume</div>
                <div className="text-lg font-black font-mono-code text-slate-900 mt-1">{formatCurrency(totalWholesaleVol)}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">{wholesaleOrders.length} commercial orders logged</div>
              </div>

              <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200">
                <div className="text-[10px] text-indigo-700 font-bold uppercase flex items-center justify-between">
                  <span>Credit Sales Receivables</span>
                  <span className="text-[9px] px-1.5 py-0.5 bg-indigo-200/80 rounded font-semibold text-indigo-900">On Account</span>
                </div>
                <div className="text-lg font-black font-mono-code text-indigo-900 mt-1">{formatCurrency(pendingCreditReceivables)}</div>
                <div className="text-[11px] text-indigo-700 mt-0.5">Pending collection under Net Terms</div>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                <div className="text-[10px] text-emerald-800 font-bold uppercase">Settled / Collected</div>
                <div className="text-lg font-black font-mono-code text-emerald-900 mt-1">{formatCurrency(paidWholesaleVol)}</div>
                <div className="text-[11px] text-emerald-700 mt-0.5">Fully paid & reconciled</div>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2 pt-1 border-b border-slate-100 pb-3">
              <button
                onClick={() => setWholesaleFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  wholesaleFilter === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Orders ({wholesaleOrders.length})
              </button>
              <button
                onClick={() => setWholesaleFilter('credit')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  wholesaleFilter === 'credit'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                }`}
              >
                <span>Credit Receivables (Net Terms)</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20">
                  {wholesaleOrders.filter(o => (o.saleType === 'Credit Sale (On Account)' || o.paymentTerms) && o.paymentStatus !== 'Paid').length}
                </span>
              </button>
              <button
                onClick={() => setWholesaleFilter('paid')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  wholesaleFilter === 'paid'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                }`}
              >
                Settled / Paid ({wholesaleOrders.filter(o => o.paymentStatus === 'Paid').length})
              </button>
            </div>

            {/* Mobile Wholesale Orders Card View */}
            <div className="space-y-3 md:hidden">
              {filteredOrders.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl">
                  No orders match the selected filter.
                </div>
              ) : (
                filteredOrders.map(order => {
                  const finalVal = order.adjustedTotalUSD || order.quotedTotalUSD;
                  const isCredit = order.saleType === 'Credit Sale (On Account)' || order.paymentTerms;
                  return (
                    <div key={order.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-slate-900 text-sm">{order.clientName}</div>
                          <div className="text-[11px] text-slate-500">{order.clientCategory} • {order.destinationCity}</div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                            order.status === 'Delivered'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : order.status === 'Weighing & Grading'
                              ? 'bg-blue-50 text-blue-800 border border-blue-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}>
                            {order.status}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            order.paymentStatus === 'Paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {order.paymentStatus === 'Paid' ? 'Paid' : `Credit: ${order.paymentTerms || 'Net-30'}`}
                          </span>
                        </div>
                      </div>

                      <div className="text-xs text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200/70">
                        <div className="font-medium text-slate-900">
                          {order.items.map(i => `${i.speciesName} (${i.requestedWeightKg}kg)`).join(', ')}
                        </div>
                        <div className="text-[10px] text-indigo-600 font-bold mt-0.5">{order.packagingRequirement}</div>
                        {order.creditAuthorizedBy && (
                          <div className="mt-1 text-[10px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            Authorized by {order.creditAuthorizedBy}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-bold block">Delivery</span>
                          <span className="font-mono-code text-slate-700 font-medium">{order.requiredDeliveryDate}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-400 text-[10px] uppercase font-bold block">Order Total</span>
                          <span className="font-mono-code font-black text-slate-900 text-sm">{formatCurrency(finalVal)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        {order.status === 'Weighing & Grading' && (
                          <button
                            onClick={() => onOpenWeigher(order)}
                            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold text-center cursor-pointer"
                          >
                            Weigh Scale
                          </button>
                        )}
                        <button
                          onClick={() => onOpenInvoice(order)}
                          className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold text-center cursor-pointer"
                        >
                          Invoice & Pay
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="overflow-x-auto hidden md:block">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-y border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">Order ID</th>
                    <th className="py-3.5 px-4">Client / Restaurant</th>
                    <th className="py-3.5 px-4">Species & Quoted Qty</th>
                    <th className="py-3.5 px-4">Terms & Payment</th>
                    <th className="py-3.5 px-4 text-right">Order Value</th>
                    <th className="py-3.5 px-4 text-center">Fulfillment Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                        No orders match the selected filter.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map(order => {
                      const finalVal = order.adjustedTotalUSD || order.quotedTotalUSD;
                      const isCredit = order.saleType === 'Credit Sale (On Account)' || order.paymentTerms;
                      return (
                        <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-4 px-4 font-mono-code font-bold text-slate-900 text-sm">
                            {order.id}
                          </td>

                          <td className="py-4 px-4">
                            <div className="font-bold text-slate-900 text-sm">{order.clientName}</div>
                            <div className="text-slate-500 text-[11px]">{order.clientCategory} • {order.destinationCity}</div>
                          </td>

                          <td className="py-4 px-4">
                            <div className="flex flex-col gap-1.5">
                              {order.items.map((i, itemIdx) => {
                                const linkedBatch = batches.find(b => b.id === i.lotId);
                                const linkedProd = products.find(p => 
                                  (i.speciesId && p.sku === i.speciesId) || 
                                  (p.linkedBatchId && p.linkedBatchId === i.lotId) ||
                                  p.name.toLowerCase() === i.speciesName.toLowerCase()
                                );
                                const resolvedImg = resolveProductImage(linkedProd, linkedBatch);
                                return (
                                  <div key={itemIdx} className="flex items-center gap-2">
                                    {resolvedImg.url ? (
                                      <button
                                        type="button"
                                        onClick={() => setLightboxDetails({
                                          imageUrl: resolvedImg.url!,
                                          title: i.speciesName,
                                          subtitle: `Order ${order.id} · Lot ${i.lotId || 'N/A'}`,
                                          sourceLabel: resolvedImg.source === 'product' ? 'Product Catalog Photo' : 'Intake Catch Photo',
                                          sourceType: resolvedImg.source === 'product' ? 'product' : 'batch',
                                          lotId: i.lotId,
                                          grade: i.grade,
                                        })}
                                        className="w-7 h-7 rounded-lg overflow-hidden border border-slate-200 shrink-0 cursor-zoom-in"
                                        title="Click to view photo"
                                      >
                                        <img 
                                          src={resolvedImg.url} 
                                          alt={i.speciesName} 
                                          loading="lazy"
                                          decoding="async"
                                          className="w-full h-full object-cover" 
                                          referrerPolicy="no-referrer" 
                                          onError={(e) => {
                                            (e.target as HTMLImageElement).src = '/logofrostly1.png';
                                          }}
                                        />
                                      </button>
                                    ) : null}
                                    <span className="font-medium text-slate-800">
                                      {i.speciesName} <span className="text-slate-400 font-normal">({i.requestedWeightKg}kg)</span>
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="text-[10px] text-indigo-600 font-bold mt-1">{order.packagingRequirement}</div>
                          </td>

                          <td className="py-4 px-4">
                            <div className="flex flex-col gap-1">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold w-fit ${
                                order.paymentStatus === 'Paid'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}>
                                {order.paymentStatus === 'Paid' ? '✓ Paid' : `Credit: ${order.paymentTerms || 'Net-30'}`}
                              </span>
                              {order.paymentDueDate && order.paymentStatus !== 'Paid' && (
                                <span className="text-[10px] text-slate-400 font-mono-code">
                                  Due: {order.paymentDueDate}
                                </span>
                              )}
                              {order.creditAuthorizedBy && (
                                <span className="text-[9px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-semibold w-fit">
                                  Override: {order.creditAuthorizedBy}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-4 px-4 text-right font-mono-code font-black text-sm text-slate-900">
                            {formatCurrency(finalVal)}
                          </td>

                          <td className="py-4 px-4 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              order.status === 'Delivered'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : order.status === 'Weighing & Grading'
                                ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}>
                              {order.status}
                            </span>
                          </td>

                          <td className="py-4 px-4 text-right space-x-2">
                            {order.status === 'Weighing & Grading' && (
                              <button
                                onClick={() => onOpenWeigher(order)}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                              >
                                Weigh Scale
                              </button>
                            )}
                            <button
                              onClick={() => onOpenInvoice(order)}
                              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold cursor-pointer"
                            >
                              Invoice & Pay
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* 3. DUAL PRICE LIST & CATALOG MATRIX */}
      {activeChannelTab === 'price_matrix' && (() => {
        const filteredMatrixProducts = products.filter((prod) => {
          const matchesCat = matrixCategory === 'all' || prod.category === matrixCategory;
          if (!matchesCat) return false;
          if (!matrixSearch.trim()) return true;
          const q = matrixSearch.toLowerCase();
          return (
            prod.name.toLowerCase().includes(q) ||
            prod.sku.toLowerCase().includes(q) ||
            prod.cutType.toLowerCase().includes(q)
          );
        });

        return (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Official Amans Ocean Price List &amp; Dual Catalog (GH₵)</h2>
              <p className="text-xs text-slate-500">Live Ghana Cedi (GH₵) retail &amp; wholesale rates, 10kg+ bulk tiers, MOQs, and coldstore inventory sync.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowFlyerPdfModal(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <FileText className="w-4 h-4 text-slate-500" />
                <span>Price List Flyer (PDF)</span>
              </button>

              {onSyncOfficialPriceList && (
                <button
                  type="button"
                  disabled={syncingPriceList}
                  onClick={async () => {
                    setSyncingPriceList(true);
                    try {
                      await onSyncOfficialPriceList();
                    } catch {} finally {
                      setSyncingPriceList(false);
                    }
                  }}
                  className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60"
                >
                  <RefreshCw className={`w-4 h-4 ${syncingPriceList ? 'animate-spin' : ''}`} />
                  <span>{syncingPriceList ? 'Syncing...' : 'Sync Official Flyer'}</span>
                </button>
              )}

              <button
                onClick={() => {
                  setEditingProduct(null);
                  setIsProductModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add Product</span>
              </button>
            </div>
          </div>

          {/* Dual Channel Connection Explainer */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-700">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
                <Tag className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <div className="font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                  <span>Supabase Dual-Channel Price Matrix</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-slate-600 tabular-nums">{products.length} Active SKUs</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed max-w-3xl">
                  Each item maintains live GH₵ wholesale and retail pricing synced to Supabase, Storefront checkout, and POS Customer View. Discounted offers apply above 5kg, with 10kg+ bulk tiers on Peeled Shrimps (GH₵ 200/kg) and Squid (GH₵ 130/kg).
                </p>
              </div>
            </div>
            {onNavigateToInventory && (
              <button
                onClick={onNavigateToInventory}
                className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold border border-slate-200 transition-colors cursor-pointer shrink-0 flex items-center gap-1 self-start sm:self-center whitespace-nowrap"
              >
                <span>View In Inventory</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Search & Category Filter inside Matrix */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {['all', 'Pelagic', 'Groundfish', 'Crustacean', 'Mollusk', 'Salmonid'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setMatrixCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    matrixCategory === cat
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat === 'all' ? 'All Categories' : cat}
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-72 shrink-0">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search Red Snapper, Prawns, SKU..."
                value={matrixSearch}
                onChange={(e) => setMatrixSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          {/* Mobile Price Matrix Cards */}
          <div className="space-y-3 md:hidden">
            {filteredMatrixProducts.map(prod => {
              const isEditing = editingPriceId === prod.id;
              const retailMargin = ((prod.retailPricePerUnit - prod.costPricePerUnit) / prod.retailPricePerUnit) * 100;
              const wholesaleMargin = ((prod.wholesalePricePerUnit - prod.costPricePerUnit) / prod.wholesalePricePerUnit) * 100;

              return (
                <div key={prod.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      {(() => {
                        const linkedBatch = batches.find(b => 
                          (prod.linkedBatchId && b.id === prod.linkedBatchId) ||
                          (b.linkedProductId && b.linkedProductId === prod.id) ||
                          (b.productSku && prod.sku && b.productSku.toLowerCase() === prod.sku.toLowerCase()) ||
                          b.id === `LOT-RET-${prod.id.replace('prod-', '')}`
                        );
                        const resolvedImg = resolveProductImage(prod, linkedBatch);

                        if (resolvedImg.url) {
                          return (
                            <button
                              type="button"
                              onClick={() => setLightboxDetails({
                                imageUrl: resolvedImg.url!,
                                title: prod.name,
                                subtitle: `${prod.cutType} · SKU: ${prod.sku}`,
                                sourceLabel: resolvedImg.source === 'product' ? 'Product Catalog Photo' : 'Intake Catch Photo',
                                sourceType: resolvedImg.source === 'product' ? 'product' : 'batch',
                                sku: prod.sku,
                                lotId: linkedBatch?.id,
                                grade: prod.grade,
                                origin: prod.origin || linkedBatch?.landingPort,
                              })}
                              className="relative group/thumb shrink-0 rounded-xl overflow-hidden border border-slate-200 cursor-zoom-in"
                              title="Click to preview enlarged photo"
                            >
                              <img
                                src={resolvedImg.url}
                                alt={prod.name}
                                loading="lazy"
                                decoding="async"
                                className="w-11 h-11 rounded-xl object-cover border border-slate-200 shrink-0 bg-slate-100 group-hover/thumb:scale-105 transition-transform"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = '/logofrostly1.png';
                                }}
                              />
                              <div className="absolute inset-0 bg-slate-950/30 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center text-white">
                                <ZoomIn className="w-3.5 h-3.5" />
                              </div>
                            </button>
                          );
                        }

                        return (
                          <div className="w-11 h-11 rounded-xl border border-slate-200 shrink-0 bg-slate-100 flex items-center justify-center text-slate-400">
                            <Package className="w-5 h-5" />
                          </div>
                        );
                      })()}
                      <div>
                        <div className="font-bold text-slate-900 text-sm">{prod.name}</div>
                        <div className="text-[11px] text-slate-500">{prod.cutType} • {prod.sku}</div>
                        {(() => {
                          const linkedBatch = batches.find(b => 
                            (prod.linkedBatchId && b.id === prod.linkedBatchId) ||
                            (b.linkedProductId && b.linkedProductId === prod.id) ||
                            (b.productSku && prod.sku && b.productSku.toLowerCase() === prod.sku.toLowerCase()) ||
                            b.id === `LOT-RET-${prod.id.replace('prod-', '')}`
                          );
                          if (linkedBatch) {
                            return (
                              <button
                                onClick={onNavigateToInventory}
                                className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
                                title={`Physical lot stored in ${linkedBatch.storageZone}. Click to view in Inventory Ledger.`}
                              >
                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                <span>Vault Lot: {linkedBatch.id} ({linkedBatch.availableWeightKg} kg)</span>
                              </button>
                            );
                          }
                          return (
                            <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              <AlertCircle className="w-2.5 h-2.5 text-amber-600" />
                              <span>Syncing to Vault...</span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                        {prod.grade}
                      </span>
                      <button
                        onClick={() => {
                          setEditingProduct(prod);
                          setIsProductModalOpen(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
                        title="Edit Product & Image"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-white p-2.5 rounded-xl border border-slate-200/70">
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Landing Cost</div>
                      <div className="font-mono-code font-bold text-slate-700">{formatCurrency(prod.costPricePerUnit)}/{prod.unit}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Origin</div>
                      <div className="font-medium text-slate-700 truncate">{prod.origin}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 bg-indigo-50/50 rounded-xl border border-indigo-100">
                      <div className="text-[10px] text-indigo-700 font-bold uppercase">Wholesale (B2B)</div>
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.1"
                          value={editWholesalePrice}
                          onChange={(e) => setEditWholesalePrice(e.target.value)}
                          className="w-full mt-1 p-1 bg-white border border-indigo-300 rounded font-bold text-xs"
                        />
                      ) : (
                        <div className="mt-0.5">
                          <div className="font-mono-code font-black text-indigo-900">{formatCurrency(prod.wholesalePricePerUnit)}</div>
                          <div className="text-[10px] text-emerald-600 font-bold">{wholesaleMargin.toFixed(0)}% Margin</div>
                        </div>
                      )}
                    </div>

                    <div className="p-2.5 bg-emerald-50/50 rounded-xl border border-emerald-100">
                      <div className="text-[10px] text-emerald-700 font-bold uppercase">Retail Counter</div>
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.1"
                          value={editRetailPrice}
                          onChange={(e) => setEditRetailPrice(e.target.value)}
                          className="w-full mt-1 p-1 bg-white border border-emerald-300 rounded font-bold text-xs"
                        />
                      ) : (
                        <div className="mt-0.5">
                          <div className="font-mono-code font-black text-emerald-900">{formatCurrency(prod.retailPricePerUnit)}/{prod.unit}</div>
                          <div className="text-[10px] text-emerald-600 font-bold">{retailMargin.toFixed(0)}% Margin</div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-1">
                    {isEditing ? (
                      <button
                        onClick={() => handleSavePriceEdit(prod.id)}
                        className="w-full py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs cursor-pointer text-center"
                      >
                        Save Pricing
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingPriceId(prod.id);
                          setEditWholesalePrice(prod.wholesalePricePerUnit.toString());
                          setEditRetailPrice(prod.retailPricePerUnit.toString());
                        }}
                        className="w-full py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold text-xs cursor-pointer text-center"
                      >
                        Edit Prices
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="overflow-x-auto hidden md:block">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-y border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Seafood Cut & SKU</th>
                  <th className="py-3.5 px-4">Grade & Origin</th>
                  <th className="py-3.5 px-4">Landing Cost</th>
                  <th className="py-3.5 px-4">Wholesale Price (B2B)</th>
                  <th className="py-3.5 px-4">Retail Counter Price</th>
                  <th className="py-3.5 px-4 text-center">Retail Margin</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMatrixProducts.map(prod => {
                  const isEditing = editingPriceId === prod.id;
                  const retailMargin = ((prod.retailPricePerUnit - prod.costPricePerUnit) / prod.retailPricePerUnit) * 100;
                  const wholesaleMargin = ((prod.wholesalePricePerUnit - prod.costPricePerUnit) / prod.wholesalePricePerUnit) * 100;

                  return (
                    <tr key={prod.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {(() => {
                            const linkedBatch = batches.find(b => 
                              (prod.linkedBatchId && b.id === prod.linkedBatchId) ||
                              (b.linkedProductId && b.linkedProductId === prod.id) ||
                              (b.productSku && prod.sku && b.productSku.toLowerCase() === prod.sku.toLowerCase()) ||
                              b.id === `LOT-RET-${prod.id.replace('prod-', '')}`
                            );
                            const resolvedImg = resolveProductImage(prod, linkedBatch);

                            if (resolvedImg.url) {
                              return (
                                <button
                                  type="button"
                                  onClick={() => setLightboxDetails({
                                    imageUrl: resolvedImg.url!,
                                    title: prod.name,
                                    subtitle: `${prod.cutType} · SKU: ${prod.sku}`,
                                    sourceLabel: resolvedImg.source === 'product' ? 'Product Catalog Photo' : 'Intake Catch Photo',
                                    sourceType: resolvedImg.source === 'product' ? 'product' : 'batch',
                                    sku: prod.sku,
                                    lotId: linkedBatch?.id,
                                    grade: prod.grade,
                                    origin: prod.origin || linkedBatch?.landingPort,
                                  })}
                                  className="relative group/thumb shrink-0 rounded-xl overflow-hidden border border-slate-200 cursor-zoom-in"
                                  title="Click to preview enlarged photo"
                                >
                                  <img
                                    src={resolvedImg.url}
                                    alt={prod.name}
                                    loading="lazy"
                                    decoding="async"
                                    className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0 bg-slate-100 group-hover/thumb:scale-105 transition-transform"
                                    referrerPolicy="no-referrer"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = '/logofrostly1.png';
                                    }}
                                  />
                                  <div className="absolute inset-0 bg-slate-950/30 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center text-white">
                                    <ZoomIn className="w-3.5 h-3.5" />
                                  </div>
                                </button>
                              );
                            }

                            return (
                              <div className="w-10 h-10 rounded-xl border border-slate-200 shrink-0 bg-slate-100 flex items-center justify-center text-slate-400">
                                <Package className="w-4 h-4" />
                              </div>
                            );
                          })()}
                          <div>
                            <div className="font-bold text-slate-900 text-sm">{prod.name}</div>
                            <div className="text-slate-400 text-[11px]">{prod.cutType} • {prod.sku}</div>
                            {(() => {
                              const linkedBatch = batches.find(b => 
                                (prod.linkedBatchId && b.id === prod.linkedBatchId) ||
                                (b.linkedProductId && b.linkedProductId === prod.id) ||
                                (b.productSku && prod.sku && b.productSku.toLowerCase() === prod.sku.toLowerCase()) ||
                                b.id === `LOT-RET-${prod.id.replace('prod-', '')}`
                              );
                              if (linkedBatch) {
                                return (
                                  <button
                                    onClick={onNavigateToInventory}
                                    className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
                                    title={`Physical lot stored in ${linkedBatch.storageZone}. Click to view in Inventory Ledger.`}
                                  >
                                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                    <span>Vault Lot: {linkedBatch.id} ({linkedBatch.availableWeightKg} kg)</span>
                                  </button>
                                );
                              }
                              return (
                                <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                  <AlertCircle className="w-2.5 h-2.5 text-amber-600" />
                                  <span>Syncing to Vault...</span>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-emerald-700">{prod.grade}</div>
                        <div className="text-slate-500 text-[11px]">{prod.origin}</div>
                      </td>

                      <td className="py-3.5 px-4 font-mono-code font-bold text-slate-700">
                        {formatCurrency(prod.costPricePerUnit)}/{prod.unit}
                      </td>

                      <td className="py-3.5 px-4 font-mono-code">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.1"
                            value={editWholesalePrice}
                            onChange={(e) => setEditWholesalePrice(e.target.value)}
                            className="w-20 p-1 border border-indigo-300 rounded-md font-bold text-xs"
                          />
                        ) : (
                          <div>
                            <span className="font-bold text-indigo-900">{formatCurrency(prod.wholesalePricePerUnit)}</span>
                            <span className="text-[10px] text-slate-400"> (MOQ {prod.wholesaleMinQty}kg)</span>
                            <div className="text-[10px] text-emerald-600 font-bold">{wholesaleMargin.toFixed(0)}% Margin</div>
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-mono-code">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.1"
                            value={editRetailPrice}
                            onChange={(e) => setEditRetailPrice(e.target.value)}
                            className="w-20 p-1 border border-emerald-300 rounded-md font-bold text-xs"
                          />
                        ) : (
                          <div>
                            <span className="font-bold text-emerald-900">{formatCurrency(prod.retailPricePerUnit)}</span>
                            <span className="text-[10px] text-slate-400"> /{prod.unit}</span>
                            <div className="text-[10px] text-slate-500">{prod.retailPackSize}</div>
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-full font-bold text-[11px] border border-emerald-200">
                          {retailMargin.toFixed(1)}%
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isEditing ? (
                            <button
                              onClick={() => handleSavePriceEdit(prod.id)}
                              className="px-3 py-1 bg-emerald-600 text-white rounded-lg font-bold text-xs cursor-pointer"
                            >
                              Save
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setEditingPriceId(prod.id);
                                  setEditWholesalePrice(prod.wholesalePricePerUnit.toString());
                                  setEditRetailPrice(prod.retailPricePerUnit.toString());
                                }}
                                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs cursor-pointer"
                              >
                                Edit Prices
                              </button>
                              <button
                                onClick={() => {
                                  setEditingProduct(prod);
                                  setIsProductModalOpen(true);
                                }}
                                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                title="Edit Product Details & Image"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        );
      })()}

      {/* Official Amans Ocean Price List Flyer PDF Modal */}
      {showFlyerPdfModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Official Amans Ocean Price List Flyer
                </h3>
                <p className="text-xs text-slate-500">
                  {AMANSOCEAN_LOCATION} · Tel {AMANSOCEAN_CONTACT_PHONE}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={AMANSOCEAN_PRICE_LIST_PDF_URL}
                  download="AmansOcean_Official_PriceList.pdf"
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  Download PDF
                </a>
                <button
                  type="button"
                  onClick={() => setShowFlyerPdfModal(false)}
                  className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-slate-100">
              <iframe
                src={AMANSOCEAN_PRICE_LIST_PDF_URL}
                title="Official Amans Ocean Price List PDF"
                className="w-full h-full border-0"
              />
            </div>
          </div>
        </div>
      )}

      {/* POS Receipt Modal on successful checkout */}
      {completedReceiptModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-300">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-black text-slate-900">Sale Completed</h3>
              <p className="text-xs text-slate-500 font-mono-code">{completedReceiptModal.receiptNumber}</p>
              <p className="text-xs text-slate-400">{completedReceiptModal.date}</p>
            </div>

            {/* Receipt Item lines */}
            <div className="space-y-2 text-xs divide-y divide-slate-100">
              {completedReceiptModal.items.map(item => (
                <div key={item.productId} className="pt-2 flex justify-between">
                  <div>
                    <div className="font-bold text-slate-900">{item.productName}</div>
                    <div className="text-[11px] text-slate-400">{item.quantity} {item.unit} @ {formatCurrency(item.unitPrice)}</div>
                  </div>
                  <div className="font-mono-code font-bold text-slate-900">{formatCurrency(item.lineTotal)}</div>
                </div>
              ))}
            </div>

            {/* Total Summary */}
            <div className="pt-3 border-t border-dashed border-slate-300 space-y-1 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal:</span>
                <span className="font-mono-code">{formatCurrency(completedReceiptModal.subtotal)}</span>
              </div>
              {completedReceiptModal.discountAmount > 0 && (
                <div className="flex justify-between text-indigo-600 font-bold">
                  <span>Discount:</span>
                  <span className="font-mono-code">-{formatCurrency(completedReceiptModal.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-500">
                <span>Sales Tax:</span>
                <span className="font-mono-code">{formatCurrency(completedReceiptModal.taxAmount)}</span>
              </div>
              <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-200">
                <span>
                  {completedReceiptModal.paymentMethod === 'Customer Credit Account'
                    ? 'Billed to Credit Account:'
                    : `Paid via ${completedReceiptModal.paymentMethod}:`}
                </span>
                <span className="font-mono-code text-emerald-700">{formatCurrency(completedReceiptModal.totalAmount)}</span>
              </div>

              {completedReceiptModal.paymentMethod === 'Customer Credit Account' && (
                <div className="mt-2 p-2.5 bg-indigo-50 rounded-xl border border-indigo-100 text-indigo-950 space-y-1">
                  <div className="font-bold flex items-center justify-between">
                    <span>Account: {completedReceiptModal.customerName}</span>
                    <span className="text-[10px] px-2 py-0.5 bg-indigo-200/80 rounded font-semibold text-indigo-800">
                      {completedReceiptModal.creditTerms || 'Net-30'}
                    </span>
                  </div>
                  <div className="text-[11px] text-indigo-700">
                    Added to client's outstanding accounts receivable ledger.
                  </div>
                  {completedReceiptModal.creditAuthorizedBy && (
                    <div className="text-[10px] text-amber-800 bg-amber-100/70 p-1.5 rounded border border-amber-200 mt-1">
                      Manager Override: {completedReceiptModal.creditAuthorizedBy}
                      {completedReceiptModal.creditOverrideNote && ` • ${completedReceiptModal.creditOverrideNote}`}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={() => setCompletedReceiptModal(null)}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow-xs cursor-pointer"
            >
              Done / Start Next Sale
            </button>
          </div>
        </div>
      )}

      {/* Product & Image Management Modal */}
      <ProductModal
        isOpen={isProductModalOpen}
        onClose={() => {
          setIsProductModalOpen(false);
          setEditingProduct(null);
        }}
        onSaveProduct={async (prod) => {
          if (onSaveProduct) {
            await onSaveProduct(prod);
          }
        }}
        productToEdit={editingProduct}
        inventoryBatches={batches}
      />

      {/* Enlarged High-Resolution Image Preview Lightbox */}
      <ImageLightboxModal
        isOpen={Boolean(lightboxDetails)}
        onClose={() => setLightboxDetails(null)}
        details={lightboxDetails}
      />
    </div>
  );
};
