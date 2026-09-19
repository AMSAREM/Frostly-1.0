import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  ShieldCheck, 
  Search, 
  Filter, 
  RefreshCw, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Ban, 
  DollarSign, 
  Users, 
  FileText, 
  Edit3, 
  X, 
  History, 
  Lock, 
  Sparkles,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Mail,
  Server,
  Trash2,
  RotateCcw,
  AlertOctagon,
  ShieldAlert
} from 'lucide-react';
import { GoogleSmtpModal } from './GoogleSmtpModal';
import { PlatformPricingPlansManager } from './PlatformPricingPlansManager';
import { FrostlyLogo } from './FrostlyLogo';
import { 
  PlatformOrganization, 
  PlatformAuditLog, 
  fetchPlatformOrganizations, 
  fetchPlatformAuditLogs, 
  updatePlatformOrganizationSubscription,
  revokePlatformOrganization,
  reinstatePlatformOrganization,
  deletePlatformOrganization
} from '../services/platformAdminService';

interface PlatformConsoleViewProps {
  onClose?: () => void;
}

export const PlatformConsoleView: React.FC<PlatformConsoleViewProps> = ({ onClose }) => {
  const [organizations, setOrganizations] = useState<PlatformOrganization[]>([]);
  const [auditLogs, setAuditLogs] = useState<PlatformAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'trial' | 'active' | 'past_due' | 'suspended'>('all');
  const [activeSubTab, setActiveSubTab] = useState<'tenants' | 'pricing' | 'audit' | 'security'>('tenants');

  // Edit Modal State
  const [selectedOrg, setSelectedOrg] = useState<PlatformOrganization | null>(null);
  const [editStatus, setEditStatus] = useState<'trial' | 'active' | 'past_due' | 'suspended'>('active');
  const [editPlanTier, setEditPlanTier] = useState<'starter' | 'standard' | 'enterprise'>('standard');
  const [editMaxSeats, setEditMaxSeats] = useState<number>(20);
  const [editTrialDaysExtension, setEditTrialDaysExtension] = useState<number>(0);
  const [editReason, setEditReason] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);
  const [showSmtpModal, setShowSmtpModal] = useState(false);

  // Revoke / Reinstate Modal State
  const [revokeTargetOrg, setRevokeTargetOrg] = useState<PlatformOrganization | null>(null);
  const [revokeActionType, setRevokeActionType] = useState<'revoke' | 'reinstate'>('revoke');
  const [revokeReason, setRevokeReason] = useState<string>('');
  const [reinstateStatus, setReinstateStatus] = useState<'active' | 'trial'>('active');
  const [isRevoking, setIsRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  // Delete Modal State
  const [deleteTargetOrg, setDeleteTargetOrg] = useState<PlatformOrganization | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState<string>('');
  const [deleteReason, setDeleteReason] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [orgs, logs] = await Promise.all([
        fetchPlatformOrganizations(),
        fetchPlatformAuditLogs(),
      ]);
      setOrganizations(orgs);
      setAuditLogs(logs);
    } catch (err: any) {
      console.error('Failed to load platform data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleOpenEditModal = (org: PlatformOrganization) => {
    setSelectedOrg(org);
    setEditStatus(org.subscription_status);
    setEditPlanTier(org.plan_tier);
    setEditMaxSeats(org.max_staff_seats);
    setEditTrialDaysExtension(0);
    setEditReason('');
    setActionErrorMessage(null);
  };

  const handleApplySubscriptionUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrg) return;

    if (!editReason.trim()) {
      setActionErrorMessage('A mandatory audit reason is required for compliance and platform logging.');
      return;
    }

    setSubmitting(true);
    setActionErrorMessage(null);

    try {
      let computedTrialEndsAt: string | null = selectedOrg.trial_ends_at;
      if (editTrialDaysExtension > 0) {
        const baseDate = selectedOrg.trial_ends_at ? new Date(selectedOrg.trial_ends_at) : new Date();
        baseDate.setDate(baseDate.getDate() + editTrialDaysExtension);
        computedTrialEndsAt = baseDate.toISOString();
      }

      await updatePlatformOrganizationSubscription({
        orgId: selectedOrg.id,
        status: editStatus,
        planTier: editPlanTier,
        maxSeats: editMaxSeats,
        trialEndsAt: computedTrialEndsAt,
        reason: editReason.trim(),
      });

      setActionSuccessMessage(`Successfully updated ${selectedOrg.name}. Audit trail committed.`);
      setSelectedOrg(null);
      await loadData();
      setTimeout(() => setActionSuccessMessage(null), 4000);
    } catch (err: any) {
      setActionErrorMessage(err.message || 'Failed to update organization');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenRevokeModal = (org: PlatformOrganization) => {
    setRevokeTargetOrg(org);
    setRevokeActionType('revoke');
    setRevokeReason('');
    setRevokeError(null);
  };

  const handleOpenReinstateModal = (org: PlatformOrganization) => {
    setRevokeTargetOrg(org);
    setRevokeActionType('reinstate');
    setReinstateStatus('active');
    setRevokeReason('');
    setRevokeError(null);
  };

  const handleConfirmRevokeReinstate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revokeTargetOrg) return;

    if (!revokeReason.trim()) {
      setRevokeError('A mandatory compliance audit reason is required.');
      return;
    }

    setIsRevoking(true);
    setRevokeError(null);

    try {
      if (revokeActionType === 'revoke') {
        await revokePlatformOrganization(revokeTargetOrg.id, revokeReason.trim());
        setActionSuccessMessage(`Access revoked for ${revokeTargetOrg.name}. Tenant is now suspended.`);
      } else {
        await reinstatePlatformOrganization(revokeTargetOrg.id, revokeReason.trim(), reinstateStatus);
        setActionSuccessMessage(`Access reinstated for ${revokeTargetOrg.name}. Status restored to ${reinstateStatus}.`);
      }

      setRevokeTargetOrg(null);
      await loadData();
      setTimeout(() => setActionSuccessMessage(null), 4000);
    } catch (err: any) {
      setRevokeError(err.message || 'Action failed');
    } finally {
      setIsRevoking(false);
    }
  };

  const handleOpenDeleteModal = (org: PlatformOrganization) => {
    setDeleteTargetOrg(org);
    setDeleteConfirmName('');
    setDeleteReason('');
    setDeleteError(null);
  };

  const handleConfirmDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deleteTargetOrg) return;

    if (deleteConfirmName.trim().toLowerCase() !== deleteTargetOrg.name.trim().toLowerCase()) {
      setDeleteError(`Please type "${deleteTargetOrg.name}" exactly to confirm deletion.`);
      return;
    }

    if (!deleteReason.trim()) {
      setDeleteError('A mandatory audit reason is required for tenant deprovisioning.');
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const orgName = deleteTargetOrg.name;
      await deletePlatformOrganization(deleteTargetOrg.id, deleteReason.trim(), deleteConfirmName.trim());
      setActionSuccessMessage(`Organization "${orgName}" was permanently deleted and deprovisioned.`);
      setDeleteTargetOrg(null);
      await loadData();
      setTimeout(() => setActionSuccessMessage(null), 4000);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete organization');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredOrgs = organizations.filter(org => {
    const matchesQuery = org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || org.subscription_status === statusFilter;
    return matchesQuery && matchesStatus;
  });

  const getStatusBadge = (status: PlatformOrganization['subscription_status']) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> Active
          </span>
        );
      case 'trial':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3 h-3" /> Trial
          </span>
        );
      case 'past_due':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3 h-3" /> Past Due
          </span>
        );
      case 'suspended':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <Ban className="w-3 h-3" /> Suspended
          </span>
        );
    }
  };

  const getTierBadge = (tier: PlatformOrganization['plan_tier']) => {
    switch (tier) {
      case 'enterprise':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">Enterprise</span>;
      case 'standard':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">Standard</span>;
      case 'starter':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">Starter</span>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-[10px] font-mono-code font-bold uppercase tracking-wider">
                Platform Owner Mode
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5" /> RLS Isolated
              </span>
            </div>
            <h1 className="text-2xl font-black font-heading tracking-tight text-white flex items-center gap-2.5">
              <FrostlyLogo size={28} iconOnly variant="blue" />
              <span>Platform Creator Console</span>
            </h1>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Global multi-tenant governance, interim manual subscription licensing (direct MoMo / bank transfer), seat quota management, and immutable audit logging.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              id="btn-platform-refresh"
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-all border border-white/10 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs transition-all cursor-pointer"
                title="Close Platform Console"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Console Navigation Tabs */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-white/10">
          <button
            id="tab-platform-tenants"
            onClick={() => setActiveSubTab('tenants')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'tenants'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/50'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Tenant Directory ({organizations.length})</span>
          </button>
          <button
            id="tab-platform-pricing"
            onClick={() => setActiveSubTab('pricing')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'pricing'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/50'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>Pricing &amp; Plans (Home Page)</span>
          </button>
          <button
            id="tab-platform-audit"
            onClick={() => setActiveSubTab('audit')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'audit'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/50'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Audit Trail ({auditLogs.length})</span>
          </button>
          <button
            id="tab-platform-security"
            onClick={() => setActiveSubTab('security')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'security'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/50'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>Security & Least Privilege</span>
          </button>
        </div>
      </div>

      {/* Success Notification Alert */}
      {actionSuccessMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between text-xs font-medium animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccessMessage}</span>
          </div>
          <button onClick={() => setActionSuccessMessage(null)} className="text-emerald-700 hover:text-emerald-900 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SUB-TAB 1: TENANTS DIRECTORY */}
      {activeSubTab === 'tenants' && (
        <div className="space-y-4">
          {/* Controls: Search & Filter */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="input-platform-search"
                type="text"
                placeholder="Search tenant by name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
              <span className="text-xs text-slate-400 font-medium whitespace-nowrap">Filter Status:</span>
              {(['all', 'active', 'trial', 'past_due', 'suspended'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    statusFilter === st
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  {st === 'all' ? 'All' : st.replace('_', ' ').toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Tenants Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3.5 px-4">Organization & Tenant</th>
                    <th className="py-3.5 px-4">Plan & Status</th>
                    <th className="py-3.5 px-4">Seats & Staff</th>
                    <th className="py-3.5 px-4">Billing & Expiration</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500 mb-2" />
                        <span>Loading platform tenants...</span>
                      </td>
                    </tr>
                  ) : filteredOrgs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        No organizations found matching the criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredOrgs.map((org) => {
                      const isSeatsWarning = org.staff_count >= org.max_staff_seats;
                      return (
                        <tr key={org.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900 text-sm">{org.name}</div>
                            <div className="text-[11px] text-slate-400 font-mono-code flex items-center gap-1 mt-0.5">
                              <span>ID: {org.id.substring(0, 13)}...</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              {getStatusBadge(org.subscription_status)}
                              {getTierBadge(org.plan_tier)}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5">
                              <Users className="w-3.5 h-3.5 text-slate-400" />
                              <span className={`font-bold font-mono-code ${isSeatsWarning ? 'text-amber-600' : 'text-slate-800'}`}>
                                {org.staff_count} / {org.max_staff_seats >= 9999 ? '∞' : org.max_staff_seats}
                              </span>
                              {org.pending_invites_count > 0 && (
                                <span className="text-[10px] text-slate-400">
                                  ({org.pending_invites_count} inv)
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="text-[11px] text-slate-600">
                              <span className="font-semibold uppercase text-slate-800">
                                {org.billing_provider} ({org.billing_currency})
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5 font-mono-code">
                              {org.subscription_status === 'trial' && org.trial_ends_at ? (
                                <span>Trial until {new Date(org.trial_ends_at).toLocaleDateString()}</span>
                              ) : org.current_period_ends_at ? (
                                <span>Renews {new Date(org.current_period_ends_at).toLocaleDateString()}</span>
                              ) : (
                                <span>No active cycle</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                id={`btn-manage-org-${org.id.substring(0, 8)}`}
                                onClick={() => handleOpenEditModal(org)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-all border border-indigo-200/70 cursor-pointer"
                                title="Manage Subscription & Quotas"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Manage</span>
                              </button>

                              {org.subscription_status === 'suspended' ? (
                                <button
                                  id={`btn-reinstate-org-${org.id.substring(0, 8)}`}
                                  onClick={() => handleOpenReinstateModal(org)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-all border border-emerald-200 cursor-pointer"
                                  title="Reinstate Operational Access"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  <span>Reinstate</span>
                                </button>
                              ) : (
                                <button
                                  id={`btn-revoke-org-${org.id.substring(0, 8)}`}
                                  onClick={() => handleOpenRevokeModal(org)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all border border-rose-200 cursor-pointer"
                                  title="Revoke / Suspend Access"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                  <span>Revoke</span>
                                </button>
                              )}

                              <button
                                id={`btn-delete-org-${org.id.substring(0, 8)}`}
                                onClick={() => handleOpenDeleteModal(org)}
                                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-700 text-xs font-bold transition-all border border-slate-200 hover:border-rose-200 cursor-pointer"
                                title="Delete / Deprovision Organization"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB: PRICING & PLANS (HOME PAGE) */}
      {activeSubTab === 'pricing' && (
        <PlatformPricingPlansManager />
      )}

      {/* SUB-TAB 2: AUDIT TRAIL */}
      {activeSubTab === 'audit' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-600" />
                Immutable Platform Operator Audit Trail
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Every manual subscription activation, seat change, and override is permanently recorded with before/after state diffs.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
              {auditLogs.length} Total Audit Records
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {auditLogs.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No audit entries recorded yet.
              </div>
            ) : (
              auditLogs.map((log) => {
                const targetOrg = organizations.find(o => o.id === log.target_organization_id);
                return (
                  <div key={log.id} className="py-4 space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono-code font-bold text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                            {log.action}
                          </span>
                          <span className="text-xs font-bold text-slate-900">
                            Target: {targetOrg ? targetOrg.name : log.target_organization_id || 'Global'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 italic">
                          "{log.reason}"
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[11px] text-slate-400 font-mono-code">
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                        <div className="text-[10px] text-slate-400">
                          By: {log.actor_id.substring(0, 18)}...
                        </div>
                      </div>
                    </div>

                    {/* Diff Viewer */}
                    {(log.previous_state || log.new_state) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 font-mono-code">
                        <div>
                          <span className="text-rose-700 font-bold">Previous State:</span>
                          <pre className="text-slate-600 mt-0.5 whitespace-pre-wrap overflow-x-auto text-[10px]">
                            {JSON.stringify(log.previous_state, null, 2)}
                          </pre>
                        </div>
                        <div>
                          <span className="text-emerald-700 font-bold">New State:</span>
                          <pre className="text-slate-600 mt-0.5 whitespace-pre-wrap overflow-x-auto text-[10px]">
                            {JSON.stringify(log.new_state, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: SECURITY & LEAST PRIVILEGE PROOF */}
      {activeSubTab === 'security' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs p-6 space-y-6">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              Security Architecture & Least-Privilege Isolation
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Architectural guarantees implemented in PostgreSQL Row-Level Security (RLS) as mandated by the Security Council.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                1
              </div>
              <h3 className="text-xs font-bold text-slate-900">Zero Ambient Operational Access</h3>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Platform admins do NOT have ambient SELECT permissions on tenant business data (<code className="text-indigo-600">customers</code>, <code className="text-indigo-600">inventory_batches</code>, <code className="text-indigo-600">financial_ledger</code>). Querying them returns 0 rows.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold text-xs">
                2
              </div>
              <h3 className="text-xs font-bold text-slate-900">Anti-Privilege Escalation</h3>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                The <code className="text-indigo-600">platform_admins</code> table has ZERO client-side INSERT/UPDATE policies. Users cannot self-promote to platform admin through the client API.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-xs">
                3
              </div>
              <h3 className="text-xs font-bold text-slate-900">Cryptographic Audit Immutability</h3>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Platform updates can only be executed through the <code className="text-indigo-600">platform_update_organization_subscription</code> SECURITY DEFINER RPC which mandates an audit log entry.
              </p>
            </div>
          </div>

          {/* Google SMTP Delivery Infrastructure Card */}
          <div className="p-5 rounded-2xl bg-indigo-50/50 border border-indigo-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-slate-900">Google SMTP Mail Delivery Relay</h3>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                    smtp.gmail.com:465 (SSL)
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed max-w-xl">
                  Tenant verification emails and critical cold-chain alerts use Google SMTP instead of third-party platforms like Resend. Configure your Google Workspace or Gmail App Password for authenticated delivery.
                </p>
              </div>
            </div>
            <button
              id="btn-open-google-smtp-diagnostics"
              type="button"
              onClick={() => setShowSmtpModal(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer shrink-0 flex items-center gap-1.5"
            >
              <Server className="w-3.5 h-3.5" />
              <span>Google SMTP Diagnostic &amp; Test</span>
            </button>
          </div>
        </div>
      )}

      {/* EDIT SUBSCRIPTION MODAL */}
      {selectedOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Manage Subscription & Quotas
                </h3>
                <p className="text-xs text-slate-500">{selectedOrg.name}</p>
              </div>
              <button
                onClick={() => setSelectedOrg(null)}
                className="p-1.5 rounded-xl hover:bg-slate-200 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleApplySubscriptionUpdate} className="p-5 space-y-4">
              {actionErrorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                  {actionErrorMessage}
                </div>
              )}

              {/* Status Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Subscription Status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['active', 'trial', 'past_due', 'suspended'] as const).map((status) => (
                    <button
                      type="button"
                      key={status}
                      onClick={() => setEditStatus(status)}
                      className={`p-2.5 rounded-xl text-xs font-bold text-left border transition-all cursor-pointer ${
                        editStatus === status
                          ? 'border-indigo-600 bg-indigo-50/60 text-indigo-900 shadow-2xs'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      {status === 'active' && 'Active (Paid / Verified)'}
                      {status === 'trial' && 'Trial (14 Days)'}
                      {status === 'past_due' && 'Past Due (Grace)'}
                      {status === 'suspended' && 'Suspended (Locked)'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Plan Tier Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Plan Tier
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['starter', 'standard', 'enterprise'] as const).map((tier) => (
                    <button
                      type="button"
                      key={tier}
                      onClick={() => {
                        setEditPlanTier(tier);
                        if (tier === 'starter') setEditMaxSeats(5);
                        else if (tier === 'standard') setEditMaxSeats(20);
                        else if (tier === 'enterprise') setEditMaxSeats(9999);
                      }}
                      className={`p-2.5 rounded-xl text-xs font-bold text-center border capitalize transition-all cursor-pointer ${
                        editPlanTier === tier
                          ? 'border-indigo-600 bg-indigo-600 text-white shadow-2xs'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      {tier}
                    </button>
                  ))}
                </div>
              </div>

              {/* Staff Seats */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Maximum Staff Seats Quota
                </label>
                <input
                  id="input-edit-seats"
                  type="number"
                  min="1"
                  max="9999"
                  value={editMaxSeats}
                  onChange={(e) => setEditMaxSeats(parseInt(e.target.value) || 5)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Current active staff in org: {selectedOrg.staff_count}
                </span>
              </div>

              {/* Trial Extension */}
              {editStatus === 'trial' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Extend Trial By
                  </label>
                  <div className="flex gap-2">
                    {[0, 7, 14, 30].map((days) => (
                      <button
                        type="button"
                        key={days}
                        onClick={() => setEditTrialDaysExtension(days)}
                        className={`flex-1 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                          editTrialDaysExtension === days
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {days === 0 ? 'No change' : `+${days} days`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Mandatory Audit Reason */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Compliance Audit Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  id="input-edit-reason"
                  required
                  rows={2}
                  placeholder="e.g. Received direct MoMo transfer of GH₵3,800 from MD for Standard Tier renewal"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none placeholder:text-slate-400"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const org = selectedOrg;
                      setSelectedOrg(null);
                      handleOpenRevokeModal(org);
                    }}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                  >
                    {selectedOrg.subscription_status === 'suspended' ? 'Reinstate Access...' : 'Revoke Access...'}
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => {
                      const org = selectedOrg;
                      setSelectedOrg(null);
                      handleOpenDeleteModal(org);
                    }}
                    className="text-[11px] font-bold text-slate-500 hover:text-rose-600 hover:underline cursor-pointer"
                  >
                    Delete Organization...
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedOrg(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    id="btn-confirm-subscription-update"
                    type="submit"
                    disabled={submitting || !editReason.trim()}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md shadow-indigo-200 cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? 'Applying...' : 'Apply & Commit Audit'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REVOKE / REINSTATE TENANT ACCESS MODAL */}
      {revokeTargetOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden">
            <div className={`p-5 border-b flex items-center justify-between ${
              revokeActionType === 'revoke' ? 'bg-rose-50/70 border-rose-100' : 'bg-emerald-50/70 border-emerald-100'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                  revokeActionType === 'revoke' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {revokeActionType === 'revoke' ? <Ban className="w-5 h-5" /> : <RotateCcw className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {revokeActionType === 'revoke' ? 'Revoke Tenant Access' : 'Reinstate Tenant Access'}
                  </h3>
                  <p className="text-xs text-slate-500">{revokeTargetOrg.name}</p>
                </div>
              </div>
              <button
                onClick={() => setRevokeTargetOrg(null)}
                className="p-1.5 rounded-xl hover:bg-slate-200 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmRevokeReinstate} className="p-5 space-y-4">
              {revokeError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                  {revokeError}
                </div>
              )}

              {revokeActionType === 'revoke' ? (
                <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200/80 text-rose-900 text-xs space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-rose-800">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Operational Lockout Warning</span>
                  </div>
                  <p className="leading-relaxed text-rose-700">
                    Revoking tenant access will immediately switch subscription status to <strong>Suspended</strong>. All active staff member accounts for <strong>{revokeTargetOrg.name}</strong> will be locked out from write operations, pending invites will be invalidated, and POS/order entry will be paused.
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 text-emerald-900 text-xs space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Restore Operational Capabilities</span>
                  </div>
                  <p className="leading-relaxed text-emerald-700">
                    Reinstating access will unlock staff login and restore full operational capabilities for <strong>{revokeTargetOrg.name}</strong>.
                  </p>
                </div>
              )}

              {/* Status Option for Reinstate */}
              {revokeActionType === 'reinstate' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Target Subscription Status
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['active', 'trial'] as const).map((status) => (
                      <button
                        type="button"
                        key={status}
                        onClick={() => setReinstateStatus(status)}
                        className={`p-2.5 rounded-xl text-xs font-bold text-left border transition-all cursor-pointer ${
                          reinstateStatus === status
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-2xs'
                            : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        {status === 'active' ? 'Active (Verified Subscription)' : 'Trial (Evaluation Mode)'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Mandatory Audit Reason */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Compliance Audit Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  id="input-revoke-reason"
                  required
                  rows={2}
                  placeholder={revokeActionType === 'revoke' 
                    ? 'e.g. Terms of Service violation, non-payment after grace period, or customer account deactivation request'
                    : 'e.g. Account settlement confirmed via bank transfer; access restored'}
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none placeholder:text-slate-400"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRevokeTargetOrg(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-confirm-revoke-reinstate"
                  type="submit"
                  disabled={isRevoking || !revokeReason.trim()}
                  className={`px-4 py-2 rounded-xl text-white text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50 ${
                    revokeActionType === 'revoke'
                      ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'
                      : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
                  }`}
                >
                  {isRevoking ? 'Processing...' : revokeActionType === 'revoke' ? 'Revoke Tenant Access' : 'Reinstate Tenant Access'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE / DEPROVISION ORGANIZATION MODAL */}
      {deleteTargetOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="p-5 border-b border-rose-100 bg-rose-50/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                  <AlertOctagon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-rose-950">
                    Permanently Delete Organization
                  </h3>
                  <p className="text-xs text-rose-700">{deleteTargetOrg.name}</p>
                </div>
              </div>
              <button
                onClick={() => setDeleteTargetOrg(null)}
                className="p-1.5 rounded-xl hover:bg-rose-100 text-rose-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmDelete} className="p-5 space-y-4">
              {deleteError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                  {deleteError}
                </div>
              )}

              <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200/80 text-rose-900 text-xs space-y-2">
                <div className="font-bold text-rose-800 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>Irreversible Deprovisioning</span>
                </div>
                <p className="leading-relaxed text-rose-700">
                  This action is <strong>permanent and cannot be undone</strong>. Deleting <strong>{deleteTargetOrg.name}</strong> will purge:
                </p>
                <ul className="list-disc list-inside space-y-1 text-rose-800 font-medium pl-1">
                  <li>Organization tenant master record (<code className="text-[10px] font-mono-code">{deleteTargetOrg.id}</code>)</li>
                  <li>All associated staff profiles ({deleteTargetOrg.staff_count} registered users)</li>
                  <li>Pending invitations ({deleteTargetOrg.pending_invites_count} invites)</li>
                  <li>Organization settings and business parameters</li>
                </ul>
                <p className="text-[11px] text-rose-600 pt-1">
                  A permanent audit log entry will be created recording who authorized this deletion and why.
                </p>
              </div>

              {/* Confirmation Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Type <span className="text-rose-600 font-mono-code select-all">"{deleteTargetOrg.name}"</span> to confirm:
                </label>
                <input
                  id="input-confirm-org-name"
                  type="text"
                  required
                  placeholder={deleteTargetOrg.name}
                  value={deleteConfirmName}
                  onChange={(e) => setDeleteConfirmName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-rose-500 focus:outline-none placeholder:text-slate-300 font-medium"
                />
              </div>

              {/* Mandatory Audit Reason */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Deprovisioning Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  id="input-delete-reason"
                  required
                  rows={2}
                  placeholder="e.g. Formal written contract termination received from tenant ownership"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-rose-500 focus:outline-none placeholder:text-slate-400"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteTargetOrg(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-confirm-delete-org"
                  type="submit"
                  disabled={
                    isDeleting || 
                    !deleteReason.trim() || 
                    deleteConfirmName.trim().toLowerCase() !== deleteTargetOrg.name.trim().toLowerCase()
                  }
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-md shadow-rose-200 cursor-pointer disabled:opacity-40"
                >
                  {isDeleting ? 'Deleting...' : 'Permanently Delete Organization'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Google SMTP Setup & Diagnostic Modal */}
      <GoogleSmtpModal
        isOpen={showSmtpModal}
        onClose={() => setShowSmtpModal(false)}
      />
    </div>
  );
};
