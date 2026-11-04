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
  FileText,
  Receipt,
  Target,
  Boxes
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
  onOpenRecordExpense?: () => void;
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
  onOpenRecordExpense,
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

  // Executive Overview Widget Calculations
  // 1. Total Active Inventory: Available unexpired inventory batches
  const activeBatches = batches.filter(b => b.availableWeightKg > 0);
  const activeBatchesCount = activeBatches.length;
  const activeInventoryWeightKg = activeBatches.reduce((sum, b) => sum + b.availableWeightKg, 0);
  const activeInventoryValueUSD = activeBatches.reduce((sum, b) => sum + (b.availableWeightKg * b.wholesalePricePerKg), 0);
  const allocatedWeightKg = batches.reduce((sum, b) => sum + (b.allocatedWeightKg || 0), 0);

  // 2. Monthly Revenue Target Progress: Month-to-date sales vs target
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const currentDayOfMonth = now.getDate();
  const monthProratedRatio = Math.max(0.05, currentDayOfMonth / daysInCurrentMonth);

  const mtdWholesaleRevenue = orders.filter(o => {
    if (!o.orderDate) return false;
    const d = new Date(o.orderDate);
    return !isNaN(d.getTime()) && d.getFullYear() === currentYear && d.getMonth() === currentMonth;
  }).reduce((sum, o) => sum + (o.adjustedTotalUSD || o.quotedTotalUSD || 0), 0);

  const mtdRetailRevenue = retailSales.filter(r => {
    if (!r.timestamp) return false;
    const d = new Date(r.timestamp);
    return !isNaN(d.getTime()) && d.getFullYear() === currentYear && d.getMonth() === currentMonth;
  }).reduce((sum, r) => sum + (r.totalAmount || 0), 0);

  // If order/sales dates are across sample periods or unanchored, fall back gracefully to total revenue
  const effectiveMonthRevenue = (mtdWholesaleRevenue + mtdRetailRevenue) > 0 
    ? (mtdWholesaleRevenue + mtdRetailRevenue) 
    : grossRevenue;

  // Monthly Revenue Target baseline: 120% of current revenue or benchmark $25,000 / GHS benchmark
  const monthlyRevenueTarget = Math.max(25000, Math.ceil((effectiveMonthRevenue * 1.25) / 5000) * 5000);
  const revenueTargetProgressPct = monthlyRevenueTarget > 0 
    ? Math.min(100, Math.round((effectiveMonthRevenue / monthlyRevenueTarget) * 100))
    : 0;

  // 3. Pending Order Value: Active orders pending fulfillment / transit / delivery
  const pendingOrders = orders.filter(o => 
    o.status !== 'Delivered' && o.status !== 'Cancelled' && o.status !== 'Voided'
  );
  const pendingOrdersCount = pendingOrders.length;
  const pendingOrdersValueUSD = pendingOrders.reduce((sum, o) => sum + (o.adjustedTotalUSD || o.quotedTotalUSD || 0), 0);
  const pendingOrdersWeightKg = pendingOrders.reduce((sum, o) => 
    sum + o.items.reduce((itemSum, item) => itemSum + (item.actualWeighedKg || item.requestedWeightKg || 0), 0), 0
  );

  const displayCompanyName = companyName || 'Commercial Cold-Chain Operations';

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-full overflow-x-hidden min-w-0">
      {/* Top Welcome Banner & Quick Action Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6 bg-white p-3.5 sm:p-5 md:p-6 lg:p-7 rounded-2xl border border-slate-200/90 shadow-xs w-full max-w-full min-w-0 box-border overflow-hidden">
        <div className="flex-1 min-w-0 max-w-full">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 max-w-full min-w-0">
            <span 
              id="dashboard-company-name-pill"
              className="px-2.5 sm:px-3 py-1 rounded-full bg-indigo-50 text-indigo-900 text-[11px] sm:text-xs font-black uppercase tracking-wider border border-indigo-200 flex items-center gap-1.5 shadow-2xs max-w-full min-w-0"
            >
              <Building2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="truncate max-w-[160px] xs:max-w-[220px] sm:max-w-xs md:max-w-md">{displayCompanyName}</span>
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[11px] sm:text-xs font-bold border border-emerald-200 flex items-center gap-1 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="whitespace-nowrap">Facility Active</span>
            </span>
            <span className="text-xs text-slate-400 font-mono-code hidden xl:inline truncate">
              Cold-Chain Operations Hub
            </span>
          </div>
          <h1 className="text-lg xs:text-xl sm:text-2xl lg:text-3xl font-heading font-extrabold text-slate-900 tracking-tight mt-2 truncate max-w-full break-words">
            {displayCompanyName}
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed break-words [overflow-wrap:anywhere]">
            Integrated commercial cold-chain ERP, multi-channel wholesale and retail POS, customer CRM, and automated inventory ledger for <strong className="font-semibold text-slate-700">{displayCompanyName}</strong>.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex lg:flex-wrap xl:flex-nowrap items-stretch sm:items-center gap-2 sm:gap-2.5 w-full lg:w-auto min-w-0 flex-initial">
          <button
            id="dashboard-quick-retail-pos-btn"
            onClick={() => onSelectTab('retail_wholesale')}
            className="w-full lg:w-auto flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer min-w-0"
          >
            <ShoppingBag className="w-4 h-4 shrink-0" />
            <span className="truncate">Retail POS</span>
          </button>
          <button
            id="dashboard-quick-harvester-catch-btn"
            onClick={() => onSelectTab('suppliers')}
            className="w-full lg:w-auto flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer min-w-0"
          >
            <Ship className="w-4 h-4 shrink-0" />
            <span className="truncate">Harvester Catch</span>
          </button>
          <button
            id="dashboard-quick-record-expense-btn"
            onClick={onOpenRecordExpense}
            className="w-full lg:w-auto flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer min-w-0"
            title="Quickly record an operating expense or disbursement"
          >
            <Receipt className="w-4 h-4 shrink-0" />
            <span className="truncate">Record Expense</span>
          </button>
          <button
            id="dashboard-quick-financials-btn"
            onClick={() => onSelectTab('financials')}
            className="w-full lg:w-auto flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer min-w-0"
          >
            <DollarSign className="w-4 h-4 shrink-0" />
            <span className="truncate">Financials &amp; P&amp;L</span>
          </button>
        </div>
      </div>

      {/* Executive Summary KPI Widgets (Requested Highlights: Total Active Inventory, Monthly Revenue Target Progress, Pending Order Value) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-indigo-600" />
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-800 font-heading">
              Executive Overview
            </h2>
          </div>
          <span className="text-[11px] text-slate-500 font-mono-code">
            Live Enterprise Telemetry
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          {/* Executive Widget 1: Total Active Inventory */}
          <div 
            id="executive-kpi-active-inventory"
            onClick={() => onSelectTab('inventory')}
            className="bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 text-white p-5 rounded-2xl border border-indigo-950/60 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group flex flex-col justify-between min-w-0"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Boxes className="w-4.5 h-4.5 text-indigo-300" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-indigo-200 uppercase tracking-wider block">
                      Total Active Inventory
                    </span>
                    <span className="text-[11px] text-slate-400 truncate block">
                      Available across Cryo-Lots
                    </span>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-indigo-300 group-hover:text-white flex items-center gap-0.5 shrink-0 transition-colors">
                  <span>View</span>
                  <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>

              <div className="mt-4">
                <div className="text-2xl sm:text-3xl font-black text-white font-mono-code tracking-tight truncate">
                  {formatWeight(activeInventoryWeightKg, useImperial)}
                </div>
                <div className="text-xs font-semibold text-indigo-300 font-mono-code mt-0.5 truncate">
                  Valued at {formatCurrency(activeInventoryValueUSD)}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-300">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <strong>{activeBatchesCount}</strong> active batches in cold-store
              </span>
              <span className="text-slate-400 truncate">
                {allocatedWeightKg > 0 ? `${formatWeight(allocatedWeightKg, useImperial)} allocated` : '100% unallocated'}
              </span>
            </div>
          </div>

          {/* Executive Widget 2: Monthly Revenue Target Progress */}
          <div 
            id="executive-kpi-monthly-target"
            onClick={() => onSelectTab('financials')}
            className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group flex flex-col justify-between min-w-0"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Target className="w-4.5 h-4.5 text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                      Monthly Revenue Target Progress
                    </span>
                    <span className="text-[11px] text-slate-500 truncate block">
                      Target: {formatCurrency(monthlyRevenueTarget)}
                    </span>
                  </div>
                </div>
                <span className="text-xs font-bold text-emerald-700 font-mono-code shrink-0">
                  {revenueTargetProgressPct}%
                </span>
              </div>

              <div className="mt-4">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono-code tracking-tight truncate">
                    {formatCurrency(effectiveMonthRevenue)}
                  </div>
                  <span className="text-xs font-medium text-slate-400 shrink-0">
                    of {formatCurrency(monthlyRevenueTarget)}
                  </span>
                </div>

                {/* Progress Bar with indicator */}
                <div className="mt-2.5 w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200/60">
                  <div 
                    className="bg-gradient-to-r from-emerald-500 to-teal-600 h-2.5 rounded-full transition-all duration-500"
                    style={{ width: `${revenueTargetProgressPct}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/70">
                <TrendingUp className="w-3 h-3 text-emerald-600" />
                {effectiveMonthRevenue >= monthlyRevenueTarget ? 'Target Achieved' : `${formatCurrency(monthlyRevenueTarget - effectiveMonthRevenue)} remaining`}
              </span>
              <span className="text-slate-400 text-[10px] sm:text-[11px] truncate">
                Day {currentDayOfMonth} of {daysInCurrentMonth}
              </span>
            </div>
          </div>

          {/* Executive Widget 3: Pending Order Value */}
          <div 
            id="executive-kpi-pending-orders"
            onClick={() => onSelectTab('orders')}
            className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group flex flex-col justify-between min-w-0"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Clock className="w-4.5 h-4.5 text-amber-600" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                      Pending Order Value
                    </span>
                    <span className="text-[11px] text-slate-500 truncate block">
                      Fulfillment pipeline in progress
                    </span>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-slate-400 group-hover:text-slate-800 flex items-center gap-0.5 shrink-0 transition-colors">
                  <span>Pipeline</span>
                  <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>

              <div className="mt-4">
                <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono-code tracking-tight truncate">
                  {formatCurrency(pendingOrdersValueUSD)}
                </div>
                <div className="text-xs font-semibold text-amber-700 font-mono-code mt-0.5 truncate">
                  {formatWeight(pendingOrdersWeightKg, useImperial)} committed volume
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
              <span className="inline-flex items-center gap-1 font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/70">
                <Package className="w-3 h-3 text-amber-600" />
                <strong>{pendingOrdersCount}</strong> active wholesale orders
              </span>
              <span className="text-slate-400 text-[10px] sm:text-[11px] truncate">
                Awaiting transit/delivery
              </span>
            </div>
          </div>
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
            {onOpenRecordExpense ? (
              <button
                type="button"
                id="dashboard-card-quick-expense-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenRecordExpense();
                }}
                className="px-2 py-0.5 rounded-lg bg-rose-500/30 hover:bg-rose-500/50 text-rose-200 border border-rose-400/40 text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                title="Quick record operating expense"
              >
                <Plus className="w-3 h-3" />
                <span>+ Expense</span>
              </button>
            ) : (
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            )}
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
