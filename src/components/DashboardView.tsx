import React from 'react';
import { 
  Anchor, 
  Package, 
  Truck, 
  TrendingUp, 
  ShieldCheck, 
  ThermometerSnowflake, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight, 
  Clock, 
  MapPin, 
  Plus, 
  Sparkles,
  Layers,
  Scale,
  CheckCircle2,
  ChevronRight,
  DollarSign,
  Users,
  Ship,
  ShoppingBag,
  CreditCard,
  Building2,
  FileText
} from 'lucide-react';
import { 
  InventoryBatch, 
  ClientOrder, 
  Customer, 
  Supplier, 
  RetailWholesaleProduct, 
  RetailTransaction, 
  PurchaseOrderLanding, 
  FinancialLedgerEntry 
} from '../types';
import { formatCurrency, formatWeight, formatTemp } from '../utils/formatters';

interface DashboardViewProps {
  batches: InventoryBatch[];
  orders: ClientOrder[];
  customers: Customer[];
  suppliers: Supplier[];
  products: RetailWholesaleProduct[];
  retailSales: RetailTransaction[];
  purchaseOrders: PurchaseOrderLanding[];
  financialEntries: FinancialLedgerEntry[];
  onSelectTab: (tab: any) => void;
  onOpenPassport: (batch: InventoryBatch) => void;
  onOpenNewBatch: () => void;
  onOpenNewOrder?: () => void;
  onOpenNewOrderModal?: () => void;
  useImperial: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  batches = [],
  orders = [],
  customers = [],
  suppliers = [],
  products = [],
  retailSales = [],
  purchaseOrders = [],
  financialEntries = [],
  onSelectTab,
  onOpenPassport,
  onOpenNewBatch,
  onOpenNewOrder,
  onOpenNewOrderModal,
  useImperial
}) => {
  const handleOpenOrder = onOpenNewOrder || onOpenNewOrderModal || (() => {});
  // Aggregate Core Metrics
  const totalStockKg = batches.reduce((sum, b) => sum + b.availableWeightKg, 0);
  const totalStockValueUSD = batches.reduce((sum, b) => sum + b.availableWeightKg * b.wholesalePricePerKg, 0);

  // Financials
  const totalWholesaleRevenue = orders.reduce((sum, o) => sum + (o.adjustedTotalUSD || o.quotedTotalUSD), 0);
  const totalRetailRevenue = retailSales.reduce((sum, r) => sum + r.totalAmount, 0);
  const grossRevenue = totalWholesaleRevenue + totalRetailRevenue;

  const totalCOGS = purchaseOrders.reduce((sum, po) => sum + po.totalCostUSD, 0);
  const grossProfit = grossRevenue - totalCOGS;
  const grossMarginPct = grossRevenue > 0 ? (grossProfit / grossRevenue) * 100 : 0;

  const totalAR = customers.reduce((sum, c) => sum + c.outstandingBalanceUSD, 0);
  const totalAP = suppliers.reduce((sum, s) => sum + s.outstandingPayableUSD, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Welcome Banner & Quick Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 sm:p-7 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-extrabold uppercase tracking-wider border border-emerald-200">
              Seafood Business ERP Active
            </span>
            <span className="text-xs text-slate-400 font-mono-code">
              Pier 38 Commercial Operations Hub
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-slate-900 tracking-tight mt-1.5">
            Executive Financials & Supply Chain
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Integrated financials, customer CRM, harvester fleet procurement, and dual-channel retail POS and wholesale distribution.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 shrink-0 w-full sm:w-auto">
          <button
            onClick={() => onSelectTab('retail_wholesale')}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer whitespace-nowrap"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Retail POS</span>
          </button>
          <button
            onClick={() => onSelectTab('suppliers')}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer whitespace-nowrap"
          >
            <Ship className="w-4 h-4" />
            <span>Harvester Catch</span>
          </button>
          <button
            onClick={() => onSelectTab('financials')}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer whitespace-nowrap"
          >
            <DollarSign className="w-4 h-4" />
            <span>Financials & P&L</span>
          </button>
        </div>
      </div>

      {/* Primary Financial & Operational Metrics (Clean, Elevated Archetype) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Gross Sales Revenue */}
        <div 
          onClick={() => onSelectTab('financials')}
          className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs hover:border-emerald-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Gross Revenue
            </span>
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center group-hover:scale-105 transition-transform">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 font-mono-code">
              {formatCurrency(grossRevenue)}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
              <span className="font-bold text-emerald-600 flex items-center">
                <ArrowUpRight className="w-3.5 h-3.5" /> {grossMarginPct.toFixed(1)}%
              </span>
              <span>gross margin across B2B & POS</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Accounts Receivable (AR) */}
        <div 
          onClick={() => onSelectTab('customers')}
          className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs hover:border-amber-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Accounts Receivable (AR)
            </span>
            <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-amber-700 font-mono-code">
              {formatCurrency(totalAR)}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
              <span>{customers.length} Client Accounts ({customers.filter(c => c.outstandingBalanceUSD > 0).length} Unpaid)</span>
            </div>
          </div>
        </div>

        {/* KPI 3: Accounts Payable (AP) */}
        <div 
          onClick={() => onSelectTab('suppliers')}
          className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs hover:border-rose-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Accounts Payable (AP)
            </span>
            <div className="w-9 h-9 rounded-2xl bg-rose-50 text-rose-700 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Ship className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-rose-700 font-mono-code">
              {formatCurrency(totalAP)}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
              <span>{suppliers.length} Sourcing Fleets & Farms</span>
            </div>
          </div>
        </div>

        {/* KPI 4: Cold-Chain Biomass In Stock */}
        <div 
          onClick={() => onSelectTab('inventory')}
          className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs hover:border-indigo-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Fish Biomass In Stock
            </span>
            <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-indigo-900 font-mono-code">
              {formatWeight(totalStockKg, useImperial)}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
              <span className="font-bold text-indigo-700">{formatCurrency(totalStockValueUSD)}</span>
              <span>inventory book value</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4-Module Quick Navigation Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Module 1: Retail & Wholesale */}
        <div 
          onClick={() => onSelectTab('retail_wholesale')}
          className="bg-gradient-to-br from-emerald-900 to-teal-950 text-white p-5 rounded-3xl shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-4"
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="p-2.5 bg-white/10 rounded-2xl text-emerald-300">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                Dual Channels
              </span>
            </div>
            <h3 className="text-lg font-bold mt-3">Retail POS & Wholesale</h3>
            <p className="text-xs text-emerald-200/80 mt-1">
              Walk-in fishmonger counter, catch-weight restaurant orders, and live dual price list.
            </p>
          </div>
          <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs font-bold text-emerald-300">
            <span>Open Sales Hub</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>

        {/* Module 2: Customers CRM */}
        <div 
          onClick={() => onSelectTab('customers')}
          className="bg-gradient-to-br from-indigo-900 to-slate-950 text-white p-5 rounded-3xl shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-4"
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="p-2.5 bg-white/10 rounded-2xl text-indigo-300">
                <Users className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-400/20 text-indigo-300 border border-indigo-400/30">
                Accounts & CRM
              </span>
            </div>
            <h3 className="text-lg font-bold mt-3">Customer Directory</h3>
            <p className="text-xs text-indigo-200/80 mt-1">
              Michelin restaurants, hotel resorts, supermarkets, credit limits, and aging receivables.
            </p>
          </div>
          <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs font-bold text-indigo-300">
            <span>Manage Customers</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>

        {/* Module 3: Suppliers & Landings */}
        <div 
          onClick={() => onSelectTab('suppliers')}
          className="bg-gradient-to-br from-blue-900 to-sky-950 text-white p-5 rounded-3xl shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-4"
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="p-2.5 bg-white/10 rounded-2xl text-blue-300">
                <Ship className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-400/20 text-blue-300 border border-blue-400/30">
                Procurement
              </span>
            </div>
            <h3 className="text-lg font-bold mt-3">Suppliers & Landings</h3>
            <p className="text-xs text-blue-200/80 mt-1">
              Fishermen co-ops, captains, aquaculture farms, inward dock receipts, and boat payouts.
            </p>
          </div>
          <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs font-bold text-blue-300">
            <span>Manage Sourcing</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>

        {/* Module 4: Financials & Ledger */}
        <div 
          onClick={() => onSelectTab('financials')}
          className="bg-gradient-to-br from-slate-900 to-zinc-950 text-white p-5 rounded-3xl shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-4"
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="p-2.5 bg-white/10 rounded-2xl text-amber-300">
                <DollarSign className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                P&L & Ledger
              </span>
            </div>
            <h3 className="text-lg font-bold mt-3">Financials & P&L</h3>
            <p className="text-xs text-slate-300 mt-1">
              Comprehensive Income Statement, Operating Expenses, COGS margin spreads, and double-entry ledger.
            </p>
          </div>
          <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs font-bold text-amber-300">
            <span>View Full Financials</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Two Columns: Recent B2B Wholesale Orders & Recent Landed Catch Intakes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 6 Cols: Recent Client Wholesale Orders */}
        <div className="lg:col-span-6 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Recent Wholesale Orders</h3>
                <p className="text-xs text-slate-500">Live order fulfillment and invoicing status</p>
              </div>
            </div>
            <button
              onClick={() => onSelectTab('retail_wholesale')}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
            >
              All Orders →
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {orders.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No client orders placed yet. Click "+ Place Order" above to record an order.
              </div>
            ) : (
              orders.slice(0, 4).map(order => (
                <div key={order.id} className="py-3 flex items-center justify-between hover:bg-slate-50/50 px-2 rounded-xl transition-colors gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                      <span className="font-bold text-slate-900 text-xs truncate max-w-[140px] sm:max-w-[200px]">{order.clientName}</span>
                      <span className="text-[10px] font-mono-code text-slate-400 shrink-0">{order.id}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                      {order.items.map(i => `${i.speciesName} (${i.requestedWeightKg}kg)`).join(', ')}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-mono-code font-black text-slate-900 text-xs">
                      {formatCurrency(order.adjustedTotalUSD || order.quotedTotalUSD)}
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold inline-block mt-0.5 ${
                      order.status === 'Delivered'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-indigo-100 text-indigo-800'
                    }`}>
                      {order.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right 6 Cols: Recent Inward Catch Landings (Suppliers) */}
        <div className="lg:col-span-6 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-50 text-blue-700 rounded-xl">
                <Ship className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Recent Dock Landings & POs</h3>
                <p className="text-xs text-slate-500">Inward catch intakes from supplier vessels</p>
              </div>
            </div>
            <button
              onClick={() => onSelectTab('suppliers')}
              className="text-xs text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
            >
              All Landings →
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {purchaseOrders.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No supplier dock landings recorded yet. Go to Suppliers to log intake.
              </div>
            ) : (
              purchaseOrders.slice(0, 4).map(po => {
                const item = po.speciesItems[0];
                return (
                  <div key={po.id} className="py-3 flex items-center justify-between hover:bg-slate-50/50 px-2 rounded-xl transition-colors gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                        <span className="font-bold text-slate-900 text-xs truncate max-w-[140px] sm:max-w-[200px]">{po.supplierName}</span>
                        <span className="text-[10px] font-mono-code text-slate-400 shrink-0">{po.id}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                        {item?.speciesName} • {item?.weightKg.toLocaleString()} kg ({item?.grade})
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-mono-code font-black text-rose-700 text-xs">
                        {formatCurrency(po.totalCostUSD)}
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold inline-block mt-0.5 ${
                        po.paymentStatus === 'Paid in Full'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {po.paymentStatus}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
