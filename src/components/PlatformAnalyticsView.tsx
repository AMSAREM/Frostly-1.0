import React, { useState, useMemo, useEffect } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  Building2, 
  Clock, 
  AlertTriangle, 
  ShieldCheck, 
  Download, 
  Calendar, 
  ArrowUpRight, 
  Activity, 
  PieChart as PieIcon, 
  BarChart3, 
  CheckCircle2, 
  RefreshCw,
  Sparkles,
  ArrowRight,
  Filter,
  UserCheck,
  Smartphone,
  Monitor,
  Tablet,
  Search,
  Zap,
  Layers,
  Flame,
  MousePointerClick,
  ChevronRight,
  User as UserIcon,
  HelpCircle,
  BarChart2
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  CartesianGrid 
} from 'recharts';
import { PlatformOrganization, PlatformAuditLog } from '../services/platformAdminService';
import { 
  UserLoginRecord, 
  FeatureUsageStat, 
  UserFeatureBreakdown, 
  fetchUserLoginHistory, 
  fetchFeatureUsageAnalytics 
} from '../services/activityTrackingService';

interface PlatformAnalyticsViewProps {
  organizations: PlatformOrganization[];
  auditLogs: PlatformAuditLog[];
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const TIER_PRICING_USD: Record<string, number> = {
  starter: 49,
  standard: 149,
  enterprise: 499,
};

const TIER_PRICING_GHS: Record<string, number> = {
  starter: 650,
  standard: 1950,
  enterprise: 6500,
};

const STATUS_COLORS: Record<string, string> = {
  active: '#10b981',   // Emerald 500
  trial: '#0ea5e9',    // Sky 500
  past_due: '#f59e0b', // Amber 500
  suspended: '#f43f5e',// Rose 500
};

const CATEGORY_COLORS: Record<string, string> = {
  Operations: '#3b82f6',  // Blue 500
  Inventory: '#6366f1',   // Indigo 500
  Sales: '#10b981',       // Emerald 500
  Compliance: '#f59e0b',  // Amber 500
  Finance: '#8b5cf6',     // Purple 500
  Admin: '#64748b',       // Slate 500
};

function formatRelativeTime(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMins = Math.floor(diffMs / (60 * 1000));
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return 'recently';
  }
}

export const PlatformAnalyticsView: React.FC<PlatformAnalyticsViewProps> = ({
  organizations,
  auditLogs,
  onRefresh,
  isRefreshing = false,
}) => {
  // Navigation sub-tabs inside Analytics
  const [activeView, setActiveView] = useState<'overview' | 'logins' | 'features'>('overview');
  const [currency, setCurrency] = useState<'USD' | 'GHS'>('USD');
  const [timeRange, setTimeRange] = useState<'all' | '90d' | '30d'>('all');

  // Telemetry state
  const [logins, setLogins] = useState<UserLoginRecord[]>([]);
  const [featureStats, setFeatureStats] = useState<FeatureUsageStat[]>([]);
  const [userBreakdown, setUserBreakdown] = useState<UserFeatureBreakdown[]>([]);
  const [totalFeatureEvents, setTotalFeatureEvents] = useState<number>(0);
  const [categoryDistribution, setCategoryDistribution] = useState<{ name: string; value: number }[]>([]);
  const [loadingTelemetry, setLoadingTelemetry] = useState(true);

  // Search & Filter state for Logins
  const [loginSearch, setLoginSearch] = useState('');
  const [loginDeviceFilter, setLoginDeviceFilter] = useState<'all' | 'desktop' | 'mobile' | 'tablet'>('all');

  // Search & Filter state for Features
  const [featureCategoryFilter, setFeatureCategoryFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');

  // Fetch telemetry
  const loadTelemetry = async () => {
    setLoadingTelemetry(true);
    try {
      const [loginData, featureData] = await Promise.all([
        fetchUserLoginHistory(),
        fetchFeatureUsageAnalytics(timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365),
      ]);
      setLogins(loginData);
      setFeatureStats(featureData.features);
      setUserBreakdown(featureData.userBreakdown);
      setTotalFeatureEvents(featureData.totalActions);
      setCategoryDistribution(featureData.categoryDistribution);
    } catch (err) {
      console.warn('Failed to load telemetry:', err);
    } finally {
      setLoadingTelemetry(false);
    }
  };

  useEffect(() => {
    loadTelemetry();
  }, [timeRange]);

  const handleRefreshAll = () => {
    loadTelemetry();
    if (onRefresh) onRefresh();
  };

  // Filter organizations by time range if created_at is present
  const filteredOrgs = useMemo(() => {
    if (timeRange === 'all') return organizations;
    const now = new Date();
    const days = timeRange === '90d' ? 90 : 30;
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return organizations.filter(org => new Date(org.created_at) >= cutoff);
  }, [organizations, timeRange]);

  // Aggregate Executive KPIs
  const kpis = useMemo(() => {
    let totalMRR_USD = 0;
    let totalMRR_GHS = 0;
    let totalSeatsCapacity = 0;
    let totalStaffActive = 0;
    let activeTenants = 0;
    let trialTenants = 0;
    let pastDueTenants = 0;
    let suspendedTenants = 0;

    organizations.forEach(org => {
      totalSeatsCapacity += org.max_staff_seats || 0;
      totalStaffActive += org.staff_count || 0;

      if (org.subscription_status === 'active') {
        activeTenants++;
        const tier = org.plan_tier || 'starter';
        totalMRR_USD += TIER_PRICING_USD[tier] || 49;
        totalMRR_GHS += TIER_PRICING_GHS[tier] || 650;
      } else if (org.subscription_status === 'trial') {
        trialTenants++;
      } else if (org.subscription_status === 'past_due') {
        pastDueTenants++;
      } else if (org.subscription_status === 'suspended') {
        suspendedTenants++;
      }
    });

    const totalMRR = currency === 'USD' ? totalMRR_USD : totalMRR_GHS;
    const totalARR = totalMRR * 12;
    const arpu = activeTenants > 0 ? Math.round(totalMRR / activeTenants) : 0;
    const seatUtilizationRate = totalSeatsCapacity > 0 ? Math.round((totalStaffActive / totalSeatsCapacity) * 100) : 0;
    const paidConversionRate = organizations.length > 0 ? Math.round((activeTenants / organizations.length) * 100) : 0;

    // Login & feature metrics
    const activeSessionsCount = logins.filter(l => l.session_status === 'active').length;
    const mostUsedFeature = featureStats[0]?.feature_name || 'Catch Inward & Weighing';
    const mostUsedPct = featureStats[0]?.percentage || 0;

    return {
      totalMRR,
      totalARR,
      arpu,
      activeTenants,
      trialTenants,
      pastDueTenants,
      suspendedTenants,
      totalTenants: organizations.length,
      totalSeatsCapacity,
      totalStaffActive,
      seatUtilizationRate,
      paidConversionRate,
      activeSessionsCount,
      totalUniqueUsersLoggedIn: logins.length,
      mostUsedFeature,
      mostUsedPct,
    };
  }, [organizations, currency, logins, featureStats]);

  // Chart 1: Tenant Lifecycle Status Distribution (Donut Chart)
  const statusDistributionData = useMemo(() => {
    const counts: Record<string, number> = {
      active: 0,
      trial: 0,
      past_due: 0,
      suspended: 0,
    };

    organizations.forEach(org => {
      if (counts[org.subscription_status] !== undefined) {
        counts[org.subscription_status]++;
      }
    });

    return [
      { name: 'Active (Paid)', value: counts.active, color: STATUS_COLORS.active },
      { name: 'Free Trial', value: counts.trial, color: STATUS_COLORS.trial },
      { name: 'Past Due', value: counts.past_due, color: STATUS_COLORS.past_due },
      { name: 'Suspended', value: counts.suspended, color: STATUS_COLORS.suspended },
    ].filter(item => item.value > 0);
  }, [organizations]);

  // Chart 2: Revenue Contribution by Plan Tier
  const tierRevenueData = useMemo(() => {
    const tiers: Record<string, { count: number; mrr: number; seats: number }> = {
      starter: { count: 0, mrr: 0, seats: 0 },
      standard: { count: 0, mrr: 0, seats: 0 },
      enterprise: { count: 0, mrr: 0, seats: 0 },
    };

    organizations.forEach(org => {
      const tier = org.plan_tier || 'starter';
      if (tiers[tier]) {
        tiers[tier].count++;
        tiers[tier].seats += org.staff_count || 0;
        if (org.subscription_status === 'active') {
          const rate = currency === 'USD' ? TIER_PRICING_USD[tier] : TIER_PRICING_GHS[tier];
          tiers[tier].mrr += rate;
        }
      }
    });

    return [
      { 
        tier: 'Starter Fishery', 
        tenants: tiers.starter.count, 
        mrr: tiers.starter.mrr, 
        seats: tiers.starter.seats,
      },
      { 
        tier: 'Commercial Standard', 
        tenants: tiers.standard.count, 
        mrr: tiers.standard.mrr, 
        seats: tiers.standard.seats,
      },
      { 
        tier: 'Enterprise Cold-Chain', 
        tenants: tiers.enterprise.count, 
        mrr: tiers.enterprise.mrr, 
        seats: tiers.enterprise.seats,
      },
    ];
  }, [organizations, currency]);

  // Chart 3: Top Features by Invocations (Horizontal Bar Chart)
  const topFeaturesChartData = useMemo(() => {
    return featureStats.slice(0, 7).map(f => ({
      name: f.feature_name.length > 22 ? f.feature_name.substring(0, 20) + '...' : f.feature_name,
      fullName: f.feature_name,
      uses: f.total_uses,
      users: f.unique_users_count,
      category: f.category,
    }));
  }, [featureStats]);

  // Filtered Logins List
  const filteredLogins = useMemo(() => {
    return logins.filter(l => {
      const q = loginSearch.toLowerCase().trim();
      const matchesSearch = !q || 
        l.full_name.toLowerCase().includes(q) || 
        l.email.toLowerCase().includes(q) || 
        l.organization_name.toLowerCase().includes(q) ||
        l.role.toLowerCase().includes(q);
      const matchesDevice = loginDeviceFilter === 'all' || l.device_type === loginDeviceFilter;
      return matchesSearch && matchesDevice;
    });
  }, [logins, loginSearch, loginDeviceFilter]);

  // Filtered Feature Stats
  const filteredFeatureStats = useMemo(() => {
    return featureStats.filter(f => {
      const matchesCat = featureCategoryFilter === 'all' || f.category.toLowerCase() === featureCategoryFilter.toLowerCase();
      return matchesCat;
    });
  }, [featureStats, featureCategoryFilter]);

  // Export Analytics Summary CSV
  const handleExportCSV = () => {
    if (activeView === 'logins') {
      const headers = ['Full Name', 'Email', 'Role', 'Organization', 'Login Timestamp', 'Device Type', 'Session Status', 'User Agent'];
      const rows = filteredLogins.map(l => [
        `"${l.full_name.replace(/"/g, '""')}"`,
        `"${l.email.replace(/"/g, '""')}"`,
        `"${l.role.replace(/"/g, '""')}"`,
        `"${l.organization_name.replace(/"/g, '""')}"`,
        `"${l.login_at}"`,
        l.device_type,
        l.session_status,
        `"${l.user_agent.replace(/"/g, '""')}"`,
      ]);
      downloadCSV('frostly_user_logins_audit.csv', headers, rows);
    } else if (activeView === 'features') {
      const headers = ['Feature Name', 'Category', 'Total Uses', 'Unique Users', 'Percentage Share', 'Last Used'];
      const rows = featureStats.map(f => [
        `"${f.feature_name.replace(/"/g, '""')}"`,
        f.category,
        f.total_uses,
        f.unique_users_count,
        `${f.percentage}%`,
        `"${f.last_used_at}"`,
      ]);
      downloadCSV('frostly_feature_usage_telemetry.csv', headers, rows);
    } else {
      const headers = ['Organization Name', 'Company', 'Plan Tier', 'Subscription Status', 'Active Staff Seats', 'Max Seats Quota', 'Monthly Value', 'Created At'];
      const rows = organizations.map(org => [
        `"${org.name.replace(/"/g, '""')}"`,
        `"${(org.company_name || '').replace(/"/g, '""')}"`,
        org.plan_tier,
        org.subscription_status,
        org.staff_count,
        org.max_staff_seats,
        org.subscription_status === 'active' ? (currency === 'USD' ? TIER_PRICING_USD[org.plan_tier] : TIER_PRICING_GHS[org.plan_tier]) : 0,
        `"${org.created_at}"`
      ]);
      downloadCSV('frostly_creator_analytics.csv', headers, rows);
    }
  };

  const downloadCSV = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${filename.replace('.csv', '')}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const currencySymbol = currency === 'USD' ? '$' : 'GH₵';

  return (
    <div className="space-y-6">
      {/* Top Header & Navigation View Switcher */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-heading font-black text-slate-900 leading-tight">Creator Platform Analytics</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Live Telemetry
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Track user logins, feature utilization, and recurring revenue</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Currency Toggle (when on overview) */}
            {activeView === 'overview' && (
              <div className="inline-flex rounded-xl bg-slate-100 p-0.5 border border-slate-200/80">
                <button
                  id="btn-analytics-currency-usd"
                  onClick={() => setCurrency('USD')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    currency === 'USD' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  USD ($)
                </button>
                <button
                  id="btn-analytics-currency-ghs"
                  onClick={() => setCurrency('GHS')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    currency === 'GHS' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  GHS (GH₵)
                </button>
              </div>
            )}

            {/* Time Range Filter */}
            <div className="inline-flex rounded-xl bg-slate-100 p-0.5 border border-slate-200/80">
              <button
                onClick={() => setTimeRange('all')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  timeRange === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                All Time
              </button>
              <button
                onClick={() => setTimeRange('90d')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  timeRange === '90d' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                90 Days
              </button>
              <button
                onClick={() => setTimeRange('30d')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  timeRange === '30d' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                30 Days
              </button>
            </div>

            {/* Export Action */}
            <button
              id="btn-analytics-export-csv"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-2xs"
              title="Download CSV report"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export CSV</span>
            </button>

            {/* Refresh Action */}
            <button
              id="btn-analytics-refresh"
              onClick={handleRefreshAll}
              disabled={isRefreshing || loadingTelemetry}
              className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
              title="Refresh Platform Analytics & Telemetry"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing || loadingTelemetry ? 'animate-spin text-indigo-600' : 'text-slate-500'}`} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs: MRR & Growth | User Logins | Feature Usage */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 overflow-x-auto">
          <button
            id="tab-analytics-overview"
            onClick={() => setActiveView('overview')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeView === 'overview'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>MRR &amp; Tenant Growth</span>
          </button>

          <button
            id="tab-analytics-logins"
            onClick={() => setActiveView('logins')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeView === 'logins'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Who Has Logged In ({logins.length})</span>
            {kpis.activeSessionsCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Active sessions online" />
            )}
          </button>

          <button
            id="tab-analytics-features"
            onClick={() => setActiveView('features')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeView === 'features'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>Features Used Most Often ({featureStats.length})</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Ribbon (Adapts according to active tab) */}
      {activeView === 'overview' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
              <span>Monthly Recurring Revenue</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-heading font-black text-slate-900 tracking-tight">
                {currencySymbol}{kpis.totalMRR.toLocaleString()}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                <span className="font-semibold text-emerald-600 flex items-center">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  {currencySymbol}{kpis.totalARR.toLocaleString()}
                </span>
                <span>ARR run-rate</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
              <span>Paying Organizations</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-heading font-black text-slate-900 tracking-tight">
                {kpis.activeTenants} <span className="text-sm font-semibold text-slate-400">/ {kpis.totalTenants} total</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                <span className="font-semibold text-blue-600">{kpis.paidConversionRate}%</span>
                <span>paid conversion</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
              <span>Seat Capacity &amp; Utilization</span>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-heading font-black text-slate-900 tracking-tight">
                {kpis.totalStaffActive} <span className="text-sm font-semibold text-slate-400">active seats</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                <span className="font-semibold text-indigo-600">{kpis.seatUtilizationRate}%</span>
                <span>of total license quota</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
              <span>Top Feature Utilized</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Flame className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-lg font-heading font-black text-slate-900 truncate tracking-tight" title={kpis.mostUsedFeature}>
                {kpis.mostUsedFeature}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                <span className="font-semibold text-amber-600">{kpis.mostUsedPct}%</span>
                <span>of all platform activity</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeView === 'logins' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
              <span>Total Logged-in Staff</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-heading font-black text-slate-900 tracking-tight">
                {logins.length}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                <span className="font-semibold text-emerald-600">{kpis.activeSessionsCount} active now</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
              <span>Desktop Users</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Monitor className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-heading font-black text-slate-900 tracking-tight">
                {logins.filter(l => l.device_type === 'desktop').length}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Weighing terminals &amp; offices
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
              <span>Tablet &amp; Mobile Staff</span>
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Smartphone className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-heading font-black text-slate-900 tracking-tight">
                {logins.filter(l => l.device_type === 'mobile' || l.device_type === 'tablet').length}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Dockside &amp; cold storage tablets
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
              <span>Latest Login</span>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-base font-heading font-black text-slate-900 truncate">
                {logins[0]?.full_name || 'No logins'}
              </div>
              <div className="mt-1 text-xs text-slate-500 truncate">
                {logins[0] ? `${formatRelativeTime(logins[0].login_at)} (${logins[0].organization_name})` : 'Waiting for telemetry'}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeView === 'features' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
              <span>Total Feature Actions</span>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <MousePointerClick className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-heading font-black text-slate-900 tracking-tight">
                {totalFeatureEvents.toLocaleString()}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Telemetry interactions logged
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
              <span>#1 Most Used Feature</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Flame className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-base font-heading font-black text-slate-900 truncate" title={featureStats[0]?.feature_name}>
                {featureStats[0]?.feature_name || 'Catch Inward'}
              </div>
              <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                <span className="font-semibold text-emerald-600">{featureStats[0]?.total_uses || 0} uses</span>
                <span>({featureStats[0]?.percentage || 0}% share)</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
              <span>Active Operators</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-heading font-black text-slate-900 tracking-tight">
                {userBreakdown.length}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Across all tenant cold-rooms
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
              <span>Top Category</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-base font-heading font-black text-slate-900">
                {categoryDistribution[0]?.name || 'Operations'}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {categoryDistribution[0]?.value || 0} events in cold-chain dock
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 1: OVERVIEW & REVENUE                                               */}
      {/* ========================================================================= */}
      {activeView === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart: Revenue Contribution by Tier */}
            <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Monthly Revenue by Plan Tier</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Distribution of MRR generated per subscription category</p>
                </div>
                <span className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
                  {currency} Model
                </span>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tierRevenueData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="tier" tickLine={false} axisLine={{ stroke: '#cbd5e1' }} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(val) => `${currencySymbol}${val}`} />
                    <Tooltip 
                      formatter={(val: any) => [`${currencySymbol}${Number(val).toLocaleString()}`, 'Monthly Revenue']}
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="mrr" fill="#6366f1" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-100 mt-4">
                {tierRevenueData.map(item => (
                  <div key={item.tier} className="text-center p-2 rounded-xl bg-slate-50/80">
                    <div className="text-[11px] font-medium text-slate-500 truncate">{item.tier}</div>
                    <div className="text-sm font-black text-slate-900 mt-0.5">{currencySymbol}{item.mrr.toLocaleString()}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{item.tenants} orgs ({item.seats} seats)</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chart: Tenant Lifecycle Distribution */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Tenant Lifecycle</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Account status distribution</p>
                  </div>
                  <PieIcon className="w-4 h-4 text-slate-400" />
                </div>

                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusDistributionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {statusDistributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(val: any) => [val, 'Tenants']}
                        contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                {statusDistributionData.map(item => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="font-medium text-slate-700">{item.name}</span>
                    </div>
                    <div className="font-bold text-slate-900">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Telemetry Callout Strip */}
          <div className="bg-linear-to-r from-indigo-900 via-slate-900 to-indigo-950 p-6 rounded-3xl text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-md">
            <div>
              <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase tracking-wider">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Feature Telemetry &amp; User Engagement Spotlight</span>
              </div>
              <h4 className="text-lg font-heading font-black text-white mt-1">
                {kpis.mostUsedFeature} is your platform's most essential module
              </h4>
              <p className="text-xs text-indigo-200 mt-1 max-w-xl">
                {kpis.totalStaffActive} operators from {kpis.totalTenants} organizations logged {totalFeatureEvents.toLocaleString()} actions. 
                Inspect user session timelines and feature popularity breakdown.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveView('logins')}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all cursor-pointer border border-white/15"
              >
                View User Logins
              </button>
              <button
                onClick={() => setActiveView('features')}
                className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold transition-all cursor-pointer shadow-md"
              >
                Explore Feature Stats
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: WHO HAS LOGGED IN (USER LOGINS & SESSIONS)                        */}
      {/* ========================================================================= */}
      {activeView === 'logins' && (
        <div className="space-y-4">
          {/* Controls: Search & Filter */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="input-analytics-search-logins"
                type="text"
                placeholder="Search by name, email, or company..."
                value={loginSearch}
                onChange={(e) => setLoginSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs text-slate-900 focus:outline-indigo-600 transition-all placeholder:text-slate-400"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <span className="text-xs text-slate-500 font-medium">Device:</span>
              <div className="inline-flex rounded-xl bg-slate-100 p-0.5 border border-slate-200/80">
                <button
                  onClick={() => setLoginDeviceFilter('all')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    loginDeviceFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  All ({logins.length})
                </button>
                <button
                  onClick={() => setLoginDeviceFilter('desktop')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    loginDeviceFilter === 'desktop' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Desktop
                </button>
                <button
                  onClick={() => setLoginDeviceFilter('tablet')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    loginDeviceFilter === 'tablet' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Tablet
                </button>
                <button
                  onClick={() => setLoginDeviceFilter('mobile')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    loginDeviceFilter === 'mobile' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Mobile
                </button>
              </div>
            </div>
          </div>

          {/* User Logins Data Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">User Login &amp; Session Activity Ledger</h3>
                <p className="text-xs text-slate-500 mt-0.5">Real-time audit log of authenticated staff access across tenant workspaces</p>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                Showing {filteredLogins.length} of {logins.length} login events
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3">Logged-in User</th>
                    <th className="px-5 py-3">Tenant Organization</th>
                    <th className="px-5 py-3">Role / Department</th>
                    <th className="px-5 py-3">Login Time</th>
                    <th className="px-5 py-3">Client Device / OS</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Feature Activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLogins.map(login => {
                    const userActivity = userBreakdown.find(u => u.user_email === login.email || u.user_id === login.user_id);

                    return (
                      <tr key={login.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-bold shrink-0">
                              {login.full_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900">{login.full_name}</div>
                              <div className="text-[11px] text-slate-400 font-mono">{login.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-medium text-slate-800">{login.organization_name}</div>
                          <div className="text-[10px] text-slate-400 truncate max-w-xs">{login.organization_id}</div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {login.role}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-slate-900">{formatRelativeTime(login.login_at)}</div>
                          <div className="text-[10px] text-slate-400">
                            {new Date(login.login_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(login.login_at).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                            {login.device_type === 'desktop' && <Monitor className="w-3.5 h-3.5 text-slate-400" />}
                            {login.device_type === 'tablet' && <Tablet className="w-3.5 h-3.5 text-purple-500" />}
                            {login.device_type === 'mobile' && <Smartphone className="w-3.5 h-3.5 text-blue-500" />}
                            <span className="capitalize">{login.device_type}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 truncate max-w-xs" title={login.user_agent}>
                            {login.user_agent}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            login.session_status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : login.session_status === 'idle'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              login.session_status === 'active' ? 'bg-emerald-500 animate-pulse' : login.session_status === 'idle' ? 'bg-amber-500' : 'bg-slate-400'
                            }`} />
                            {login.session_status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {userActivity ? (
                            <button
                              onClick={() => {
                                setUserFilter(login.email);
                                setActiveView('features');
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                            >
                              <span>{userActivity.total_actions} actions</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400">0 logged</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: WHAT FEATURES THEY USED MOST OFTEN                                */}
      {/* ========================================================================= */}
      {activeView === 'features' && (
        <div className="space-y-6">
          
          {/* Top Visual Charts: Feature Popularity Bar Chart & Category Donut */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Horizontal Bar Chart: Most Used Features */}
            <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Feature Popularity Ranking</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Most frequently accessed modules sorted by total invocations</p>
                </div>
                <span className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Total {totalFeatureEvents.toLocaleString()} actions
                </span>
              </div>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={topFeaturesChartData} 
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" width={140} tickLine={false} axisLine={false} tick={{ fill: '#334155', fontSize: 11, fontWeight: 500 }} />
                    <Tooltip 
                      formatter={(val: any, name: any, item: any) => [
                        `${val} total uses (${item.payload.users} operators)`, 
                        item.payload.fullName
                      ]}
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                    />
                    <Bar dataKey="uses" fill="#10b981" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Category Split: Operations vs Inventory vs Sales vs Compliance */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Usage by Workflow Domain</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Distribution across ERP operational tiers</p>
                  </div>
                  <Layers className="w-4 h-4 text-slate-400" />
                </div>

                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {categoryDistribution.map((entry, index) => (
                          <Cell 
                            key={`cat-cell-${index}`} 
                            fill={CATEGORY_COLORS[entry.name] || '#6366f1'} 
                          />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(val: any) => [val, 'Actions']}
                        contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                {categoryDistribution.map(item => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[item.name] || '#6366f1' }} />
                      <span className="font-medium text-slate-700">{item.name}</span>
                    </div>
                    <div className="font-bold text-slate-900">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* User-Level Feature Affinity Table: What Features Each User Used Most Often */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Operator Feature Affinity Matrix</h3>
                <p className="text-xs text-slate-500 mt-0.5">Exact breakdown of what features each team member uses most often</p>
              </div>
              {userFilter !== 'all' && (
                <button
                  onClick={() => setUserFilter('all')}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 cursor-pointer self-start sm:self-auto"
                >
                  Clear user filter ({userFilter})
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3">Staff Operator</th>
                    <th className="px-5 py-3">Organization</th>
                    <th className="px-5 py-3">Total Actions</th>
                    <th className="px-5 py-3">#1 Most Used Feature</th>
                    <th className="px-5 py-3">Secondary Features Used</th>
                    <th className="px-5 py-3">Last Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {userBreakdown
                    .filter(u => userFilter === 'all' || u.user_email === userFilter)
                    .map(u => (
                      <tr key={u.user_id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-slate-900">{u.user_name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{u.user_email}</div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-medium text-slate-800">{u.organization_name}</div>
                        </td>
                        <td className="px-5 py-3.5 font-bold font-mono text-slate-900">
                          {u.total_actions}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <Flame className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>{u.most_used_feature}</span>
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-wrap gap-1">
                            {u.top_features.slice(1).map(feat => (
                              <span key={feat.name} className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                {feat.name} ({feat.count})
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 text-[11px]">
                          {formatRelativeTime(u.last_login_at)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Master Feature Catalog Ledger */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Complete Feature Catalog Telemetry</h3>
                <p className="text-xs text-slate-500 mt-0.5">Aggregated metrics per application feature</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 font-medium">Filter:</span>
                <select
                  value={featureCategoryFilter}
                  onChange={(e) => setFeatureCategoryFilter(e.target.value)}
                  className="px-2.5 py-1 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-slate-50 focus:bg-white cursor-pointer"
                >
                  <option value="all">All Categories</option>
                  <option value="operations">Operations</option>
                  <option value="inventory">Inventory</option>
                  <option value="sales">Sales</option>
                  <option value="compliance">Compliance</option>
                  <option value="finance">Finance</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3">Feature Name</th>
                    <th className="px-5 py-3">Category</th>
                    <th className="px-5 py-3">Total Uses</th>
                    <th className="px-5 py-3">Unique Users</th>
                    <th className="px-5 py-3">Platform Share</th>
                    <th className="px-5 py-3">Last Invocation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredFeatureStats.map(f => (
                    <tr key={f.feature_key} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3.5 font-bold text-slate-900">
                        {f.feature_name}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                          {f.category}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-bold font-mono text-slate-900">
                        {f.total_uses}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-600">
                        {f.unique_users_count}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${Math.min(100, f.percentage * 3)}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-mono text-slate-700 font-bold">{f.percentage}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 text-[11px]">
                        {formatRelativeTime(f.last_used_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
