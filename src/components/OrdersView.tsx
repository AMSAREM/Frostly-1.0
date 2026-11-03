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
  MapPin,
  Calendar,
  Edit2,
  Trash2,
  Calculator,
  Check,
  AlertCircle,
  CreditCard,
  Building2,
  Filter
} from 'lucide-react';
import { ClientOrder, OrderStatus, InventoryBatch, Customer } from '../types';
import { formatCurrency as defaultFormatCurrency, formatWeight, getYieldVariance } from '../utils/formatters';

interface OrdersViewProps {
  orders: ClientOrder[];
  batches: InventoryBatch[];
  customers?: Customer[];
  onOpenNewOrder: () => void;
  onOpenWeigher: (order: ClientOrder) => void;
  onOpenInvoice: (order: ClientOrder) => void;
  onAdvanceOrderStatus: (orderId: string, nextStatus: OrderStatus) => void;
  onEditOrder: (order: ClientOrder) => void;
  onEditQuote: (order: ClientOrder) => void;
  onDeleteOrder: (order: ClientOrder) => void;
  onUpdatePaymentStatus: (orderId: string, status: ClientOrder['paymentStatus']) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  useImperial: boolean;
  companyName?: string;
  formatCurrency?: (amount: number) => string;
}

export const OrdersView: React.FC<OrdersViewProps> = ({
  orders,
  batches,
  customers = [],
  onOpenNewOrder,
  onOpenWeigher,
  onOpenInvoice,
  onAdvanceOrderStatus,
  onEditOrder,
  onEditQuote,
  onDeleteOrder,
  onUpdatePaymentStatus,
  searchQuery,
  setSearchQuery,
  useImperial,
  companyName,
  formatCurrency = defaultFormatCurrency
}) => {
  // Invoice & Payment Status Filter Tab
  const [invoiceTab, setInvoiceTab] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');

  const isOrderPaid = (o: ClientOrder) => o.paymentStatus === 'Paid' || o.paymentStatus === 'Paid in Full';

  // Filtered orders list
  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.destinationCity.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.items.some(i => i.speciesName.toLowerCase().includes(searchQuery.toLowerCase()) || i.lotId.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'All' || o.status === statusFilter;
    const matchesCategory = categoryFilter === 'All' || o.clientCategory === categoryFilter;

    let matchesInvoiceTab = true;
    if (invoiceTab === 'unpaid') {
      matchesInvoiceTab = !isOrderPaid(o);
    } else if (invoiceTab === 'paid') {
      matchesInvoiceTab = isOrderPaid(o);
    }

    return matchesSearch && matchesStatus && matchesCategory && matchesInvoiceTab;
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
      case 'Pending Confirmation': return 'Accept & Dock';
      case 'Weighing & Grading': return 'Weigh Catch';
      case 'Cryo-Packed & Iced': return 'Dispatch Reefer';
      case 'In Reefer Transit': return 'Confirm Delivery';
      case 'Delivered': return 'Completed';
      default: return 'Advance';
    }
  };

  // Financial aggregates
  const totalInvoicedVol = orders.reduce((sum, o) => sum + (o.adjustedTotalUSD || o.quotedTotalUSD), 0);
  const unpaidOrders = orders.filter(o => !isOrderPaid(o));
  const unpaidTotal = unpaidOrders.reduce((sum, o) => sum + (o.adjustedTotalUSD || o.quotedTotalUSD), 0);
  const paidOrders = orders.filter(o => isOrderPaid(o));
  const paidTotal = paidOrders.reduce((sum, o) => sum + (o.adjustedTotalUSD || o.quotedTotalUSD), 0);
  const totalQuotedGross = orders.reduce((sum, o) => sum + o.quotedTotalUSD, 0);
  const totalAdjustedGross = orders.reduce((sum, o) => sum + (o.adjustedTotalUSD || o.quotedTotalUSD), 0);
  const totalYieldVariance = totalAdjustedGross - totalQuotedGross;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header & Invoicing Pipeline Banner */}
      <div className="bg-white p-5 sm:p-7 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
                {companyName || 'Amans Ocean Seafoods'} · Wholesale & Invoicing
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-xs text-slate-500 font-mono">
                {orders.length} Total Orders ({unpaidOrders.length} Unpaid Invoices)
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
              Orders & Commercial Invoices
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Track client orders, edit estimated quotes, manage paid & unpaid commercial invoices, and print receipts.
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={onOpenNewOrder}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer w-full sm:w-auto"
            >
              <Plus className="w-4 h-4" />
              <span>New B2B Order</span>
            </button>
          </div>
        </div>

        {/* Invoice & Receivables Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-200">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Invoiced Volume</div>
            <div className="text-lg font-black font-mono text-slate-900 mt-0.5">{formatCurrency(totalInvoicedVol)}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">{orders.length} total commercial orders</div>
          </div>

          <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-amber-50 border border-amber-200">
            <div className="text-[10px] text-amber-800 font-bold uppercase tracking-wider flex items-center justify-between">
              <span>Unpaid / Outstanding</span>
              <span className="text-[9px] px-1.5 py-0.2 bg-amber-200 text-amber-900 rounded font-bold">Due</span>
            </div>
            <div className="text-lg font-black font-mono text-amber-950 mt-0.5">{formatCurrency(unpaidTotal)}</div>
            <div className="text-[11px] text-amber-800 mt-0.5">{unpaidOrders.length} unpaid invoices pending</div>
          </div>

          <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-emerald-50 border border-emerald-200">
            <div className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider flex items-center justify-between">
              <span>Paid & Collected</span>
              <span className="text-[9px] px-1.5 py-0.2 bg-emerald-200 text-emerald-900 rounded font-bold">Settled</span>
            </div>
            <div className="text-lg font-black font-mono text-emerald-950 mt-0.5">{formatCurrency(paidTotal)}</div>
            <div className="text-[11px] text-emerald-700 mt-0.5">{paidOrders.length} invoices settled in full</div>
          </div>

          <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-indigo-50 border border-indigo-200">
            <div className="text-[10px] text-indigo-700 font-bold uppercase tracking-wider">Catch-Weight Variance</div>
            <div className="text-lg font-black font-mono text-indigo-950 mt-0.5 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
              <span>{totalYieldVariance >= 0 ? `+${formatCurrency(totalYieldVariance)}` : formatCurrency(totalYieldVariance)}</span>
            </div>
            <div className="text-[11px] text-indigo-700 mt-0.5">Scale actual vs quoted target</div>
          </div>
        </div>

        {/* Primary Filter Tabs: All Orders vs Unpaid Invoices vs Paid Invoices */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
            <button
              onClick={() => setInvoiceTab('all')}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                invoiceTab === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Orders ({orders.length})
            </button>
            <button
              onClick={() => setInvoiceTab('unpaid')}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                invoiceTab === 'unpaid'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-amber-800 hover:bg-amber-100/50'
              }`}
            >
              <span>Unpaid Invoices</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                invoiceTab === 'unpaid' ? 'bg-amber-700 text-white' : 'bg-amber-200 text-amber-900'
              }`}>
                {unpaidOrders.length}
              </span>
            </button>
            <button
              onClick={() => setInvoiceTab('paid')}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                invoiceTab === 'paid'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-800 hover:bg-emerald-100/50'
              }`}
            >
              <span>Paid Invoices</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                invoiceTab === 'paid' ? 'bg-emerald-700 text-white' : 'bg-emerald-200 text-emerald-900'
              }`}>
                {paidOrders.length}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="hidden sm:flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setViewMode('table')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${viewMode === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
              >
                Table View
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${viewMode === 'cards' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
              >
                Card View
              </button>
            </div>

            {/* Stage filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 font-medium focus:outline-none"
            >
              <option value="All">All Stages</option>
              <option value="Pending Confirmation">Pending Confirmation</option>
              <option value="Weighing & Grading">Weighing & Grading</option>
              <option value="Cryo-Packed & Iced">Cryo-Packed & Iced</option>
              <option value="In Reefer Transit">In Reefer Transit</option>
              <option value="Delivered">Delivered</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Orders Content Area */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl sm:rounded-3xl border border-slate-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <Truck className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-base text-slate-900">
            {invoiceTab === 'unpaid' ? 'No unpaid invoices found' : invoiceTab === 'paid' ? 'No paid invoices found' : 'No orders found'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {invoiceTab === 'unpaid'
              ? 'All customer orders are currently settled in full.'
              : 'Create a new B2B wholesale order or clear your search criteria.'}
          </p>
          <button
            onClick={onOpenNewOrder}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Order</span>
          </button>
        </div>
      ) : viewMode === 'table' ? (
        /* High-Density Desktop Table View with Action Buttons */
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Order / Invoice ID</th>
                  <th className="py-3 px-4">Customer & City</th>
                  <th className="py-3 px-4">Species & Quoted Qty</th>
                  <th className="py-3 px-4">Estimated Quote / Value</th>
                  <th className="py-3 px-4">Stage Status</th>
                  <th className="py-3 px-4">Payment & Invoice</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((order) => {
                  const finalVal = order.adjustedTotalUSD || order.quotedTotalUSD;
                  const isPaid = isOrderPaid(order);
                  const nextStage = getNextStage(order.status);
                  const isWeighing = order.status === 'Weighing & Grading';

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Order ID */}
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <span className="text-indigo-700">{order.id}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                          {order.orderDate}
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 text-sm">{order.clientName}</div>
                        <div className="text-slate-500 text-[11px] flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{order.destinationCity}</span>
                          <span>·</span>
                          <span className="text-slate-400">{order.clientCategory}</span>
                        </div>
                      </td>

                      {/* Species & Items */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">
                          {order.items.map(i => `${i.speciesName} (${formatWeight(i.requestedWeightKg, useImperial)})`).join(', ') || 'No line items'}
                        </div>
                        <div className="text-[10px] text-indigo-600 font-semibold mt-0.5">
                          Req. Delivery: {order.requiredDeliveryDate}
                        </div>
                      </td>

                      {/* Quoted Total with Edit Quote affordance */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-slate-900 text-sm">
                            {formatCurrency(finalVal)}
                          </span>
                          <button
                            onClick={() => onEditQuote(order)}
                            title="Edit Estimated Quote"
                            className="p-1 rounded text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                          >
                            <Calculator className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {order.adjustedTotalUSD !== order.quotedTotalUSD && order.adjustedTotalUSD > 0 && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            Quoted: {formatCurrency(order.quotedTotalUSD)}
                          </div>
                        )}
                      </td>

                      {/* Fulfillment Stage */}
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          order.status === 'Delivered' ? 'bg-emerald-100 text-emerald-800' :
                          order.status === 'In Reefer Transit' ? 'bg-blue-100 text-blue-800' :
                          order.status === 'Cryo-Packed & Iced' ? 'bg-violet-100 text-violet-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {order.status}
                        </span>
                      </td>

                      {/* Payment Status & Toggle */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => onUpdatePaymentStatus(order.id, isPaid ? 'Invoiced' : 'Paid in Full')}
                            title={isPaid ? 'Click to mark as Unpaid' : 'Click to mark as Paid'}
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold w-fit cursor-pointer transition-colors ${
                              isPaid 
                                ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800' 
                                : 'bg-amber-100 hover:bg-amber-200 text-amber-900'
                            }`}
                          >
                            {isPaid ? <Check className="w-3 h-3 text-emerald-600" /> : <AlertCircle className="w-3 h-3 text-amber-600" />}
                            <span>{isPaid ? 'PAID IN FULL' : 'UNPAID'}</span>
                          </button>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {order.paymentStatus}
                          </span>
                        </div>
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Commercial Invoice */}
                          <button
                            onClick={() => onOpenInvoice(order)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                            title="View / Print Commercial Invoice"
                          >
                            <FileText className="w-3.5 h-3.5 text-indigo-300" />
                            <span>Invoice</span>
                          </button>

                          {/* Edit / Modify Order */}
                          <button
                            onClick={() => onEditOrder(order)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                            title="Edit / Modify Order Details & Line Items"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Scale Button */}
                          {isWeighing && (
                            <button
                              onClick={() => onOpenWeigher(order)}
                              className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors cursor-pointer"
                              title="Weigh Dock Catch on Scale"
                            >
                              <Scale className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Advance Status Button */}
                          {nextStage && order.status !== 'Delivered' && (
                            <button
                              onClick={() => onAdvanceOrderStatus(order.id, nextStage)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                              title={`Advance to ${nextStage}`}
                            >
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Delete Order */}
                          <button
                            onClick={() => onDeleteOrder(order)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete Order"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Detailed Card View (Great for Mobile and Quick Touch Actions) */
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const nextStage = getNextStage(order.status);
            const isDelivered = order.status === 'Delivered';
            const isWeighing = order.status === 'Weighing & Grading';
            const isPaid = isOrderPaid(order);
            const finalVal = order.adjustedTotalUSD || order.quotedTotalUSD;

            return (
              <div
                key={order.id}
                className="bg-white p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs hover:border-indigo-200 transition-all space-y-4"
              >
                {/* Order Top Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                        {order.id}
                      </span>
                      <span className="font-bold text-base text-slate-900">
                        {order.clientName}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-500">
                        {order.clientCategory}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {order.destinationCity} ({order.deliveryAddress})
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        Required: <strong className="text-slate-800">{order.requiredDeliveryDate}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Badges & Value */}
                  <div className="flex items-center gap-3 sm:text-right">
                    <div>
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">Total Value</div>
                      <div className="text-base font-black text-slate-900 font-mono">
                        {formatCurrency(finalVal)}
                      </div>
                    </div>

                    {/* Paid/Unpaid Badge */}
                    <button
                      onClick={() => onUpdatePaymentStatus(order.id, isPaid ? 'Invoiced' : 'Paid in Full')}
                      title="Click to toggle Paid/Unpaid"
                      className={`px-2.5 py-1 rounded-full text-xs font-bold cursor-pointer transition-colors ${
                        isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
                      }`}
                    >
                      {isPaid ? 'PAID' : 'UNPAID'}
                    </button>

                    {/* Stage status */}
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                      {order.status}
                    </span>
                  </div>
                </div>

                {/* Line items preview */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Package className="w-3.5 h-3.5 text-indigo-500" />
                      Allocated Seafood Items & Estimated Quote
                    </span>
                    <button
                      onClick={() => onEditQuote(order)}
                      className="text-indigo-600 hover:text-indigo-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Calculator className="w-3 h-3" />
                      <span>Edit Quote Rates</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {order.items.map((item) => (
                      <div
                        key={item.id}
                        className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-slate-900">{item.speciesName}</div>
                          <div className="text-[10px] text-slate-500">
                            Lot: <strong className="font-mono text-indigo-600">{item.lotId}</strong> · Rate: {formatCurrency(item.pricePerKg)}/kg
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-bold text-slate-800">
                            {formatWeight(item.actualWeighedKg ?? item.requestedWeightKg, useImperial)}
                          </div>
                          <div className="text-[10px] font-mono font-semibold text-indigo-700">
                            {formatCurrency((item.actualWeighedKg ?? item.requestedWeightKg) * item.pricePerKg)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Buttons Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Invoice */}
                    <button
                      onClick={() => onOpenInvoice(order)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-indigo-300" />
                      <span>Commercial Invoice</span>
                    </button>

                    {/* Edit Order */}
                    <button
                      onClick={() => onEditOrder(order)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit Order</span>
                    </button>

                    {/* Edit Quote */}
                    <button
                      onClick={() => onEditQuote(order)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200 transition-colors cursor-pointer"
                    >
                      <Calculator className="w-3.5 h-3.5" />
                      <span>Edit Quote</span>
                    </button>

                    {/* Weigh Scale if applicable */}
                    {isWeighing && (
                      <button
                        onClick={() => onOpenWeigher(order)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold border border-blue-200 transition-colors cursor-pointer"
                      >
                        <Scale className="w-3.5 h-3.5" />
                        <span>Dock Scale</span>
                      </button>
                    )}

                    {/* Delete */}
                    <button
                      onClick={() => onDeleteOrder(order)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Delete Order"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Stage Advancement */}
                  {nextStage && !isDelivered && (
                    <button
                      onClick={() => onAdvanceOrderStatus(order.id, nextStage)}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors cursor-pointer ml-auto"
                    >
                      <span>{getStageActionLabel(order.status)}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
