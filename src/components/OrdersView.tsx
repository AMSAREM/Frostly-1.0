import React, { useState } from 'react';
import { 
  Truck, 
  Scale, 
  FileText, 
  Plus, 
  Search, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  TrendingUp, 
  DollarSign, 
  Package, 
  ShieldCheck,
  ChevronRight,
  Sparkles,
  Layers,
  MapPin,
  Calendar
} from 'lucide-react';
import { ClientOrder, OrderStatus, InventoryBatch } from '../types';
import { formatCurrency, formatWeight, getYieldVariance } from '../utils/formatters';

interface OrdersViewProps {
  orders: ClientOrder[];
  batches: InventoryBatch[];
  onOpenNewOrder: () => void;
  onOpenWeigher: (order: ClientOrder) => void;
  onOpenInvoice: (order: ClientOrder) => void;
  onAdvanceOrderStatus: (orderId: string, nextStatus: OrderStatus) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  useImperial: boolean;
}

export const OrdersView: React.FC<OrdersViewProps> = ({
  orders,
  batches,
  onOpenNewOrder,
  onOpenWeigher,
  onOpenInvoice,
  onAdvanceOrderStatus,
  searchQuery,
  setSearchQuery,
  useImperial
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.destinationCity.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.items.some(i => i.speciesName.toLowerCase().includes(searchQuery.toLowerCase()) || i.lotId.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'All' || o.status === statusFilter;
    const matchesCategory = categoryFilter === 'All' || o.clientCategory === categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  const getNextStage = (current: OrderStatus): OrderStatus | null => {
    switch (current) {
      case 'Pending Confirmation': return 'Weighing & Grading';
      case 'Weighing & Grading': return 'Cryo-Packed & Iced';
      case 'Cryo-Packed & Iced': return 'In Reefer Transit';
      case 'In Reefer Transit': return 'Delivered';
      default: return null;
    }
  };

  const getStageActionLabel = (current: OrderStatus): string => {
    switch (current) {
      case 'Pending Confirmation': return 'Accept & Send to Dock';
      case 'Weighing & Grading': return 'Weigh on Precision Scale';
      case 'Cryo-Packed & Iced': return 'Assign & Dispatch Reefer';
      case 'In Reefer Transit': return 'Confirm Customer Delivery';
      case 'Delivered': return 'Completed';
      default: return 'Action';
    }
  };

  const totalQuotedGross = orders.reduce((sum, o) => sum + o.quotedTotalUSD, 0);
  const totalAdjustedGross = orders.reduce((sum, o) => sum + (o.adjustedTotalUSD || o.quotedTotalUSD), 0);
  const totalYieldVariance = totalAdjustedGross - totalQuotedGross;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header & Catch-Weight Pipeline Banner */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider border border-indigo-100">
                Fulfillment & Dynamic Catch-Weight
              </span>
              <span className="text-xs text-slate-400 font-mono-code">
                {filteredOrders.length} B2B Wholesale Accounts
              </span>
            </div>
            <h1 className="text-2xl font-heading font-extrabold text-slate-900 tracking-tight mt-1.5">
              Wholesale Order Management
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Live scale yield calibration, reefer temperature monitoring, and commercial invoices.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={onOpenNewOrder}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-bold shadow-md shadow-indigo-200 transition-all cursor-pointer w-full sm:w-auto"
            >
              <Plus className="w-4 h-4" />
              <span>New B2B Order</span>
            </button>
          </div>
        </div>

        {/* Catch-Weight Yield Statistics Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
          <div>
            <span className="text-slate-400 font-semibold uppercase text-[10px]">Quoted Target Value:</span>
            <div className="font-bold text-slate-900 font-mono-code text-sm mt-0.5">
              {formatCurrency(totalQuotedGross)}
            </div>
          </div>

          <div>
            <span className="text-slate-400 font-semibold uppercase text-[10px]">Realized Weighed Yield:</span>
            <div className="font-bold text-indigo-700 font-mono-code text-sm mt-0.5">
              {formatCurrency(totalAdjustedGross)}
            </div>
          </div>

          <div>
            <span className="text-slate-400 font-semibold uppercase text-[10px]">Catch-Weight Yield Delta:</span>
            <div className="font-bold text-emerald-600 font-mono-code text-sm mt-0.5 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              {totalYieldVariance >= 0 ? `+${formatCurrency(totalYieldVariance)}` : formatCurrency(totalYieldVariance)} (Zero Revenue Leak)
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 w-full sm:w-auto">
            {['All', 'Pending Confirmation', 'Weighing & Grading', 'Cryo-Packed & Iced', 'In Reefer Transit', 'Delivered'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border shrink-0 ${
                  statusFilter === st
                    ? 'bg-slate-900 text-white border-slate-900 shadow-2xs font-bold'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-full px-3.5 py-1.5 text-xs text-slate-700 font-medium focus:outline-none w-full sm:w-auto"
          >
            <option value="All">All Client Sectors</option>
            <option value="Michelin Restaurant">Michelin Restaurant</option>
            <option value="Luxury Hotel Group">Luxury Hotel Group</option>
            <option value="Seafood Wholesaler">Seafood Wholesaler</option>
          </select>
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
              <Truck className="w-6 h-6" />
            </div>
            <h3 className="font-heading font-bold text-base text-slate-900">No orders found in this filter</h3>
            <p className="text-xs text-slate-500">Create a new wholesale B2B order or clear your search criteria.</p>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const nextStage = getNextStage(order.status);
            const isDelivered = order.status === 'Delivered';
            const isWeighing = order.status === 'Weighing & Grading';
            const hasWeighedAll = order.items.every(i => i.actualWeighedKg !== null);

            return (
              <div
                key={order.id}
                className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs hover:border-indigo-200 transition-all space-y-5"
              >
                {/* Order Top Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono-code text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                        {order.id}
                      </span>
                      <span className="font-heading font-extrabold text-base text-slate-900">
                        {order.clientName}
                      </span>
                      <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full border border-slate-200">
                        {order.clientCategory}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {order.destinationCity} ({order.deliveryAddress})
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        Required: <strong className="text-slate-800">{order.requiredDeliveryDate}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Status Badge & Financial Preview */}
                  <div className="flex items-center gap-3 sm:text-right">
                    <div>
                      <div className="text-[11px] text-slate-400 font-medium">Catch-Weight Total</div>
                      <div className="text-base font-extrabold text-indigo-700 font-mono-code">
                        {formatCurrency(order.adjustedTotalUSD || order.quotedTotalUSD)}
                      </div>
                    </div>

                    <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                      isDelivered ? 'bg-emerald-100 text-emerald-800' :
                      order.status === 'In Reefer Transit' ? 'bg-blue-100 text-blue-800' :
                      order.status === 'Cryo-Packed & Iced' ? 'bg-violet-100 text-violet-800' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      <span className="w-2 h-2 rounded-full bg-current" />
                      {order.status}
                    </div>
                  </div>
                </div>

                {/* Line Items Table & Catch-Weight Yield Readings */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                  <div className="md:col-span-8 space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-indigo-500" />
                      Allocated Seafood Line Items
                    </div>

                    <div className="space-y-2">
                      {order.items.map((item) => {
                        const hasWeighed = item.actualWeighedKg !== null;
                        const variance = getYieldVariance(item.requestedWeightKg, item.actualWeighedKg);

                        return (
                          <div
                            key={item.id}
                            className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                          >
                            <div>
                              <div className="font-bold text-slate-900">
                                {item.speciesName} <span className="text-slate-400 font-normal">({item.grade})</span>
                              </div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                                <span>Lot: <strong className="font-mono-code text-indigo-600">{item.lotId}</strong></span>
                                <span>•</span>
                                <span>Rate: {formatCurrency(item.pricePerKg)}/kg</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-4 sm:text-right">
                              <div>
                                <span className="text-[10px] text-slate-400 uppercase font-semibold">Target vs Weighed</span>
                                <div className="font-mono-code font-bold text-slate-800">
                                  {formatWeight(item.requestedWeightKg, useImperial)} →{' '}
                                  {hasWeighed ? (
                                    <strong className="text-emerald-600">
                                      {formatWeight(item.actualWeighedKg!, useImperial)}
                                    </strong>
                                  ) : (
                                    <span className="text-amber-600 font-normal">Pending dock weigh</span>
                                  )}
                                </div>
                              </div>

                              {hasWeighed && (
                                <div className="text-[11px] font-bold px-2 py-1 rounded-lg bg-white border border-slate-200">
                                  <span className={variance.isOver ? 'text-amber-700' : 'text-indigo-700'}>
                                    {variance.diffKg > 0 ? `+${variance.diffKg.toFixed(2)}` : variance.diffKg.toFixed(2)} kg
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Packaging & Reefer Info */}
                  <div className="md:col-span-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Cold-Chain Specification
                    </div>
                    <div className="text-slate-700">
                      Package: <strong>{order.packagingRequirement}</strong>
                    </div>
                    <div className="text-slate-700">
                      Carrier: <strong>{order.assignedReeferId || 'Queued for Assignment'}</strong>
                    </div>
                    {order.assignedDriver && (
                      <div className="text-[11px] text-slate-500">
                        Driver: {order.assignedDriver}
                      </div>
                    )}
                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Payment:</span>
                      <span className="font-bold text-slate-800">{order.paymentStatus}</span>
                    </div>
                  </div>
                </div>

                {/* Card Action Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => onOpenInvoice(order)}
                      className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-full bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Commercial Invoice</span>
                    </button>

                    {/* Scale Calibration Button */}
                    <button
                      id={`btn-weigh-order-${order.id}`}
                      onClick={() => onOpenWeigher(order)}
                      className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200 transition-colors cursor-pointer"
                    >
                      <Scale className="w-3.5 h-3.5" />
                      <span>{hasWeighedAll ? 'Recalibrate Scale' : 'Weigh Dock Catch'}</span>
                    </button>
                  </div>

                  {/* Stage Advancement Button */}
                  {nextStage && !isDelivered && (
                    <button
                      onClick={() => onAdvanceOrderStatus(order.id, nextStage)}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer sm:ml-auto"
                    >
                      <span>{getStageActionLabel(order.status)}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
