import React from 'react';
import { 
  Shield, 
  Warehouse, 
  ShoppingBag, 
  Truck, 
  Eye, 
  Lock, 
  Sparkles, 
  AlertTriangle 
} from 'lucide-react';

export type AppRole = 'creator' | 'admin' | 'ops_staff' | 'sales_staff' | 'dispatch_staff' | 'viewer';

export type AppPermission =
  // Organization & Workers Governance
  | 'manage_workers'
  | 'invite_workers'
  | 'change_worker_roles'
  | 'reset_worker_passwords'
  | 'manage_settings'
  | 'manage_subscription'
  | 'manage_platform'
  // Operations & Cold Storage
  | 'create_batch'
  | 'edit_batch'
  | 'adjust_inventory'
  | 'record_haccp'
  | 'manage_storage_zones'
  | 'catch_weight_weighing'
  // Sales & Customers
  | 'create_order'
  | 'edit_order'
  | 'cancel_order'
  | 'process_pos_sale'
  | 'manage_customers'
  | 'record_customer_payment'
  // Suppliers & Procurement
  | 'manage_suppliers'
  | 'create_purchase_order'
  | 'record_supplier_payment'
  // Logistics & Dispatch
  | 'dispatch_order'
  | 'manage_reefer_fleet'
  | 'print_traceability_passport'
  // Financials & Audit
  | 'view_financial_reports'
  | 'view_profit_loss'
  | 'export_audit_logs';

export interface RoleDefinition {
  id: AppRole;
  label: string;
  tagline: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  icon: React.ElementType;
  permissions: Set<AppPermission>;
}

export const ROLE_DEFINITIONS: Record<AppRole, RoleDefinition> = {
  creator: {
    id: 'creator',
    label: 'Platform Creator',
    tagline: 'System operator with global multi-tenant governance, billing configuration, and infrastructure telemetry.',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-900',
    badgeBorder: 'border-amber-300',
    icon: Sparkles,
    permissions: new Set([
      'manage_workers',
      'invite_workers',
      'change_worker_roles',
      'reset_worker_passwords',
      'manage_settings',
      'manage_subscription',
      'manage_platform',
      'create_batch',
      'edit_batch',
      'adjust_inventory',
      'record_haccp',
      'manage_storage_zones',
      'catch_weight_weighing',
      'create_order',
      'edit_order',
      'cancel_order',
      'process_pos_sale',
      'manage_customers',
      'record_customer_payment',
      'manage_suppliers',
      'create_purchase_order',
      'record_supplier_payment',
      'dispatch_order',
      'manage_reefer_fleet',
      'print_traceability_passport',
      'view_financial_reports',
      'view_profit_loss',
      'export_audit_logs',
    ]),
  },
  admin: {
    id: 'admin',
    label: 'Facility Administrator',
    tagline: 'Full authority over tenant operations, worker management, financial ledgers, and organization configuration.',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-900',
    badgeBorder: 'border-purple-300',
    icon: Shield,
    permissions: new Set([
      'manage_workers',
      'invite_workers',
      'change_worker_roles',
      'reset_worker_passwords',
      'manage_settings',
      'manage_subscription',
      'create_batch',
      'edit_batch',
      'adjust_inventory',
      'record_haccp',
      'manage_storage_zones',
      'catch_weight_weighing',
      'create_order',
      'edit_order',
      'cancel_order',
      'process_pos_sale',
      'manage_customers',
      'record_customer_payment',
      'manage_suppliers',
      'create_purchase_order',
      'record_supplier_payment',
      'dispatch_order',
      'manage_reefer_fleet',
      'print_traceability_passport',
      'view_financial_reports',
      'view_profit_loss',
      'export_audit_logs',
    ]),
  },
  ops_staff: {
    id: 'ops_staff',
    label: 'Operations & Cold Storage',
    tagline: 'Manages dock receiving, catch weighing, blast freezers, HACCP safety compliance, and inventory adjustments.',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-900',
    badgeBorder: 'border-blue-300',
    icon: Warehouse,
    permissions: new Set([
      'create_batch',
      'edit_batch',
      'adjust_inventory',
      'record_haccp',
      'manage_storage_zones',
      'catch_weight_weighing',
      'manage_suppliers',
      'create_purchase_order',
      'print_traceability_passport',
    ]),
  },
  sales_staff: {
    id: 'sales_staff',
    label: 'Sales & POS Cashier',
    tagline: 'Executes retail sales, B2B wholesale client orders, payments, and customer accounts receivable ledgers.',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-900',
    badgeBorder: 'border-emerald-300',
    icon: ShoppingBag,
    permissions: new Set([
      'create_order',
      'edit_order',
      'process_pos_sale',
      'manage_customers',
      'record_customer_payment',
      'print_traceability_passport',
    ]),
  },
  dispatch_staff: {
    id: 'dispatch_staff',
    label: 'Dispatch & Logistics',
    tagline: 'Manages refrigerated vehicle fleet, cold chain transport handoffs, delivery routes, and digital passports.',
    badgeBg: 'bg-cyan-100',
    badgeText: 'text-cyan-900',
    badgeBorder: 'border-cyan-300',
    icon: Truck,
    permissions: new Set([
      'dispatch_order',
      'manage_reefer_fleet',
      'print_traceability_passport',
    ]),
  },
  viewer: {
    id: 'viewer',
    label: 'Auditor & Observer',
    tagline: 'Read-only access for food safety inspectors, external auditors, and certification authorities.',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-800',
    badgeBorder: 'border-slate-300',
    icon: Eye,
    permissions: new Set([
      'print_traceability_passport',
      'view_financial_reports',
    ]),
  },
};

/**
 * Normalizes input role string to canonical AppRole with safe least-privilege fallback
 */
export function normalizeRole(role?: string | null): AppRole {
  if (!role) return 'viewer';
  const clean = role.toLowerCase().trim();
  if (clean === 'creator' || clean === 'platform_creator' || clean === 'platform owner' || clean === 'owner') return 'creator';
  if (clean === 'admin' || clean === 'superadmin' || clean === 'manager') return 'admin';
  if (clean === 'ops_staff' || clean === 'operations' || clean === 'ops' || clean === 'operator') return 'ops_staff';
  if (clean === 'sales_staff' || clean === 'sales' || clean === 'cashier') return 'sales_staff';
  if (clean === 'dispatch_staff' || clean === 'dispatch' || clean === 'logistics') return 'dispatch_staff';
  if (clean === 'viewer' || clean === 'auditor' || clean === 'observer') return 'viewer';
  return 'viewer';
}

/**
 * Validates if a user role holds permission for a given action
 */
export function canUserPerform(role: string | undefined | null, permission: AppPermission): boolean {
  const normalized = normalizeRole(role);
  const def = ROLE_DEFINITIONS[normalized];
  return def ? def.permissions.has(permission) : false;
}

/**
 * Retrieves UI badge information for a role
 */
export function getRoleBadgeInfo(role?: string | null) {
  const normalized = normalizeRole(role);
  return ROLE_DEFINITIONS[normalized] || ROLE_DEFINITIONS.ops_staff;
}

/**
 * Authoritative Access Denial Banner for UI
 */
export const RestrictedAccessNotice: React.FC<{
  requiredRole?: string;
  userRole?: string | null;
  featureName: string;
  message?: string;
}> = ({ requiredRole = 'Administrator', userRole = 'Staff', featureName, message }) => {
  const badgeInfo = getRoleBadgeInfo(userRole);
  const Icon = badgeInfo.icon;

  return (
    <div className="p-6 max-w-2xl mx-auto my-8 bg-white rounded-2xl border border-slate-200 shadow-sm text-center">
      <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
        <Lock className="w-6 h-6" />
      </div>
      <h3 className="text-lg font-bold text-slate-900 mb-1">
        Access Restricted: {featureName}
      </h3>
      <p className="text-sm text-slate-600 mb-4 max-w-md mx-auto">
        {message || `This action or administrative screen requires ${requiredRole} privileges.`}
      </p>

      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
        <span className="text-slate-400">Your Current Role:</span>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-bold border ${badgeInfo.badgeBg} ${badgeInfo.badgeText} ${badgeInfo.badgeBorder}`}>
          <Icon className="w-3.5 h-3.5" />
          {badgeInfo.label}
        </span>
      </div>

      <div className="mt-4 text-xs text-slate-400">
        Please contact your organization administrator to request role privilege updates.
      </div>
    </div>
  );
};

/**
 * Role-level UI Gate component
 */
export const RoleGate: React.FC<{
  allowedRoles: AppRole[];
  userRole?: string | null;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  featureName?: string;
}> = ({ allowedRoles, userRole, children, fallback, featureName = 'This feature' }) => {
  const normalized = normalizeRole(userRole);
  const isAllowed = allowedRoles.includes(normalized);

  if (isAllowed) {
    return <>{children}</>;
  }

  if (fallback !== undefined) {
    return <>{fallback}</>;
  }

  return (
    <RestrictedAccessNotice
      requiredRole={allowedRoles.map((r) => ROLE_DEFINITIONS[r]?.label || r).join(' or ')}
      userRole={userRole}
      featureName={featureName}
    />
  );
};
