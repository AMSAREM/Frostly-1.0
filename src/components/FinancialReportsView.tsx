import React, { useState, useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  ComposedChart
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight, 
  Percent, 
  Download, 
  FileText, 
  Layers, 
  CreditCard,
  PieChart as PieIcon,
  Activity,
  Sparkles,
  CheckCircle2,
  Filter,
  BarChart3
} from 'lucide-react';
import { 
  FinancialLedgerEntry, 
  ClientOrder, 
  RetailTransaction, 
  PurchaseOrderLanding, 
  Customer, 
  Supplier 
} from '../types';
import { isReversalLedgerEntry } from '../repositories/financialRepository';

interface FinancialReportsViewProps {
  financialEntries: FinancialLedgerEntry[];
  orders: ClientOrder[];
  retailSales: RetailTransaction[];
  purchaseOrders: PurchaseOrderLanding[];
  customers: Customer[];
  suppliers: Supplier[];
  formatCurrency: (amount: number) => string;
}

export interface MonthlyFinancialSummary {
  monthKey: string; // e.g. "2026-08"
  monthLabel: string; // e.g. "Aug 2026"
  shortMonth: string; // e.g. "Aug"
  wholesaleRevenue: number;
  retailRevenue: number;
  totalRevenue: number;
  cogs: number;
  grossProfit: number;
  grossMarginPct: number;
  opEx: number;
  netProfit: number;
  netMarginPct: number;
  cashInflow: number;
  cashOutflow: number;
  netCashFlow: number;
  orderCount: number;
  retailTicketCount: number;
}

const getMonthKey = (dateStr?: string, fallbackKey?: string): string => {
  if (dateStr) {
    const isoMatch = dateStr.match(/^(\d{4})-(\d{2})/);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2]}`;
    }
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
    }
  }
  if (fallbackKey) return fallbackKey;
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const formatMonthLabels = (monthKey: string, isCurrentMonth: boolean) => {
  const [yearStr, monthStr] = monthKey.split('-');
  const d = new Date(Number(yearStr), Number(monthStr) - 1, 1);
  const fullMonth = d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const shortMonth = d.toLocaleString('en-US', { month: 'short' });
  return {
    monthLabel: isCurrentMonth ? `${fullMonth} (Live MTD)` : fullMonth,
    shortMonth: isCurrentMonth ? `${shortMonth} (MTD)` : shortMonth
  };
};

export const FinancialReportsView: React.FC<FinancialReportsViewProps> = ({
  financialEntries = [],
  orders = [],
  retailSales = [],
  purchaseOrders = [],
  customers = [],
  suppliers = [],
  formatCurrency
}) => {
  const [timeRange, setTimeRange] = useState<'6m' | '3m' | 'ytd'>('6m');
  const [chartMetric, setChartMetric] = useState<'all' | 'profit' | 'margins'>('all');

  // Compute live monthly summaries from actual transactions (last 6 calendar months + any active entry months)
  const allMonthlyData = useMemo<MonthlyFinancialSummary[]>(() => {
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const monthKeysSet = new Set<string>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthKeysSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    orders.forEach(o => monthKeysSet.add(getMonthKey(o.orderDate, currentMonthKey)));
    retailSales.forEach(r => monthKeysSet.add(getMonthKey(r.date, currentMonthKey)));
    purchaseOrders.forEach(po => monthKeysSet.add(getMonthKey(po.orderDate || po.deliveryDate, currentMonthKey)));
    financialEntries.forEach(e => monthKeysSet.add(getMonthKey(e.date, currentMonthKey)));

    const sortedKeys = Array.from(monthKeysSet).sort();

    return sortedKeys.map(monthKey => {
      const monthOrders = orders.filter(
        o => o.status !== 'Cancelled' && getMonthKey(o.orderDate, currentMonthKey) === monthKey
      );
      const wholesaleRev = monthOrders.reduce(
        (sum, o) => sum + (o.adjustedTotalUSD || o.quotedTotalUSD),
        0
      );

      const monthRetail = retailSales.filter(
        r => getMonthKey(r.date, currentMonthKey) === monthKey
      );
      const retailRev = monthRetail.reduce((sum, r) => sum + r.totalAmount, 0);
      const totRev = wholesaleRev + retailRev;

      const monthPOs = purchaseOrders.filter(
        po => getMonthKey(po.orderDate || po.deliveryDate, currentMonthKey) === monthKey
      );
      const poCogs = monthPOs.reduce((sum, po) => sum + po.totalCostUSD, 0);

      const monthEntries = financialEntries.filter(
        e => getMonthKey(e.date, currentMonthKey) === monthKey
      );
      const invAdjLoss = monthEntries
        .filter(e => e.category === 'Inventory Adjustment' && e.type === 'COGS')
        .reduce((sum, e) => sum + e.amount, 0);
      const invAdjGain = monthEntries
        .filter(e => e.category === 'Inventory Adjustment' && e.type === 'Income')
        .reduce((sum, e) => sum + e.amount, 0);
      const cogsTotal = poCogs + (invAdjLoss - invAdjGain);

      const grossProf = totRev - cogsTotal;
      const grossMargin = totRev > 0 ? (grossProf / totRev) * 100 : 0;

      const isOpExEntry = (e: FinancialLedgerEntry) =>
        e.type === 'OpEx' && !isReversalLedgerEntry(e);

      const opExTotal = monthEntries
        .filter(isOpExEntry)
        .reduce((sum, e) => sum + e.amount, 0);

      const netProf = grossProf - opExTotal;
      const netMargin = totRev > 0 ? (netProf / totRev) * 100 : 0;

      const cashIn =
        monthEntries
          .filter(e => e.type === 'Income' && e.status === 'Settled')
          .reduce((sum, e) => sum + (isReversalLedgerEntry(e) ? -Math.abs(e.amount) : e.amount), 0) + retailRev;

      const cashOut = monthEntries
        .filter(e => (e.type === 'COGS' || isOpExEntry(e)) && e.status === 'Settled')
        .reduce((sum, e) => sum + e.amount, 0);

      const { monthLabel, shortMonth } = formatMonthLabels(monthKey, monthKey === currentMonthKey);

      return {
        monthKey,
        monthLabel,
        shortMonth,
        wholesaleRevenue: wholesaleRev,
        retailRevenue: retailRev,
        totalRevenue: totRev,
        cogs: cogsTotal,
        grossProfit: grossProf,
        grossMarginPct: parseFloat(grossMargin.toFixed(1)),
        opEx: opExTotal,
        netProfit: netProf,
        netMarginPct: parseFloat(netMargin.toFixed(1)),
        cashInflow: cashIn,
        cashOutflow: cashOut,
        netCashFlow: cashIn - cashOut,
        orderCount: monthOrders.length,
        retailTicketCount: monthRetail.length
      };
    });
  }, [orders, retailSales, purchaseOrders, financialEntries]);

  // Filtered dataset based on range selector
  const displayedData = useMemo(() => {
    if (timeRange === '3m') {
      return allMonthlyData.slice(-3);
    }
    return allMonthlyData.slice(-6); // 6m / YTD
  }, [allMonthlyData, timeRange]);

  // High-level Trailing Totals
  const aggregateMetrics = useMemo(() => {
    const totalRev = displayedData.reduce((sum, m) => sum + m.totalRevenue, 0);
    const totalCOGS = displayedData.reduce((sum, m) => sum + m.cogs, 0);
    const totalGross = displayedData.reduce((sum, m) => sum + m.grossProfit, 0);
    const totalOpEx = displayedData.reduce((sum, m) => sum + m.opEx, 0);
    const totalNet = displayedData.reduce((sum, m) => sum + m.netProfit, 0);
    const totalCashIn = displayedData.reduce((sum, m) => sum + m.cashInflow, 0);
    const totalCashOut = displayedData.reduce((sum, m) => sum + m.cashOutflow, 0);
    const netCash = totalCashIn - totalCashOut;
    const avgMargin = totalRev > 0 ? (totalGross / totalRev) * 100 : 0;
    const avgNetMargin = totalRev > 0 ? (totalNet / totalRev) * 100 : 0;

    return {
      totalRev,
      totalCOGS,
      totalGross,
      totalOpEx,
      totalNet,
      totalCashIn,
      totalCashOut,
      netCash,
      avgMargin,
      avgNetMargin
    };
  }, [displayedData]);

  // OpEx Category Breakdown data for Pie chart (100% live from financialEntries)
  const opexBreakdownData = useMemo(() => {
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const activeMonthKeys = new Set(displayedData.map(m => m.monthKey));

    const categories: Record<string, number> = {};

    financialEntries
      .filter(
        e =>
          e.type === 'OpEx' &&
          !isReversalLedgerEntry(e) &&
          activeMonthKeys.has(getMonthKey(e.date, currentMonthKey))
      )
      .forEach(e => {
        const cat = e.category || 'Operating Expense';
        categories[cat] = (categories[cat] || 0) + e.amount;
      });

    return Object.entries(categories)
      .filter(([, value]) => value > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([name, value]) => ({
        name,
        value
      }));
  }, [financialEntries, displayedData]);

  // Product category revenue share data
  const categoryRevenueData = useMemo(() => [
    { name: 'Pelagic (Bluefin & Yellowfin)', value: 48, color: '#3b82f6' },
    { name: 'Salmonid (Wild & Fjord Salmon)', value: 27, color: '#10b981' },
    { name: 'Crustacean (King Crab & Lobster)', value: 18, color: '#f59e0b' },
    { name: 'Mollusk & Scallops', value: 7, color: '#8b5cf6' }
  ], []);

  // Custom Chart Tooltips
  const CustomPnLTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as MonthlyFinancialSummary;
      return (
        <div className="bg-slate-900 text-white p-3.5 rounded-2xl shadow-xl border border-slate-700 text-xs space-y-1.5 min-w-[200px]">
          <div className="font-bold text-slate-200 border-b border-slate-700 pb-1 flex justify-between">
            <span>{data.monthLabel}</span>
            <span className="text-emerald-400 font-mono-code font-bold">{data.grossMarginPct}% Margin</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>Wholesale Revenue:</span>
            <span className="font-mono-code font-semibold text-indigo-300">{formatCurrency(data.wholesaleRevenue)}</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>Retail Counter Sales:</span>
            <span className="font-mono-code font-semibold text-emerald-300">{formatCurrency(data.retailRevenue)}</span>
          </div>
          <div className="flex justify-between font-bold text-white pt-0.5 border-t border-slate-800">
            <span>Gross Revenue:</span>
            <span className="font-mono-code text-white">{formatCurrency(data.totalRevenue)}</span>
          </div>
          <div className="flex justify-between text-rose-300">
            <span>Cost of Catch (COGS):</span>
            <span className="font-mono-code text-rose-400">-{formatCurrency(data.cogs)}</span>
          </div>
          <div className="flex justify-between font-bold text-emerald-400 pt-1 border-t border-slate-800">
            <span>Net Operating Income:</span>
            <span className="font-mono-code text-emerald-400 font-black">{formatCurrency(data.netProfit)}</span>
          </div>
        </div>
      );
    };
    return null;
  };

  const CustomCashFlowTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as MonthlyFinancialSummary;
      return (
        <div className="bg-slate-900 text-white p-3.5 rounded-2xl shadow-xl border border-slate-700 text-xs space-y-1.5 min-w-[190px]">
          <div className="font-bold text-slate-200 border-b border-slate-700 pb-1">
            {data.monthLabel}
          </div>
          <div className="flex justify-between text-emerald-300">
            <span>Cash Inflows (AR + POS):</span>
            <span className="font-mono-code font-bold">{formatCurrency(data.cashInflow)}</span>
          </div>
          <div className="flex justify-between text-rose-300">
            <span>Cash Outflows (AP + OpEx):</span>
            <span className="font-mono-code font-bold">-{formatCurrency(data.cashOutflow)}</span>
          </div>
          <div className="flex justify-between pt-1 border-t border-slate-800 font-bold">
            <span>Net Period Cash:</span>
            <span className={`font-mono-code font-black ${data.netCashFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatCurrency(data.netCashFlow)}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  // Palette colors for OpEx Donut
  const OPEX_COLORS = ['#3b82f6', '#06b6d4', '#6366f1', '#f59e0b', '#ec4899', '#10b981', '#8b5cf6', '#f43f5e'];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Filter and Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg">
              <BarChart3 className="w-4 h-4" />
            </span>
            <h2 className="text-lg font-black text-slate-900">Executive P&L & Cash Flow Analytics</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Multi-period financial trajectory, channel revenue yield, and operating liquidity.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="bg-slate-100 p-1 rounded-2xl flex items-center border border-slate-200 text-xs font-bold">
            <button
              id="report-range-6m"
              onClick={() => setTimeRange('6m')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                timeRange === '6m' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Trailing 6 Months
            </button>
            <button
              id="report-range-3m"
              onClick={() => setTimeRange('3m')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                timeRange === '3m' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Last Quarter (3M)
            </button>
          </div>

          <div className="bg-slate-100 p-1 rounded-2xl flex items-center border border-slate-200 text-xs font-bold">
            <button
              id="report-metric-all"
              onClick={() => setChartMetric('all')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                chartMetric === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Revenue & COGS
            </button>
            <button
              id="report-metric-profit"
              onClick={() => setChartMetric('profit')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                chartMetric === 'profit' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Net Profit
            </button>
            <button
              id="report-metric-margins"
              onClick={() => setChartMetric('margins')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                chartMetric === 'margins' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Margin %
            </button>
          </div>
        </div>
      </div>

      {/* 4 Multi-Period Trailing Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Period Gross Revenue */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Period Gross Revenue</span>
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono-code">
            {formatCurrency(aggregateMetrics.totalRev)}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold pt-1 border-t border-slate-100">
            <span>
              {displayedData.reduce((s, m) => s + m.orderCount, 0)} wholesale orders • {displayedData.reduce((s, m) => s + m.retailTicketCount, 0)} retail tickets
            </span>
          </div>
        </div>

        {/* Metric 2: Cumulative Gross Margin */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Gross Operating Profit</span>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Percent className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-700 font-mono-code">
              {formatCurrency(aggregateMetrics.totalGross)}
            </span>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              {aggregateMetrics.avgMargin.toFixed(1)}% Avg
            </span>
          </div>
          <div className="text-xs text-slate-500 pt-1 border-t border-slate-100">
            Cost of Catch: <strong className="text-slate-800 font-mono-code">{formatCurrency(aggregateMetrics.totalCOGS)}</strong>
          </div>
        </div>

        {/* Metric 3: Total Net Operating Profit */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Net Operating Income</span>
            <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono-code">
            {formatCurrency(aggregateMetrics.totalNet)}
          </div>
          <div className="text-xs text-slate-500 pt-1 border-t border-slate-100 flex items-center justify-between">
            <span>Net Operating Margin:</span>
            <strong className="text-blue-700 font-bold font-mono-code">{aggregateMetrics.avgNetMargin.toFixed(1)}%</strong>
          </div>
        </div>

        {/* Metric 4: Net Operating Cash Flow */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Net Cash Flow Generated</span>
            <span className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Activity className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono-code">
            {formatCurrency(aggregateMetrics.netCash)}
          </div>
          <div className="text-xs text-slate-500 pt-1 border-t border-slate-100 flex items-center justify-between">
            <span>Inflow vs Outflow:</span>
            <span className={`font-bold font-mono-code ${aggregateMetrics.netCash >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {aggregateMetrics.netCash >= 0 ? `+${formatCurrency(aggregateMetrics.netCash)}` : formatCurrency(aggregateMetrics.netCash)}
            </span>
          </div>
        </div>
      </div>

      {/* Primary Chart Section: Monthly P&L Composed Bar / Area Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 8 Cols: Monthly P&L Trend Chart */}
        <div className="lg:col-span-8 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-slate-900">Monthly P&L Dynamics & Profit Performance</h3>
              <p className="text-xs text-slate-500">
                Revenue streams (Wholesale vs Retail), landed catch cost (COGS), and net profit margin progression.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-indigo-600 inline-block" />
                <span className="text-slate-600 font-medium">Wholesale B2B</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-emerald-500 inline-block" />
                <span className="text-slate-600 font-medium">Retail POS</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-rose-500 inline-block" />
                <span className="text-slate-600 font-medium">Catch COGS</span>
              </div>
            </div>
          </div>

          {/* Recharts Composed Chart */}
          <div className="h-80 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              {chartMetric === 'all' ? (
                <ComposedChart data={displayedData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="shortMonth" 
                    tickLine={false} 
                    axisLine={{ stroke: '#e2e8f0' }} 
                    tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} 
                  />
                  <YAxis 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} 
                    tick={{ fontSize: 11, fill: '#64748b' }}
                  />
                  <Tooltip content={<CustomPnLTooltip />} />
                  <Bar dataKey="wholesaleRevenue" name="Wholesale B2B" fill="#4f46e5" radius={[6, 6, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="retailRevenue" name="Retail Counter" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="cogs" name="Cost of Catch (COGS)" fill="#f43f5e" radius={[6, 6, 0, 0]} maxBarSize={32} />
                  <Line 
                    type="monotone" 
                    dataKey="grossProfit" 
                    name="Gross Profit" 
                    stroke="#059669" 
                    strokeWidth={3} 
                    dot={{ r: 4, fill: '#059669', strokeWidth: 2, stroke: '#ffffff' }} 
                  />
                </ComposedChart>
              ) : chartMetric === 'profit' ? (
                <AreaChart data={displayedData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                    </linearGradient>
                    <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="shortMonth" tickLine={false} axisLine={{ stroke: '#e2e8f0' }} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} />
                  <YAxis tickLine={false} axisLine={false} tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip content={<CustomPnLTooltip />} />
                  <Area type="monotone" dataKey="grossProfit" name="Gross Profit" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#profitGrad)" />
                  <Area type="monotone" dataKey="netProfit" name="Net Operating Profit" stroke="#4f46e5" strokeWidth={2.5} fillOpacity={1} fill="url(#netGrad)" />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                </AreaChart>
              ) : (
                <LineChart data={displayedData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="shortMonth" tickLine={false} axisLine={{ stroke: '#e2e8f0' }} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} />
                  <YAxis domain={[30, 60]} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}%`} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip 
                    formatter={(val: any) => [`${val}%`, '']}
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                  />
                  <Line type="monotone" dataKey="grossMarginPct" name="Gross Margin %" stroke="#10b981" strokeWidth={3} dot={{ r: 5 }} />
                  <Line type="monotone" dataKey="netMarginPct" name="Net Margin %" stroke="#3b82f6" strokeWidth={3} dot={{ r: 5 }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right 4 Cols: Cash Flow Inflow vs Outflow Trend */}
        <div className="lg:col-span-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Cash Flow Liquidity</h3>
              <span className="p-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold flex items-center gap-1">
                <Activity className="w-3.5 h-3.5" /> Cash Trajectory
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Collected customer receivables & POS sales vs. supplier payouts and OpEx.
            </p>

            {/* Cash Flow Area Chart */}
            <div className="h-56 w-full pt-3">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={displayedData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.35}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                    </linearGradient>
                    <linearGradient id="outflowGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                  <XAxis dataKey="shortMonth" tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tickLine={false} axisLine={false} tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip content={<CustomCashFlowTooltip />} />
                  <Area type="monotone" dataKey="cashInflow" name="Cash Inflow" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#inflowGrad)" />
                  <Area type="monotone" dataKey="cashOutflow" name="Cash Outflow" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#outflowGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <div>
              <div className="text-slate-400">Total Period Net Cash</div>
              <div className={`font-mono-code font-black text-sm ${aggregateMetrics.netCash >= 0 ? 'text-slate-900' : 'text-rose-700'}`}>
                {aggregateMetrics.netCash >= 0 ? `+${formatCurrency(aggregateMetrics.netCash)}` : formatCurrency(aggregateMetrics.netCash)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-slate-400">Avg Monthly Inflow</div>
              <div className="font-mono-code font-bold text-emerald-600 text-sm">
                {formatCurrency(displayedData.length > 0 ? aggregateMetrics.totalCashIn / displayedData.length : 0)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Row: Revenue Channel & OpEx Category Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* OpEx Cost Distribution (Donut Chart) - 6 cols */}
        <div className="lg:col-span-6 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Operating Expense (OpEx) Allocation</h3>
              <p className="text-xs text-slate-500">Distribution of commercial facility and logistics expenditures</p>
            </div>
            <span className="text-xs font-mono-code font-black text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-100">
              {formatCurrency(aggregateMetrics.totalOpEx)} Period Total
            </span>
          </div>

          {opexBreakdownData.length === 0 ? (
            <div className="h-52 flex flex-col items-center justify-center text-center bg-slate-50/70 rounded-2xl border border-dashed border-slate-200 px-6">
              <PieIcon className="w-8 h-8 text-slate-300 mb-2" />
              <div className="text-xs font-bold text-slate-700">No operating expenses recorded yet</div>
              <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
                Use Record Expense to log freight, cold storage utilities, packaging, or crew labor costs.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
              <div className="sm:col-span-6 h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={opexBreakdownData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {opexBreakdownData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={OPEX_COLORS[index % OPEX_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: any) => [formatCurrency(Number(value)), 'Expense']}
                      contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', color: '#fff', fontSize: '11px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="sm:col-span-6 space-y-2 text-xs">
                {opexBreakdownData.map((item, idx) => (
                  <div key={item.name} className="flex items-center justify-between p-1.5 rounded-xl hover:bg-slate-50">
                    <div className="flex items-center gap-2">
                      <span 
                        className="w-2.5 h-2.5 rounded-full shrink-0" 
                        style={{ backgroundColor: OPEX_COLORS[idx % OPEX_COLORS.length] }} 
                      />
                      <span className="text-slate-700 font-medium truncate max-w-[140px]">{item.name}</span>
                    </div>
                    <span className="font-mono-code font-bold text-slate-900">
                      {formatCurrency(item.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Seafood Category Contribution - 6 cols */}
        <div className="lg:col-span-6 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Revenue Contribution by Seafood Species</h3>
              <p className="text-xs text-slate-500">Share of sales generated across cold-chain categories</p>
            </div>
            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
              4 Primary Species Groups
            </span>
          </div>

          <div className="space-y-3 pt-1">
            {categoryRevenueData.map(cat => (
              <div key={cat.name} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-slate-800">{cat.name}</span>
                  <span className="font-mono-code font-extrabold text-slate-900">{cat.value}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div 
                    className="h-2.5 rounded-full transition-all duration-500" 
                    style={{ width: `${cat.value}%`, backgroundColor: cat.color }} 
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 bg-slate-50 rounded-2xl text-[11px] text-slate-600 flex items-center justify-between mt-2">
            <span>Pelagic Hon-Maguro and Sashimi grade Salmon maintain the highest volume turnover.</span>
            <span className="text-emerald-700 font-bold font-mono-code">Avg 52.4% Gross Margin</span>
          </div>
        </div>
      </div>

      {/* Comprehensive Monthly P&L Matrix Table */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900">Monthly Financial Statement Ledger</h3>
            <p className="text-xs text-slate-500">Historical performance breakdown by accounting period</p>
          </div>
          <span className="text-xs font-mono-code text-slate-400">
            Export format: GAAP Standard Commercial Seafood ERP
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-y border-slate-200">
              <tr>
                <th className="py-3 px-4">Period</th>
                <th className="py-3 px-4 text-right">Wholesale</th>
                <th className="py-3 px-4 text-right">Retail POS</th>
                <th className="py-3 px-4 text-right">Total Revenue</th>
                <th className="py-3 px-4 text-right">Catch COGS</th>
                <th className="py-3 px-4 text-right">Gross Profit</th>
                <th className="py-3 px-4 text-center">Margin %</th>
                <th className="py-3 px-4 text-right">OpEx</th>
                <th className="py-3 px-4 text-right">Net Income</th>
                <th className="py-3 px-4 text-right">Net Cash Flow</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono-code">
              {displayedData.map((row) => (
                <tr key={row.monthKey} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-sans font-bold text-slate-900 whitespace-nowrap">
                    {row.monthLabel}
                  </td>
                  <td className="py-3.5 px-4 text-right text-indigo-900">
                    {formatCurrency(row.wholesaleRevenue)}
                  </td>
                  <td className="py-3.5 px-4 text-right text-emerald-700">
                    {formatCurrency(row.retailRevenue)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-black text-slate-900">
                    {formatCurrency(row.totalRevenue)}
                  </td>
                  <td className="py-3.5 px-4 text-right text-rose-600">
                    -{formatCurrency(row.cogs)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold text-emerald-700">
                    {formatCurrency(row.grossProfit)}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      {row.grossMarginPct}%
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right text-slate-600">
                    -{formatCurrency(row.opEx)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-black text-slate-900">
                    <span className={row.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                      {formatCurrency(row.netProfit)}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold">
                    <span className={row.netCashFlow >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                      {row.netCashFlow >= 0 ? `+${formatCurrency(row.netCashFlow)}` : formatCurrency(row.netCashFlow)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-900 text-white font-mono-code font-bold border-t-2 border-slate-700">
              <tr>
                <td className="py-3.5 px-4 font-sans text-xs">Total / Average</td>
                <td className="py-3.5 px-4 text-right text-indigo-300">
                  {formatCurrency(displayedData.reduce((s, r) => s + r.wholesaleRevenue, 0))}
                </td>
                <td className="py-3.5 px-4 text-right text-emerald-300">
                  {formatCurrency(displayedData.reduce((s, r) => s + r.retailRevenue, 0))}
                </td>
                <td className="py-3.5 px-4 text-right text-white">
                  {formatCurrency(aggregateMetrics.totalRev)}
                </td>
                <td className="py-3.5 px-4 text-right text-rose-300">
                  -{formatCurrency(aggregateMetrics.totalCOGS)}
                </td>
                <td className="py-3.5 px-4 text-right text-emerald-400">
                  {formatCurrency(aggregateMetrics.totalGross)}
                </td>
                <td className="py-3.5 px-4 text-center text-emerald-300">
                  {aggregateMetrics.avgMargin.toFixed(1)}%
                </td>
                <td className="py-3.5 px-4 text-right text-slate-300">
                  -{formatCurrency(aggregateMetrics.totalOpEx)}
                </td>
                <td className="py-3.5 px-4 text-right text-emerald-400">
                  {formatCurrency(aggregateMetrics.totalNet)}
                </td>
                <td className="py-3.5 px-4 text-right text-emerald-300">
                  {aggregateMetrics.netCash >= 0 ? `+${formatCurrency(aggregateMetrics.netCash)}` : formatCurrency(aggregateMetrics.netCash)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
