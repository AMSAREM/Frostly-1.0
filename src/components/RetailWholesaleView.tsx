import React, { useState } from 'react';
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
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { 
  RetailWholesaleProduct, 
  RetailTransaction, 
  ClientOrder, 
  Customer, 
  RetailSaleItem, 
  QualityGrade 
} from '../types';

interface RetailWholesaleViewProps {
  products: RetailWholesaleProduct[];
  retailSales: RetailTransaction[];
  wholesaleOrders: ClientOrder[];
  customers: Customer[];
  onCompleteRetailSale: (sale: RetailTransaction) => void;
  onOpenNewWholesaleOrder: () => void;
  onOpenWeigher: (order: ClientOrder) => void;
  onOpenInvoice: (order: ClientOrder) => void;
  onUpdateProductPricing: (productId: string, wholesalePrice: number, retailPrice: number) => void;
  formatCurrency: (amount: number) => string;
}

export const RetailWholesaleView: React.FC<RetailWholesaleViewProps> = ({
  products = [],
  retailSales = [],
  wholesaleOrders = [],
  customers = [],
  onCompleteRetailSale,
  onOpenNewWholesaleOrder,
  onOpenWeigher,
  onOpenInvoice,
  onUpdateProductPricing,
  formatCurrency
}) => {
  const [activeChannelTab, setActiveChannelTab] = useState<'retail_pos' | 'wholesale_orders' | 'price_matrix'>('retail_pos');
  
  // POS State
  const [posSearch, setPosSearch] = useState('');
  const [posCategory, setPosCategory] = useState<string>('all');
  const [posCart, setPosCart] = useState<{ product: RetailWholesaleProduct; quantity: number }[]>([]);
  const [posCustomerName, setPosCustomerName] = useState('Walk-in Customer');
  const [posDiscountPct, setPosDiscountPct] = useState<number>(0);
  const [posPaymentMethod, setPosPaymentMethod] = useState<'Credit Card' | 'Cash' | 'Apple Pay / Contactless' | 'Store Credit'>('Credit Card');
  const [completedReceiptModal, setCompletedReceiptModal] = useState<RetailTransaction | null>(null);

  // Price Matrix Edit State
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editWholesalePrice, setEditWholesalePrice] = useState<string>('');
  const [editRetailPrice, setEditRetailPrice] = useState<string>('');

  // POS Cart Calculations
  const cartSubtotal = posCart.reduce((sum, item) => sum + (item.product.retailPricePerUnit * item.quantity), 0);
  const discountAmount = (cartSubtotal * posDiscountPct) / 100;
  const taxableAmount = cartSubtotal - discountAmount;
  const taxAmount = taxableAmount * 0.0875; // 8.75% local sales tax
  const cartGrandTotal = taxableAmount + taxAmount;
  const cartCostTotal = posCart.reduce((sum, item) => sum + (item.product.costPricePerUnit * item.quantity), 0);

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
  };

  const handleCheckoutSubmit = () => {
    if (posCart.length === 0) return;

    const saleItems: RetailSaleItem[] = posCart.map(item => ({
      productId: item.product.id,
      productName: item.product.name,
      cutType: item.product.cutType,
      quantity: item.quantity,
      unit: item.product.unit,
      unitPrice: item.product.retailPricePerUnit,
      costPrice: item.product.costPricePerUnit,
      lineTotal: parseFloat((item.product.retailPricePerUnit * item.quantity).toFixed(2))
    }));

    const newSale: RetailTransaction = {
      id: `REC-${(5020 + retailSales.length + 1).toString()}`,
      receiptNumber: `POS-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      date: new Date().toISOString().replace('T', ' ').slice(0, 16),
      customerName: posCustomerName.trim() || 'Counter Walk-in',
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-100/80 text-indigo-700 rounded-xl">
              <ShoppingBag className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Retail & Wholesale Sales Hub</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Dual-channel execution: Walk-in counter POS, B2B restaurant bulk contracts, and dual price matrices.
          </p>
        </div>

        <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center gap-1 border border-slate-200 overflow-x-auto no-scrollbar w-full sm:w-auto shrink-0">
          <button
            id="tab-retail-pos"
            onClick={() => setActiveChannelTab('retail_pos')}
            className={`px-3.5 sm:px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeChannelTab === 'retail_pos'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Retail Counter POS</span>
          </button>

          <button
            id="tab-wholesale-orders"
            onClick={() => setActiveChannelTab('wholesale_orders')}
            className={`px-3.5 sm:px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeChannelTab === 'wholesale_orders'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Wholesale Bulk ({wholesaleOrders.length})</span>
          </button>

          <button
            id="tab-price-matrix"
            onClick={() => setActiveChannelTab('price_matrix')}
            className={`px-3.5 sm:px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeChannelTab === 'price_matrix'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Tag className="w-4 h-4" />
            <span>Dual Price Book</span>
          </button>
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
                {['all', 'Pelagic', 'Salmonid', 'Crustacean', 'Mollusk'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setPosCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
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
              {filteredPOSProducts.map(prod => (
                <div 
                  key={prod.id}
                  onClick={() => handleAddToCart(prod)}
                  className="bg-white rounded-3xl border border-slate-200 p-4 shadow-xs hover:border-emerald-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-3 group"
                >
                  <div className="flex items-start gap-3">
                    <img 
                      src={prod.imageUrl} 
                      alt={prod.name} 
                      className="w-16 h-16 rounded-2xl object-cover border border-slate-200 shrink-0"
                    />
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
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Retail Price</div>
                      <div className="text-base font-black text-slate-900 font-mono-code">
                        {formatCurrency(prod.retailPricePerUnit)}
                        <span className="text-[11px] font-normal text-slate-500">/{prod.unit}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">In Stock</div>
                      <div className="text-xs font-bold text-slate-700 font-mono-code">{prod.stockKg} kg</div>
                    </div>
                  </div>
                </div>
              ))}
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
                  <p className="text-[11px] text-slate-400">Direct Retail POS Register #1</p>
                </div>
              </div>

              {posCart.length > 0 && (
                <button
                  onClick={handleClearCart}
                  className="text-xs text-rose-600 hover:text-rose-800 font-bold cursor-pointer"
                >
                  Clear
                </button>
              )}
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
                posCart.map(item => (
                  <div 
                    key={item.product.id}
                    className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-900 truncate">{item.product.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {formatCurrency(item.product.retailPricePerUnit)}/{item.product.unit}
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
                          {item.quantity} {item.product.unit}
                        </span>
                        <button
                          onClick={() => handleUpdateCartQty(item.product.id, parseFloat((item.quantity + (item.product.unit === 'pack' ? 1 : 0.25)).toFixed(2)))}
                          className="w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="font-mono-code font-black text-slate-900 w-16 text-right">
                        {formatCurrency(item.product.retailPricePerUnit * item.quantity)}
                      </div>

                      <button
                        onClick={() => handleRemoveFromCart(item.product.id)}
                        className="text-slate-400 hover:text-rose-600 cursor-pointer p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
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
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['Credit Card', 'Cash', 'Apple Pay / Contactless', 'Store Credit'] as const).map(method => (
                      <button
                        key={method}
                        onClick={() => setPosPaymentMethod(method)}
                        className={`py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                          posPaymentMethod === method
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleCheckoutSubmit}
                  className="w-full mt-3 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Charge & Complete Sale ({formatCurrency(cartGrandTotal)})</span>
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

      {/* 2. WHOLESALE BULK ORDERS VIEW */}
      {activeChannelTab === 'wholesale_orders' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Wholesale B2B Catch-Weight Orders</h2>
              <p className="text-xs text-slate-500">Commercial restaurant and distributor purchase orders, yield tolerances, and invoices.</p>
            </div>

            <button
              onClick={onOpenNewWholesaleOrder}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer w-full sm:w-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Create Wholesale Order</span>
            </button>
          </div>

          {/* Mobile Wholesale Orders Card View */}
          <div className="space-y-3 md:hidden">
            {wholesaleOrders.map(order => {
              const finalVal = order.adjustedTotalUSD || order.quotedTotalUSD;
              return (
                <div key={order.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{order.clientName}</div>
                      <div className="text-[11px] text-slate-500">{order.clientCategory} • {order.destinationCity}</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                      order.status === 'Delivered'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : order.status === 'Weighing & Grading'
                        ? 'bg-blue-50 text-blue-800 border border-blue-200'
                        : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}>
                      {order.status}
                    </span>
                  </div>

                  <div className="text-xs text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200/70">
                    <div className="font-medium text-slate-900">
                      {order.items.map(i => `${i.speciesName} (${i.requestedWeightKg}kg)`).join(', ')}
                    </div>
                    <div className="text-[10px] text-indigo-600 font-bold mt-0.5">{order.packagingRequirement}</div>
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
                      Invoice
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="overflow-x-auto hidden md:block">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-y border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Order ID</th>
                  <th className="py-3.5 px-4">Client / Restaurant</th>
                  <th className="py-3.5 px-4">Species & Quoted Qty</th>
                  <th className="py-3.5 px-4">Delivery Date</th>
                  <th className="py-3.5 px-4 text-right">Order Value</th>
                  <th className="py-3.5 px-4 text-center">Fulfillment Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {wholesaleOrders.map(order => {
                  const finalVal = order.adjustedTotalUSD || order.quotedTotalUSD;
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
                        <div className="font-medium text-slate-800">
                          {order.items.map(i => `${i.speciesName} (${i.requestedWeightKg}kg)`).join(', ')}
                        </div>
                        <div className="text-[10px] text-indigo-600 font-bold">{order.packagingRequirement}</div>
                      </td>

                      <td className="py-4 px-4 font-mono-code text-slate-600">
                        {order.requiredDeliveryDate}
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
                          Invoice
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. DUAL PRICE LIST & CATALOG MATRIX */}
      {activeChannelTab === 'price_matrix' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Dual Wholesale vs Retail Pricing Catalog</h2>
            <p className="text-xs text-slate-500">Live price matrix, minimum order quantities (MOQ), and margin spreads by cut.</p>
          </div>

          {/* Mobile Price Matrix Cards */}
          <div className="space-y-3 md:hidden">
            {products.map(prod => {
              const isEditing = editingPriceId === prod.id;
              const retailMargin = ((prod.retailPricePerUnit - prod.costPricePerUnit) / prod.retailPricePerUnit) * 100;
              const wholesaleMargin = ((prod.wholesalePricePerUnit - prod.costPricePerUnit) / prod.wholesalePricePerUnit) * 100;

              return (
                <div key={prod.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{prod.name}</div>
                      <div className="text-[11px] text-slate-500">{prod.cutType} • {prod.sku}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                      {prod.grade}
                    </span>
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
                {products.map(prod => {
                  const isEditing = editingPriceId === prod.id;
                  const retailMargin = ((prod.retailPricePerUnit - prod.costPricePerUnit) / prod.retailPricePerUnit) * 100;
                  const wholesaleMargin = ((prod.wholesalePricePerUnit - prod.costPricePerUnit) / prod.wholesalePricePerUnit) * 100;

                  return (
                    <tr key={prod.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 text-sm">{prod.name}</div>
                        <div className="text-slate-400 text-[11px]">{prod.cutType} • {prod.sku}</div>
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
                        {isEditing ? (
                          <button
                            onClick={() => handleSavePriceEdit(prod.id)}
                            className="px-3 py-1 bg-emerald-600 text-white rounded-lg font-bold text-xs cursor-pointer"
                          >
                            Save
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingPriceId(prod.id);
                              setEditWholesalePrice(prod.wholesalePricePerUnit.toString());
                              setEditRetailPrice(prod.retailPricePerUnit.toString());
                            }}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs cursor-pointer"
                          >
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
                <span>Paid via {completedReceiptModal.paymentMethod}:</span>
                <span className="font-mono-code text-emerald-700">{formatCurrency(completedReceiptModal.totalAmount)}</span>
              </div>
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
    </div>
  );
};
