import React, { useState } from 'react';
import { 
  X, 
  Trash2, 
  Plus, 
  Minus, 
  ShoppingBag, 
  ArrowRight, 
  Truck, 
  ShieldCheck, 
  CheckCircle2,
  Snowflake,
  Loader2,
  AlertCircle,
  PackageSearch
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { CURRENCY } from '../../data/amansoceanProducts';
import {
  submitStorefrontOrder,
  trackStorefrontEvent,
  StorefrontOrderConfirmation,
  StorefrontStockError,
} from '../../services/storefrontService';

interface CartDrawerProps {
  onOrderConfirmed?: () => void;
  onTrackOrder?: (orderNumber: string, contact: string) => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  onOrderConfirmed,
  onTrackOrder,
}) => {
  const { 
    items, 
    isCartOpen, 
    setIsCartOpen, 
    removeFromCart, 
    updateQuantity, 
    clearCart, 
    subtotal, 
    totalCount 
  } = useCart();

  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<StorefrontOrderConfirmation | null>(null);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash / Mobile Money on Delivery');

  if (!isCartOpen) return null;

  const FREE_SHIPPING_THRESHOLD = 300;
  const deliveryFee = subtotal >= FREE_SHIPPING_THRESHOLD || items.length === 0 ? 0 : 25;
  const progressToFreeShipping = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);
  const amountNeeded = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  const grandTotal = subtotal + deliveryFee;

  const handleBeginCheckout = () => {
    setSubmitError(null);
    setIsCheckingOut(true);
    trackStorefrontEvent('begin_checkout', {
      cartValue: Number(grandTotal.toFixed(2)),
      metadata: { item_count: totalCount },
    });
  };

  const handleCompleteOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerPhone.trim() && !customerEmail.trim()) {
      setSubmitError('Please enter a phone number or email address so you can track your cold-chain delivery.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const order = await submitStorefrontOrder({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        customerEmail: customerEmail.trim() || undefined,
        deliveryAddress: customerAddress.trim(),
        deliveryNotes: deliveryNote.trim() || undefined,
        paymentMethod,
        items: items.map((it) => ({
          productId: it.product.id,
          quantity: it.quantity,
        })),
      });

      setConfirmedOrder(order);
      clearCart();
      if (onOrderConfirmed) {
        onOrderConfirmed();
      }
    } catch (err: any) {
      if (err instanceof StorefrontStockError && err.productId) {
        if (typeof err.availableStockKg === 'number') {
          if (err.availableStockKg <= 0) {
            removeFromCart(err.productId);
          } else {
            updateQuantity(err.productId, Math.floor(err.availableStockKg));
          }
        }
        if (onOrderConfirmed) onOrderConfirmed();
      }
      setSubmitError(err?.message || 'Unable to confirm order right now. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAndClose = () => {
    setIsCartOpen(false);
    setIsCheckingOut(false);
    setSubmitError(null);
    setConfirmedOrder(null);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-fade-in-up"
        onClick={resetAndClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-[#FBF3E4] text-[#1A1A1A] shadow-2xl flex flex-col border-l border-amber-200/80">
          
          {/* Header */}
          <div className="p-5 bg-[#FFC400] text-[#1A1A1A] flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#C8102E] text-white flex items-center justify-center font-black text-sm shadow-xs">
                AO
              </div>
              <div>
                <h2 className="font-extrabold text-lg tracking-tight">Your Cart</h2>
                <p className="text-xs font-semibold text-neutral-800 tabular-nums">
                  {totalCount} {totalCount === 1 ? 'item' : 'items'} in bag
                </p>
              </div>
            </div>

            <button
              onClick={resetAndClose}
              className="p-2 rounded-full hover:bg-black/10 transition-colors"
              aria-label="Close cart"
            >
              <X className="w-5 h-5 text-neutral-900" />
            </button>
          </div>

          {/* Free Cold-Chain Delivery Progress */}
          {!confirmedOrder && (
            <div className="bg-[#F5DDB0] px-5 py-3 border-b border-amber-200">
              <div className="flex items-center justify-between text-xs font-bold text-[#1A1A1A] mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-[#C8102E]" />
                  {amountNeeded === 0 ? (
                    <span className="text-[#9B0B20]">You unlocked FREE Flash-Frozen Delivery!</span>
                  ) : (
                    <span className="tabular-nums">
                      Add {CURRENCY} {amountNeeded.toFixed(2)} more for Free Frozen Delivery
                    </span>
                  )}
                </span>
                <span className="tabular-nums">{Math.round(progressToFreeShipping)}%</span>
              </div>
              <div className="w-full h-2 bg-amber-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#C8102E] transition-all duration-300 rounded-full"
                  style={{ width: `${progressToFreeShipping}%` }}
                />
              </div>
            </div>
          )}

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto p-5">
            {confirmedOrder ? (
              <div className="text-center py-6 px-2 space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center shadow-inner">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-black text-[#1A1A1A]">Order Confirmed!</h3>
                <p className="text-sm text-neutral-700 max-w-xs mx-auto">
                  Thank you, <strong>{confirmedOrder.customerName}</strong>! Your order is synced to Amansocean Coldstore and queued for cryo-packing.
                </p>

                <div className="p-4 bg-white rounded-2xl border border-amber-200 text-left text-xs space-y-2.5">
                  <div className="flex justify-between items-center font-bold pb-2 border-b border-amber-100">
                    <span className="text-neutral-600">Tracking Number</span>
                    <span className="font-mono text-sm text-[#C8102E]">
                      {confirmedOrder.orderNumber}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-neutral-500 shrink-0">Deliver to</span>
                    <span className="font-semibold text-neutral-800 text-right">
                      {confirmedOrder.deliveryAddress}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-neutral-500">Payment</span>
                    <span className="font-semibold text-neutral-800">
                      {confirmedOrder.paymentMethod}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-amber-100 font-extrabold text-sm text-[#1A1A1A]">
                    <span>Total Confirmed</span>
                    <span className="font-mono tabular-nums text-[#C8102E]">
                      {CURRENCY} {Number(confirmedOrder.totalAmount).toFixed(2)}
                    </span>
                  </div>
                </div>

                {onTrackOrder && (
                  <button
                    type="button"
                    onClick={() => {
                      const ordNo = confirmedOrder.orderNumber;
                      const cnt =
                        confirmedOrder.customerPhone || confirmedOrder.customerEmail || '';
                      resetAndClose();
                      onTrackOrder(ordNo, cnt);
                    }}
                    className="w-full py-3 bg-[#FFC400] text-[#1A1A1A] rounded-full font-extrabold text-sm hover:bg-amber-300 transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                  >
                    <PackageSearch className="w-4 h-4" />
                    <span>Track Live Order Status</span>
                  </button>
                )}

                <button
                  onClick={resetAndClose}
                  className="w-full py-3 bg-[#C8102E] text-white rounded-full font-bold text-sm hover:bg-[#9B0B20] transition-colors shadow-md cursor-pointer"
                >
                  Continue Shopping
                </button>
              </div>
            ) : isCheckingOut ? (
              <form onSubmit={handleCompleteOrder} className="space-y-3.5">
                <div className="flex items-center justify-between pb-3 border-b border-amber-200">
                  <h3 className="font-extrabold text-base text-[#1A1A1A]">Express Delivery Details</h3>
                  <button
                    type="button"
                    onClick={() => {
                      setSubmitError(null);
                      setIsCheckingOut(false);
                    }}
                    className="text-xs font-bold text-[#C8102E] hover:underline"
                  >
                    ← Back to Cart
                  </button>
                </div>

                {submitError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{submitError}</span>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="checkout-name"
                    className="block text-xs font-bold text-neutral-700 mb-1"
                  >
                    Full Name *
                  </label>
                  <input
                    id="checkout-name"
                    type="text"
                    required
                    placeholder="e.g. Ama Mensah"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-amber-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="checkout-phone"
                      className="block text-xs font-bold text-neutral-700 mb-1"
                    >
                      Phone Number *
                    </label>
                    <input
                      id="checkout-phone"
                      type="tel"
                      required={!customerEmail.trim()}
                      placeholder="+233 24 000 0000"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-amber-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="checkout-email"
                      className="block text-xs font-bold text-neutral-700 mb-1"
                    >
                      Email (Optional)
                    </label>
                    <input
                      id="checkout-email"
                      type="email"
                      placeholder="you@example.com"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-amber-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="checkout-address"
                    className="block text-xs font-bold text-neutral-700 mb-1"
                  >
                    Delivery Address *
                  </label>
                  <textarea
                    id="checkout-address"
                    required
                    rows={2}
                    placeholder="House / Street, Neighborhood, City"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-amber-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="checkout-payment"
                    className="block text-xs font-bold text-neutral-700 mb-1"
                  >
                    Payment Method
                  </label>
                  <select
                    id="checkout-payment"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-amber-200 bg-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
                  >
                    <option value="Cash / Mobile Money on Delivery">
                      Cash / Mobile Money on Delivery
                    </option>
                    <option value="Card on Delivery">Card on Delivery (POS Terminal)</option>
                    <option value="Instant Contactless / Mobile Money">
                      Instant Contactless / Mobile Money
                    </option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="checkout-notes"
                    className="block text-xs font-bold text-neutral-700 mb-1"
                  >
                    Delivery Instructions (Optional)
                  </label>
                  <input
                    id="checkout-notes"
                    type="text"
                    placeholder="e.g. Call upon arrival at main gate"
                    value={deliveryNote}
                    onChange={(e) => setDeliveryNote(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-amber-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
                  />
                </div>

                <div className="p-3 bg-white rounded-xl border border-amber-200 flex items-center gap-2 text-xs text-neutral-600">
                  <Snowflake className="w-5 h-5 text-[#C8102E] shrink-0" />
                  <span>Packed with insulated thermal foam and dry ice gel packs to guarantee frozen arrival.</span>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 bg-[#C8102E] disabled:opacity-60 text-white rounded-full font-extrabold hover:bg-[#9B0B20] transition-colors shadow-lg hover-lift flex items-center justify-center gap-2 mt-3 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Confirming Stock &amp; Saving Order...</span>
                    </>
                  ) : (
                    <>
                      <span className="tabular-nums">
                        Confirm Order ({CURRENCY} {grandTotal.toFixed(2)})
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            ) : items.length === 0 ? (
              <div className="text-center py-16 px-4 space-y-4">
                <div className="w-16 h-16 rounded-full bg-amber-100 text-[#C8102E] mx-auto flex items-center justify-center">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <h3 className="font-extrabold text-xl text-[#1A1A1A]">Your cart is empty</h3>
                <p className="text-sm text-neutral-600 max-w-xs mx-auto">
                  Explore our flash-frozen red snapper, jumbo prawns, grouper fillets, and pure fish &amp; shrimp powders.
                </p>
                <button
                  onClick={() => {
                    setIsCartOpen(false);
                    const el = document.getElementById('shop');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="px-6 py-3 bg-[#FFC400] text-[#1A1A1A] rounded-full font-bold hover:bg-amber-400 transition-colors shadow-sm"
                >
                  Start Shopping
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map(({ product, quantity }) => {
                  const maxStock =
                    typeof product.stockKg === 'number'
                      ? Math.max(0, Math.floor(product.stockKg))
                      : Infinity;
                  const atMaxStock = quantity >= maxStock;

                  return (
                    <div
                      key={product.id}
                      className="flex gap-3 bg-white p-3 rounded-2xl border border-amber-200 shadow-xs items-center"
                    >
                      <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-amber-50 shrink-0 border border-amber-200/60">
                        <img
                          src={product.image}
                          alt={product.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const fb = e.currentTarget.parentElement?.querySelector('.img-fallback');
                            if (fb) (fb as HTMLElement).style.display = 'flex';
                          }}
                        />
                        <div className="w-full h-full hidden items-center justify-center text-amber-500 bg-amber-50/80 img-fallback">
                          <PackageSearch className="w-8 h-8 opacity-60" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm text-[#1A1A1A] truncate">{product.name}</h4>
                        <p className="text-xs text-neutral-500 font-medium tabular-nums">
                          {CURRENCY} {product.price.toFixed(2)} each {product.weight && `· ${product.weight}`}
                        </p>
                        
                        <div className="flex items-center justify-between mt-2">
                          {/* Quantity Controls */}
                          <div className="flex items-center border border-amber-200 rounded-lg bg-amber-50 overflow-hidden">
                            <button
                              onClick={() => updateQuantity(product.id, quantity - 1)}
                              className="p-1.5 hover:bg-amber-200 transition-colors text-neutral-700"
                              aria-label="Decrease quantity"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="px-2.5 text-xs font-bold text-neutral-900 font-mono tabular-nums">
                              {quantity}
                            </span>
                            <button
                              onClick={() => updateQuantity(product.id, quantity + 1)}
                              disabled={atMaxStock}
                              className="p-1.5 hover:bg-amber-200 disabled:opacity-40 transition-colors text-neutral-700"
                              aria-label="Increase quantity"
                              title={atMaxStock ? 'Maximum available stock reached' : 'Increase quantity'}
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <span className="font-extrabold text-sm text-[#C8102E] font-mono tabular-nums">
                            {CURRENCY} {(product.price * quantity).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => removeFromCart(product.id)}
                        className="p-1.5 text-neutral-400 hover:text-[#C8102E] transition-colors"
                        title="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}

                <button
                  onClick={clearCart}
                  className="text-xs text-neutral-500 hover:text-[#C8102E] font-medium transition-colors pt-2 block ml-auto"
                >
                  Clear all items
                </button>
              </div>
            )}
          </div>

          {/* Footer Checkout Summary */}
          {!confirmedOrder && items.length > 0 && !isCheckingOut && (
            <div className="p-5 bg-white border-t border-amber-200 shadow-md space-y-3">
              <div className="space-y-1.5 text-xs font-medium text-neutral-600">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-bold text-neutral-900 font-mono tabular-nums">
                    {CURRENCY} {subtotal.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Frozen Insulated Shipping</span>
                  <span className="font-bold text-neutral-900 font-mono tabular-nums">
                    {deliveryFee === 0 ? (
                      <span className="text-emerald-700 font-sans font-bold">FREE</span>
                    ) : (
                      `${CURRENCY} ${deliveryFee.toFixed(2)}`
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-base font-extrabold text-[#1A1A1A] pt-2 border-t border-amber-100">
                  <span>Total</span>
                  <span className="text-[#C8102E] font-mono tabular-nums">
                    {CURRENCY} {grandTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              <button
                onClick={handleBeginCheckout}
                className="w-full py-3.5 bg-[#C8102E] text-white rounded-full font-extrabold hover:bg-[#9B0B20] transition-colors shadow-lg hover-lift flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-neutral-500">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>100% Ocean Freshness &amp; Frozen Arrival Guarantee</span>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
