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
  companyName?: string;
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
  useImperial,
  companyName
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

  const displayCompanyName = companyName || 'Commercial Cold-Chain Operations';

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-full overflow-x-hidden min-w-0">
      {/* Top Welcome Banner & Quick Action Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6 bg-white p-4 sm:p-6 lg:p-7 rounded-2xl border border-slate-200/90 shadow-xs">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span 
              id="dashboard-company-name-pill"
              className="px-2.5 sm:px-3 py-1 rounded-full bg-indigo-50 text-indigo-900 text-[11px] sm:text-xs font-black uppercase tracking-wider border border-indigo-200 flex items-center gap-1.5 shadow-2xs max-w-full truncate"
            >
              <Building2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="truncate">{displayCompanyName}</span>
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[11px] sm:text-xs font-bold border border-emerald-200 flex items-center gap-1 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Facility Active</span>
            </span>
            <span className="text-xs text-slate-400 font-mono-code hidden xl:inline">
              Cold-Chain Operations Hub
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-heading font-extrabold text-slate-900 tracking-tight mt-2 truncate">
            {displayCompanyName}
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Integrated commercial cold-chain ERP, multi-channel wholesale and retail POS, customer CRM, and automated inventory ledger for <strong>{displayCompanyName}</strong>.
          </p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap lg:flex-wrap xl:flex-nowrap items-stretch sm:items-center gap-2 sm:gap-2.5 shrink-0 w-full lg:w-auto max-w-full">
          <button
            onClick={() => onSelectTab('retail_wholesale')}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-2.5 rounded-xl sm:rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer min-w-0"
          >
            <ShoppingBag className="w-4 h-4 shrink-0" />
            <span className="truncate">Retail POS</span>
          </button>
          <button
            onClick={() => onSelectTab('suppliers')}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-2.5 rounded-xl sm:rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer min-w-0"
          >
            <Ship className="w-4 h-4 shrink-0" />
            <span className="truncate">Harvester Catch</span>
          </button>
          <button
            onClick={() => onSelectTab('financials')}
            className="w-full sm:w-auto flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl sm:rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer min-w-0"
          >
            <DollarSign className="w-4 h-4 shrink-0" />
            <span className="truncate">Financials &amp; P&amp;L</span>
          </button>
        </div>
      </div>

      {/* Primary Financial & Operational Metrics (Clean, Elevated Enterprise Design) */}
      <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* KPI 1: Gross Sales Revenue */}
        <div 
          id="dashboard-kpi-revenue"
          onClick={() => onSelectTab('financials')}
          className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group flex flex-col justify-between w-full min-w-0"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <span className="text-xs sm:text-sm font-semibold text-slate-700 truncate">
                Gross Revenue
              </span>
            </div>
            <span className="text-xs font-medium text-slate-400 group-hover:text-slate-800 flex items-center gap-0.5 transition-colors shrink-0">
              <span className="hidden sm:inline">P&amp;L</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
          <div className="mt-2.5 sm:mt-3">
            <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono-code tracking-tight truncate">
              {formatCurrency(grossRevenue)}
            </div>
            <div className="flex items-center justify-between gap-1 mt-2.5 sm:mt-3 pt-2.5 sm:pt-3 border-t border-slate-100 text-[11px] sm:text-xs">
              <span className="inline-flex items-center gap-1 font-medium text-slate-700 bg-slate-100 px-1.5 sm:px-2 py-0.5 rounded-md border border-slate-200/80 shrink-0">
                <ArrowUpRight className="w-3 h-3 text-slate-500" /> {grossMarginPct.toFixed(1)}% margin
              </span>
              <span className="text-slate-400 text-[10px] sm:text-[11px] truncate text-right">Wholesale &amp; POS</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Accounts Receivable (AR) */}
        <div 
          id="dashboard-kpi-ar"
          onClick={() => onSelectTab('customers')}
          className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group flex flex-col justify-between w-full min-w-0"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <span className="text-xs sm:text-sm font-semibold text-slate-700 truncate">
                Accounts Receivable
              </span>
            </div>
            <span className="text-xs font-medium text-slate-400 group-hover:text-slate-800 flex items-center gap-0.5 transition-colors shrink-0">
              <span className="hidden sm:inline">Clients</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
          <div className="mt-2.5 sm:mt-3">
            <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono-code tracking-tight truncate">
              {formatCurrency(totalAR)}
            </div>
            <div className="flex items-center justify-between gap-1 mt-2.5 sm:mt-3 pt-2.5 sm:pt-3 border-t border-slate-100 text-[11px] sm:text-xs">
              <span className="inline-flex items-center gap-1 font-medium text-slate-700 bg-slate-100 px-1.5 sm:px-2 py-0.5 rounded-md border border-slate-200/80 shrink-0">
                {customers.filter(c => c.outstandingBalanceUSD > 0).length} Unpaid
              </span>
              <span className="text-slate-400 text-[10px] sm:text-[11px] truncate text-right">{customers.length} Accounts</span>
            </div>
          </div>
        </div>

        {/* KPI 3: Accounts Payable (AP) */}
        <div 
          id="dashboard-kpi-ap"
          onClick={() => onSelectTab('suppliers')}
          className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group flex flex-col justify-between w-full min-w-0"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Ship className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <span className="text-xs sm:text-sm font-semibold text-slate-700 truncate">
                Accounts Payable
              </span>
            </div>
            <span className="text-xs font-medium text-slate-400 group-hover:text-slate-800 flex items-center gap-0.5 transition-colors shrink-0">
              <span className="hidden sm:inline">Fleets</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
          <div className="mt-2.5 sm:mt-3">
            <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono-code tracking-tight truncate">
              {formatCurrency(totalAP)}
            </div>
            <div className="flex items-center justify-between gap-1 mt-2.5 sm:mt-3 pt-2.5 sm:pt-3 border-t border-slate-100 text-[11px] sm:text-xs">
              <span className="inline-flex items-center gap-1 font-medium text-slate-700 bg-slate-100 px-1.5 sm:px-2 py-0.5 rounded-md border border-slate-200/80 shrink-0">
                {suppliers.length} Harvesters
              </span>
              <span className="text-slate-400 text-[10px] sm:text-[11px] truncate text-right">Catch Landings</span>
            </div>
          </div>
        </div>

        {/* KPI 4: Cold-Chain Biomass In Stock */}
        <div 
          id="dashboard-kpi-biomass"
          onClick={() => onSelectTab('inventory')}
          className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group flex flex-col justify-between w-full min-w-0"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <span className="text-xs sm:text-sm font-semibold text-slate-700 truncate">
                Biomass In Stock
              </span>
            </div>
            <span className="text-xs font-medium text-slate-400 group-hover:text-slate-800 flex items-center gap-0.5 transition-colors shrink-0">
              <span className="hidden sm:inline">Ledger</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
          <div className="mt-2.5 sm:mt-3">
            <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono-code tracking-tight truncate">
              {formatWeight(totalStockKg, useImperial)}
            </div>
            <div className="flex items-center justify-between gap-1 mt-2.5 sm:mt-3 pt-2.5 sm:pt-3 border-t border-slate-100 text-[11px] sm:text-xs">
              <span className="inline-flex items-center gap-1 font-medium text-slate-700 bg-slate-100 px-1.5 sm:px-2 py-0.5 rounded-md border border-slate-200/80 shrink-0">
                {formatCurrency(totalStockValueUSD)}
              </span>
              <span className="text-slate-400 text-[10px] sm:text-[11px] truncate text-right">{batches.length} Lots</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4-Module Quick Navigation Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {/* Module 1: Retail & Wholesale */}
        <div 
          onClick={() => onSelectTab('retail_wholesale')}
          className="bg-gradient-to-br from-emerald-900 to-teal-950 text-white p-4 sm:p-5 rounded-2xl shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer flex flex-col justify-between space-y-3 sm:space-y-4 group min-w-0"
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="p-2 sm:p-2.5 bg-white/10 rounded-xl text-emerald-300 group-hover:scale-105 transition-transform shrink-0">
                <ShoppingBag className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
              </div>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 shrink-0">
                Dual Channels
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold mt-2.5 sm:mt-3 truncate">Retail POS &amp; Wholesale</h3>
            <p className="text-xs text-emerald-200/80 mt-1 line-clamp-2">
              Walk-in fishmonger counter, catch-weight restaurant orders, and live dual price list.
            </p>
          </div>
          <div className="pt-2.5 sm:pt-3 border-t border-white/10 flex items-center justify-between text-xs font-bold text-emerald-300">
            <span>Open Sales Hub</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* Module 2: Customers CRM */}
        <div 
          onClick={() => onSelectTab('customers')}
          className="bg-gradient-to-br from-indigo-900 to-slate-950 text-white p-4 sm:p-5 rounded-2xl shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer flex flex-col justify-between space-y-3 sm:space-y-4 group min-w-0"
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="p-2 sm:p-2.5 bg-white/10 rounded-xl text-indigo-300 group-hover:scale-105 transition-transform shrink-0">
                <Users className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
              </div>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-400/20 text-indigo-300 border border-indigo-400/30 shrink-0">
                Accounts &amp; CRM
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold mt-2.5 sm:mt-3 truncate">Customer Directory</h3>
            <p className="text-xs text-indigo-200/80 mt-1 line-clamp-2">
              Michelin restaurants, hotel resorts, supermarkets, credit limits, and aging receivables.
            </p>
          </div>
          <div className="pt-2.5 sm:pt-3 border-t border-white/10 flex items-center justify-between text-xs font-bold text-indigo-300">
            <span>Manage Customers</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* Module 3: Suppliers & Landings */}
        <div 
          onClick={() => onSelectTab('suppliers')}
          className="bg-gradient-to-br from-blue-900 to-sky-950 text-white p-4 sm:p-5 rounded-2xl shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer flex flex-col justify-between space-y-3 sm:space-y-4 group min-w-0"
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="p-2 sm:p-2.5 bg-white/10 rounded-xl text-blue-300 group-hover:scale-105 transition-transform shrink-0">
                <Ship className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
              </div>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-400/20 text-blue-300 border border-blue-400/30 shrink-0">
                Procurement
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold mt-2.5 sm:mt-3 truncate">Suppliers &amp; Landings</h3>
            <p className="text-xs text-blue-200/80 mt-1 line-clamp-2">
              Fishermen co-ops, captains, aquaculture farms, inward dock receipts, and boat payouts.
            </p>
          </div>
          <div className="pt-2.5 sm:pt-3 border-t border-white/10 flex items-center justify-between text-xs font-bold text-blue-300">
            <span>Manage Sourcing</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* Module 4: Financials & Ledger */}
        <div 
          onClick={() => onSelectTab('financials')}
          className="bg-gradient-to-br from-slate-900 to-zinc-950 text-white p-4 sm:p-5 rounded-2xl shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer flex flex-col justify-between space-y-3 sm:space-y-4 group min-w-0"
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="p-2 sm:p-2.5 bg-white/10 rounded-xl text-amber-300 group-hover:scale-105 transition-transform shrink-0">
                <DollarSign className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
              </div>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 shrink-0">
                P&amp;L &amp; Ledger
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold mt-2.5 sm:mt-3 truncate">Financials &amp; P&amp;L</h3>
            <p className="text-xs text-slate-300 mt-1 line-clamp-2">
              Comprehensive Income Statement, Operating Expenses, COGS margin spreads, and double-entry ledger.
            </p>
          </div>
          <div className="pt-2.5 sm:pt-3 border-t border-white/10 flex items-center justify-between text-xs font-bold text-amber-300">
            <span>View Full Financials</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>

      {/* Two Columns: Recent B2B Wholesale Orders & Recent Landed Catch Intakes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        {/* Left 6 Cols: Recent Client Wholesale Orders */}
        <div className="lg:col-span-6 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl shrink-0">
                <Truck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">Recent Wholesale Orders</h3>
                <p className="text-[11px] sm:text-xs text-slate-500 truncate">Live order fulfillment and invoicing status</p>
              </div>
            </div>
            <button
              onClick={() => onSelectTab('retail_wholesale')}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer shrink-0"
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
                <div key={order.id} className="py-3 flex items-center justify-between hover:bg-slate-50/50 px-1 sm:px-2 rounded-xl transition-colors gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                      <span className="font-bold text-slate-900 text-xs truncate max-w-[130px] xs:max-w-[160px] sm:max-w-[200px]">{order.clientName}</span>
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
        <div className="lg:col-span-6 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-2 bg-blue-50 text-blue-700 rounded-xl shrink-0">
                <Ship className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">Recent Dock Landings &amp; POs</h3>
                <p className="text-[11px] sm:text-xs text-slate-500 truncate">Inward catch intakes from supplier vessels</p>
              </div>
            </div>
            <button
              onClick={() => onSelectTab('suppliers')}
              className="text-xs text-blue-600 hover:text-blue-800 font-bold cursor-pointer shrink-0"
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
                  <div key={po.id} className="py-3 flex items-center justify-between hover:bg-slate-50/50 px-1 sm:px-2 rounded-xl transition-colors gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                        <span className="font-bold text-slate-900 text-xs truncate max-w-[130px] xs:max-w-[160px] sm:max-w-[200px]">{po.supplierName}</span>
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
