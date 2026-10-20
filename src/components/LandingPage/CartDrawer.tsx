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
  Snowflake
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { CURRENCY } from '../../data/amansoceanProducts';

export const CartDrawer: React.FC = () => {
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
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');

  if (!isCartOpen) return null;

  const FREE_SHIPPING_THRESHOLD = 45;
  const deliveryFee = subtotal >= FREE_SHIPPING_THRESHOLD || items.length === 0 ? 0 : 4.99;
  const progressToFreeShipping = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);
  const amountNeeded = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  const grandTotal = subtotal + deliveryFee;

  const handleCompleteOrder = (e: React.FormEvent) => {
    e.preventDefault();
    setOrderPlaced(true);
    setTimeout(() => {
      clearCart();
    }, 1000);
  };

  const resetAndClose = () => {
    setIsCartOpen(false);
    setIsCheckingOut(false);
    setOrderPlaced(false);
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
                <p className="text-xs font-semibold text-neutral-800">
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
          <div className="bg-[#F5DDB0] px-5 py-3 border-b border-amber-200">
            <div className="flex items-center justify-between text-xs font-bold text-[#1A1A1A] mb-1.5">
              <span className="flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-[#C8102E]" />
                {amountNeeded === 0 ? (
                  <span className="text-[#9B0B20]">You unlocked FREE Flash-Frozen Delivery!</span>
                ) : (
                  <span>Add {CURRENCY}{amountNeeded.toFixed(2)} more for Free Frozen Delivery</span>
                )}
              </span>
              <span>{Math.round(progressToFreeShipping)}%</span>
            </div>
            <div className="w-full h-2 bg-amber-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#C8102E] transition-all duration-300 rounded-full"
                style={{ width: `${progressToFreeShipping}%` }}
              />
            </div>
          </div>

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto p-5">
            {orderPlaced ? (
              <div className="text-center py-12 px-4 space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center shadow-inner">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-black text-[#1A1A1A]">Order Confirmed!</h3>
                <p className="text-sm text-neutral-600 max-w-xs mx-auto">
                  Thank you, <strong>{customerName || 'valued customer'}</strong>! Your fresh ocean catch is being flash-packed with dry ice and will arrive frozen solid.
                </p>
                <div className="p-4 bg-white rounded-2xl border border-amber-200 text-left text-xs space-y-2">
                  <div className="flex justify-between font-bold">
                    <span>Order ID:</span>
                    <span className="font-mono text-[#C8102E]">AO-{(Math.random()*90000+10000).toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Deliver to:</span>
                    <span className="font-medium text-neutral-700">{customerAddress || 'Express Doorstep Delivery'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Estimated Arrival:</span>
                    <span className="font-medium text-emerald-700">Tomorrow, 10:00 AM - 1:00 PM</span>
                  </div>
                </div>
                <button
                  onClick={resetAndClose}
                  className="w-full py-3.5 bg-[#C8102E] text-white rounded-full font-bold hover:bg-[#9B0B20] transition-colors shadow-md"
                >
                  Continue Shopping
                </button>
              </div>
            ) : isCheckingOut ? (
              <form onSubmit={handleCompleteOrder} className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-amber-200">
                  <h3 className="font-extrabold text-base text-[#1A1A1A]">Express Delivery Details</h3>
                  <button
                    type="button"
                    onClick={() => setIsCheckingOut(false)}
                    className="text-xs font-bold text-[#C8102E] hover:underline"
                  >
                    ← Back to Cart
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1">
                    Your Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Alex Morgan"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-amber-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1">
                    Delivery Address *
                  </label>
                  <textarea
                    required
                    rows={2}
                    placeholder="Street, Apartment / House No., Zip Code"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-amber-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1">
                    Delivery Instructions (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Leave with insulated ice box on porch"
                    value={deliveryNote}
                    onChange={(e) => setDeliveryNote(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-amber-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
                  />
                </div>

                <div className="p-3 bg-white rounded-xl border border-amber-200 flex items-center gap-2 text-xs text-neutral-600">
                  <Snowflake className="w-5 h-5 text-[#C8102E] shrink-0" />
                  <span>Packed with insulated thermal foam and eco dry ice blocks to guarantee zero thawing.</span>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 bg-[#C8102E] text-white rounded-full font-extrabold hover:bg-[#9B0B20] transition-colors shadow-lg hover-lift flex items-center justify-center gap-2 mt-4"
                >
                  <span>Place Flash-Frozen Order ({CURRENCY}{grandTotal.toFixed(2)})</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            ) : items.length === 0 ? (
              <div className="text-center py-16 px-4 space-y-4">
                <div className="w-16 h-16 rounded-full bg-amber-100 text-[#C8102E] mx-auto flex items-center justify-center">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <h3 className="font-extrabold text-xl text-[#1A1A1A]">Your cart is empty</h3>
                <p className="text-sm text-neutral-600 max-w-xs mx-auto">
                  Explore our flash-frozen prawns, golden cod fillets, and ready meals to stock up your freezer.
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
                {items.map(({ product, quantity }) => (
                  <div
                    key={product.id}
                    className="flex gap-3 bg-white p-3 rounded-2xl border border-amber-200 shadow-xs items-center"
                  >
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-20 h-20 rounded-xl object-cover bg-amber-50 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm text-[#1A1A1A] truncate">{product.name}</h4>
                      <p className="text-xs text-neutral-500 font-medium">
                        {CURRENCY}{product.price.toFixed(2)} each {product.weight && `· ${product.weight}`}
                      </p>
                      
                      <div className="flex items-center justify-between mt-2">
                        {/* Quantity Controls */}
                        <div className="flex items-center border border-amber-200 rounded-lg bg-amber-50 overflow-hidden">
                          <button
                            onClick={() => updateQuantity(product.id, quantity - 1)}
                            className="p-1 hover:bg-amber-200 transition-colors text-neutral-700"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-2.5 text-xs font-bold text-neutral-900">{quantity}</span>
                          <button
                            onClick={() => updateQuantity(product.id, quantity + 1)}
                            className="p-1 hover:bg-amber-200 transition-colors text-neutral-700"
                            aria-label="Increase quantity"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <span className="font-extrabold text-sm text-[#C8102E]">
                          {CURRENCY}{(product.price * quantity).toFixed(2)}
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
                ))}

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
          {!orderPlaced && items.length > 0 && !isCheckingOut && (
            <div className="p-5 bg-white border-t border-amber-200 shadow-md space-y-3">
              <div className="space-y-1.5 text-xs font-medium text-neutral-600">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-bold text-neutral-900">{CURRENCY}{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Frozen Insulated Shipping</span>
                  <span className="font-bold text-neutral-900">
                    {deliveryFee === 0 ? (
                      <span className="text-emerald-700 font-bold">FREE</span>
                    ) : (
                      `${CURRENCY}${deliveryFee.toFixed(2)}`
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-base font-extrabold text-[#1A1A1A] pt-2 border-t border-amber-100">
                  <span>Total</span>
                  <span className="text-[#C8102E]">{CURRENCY}{grandTotal.toFixed(2)}</span>
                </div>
              </div>

              <button
                onClick={() => setIsCheckingOut(true)}
                className="w-full py-3.5 bg-[#C8102E] text-white rounded-full font-extrabold hover:bg-[#9B0B20] transition-colors shadow-lg hover-lift flex items-center justify-center gap-2"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-neutral-500">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>100% Ocean Freshness & Frozen Arrival Guarantee</span>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
