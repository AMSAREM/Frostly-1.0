import { supabase, isSupabaseConfigured } from '../utils/supabase';
import { StaffProfile, TenantOrganization } from '../data/auth';

export interface UserLoginRecord {
  id: string;
  user_id: string;
  organization_id: string;
  organization_name: string;
  email: string;
  full_name: string;
  role: string;
  login_at: string;
  device_type: 'desktop' | 'mobile' | 'tablet';
  user_agent: string;
  session_status: 'active' | 'idle' | 'expired';
}

export interface FeatureUsageRecord {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  organization_id: string;
  organization_name: string;
  feature_key: string;
  feature_name: string;
  category: 'operations' | 'inventory' | 'sales' | 'finance' | 'compliance' | 'admin';
  action_type: 'view' | 'create' | 'update' | 'delete' | 'export';
  metadata?: Record<string, any>;
  created_at: string;
}

export interface FeatureUsageStat {
  feature_key: string;
  feature_name: string;
  category: string;
  total_uses: number;
  unique_users_count: number;
  percentage: number;
  last_used_at: string;
}

export interface UserFeatureBreakdown {
  user_id: string;
  user_email: string;
  user_name: string;
  role: string;
  organization_name: string;
  last_login_at: string;
  device_type: string;
  total_actions: number;
  most_used_feature: string;
  top_features: { name: string; count: number }[];
}

export const FEATURE_CATALOG: Record<string, { name: string; category: FeatureUsageRecord['category'] }> = {
  catch_inward: { name: 'Catch Inward & Weighing', category: 'operations' },
  inventory_lots: { name: 'Cold Storage & Lot Tracking', category: 'inventory' },
  sales_orders: { name: 'Sales Orders & Invoicing', category: 'sales' },
  processing_blast: { name: 'Processing & Blast Freezing', category: 'operations' },
  fsma_traceability: { name: 'FSMA 204 & HACCP QR Passports', category: 'compliance' },
  financial_ledger: { name: 'Financial Ledger & Cashflow', category: 'finance' },
  retail_pos: { name: 'Retail POS & Quick Counter', category: 'sales' },
  suppliers_vessels: { name: 'Vessels & Dock Suppliers', category: 'operations' },
  customers_clients: { name: 'Wholesale Client Directory', category: 'sales' },
  cold_room_telemetry: { name: 'Cold Room IoT Telemetry', category: 'inventory' },
  platform_console: { name: 'Platform Creator Console', category: 'admin' },
  settings_permissions: { name: 'Settings & Security Audit', category: 'admin' },
};

const STORAGE_KEY_LOGINS = 'frostly_telemetry_logins';
const STORAGE_KEY_FEATURES = 'frostly_telemetry_features';

// Realistic pre-seeded demo telemetry for rich instant visualization
const DEMO_LOGINS: UserLoginRecord[] = [
  {
    id: 'log-001',
    user_id: 'usr-kofi-mensah',
    organization_id: '00000000-0000-0000-0000-000000000001',
    organization_name: 'Tema Cold Store Ltd (Headquarters)',
    email: 'k.mensah@temacoldstore.gh',
    full_name: 'Kofi Mensah',
    role: 'Operations Director',
    login_at: new Date(Date.now() - 14 * 60 * 1000).toISOString(), // 14 mins ago
    device_type: 'desktop',
    user_agent: 'Chrome 128 / macOS Sequoia (Dock Office)',
    session_status: 'active',
  },
  {
    id: 'log-002',
    user_id: 'usr-abena-osei',
    organization_id: '00000000-0000-0000-0000-000000000001',
    organization_name: 'Tema Cold Store Ltd (Headquarters)',
    email: 'a.osei@temacoldstore.gh',
    full_name: 'Abena Osei',
    role: 'Quality & HACCP Lead',
    login_at: new Date(Date.now() - 52 * 60 * 1000).toISOString(), // 52 mins ago
    device_type: 'tablet',
    user_agent: 'Safari / iPadOS 18 (Cold Room Zone B Tablet)',
    session_status: 'active',
  },
  {
    id: 'log-003',
    user_id: 'usr-kwame-boateng',
    organization_id: '90000000-0000-0000-0000-000000000001',
    organization_name: 'Tema Coastal Fisheries Ltd',
    email: 'kwame@temacoastalfish.com',
    full_name: 'Kwame Boateng',
    role: 'Fleet Manager',
    login_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString(), // 3 hours ago
    device_type: 'mobile',
    user_agent: 'Mobile Safari / iOS 17.6 (Pier 4 Dispatch)',
    session_status: 'idle',
  },
  {
    id: 'log-004',
    user_id: 'usr-sarah-quaye',
    organization_id: '80000000-0000-0000-0000-000000000002',
    organization_name: 'Takoradi Deepsea Logistics Ltd',
    email: 's.quaye@takoradilogistics.com',
    full_name: 'Sarah Quaye',
    role: 'Wholesale Controller',
    login_at: new Date(Date.now() - 6 * 3600 * 1000).toISOString(), // 6 hours ago
    device_type: 'desktop',
    user_agent: 'Edge 128 / Windows 11 Enterprise (Wholesale Desk)',
    session_status: 'idle',
  },
  {
    id: 'log-005',
    user_id: 'usr-samuel-dartey',
    organization_id: '00000000-0000-0000-0000-000000000001',
    organization_name: 'Tema Cold Store Ltd (Headquarters)',
    email: 's.dartey@temacoldstore.gh',
    full_name: 'Samuel Dartey',
    role: 'Senior Financial Accountant',
    login_at: new Date(Date.now() - 11 * 3600 * 1000).toISOString(), // 11 hours ago
    device_type: 'desktop',
    user_agent: 'Firefox 130 / macOS Sonoma (Finance Office)',
    session_status: 'expired',
  },
  {
    id: 'log-006',
    user_id: 'usr-efua-appiah',
    organization_id: '70000000-0000-0000-0000-000000000003',
    organization_name: 'Atlantic Frozen Catch Exporters',
    email: 'efua@atlanticcatch.com',
    full_name: 'Efua Appiah',
    role: 'Export & Regulatory Officer',
    login_at: new Date(Date.now() - 25 * 3600 * 1000).toISOString(), // 1 day ago
    device_type: 'desktop',
    user_agent: 'Chrome 128 / Windows 11 (Export Terminal)',
    session_status: 'expired',
  },
];

const DEMO_FEATURE_RECORDS: FeatureUsageRecord[] = [
  // Kofi Mensah (Operations Director) - Heavily uses Catch Inward & Inventory
  ...Array.from({ length: 48 }, (_, i) => ({
    id: `feat-km-ci-${i}`,
    user_id: 'usr-kofi-mensah',
    user_email: 'k.mensah@temacoldstore.gh',
    user_name: 'Kofi Mensah',
    organization_id: '00000000-0000-0000-0000-000000000001',
    organization_name: 'Tema Cold Store Ltd',
    feature_key: 'catch_inward',
    feature_name: 'Catch Inward & Weighing',
    category: 'operations' as const,
    action_type: 'create' as const,
    created_at: new Date(Date.now() - (i * 2 + 1) * 3600 * 1000).toISOString(),
  })),
  ...Array.from({ length: 35 }, (_, i) => ({
    id: `feat-km-inv-${i}`,
    user_id: 'usr-kofi-mensah',
    user_email: 'k.mensah@temacoldstore.gh',
    user_name: 'Kofi Mensah',
    organization_id: '00000000-0000-0000-0000-000000000001',
    organization_name: 'Tema Cold Store Ltd',
    feature_key: 'inventory_lots',
    feature_name: 'Cold Storage & Lot Tracking',
    category: 'inventory' as const,
    action_type: 'view' as const,
    created_at: new Date(Date.now() - (i * 3 + 2) * 3600 * 1000).toISOString(),
  })),

  // Abena Osei (Quality & HACCP Lead) - Heavily uses FSMA QR Passports & Processing
  ...Array.from({ length: 42 }, (_, i) => ({
    id: `feat-ao-fsma-${i}`,
    user_id: 'usr-abena-osei',
    user_email: 'a.osei@temacoldstore.gh',
    user_name: 'Abena Osei',
    organization_id: '00000000-0000-0000-0000-000000000001',
    organization_name: 'Tema Cold Store Ltd',
    feature_key: 'fsma_traceability',
    feature_name: 'FSMA 204 & HACCP QR Passports',
    category: 'compliance' as const,
    action_type: 'create' as const,
    created_at: new Date(Date.now() - (i * 2 + 3) * 3600 * 1000).toISOString(),
  })),
  ...Array.from({ length: 28 }, (_, i) => ({
    id: `feat-ao-proc-${i}`,
    user_id: 'usr-abena-osei',
    user_email: 'a.osei@temacoldstore.gh',
    user_name: 'Abena Osei',
    organization_id: '00000000-0000-0000-0000-000000000001',
    organization_name: 'Tema Cold Store Ltd',
    feature_key: 'processing_blast',
    feature_name: 'Processing & Blast Freezing',
    category: 'operations' as const,
    action_type: 'update' as const,
    created_at: new Date(Date.now() - (i * 3 + 4) * 3600 * 1000).toISOString(),
  })),

  // Sarah Quaye & Kwame Boateng - Sales Orders & Invoicing
  ...Array.from({ length: 39 }, (_, i) => ({
    id: `feat-sq-so-${i}`,
    user_id: 'usr-sarah-quaye',
    user_email: 's.quaye@takoradilogistics.com',
    user_name: 'Sarah Quaye',
    organization_id: '80000000-0000-0000-0000-000000000002',
    organization_name: 'Takoradi Deepsea Logistics Ltd',
    feature_key: 'sales_orders',
    feature_name: 'Sales Orders & Invoicing',
    category: 'sales' as const,
    action_type: 'create' as const,
    created_at: new Date(Date.now() - (i * 2 + 5) * 3600 * 1000).toISOString(),
  })),

  // Samuel Dartey - Financial Ledger & Cashflow
  ...Array.from({ length: 31 }, (_, i) => ({
    id: `feat-sd-fl-${i}`,
    user_id: 'usr-samuel-dartey',
    user_email: 's.dartey@temacoldstore.gh',
    user_name: 'Samuel Dartey',
    organization_id: '00000000-0000-0000-0000-000000000001',
    organization_name: 'Tema Cold Store Ltd',
    feature_key: 'financial_ledger',
    feature_name: 'Financial Ledger & Cashflow',
    category: 'finance' as const,
    action_type: 'view' as const,
    created_at: new Date(Date.now() - (i * 4 + 2) * 3600 * 1000).toISOString(),
  })),

  // Efua Appiah - Wholesale & Clients
  ...Array.from({ length: 22 }, (_, i) => ({
    id: `feat-ea-cu-${i}`,
    user_id: 'usr-efua-appiah',
    user_email: 'efua@atlanticcatch.com',
    user_name: 'Efua Appiah',
    organization_id: '70000000-0000-0000-0000-000000000003',
    organization_name: 'Atlantic Frozen Catch Exporters',
    feature_key: 'customers_clients',
    feature_name: 'Wholesale Client Directory',
    category: 'sales' as const,
    action_type: 'view' as const,
    created_at: new Date(Date.now() - (i * 5 + 1) * 3600 * 1000).toISOString(),
  })),

  // Quick Retail POS & Suppliers
  ...Array.from({ length: 18 }, (_, i) => ({
    id: `feat-pos-${i}`,
    user_id: 'usr-kwame-boateng',
    user_email: 'kwame@temacoastalfish.com',
    user_name: 'Kwame Boateng',
    organization_id: '90000000-0000-0000-0000-000000000001',
    organization_name: 'Tema Coastal Fisheries Ltd',
    feature_key: 'retail_pos',
    feature_name: 'Retail POS & Quick Counter',
    category: 'sales' as const,
    action_type: 'create' as const,
    created_at: new Date(Date.now() - (i * 4 + 6) * 3600 * 1000).toISOString(),
  })),
  ...Array.from({ length: 15 }, (_, i) => ({
    id: `feat-sup-${i}`,
    user_id: 'usr-kofi-mensah',
    user_email: 'k.mensah@temacoldstore.gh',
    user_name: 'Kofi Mensah',
    organization_id: '00000000-0000-0000-0000-000000000001',
    organization_name: 'Tema Cold Store Ltd',
    feature_key: 'suppliers_vessels',
    feature_name: 'Vessels & Dock Suppliers',
    category: 'operations' as const,
    action_type: 'view' as const,
    created_at: new Date(Date.now() - (i * 6 + 3) * 3600 * 1000).toISOString(),
  })),
];

/**
 * Detect client device type
 */
function getDeviceType(): 'desktop' | 'mobile' | 'tablet' {
  if (typeof window === 'undefined') return 'desktop';
  const ua = navigator.userAgent.toLowerCase();
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'tablet';
  }
  if (/mobile|iphone|ipod|blackberry|opera mini|iemobile|wpdesktop/i.test(ua)) {
    return 'mobile';
  }
  return 'desktop';
}

/**
 * Record a user login event
 */
export async function recordUserLogin(
  user: { id: string; email: string },
  profile?: StaffProfile | null,
  organization?: TenantOrganization | null
): Promise<void> {
  const device = getDeviceType();
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Browser Client';
  const orgName = organization?.name || profile?.organization_name || 'Frostly Operations';
  const orgId = organization?.id || profile?.organization_id || '00000000-0000-0000-0000-000000000001';

  const loginRecord: UserLoginRecord = {
    id: 'log-' + Date.now(),
    user_id: user.id,
    organization_id: orgId,
    organization_name: orgName,
    email: user.email,
    full_name: profile?.full_name || user.email.split('@')[0],
    role: profile?.role || 'staff',
    login_at: new Date().toISOString(),
    device_type: device,
    user_agent: userAgent,
    session_status: 'active',
  };

  // 1. Sync to local storage
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LOGINS);
    const existing: UserLoginRecord[] = raw ? JSON.parse(raw) : [];
    // Keep last 150 logins
    const updated = [loginRecord, ...existing.filter(r => r.user_id !== user.id || Math.abs(new Date(r.login_at).getTime() - Date.now()) > 300000)].slice(0, 150);
    localStorage.setItem(STORAGE_KEY_LOGINS, JSON.stringify(updated));
  } catch {}

  // 2. Persist to Supabase if configured
  if (isSupabaseConfigured) {
    try {
      await supabase.from('user_login_logs').insert({
        user_id: user.id,
        organization_id: orgId,
        organization_name: orgName,
        email: user.email,
        full_name: loginRecord.full_name,
        role: loginRecord.role,
        device_type: device,
        user_agent: userAgent,
        session_status: 'active',
      });
    } catch (err) {
      console.warn('[ActivityTracking] Supabase login log failed (fallback to local cache):', err);
    }
  }
}

/**
 * Record a user feature interaction (e.g. Catch Inward, FSMA Traceability, Financial Ledger)
 */
export async function trackFeatureAction(
  featureKey: string,
  actionType: 'view' | 'create' | 'update' | 'delete' | 'export' = 'view',
  metadata?: Record<string, any>
): Promise<void> {
  const catalogEntry = FEATURE_CATALOG[featureKey] || {
    name: featureKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    category: 'operations' as const,
  };

  // Get current user from auth cache
  let userEmail = 'operator@frostly.gh';
  let userName = 'Dock Operator';
  let userId = 'usr-current';
  let orgId = '00000000-0000-0000-0000-000000000001';
  let orgName = 'Frostly Cold-Chain Operations';

  try {
    const cachedProfile = localStorage.getItem('frostly_staff_profile');
    if (cachedProfile) {
      const p = JSON.parse(cachedProfile);
      userEmail = p.email || userEmail;
      userName = p.full_name || userName;
      userId = p.id || userId;
      orgId = p.organization_id || orgId;
      orgName = p.organization_name || orgName;
    }
  } catch {}

  const record: FeatureUsageRecord = {
    id: 'feat-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    user_id: userId,
    user_email: userEmail,
    user_name: userName,
    organization_id: orgId,
    organization_name: orgName,
    feature_key: featureKey,
    feature_name: catalogEntry.name,
    category: catalogEntry.category,
    action_type: actionType,
    metadata,
    created_at: new Date().toISOString(),
  };

  // 1. Sync to local storage
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FEATURES);
    const existing: FeatureUsageRecord[] = raw ? JSON.parse(raw) : [];
    const updated = [record, ...existing].slice(0, 500); // keep last 500 events
    localStorage.setItem(STORAGE_KEY_FEATURES, JSON.stringify(updated));
  } catch {}

  // 2. Persist to Supabase if configured
  if (isSupabaseConfigured) {
    try {
      await supabase.from('user_feature_usage_logs').insert({
        user_id: userId,
        organization_id: orgId,
        user_email: userEmail,
        user_name: userName,
        organization_name: orgName,
        feature_key: featureKey,
        feature_name: catalogEntry.name,
        category: catalogEntry.category,
        action_type: actionType,
        metadata: metadata || {},
      });
    } catch (err) {
      // Non-blocking telemetry
    }
  }
}

/**
 * Fetch list of users who have logged in with their latest session details
 */
export async function fetchUserLoginHistory(): Promise<UserLoginRecord[]> {
  // 1. Try Supabase RPC or Table
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.rpc('platform_get_user_logins', { p_limit: 100 });
      if (!error && Array.isArray(data) && data.length > 0) {
        return data as UserLoginRecord[];
      }

      // Direct table select fallback
      const { data: tableData, error: tableErr } = await supabase
        .from('user_login_logs')
        .select('*')
        .order('login_at', { ascending: false })
        .limit(100);

      if (!tableErr && Array.isArray(tableData) && tableData.length > 0) {
        return tableData as UserLoginRecord[];
      }
    } catch (err) {
      console.warn('[ActivityTracking] Supabase login fetch fallback:', err);
    }
  }

  // 2. Read from LocalStorage or merged demo seed
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LOGINS);
    if (raw) {
      const parsed: UserLoginRecord[] = JSON.parse(raw);
      if (parsed.length > 0) {
        // Merge with demo logins to ensure a rich list is visible
        const existingIds = new Set(parsed.map(p => p.id));
        const combined = [...parsed, ...DEMO_LOGINS.filter(d => !existingIds.has(d.id))];
        return combined.sort((a, b) => new Date(b.login_at).getTime() - new Date(a.login_at).getTime());
      }
    }
  } catch {}

  return DEMO_LOGINS;
}

/**
 * Fetch feature usage telemetry & aggregated statistics
 */
export async function fetchFeatureUsageAnalytics(days: number = 30): Promise<{
  features: FeatureUsageStat[];
  userBreakdown: UserFeatureBreakdown[];
  totalActions: number;
  uniqueUsers: number;
  categoryDistribution: { name: string; value: number }[];
}> {
  let records: FeatureUsageRecord[] = [];

  // 1. Attempt Supabase fetch
  if (isSupabaseConfigured) {
    try {
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('user_feature_usage_logs')
        .select('*')
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false })
        .limit(1000);

      if (!error && Array.isArray(data) && data.length > 0) {
        records = data as FeatureUsageRecord[];
      }
    } catch {}
  }

  // 2. If records empty, pull from local storage + demo records
  if (records.length === 0) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_FEATURES);
      const localRecords: FeatureUsageRecord[] = raw ? JSON.parse(raw) : [];
      const existingIds = new Set(localRecords.map(r => r.id));
      records = [...localRecords, ...DEMO_FEATURE_RECORDS.filter(d => !existingIds.has(d.id))];
    } catch {
      records = DEMO_FEATURE_RECORDS;
    }
  }

  // Aggregate Feature Usage
  const featureMap: Record<string, {
    key: string;
    name: string;
    category: string;
    total: number;
    users: Set<string>;
    lastUsed: string;
  }> = {};

  // Aggregate User Affinity
  const userMap: Record<string, {
    userId: string;
    email: string;
    name: string;
    role: string;
    orgName: string;
    lastLogin: string;
    device: string;
    featureCounts: Record<string, number>;
    totalActions: number;
  }> = {};

  const categoryMap: Record<string, number> = {};

  records.forEach(rec => {
    // Feature aggregation
    if (!featureMap[rec.feature_key]) {
      featureMap[rec.feature_key] = {
        key: rec.feature_key,
        name: rec.feature_name,
        category: rec.category,
        total: 0,
        users: new Set(),
        lastUsed: rec.created_at,
      };
    }
    featureMap[rec.feature_key].total++;
    featureMap[rec.feature_key].users.add(rec.user_id);
    if (new Date(rec.created_at) > new Date(featureMap[rec.feature_key].lastUsed)) {
      featureMap[rec.feature_key].lastUsed = rec.created_at;
    }

    // Category aggregation
    categoryMap[rec.category] = (categoryMap[rec.category] || 0) + 1;

    // User aggregation
    if (!userMap[rec.user_id]) {
      userMap[rec.user_id] = {
        userId: rec.user_id,
        email: rec.user_email,
        name: rec.user_name,
        role: 'Staff Specialist',
        orgName: rec.organization_name,
        lastLogin: rec.created_at,
        device: 'Desktop',
        featureCounts: {},
        totalActions: 0,
      };
    }
    userMap[rec.user_id].totalActions++;
    userMap[rec.user_id].featureCounts[rec.feature_name] = (userMap[rec.user_id].featureCounts[rec.feature_name] || 0) + 1;
  });

  const totalActions = records.length;
  const uniqueUsers = Object.keys(userMap).length;

  // Format and sort feature stats
  const features: FeatureUsageStat[] = Object.values(featureMap)
    .map(f => ({
      feature_key: f.key,
      feature_name: f.name,
      category: f.category,
      total_uses: f.total,
      unique_users_count: f.users.size,
      percentage: totalActions > 0 ? Math.round((f.total / totalActions) * 100) : 0,
      last_used_at: f.lastUsed,
    }))
    .sort((a, b) => b.total_uses - a.total_uses);

  // Format user breakdown
  const userBreakdown: UserFeatureBreakdown[] = Object.values(userMap)
    .map(u => {
      const sortedFeatures = Object.entries(u.featureCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      return {
        user_id: u.userId,
        user_email: u.email,
        user_name: u.name,
        role: u.role,
        organization_name: u.orgName,
        last_login_at: u.lastLogin,
        device_type: u.device,
        total_actions: u.totalActions,
        most_used_feature: sortedFeatures[0]?.name || 'Catch Inward',
        top_features: sortedFeatures.slice(0, 3),
      };
    })
    .sort((a, b) => b.total_actions - a.total_actions);

  const categoryDistribution = Object.entries(categoryMap).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
  }));

  return {
    features,
    userBreakdown,
    totalActions,
    uniqueUsers,
    categoryDistribution,
  };
}
