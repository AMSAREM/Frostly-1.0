import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  Package,
  Snowflake,
  Truck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  MapPin,
  Clock,
  XCircle,
} from 'lucide-react';
import {
  trackStorefrontOrder,
  getRecentTrackedOrders,
  StorefrontOrderConfirmation,
  StorefrontFulfillmentStatus,
  RecentTrackedOrderRef,
} from '../../services/storefrontService';
import { CURRENCY } from '../../data/amansoceanProducts';

interface OrderTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialOrderNumber?: string;
  initialContact?: string;
}

const STAGES: Array<{
  key: StorefrontFulfillmentStatus;
  label: string;
  subtitle: string;
  icon: React.FC<{ className?: string }>;
}> = [
  {
    key: 'confirmed',
    label: 'Order Confirmed',
    subtitle: 'Logged into Amansocean Coldstore queue',
    icon: Package,
  },
  {
    key: 'packing',
    label: 'Cryo-Packed & Iced',
    subtitle: 'Sealed at -22°C with insulated gel packs',
    icon: Snowflake,
  },
  {
    key: 'out_for_delivery',
    label: 'Out for Cold Delivery',
    subtitle: 'Dispatched via refrigerated cold-fleet',
    icon: Truck,
  },
  {
    key: 'delivered',
    label: 'Delivered Frozen',
    subtitle: 'Handed over frozen solid at destination',
    icon: CheckCircle2,
  },
];

function getStageIndex(status: StorefrontFulfillmentStatus): number {
  switch (status) {
    case 'confirmed':
      return 0;
    case 'packing':
      return 1;
    case 'out_for_delivery':
      return 2;
    case 'delivered':
      return 3;
    default:
      return -1;
  }
}

export const OrderTrackingModal: React.FC<OrderTrackingModalProps> = ({
  isOpen,
  onClose,
  initialOrderNumber = '',
  initialContact = '',
}) => {
  const [orderNumber, setOrderNumber] = useState(initialOrderNumber);
  const [contact, setContact] = useState(initialContact);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [trackedOrder, setTrackedOrder] = useState<StorefrontOrderConfirmation | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentTrackedOrderRef[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setRecentOrders(getRecentTrackedOrders());
    if (initialOrderNumber && initialContact) {
      setOrderNumber(initialOrderNumber);
      setContact(initialContact);
      performLookup(initialOrderNumber, initialContact);
    } else if (initialOrderNumber) {
      setOrderNumber(initialOrderNumber);
    }
  }, [isOpen, initialOrderNumber, initialContact]);

  if (!isOpen) return null;

  const performLookup = async (ord: string, cnt: string) => {
    const cleanOrd = ord.trim().toUpperCase();
    const cleanCnt = cnt.trim();
    if (!cleanOrd || !cleanCnt) {
      setErrorMsg('Please enter both your Order Number (e.g. AO-12345) and your Phone or Email.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const result = await trackStorefrontOrder(cleanOrd, cleanCnt);
      setTrackedOrder(result);
    } catch (err: any) {
      setTrackedOrder(null);
      setErrorMsg(err?.message || 'Unable to find matching order.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performLookup(orderNumber, contact);
  };

  const activeStageIdx = trackedOrder ? getStageIndex(trackedOrder.fulfillmentStatus) : -1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-[#FBF3E4] text-[#1A1A1A] rounded-3xl max-w-xl w-full shadow-2xl border-2 border-amber-300 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-[#FFC400] border-b border-amber-300 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#C8102E] text-white flex items-center justify-center font-black text-xs shadow-xs">
              AO
            </div>
            <div>
              <h2 className="font-extrabold text-lg tracking-tight text-[#1A1A1A]">
                Track Cold-Chain Order
              </h2>
              <p className="text-xs font-semibold text-neutral-800">
                Real-time fulfillment status synced with Amansocean Coldstore
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-black/10 transition-colors"
            aria-label="Close order tracker"
          >
            <X className="w-5 h-5 text-neutral-900" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {/* Quick Recent Order Selector */}
          {recentOrders.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-bold text-neutral-600">Recent orders on this device</div>
              <div className="flex flex-wrap gap-2">
                {recentOrders.map((ro) => (
                  <button
                    key={ro.orderNumber}
                    type="button"
                    onClick={() => {
                      setOrderNumber(ro.orderNumber);
                      setContact(ro.contact);
                      performLookup(ro.orderNumber, ro.contact);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 hover:border-[#C8102E] text-xs font-bold text-[#1A1A1A] transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
                  >
                    <span className="font-mono text-[#C8102E]">{ro.orderNumber}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      {CURRENCY}
                      {Number(ro.totalAmount || 0).toFixed(2)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Lookup Form */}
          <form onSubmit={handleSubmit} className="bg-white p-4 rounded-2xl border border-amber-200 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="track-order-number"
                  className="block text-xs font-bold text-neutral-700 mb-1"
                >
                  Order Number
                </label>
                <input
                  id="track-order-number"
                  type="text"
                  required
                  placeholder="AO-12345"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-amber-200 bg-[#FBF3E4]/50 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
                />
              </div>
              <div>
                <label
                  htmlFor="track-order-contact"
                  className="block text-xs font-bold text-neutral-700 mb-1"
                >
                  Phone or Email Used
                </label>
                <input
                  id="track-order-contact"
                  type="text"
                  required
                  placeholder="Phone number or email"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-amber-200 bg-[#FBF3E4]/50 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-full bg-[#C8102E] hover:bg-[#9B0B20] disabled:opacity-60 text-white font-extrabold text-sm transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Checking Coldstore Status...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Look Up Order</span>
                </>
              )}
            </button>
          </form>

          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Tracked Order Result */}
          {trackedOrder && (
            <div className="bg-white rounded-2xl border border-amber-200 p-5 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-amber-100">
                <div>
                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                    <span className="font-mono font-bold text-sm text-[#C8102E]">
                      {trackedOrder.orderNumber}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{trackedOrder.customerName}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-neutral-500 mt-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      Placed {new Date(trackedOrder.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => performLookup(orderNumber, contact)}
                  disabled={loading}
                  className="px-3 py-1.5 rounded-lg border border-amber-200 hover:bg-amber-50 text-xs font-bold text-neutral-800 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {/* Status Timeline */}
              {trackedOrder.fulfillmentStatus === 'canceled' ? (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-3 text-rose-800">
                  <XCircle className="w-6 h-6 text-rose-600 shrink-0" />
                  <div>
                    <div className="font-bold text-sm">Order Canceled</div>
                    <div className="text-xs text-rose-700">
                      This order has been marked canceled by dispatch operations.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {STAGES.map((stage, idx) => {
                    const Icon = stage.icon;
                    const isCompleted = idx <= activeStageIdx;
                    const isCurrent = idx === activeStageIdx;
                    return (
                      <div
                        key={stage.key}
                        className={`flex items-start gap-3 p-3 rounded-xl transition-colors ${
                          isCurrent
                            ? 'bg-[#FBF3E4] border border-amber-300'
                            : 'bg-transparent'
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                            isCompleted
                              ? 'bg-emerald-600 text-white'
                              : 'bg-neutral-100 text-neutral-400'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`text-sm font-bold ${
                                isCompleted ? 'text-[#1A1A1A]' : 'text-neutral-400'
                              }`}
                            >
                              {stage.label}
                            </span>
                            {isCurrent && (
                              <span className="text-xs font-bold text-emerald-700">
                                Current Stage
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-neutral-500 mt-0.5">{stage.subtitle}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Delivery Destination */}
              <div className="pt-3 border-t border-amber-100 flex items-start gap-2.5 text-xs text-neutral-700">
                <MapPin className="w-4 h-4 text-[#C8102E] shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-[#1A1A1A]">Delivering to: </span>
                  <span>{trackedOrder.deliveryAddress}</span>
                  {trackedOrder.deliveryNotes && (
                    <div className="text-neutral-500 mt-0.5">
                      Note: {trackedOrder.deliveryNotes}
                    </div>
                  )}
                </div>
              </div>

              {/* Line Items & Totals */}
              <div className="pt-3 border-t border-amber-100 space-y-2">
                <div className="text-xs font-bold text-neutral-700">Order Summary</div>
                {trackedOrder.items.map((item, idx) => {
                  const itemImg = (item as any).imageUrl;
                  return (
                    <div
                      key={`${item.productId}-${idx}`}
                      className="flex items-center justify-between text-xs text-neutral-700 gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        {itemImg ? (
                          <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-amber-200 bg-amber-50 shrink-0">
                            <img
                              src={itemImg}
                              alt={item.productName}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const fb = e.currentTarget.parentElement?.querySelector('.img-fallback');
                                if (fb) (fb as HTMLElement).style.display = 'flex';
                              }}
                            />
                            <div className="w-full h-full hidden items-center justify-center text-amber-500 img-fallback">
                              <Package className="w-4 h-4" />
                            </div>
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-lg border border-amber-200 bg-amber-50 flex items-center justify-center text-amber-500 shrink-0">
                            <Package className="w-4 h-4" />
                          </div>
                        )}
                        <span className="truncate">
                          <span className="font-mono font-bold">{item.quantity}x</span>{' '}
                          {item.productName}
                        </span>
                      </div>
                      <span className="font-mono font-bold tabular-nums shrink-0">
                        {CURRENCY}
                        {Number(item.lineTotal).toFixed(2)}
                      </span>
                    </div>
                  );
                })}
                <div className="pt-2 border-t border-amber-100 flex items-center justify-between text-sm font-extrabold text-[#1A1A1A]">
                  <span>Total ({trackedOrder.paymentMethod})</span>
                  <span className="font-mono tabular-nums text-[#C8102E]">
                    {CURRENCY}
                    {Number(trackedOrder.totalAmount).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
