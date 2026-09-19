import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Mail,
  Key,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  Search,
  Warehouse,
  Truck,
  DollarSign,
  Eye,
  Sliders,
  Sparkles,
  Lock,
  Clock,
  ArrowUpRight,
  UserX,
  UserCheck,
} from 'lucide-react';
import {
  WorkspaceWorker,
  WorkspacePendingInvite,
  listWorkspaceWorkers,
  updateWorkspaceWorker,
  removeWorkerOrInvite,
  resetWorkerPassword,
  StaffProfile,
} from '../data/auth';
import { AddWorkerModal } from './AddWorkerModal';

interface WorkersManagementTabProps {
  staffProfile: StaffProfile | null;
  onNavigateToSubscription?: () => void;
}

export const WorkersManagementTab: React.FC<WorkersManagementTabProps> = ({
  staffProfile,
  onNavigateToSubscription,
}) => {
  const organizationId = staffProfile?.organization_id || 'default-org';
  const organizationName = staffProfile?.org_name || 'Frostly Seafood';
  const isTenantAdmin = staffProfile?.role === 'admin';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workers, setWorkers] = useState<WorkspaceWorker[]>([]);
  const [pendingInvites, setPendingInvites] = useState<WorkspacePendingInvite[]>([]);
  const [seats, setSeats] = useState({
    used: 0,
    max: 5,
    available: 5,
    activeWorkers: 0,
    pendingInvites: 0,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [isAddWorkerOpen, setIsAddWorkerOpen] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Password reset modal state
  const [resetTargetWorker, setResetTargetWorker] = useState<WorkspaceWorker | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Role edit modal state
  const [editTargetWorker, setEditTargetWorker] = useState<WorkspaceWorker | null>(null);
  const [editRole, setEditRole] = useState<'admin' | 'ops_staff' | 'sales_staff' | 'dispatch_staff' | 'viewer'>('ops_staff');
  const [editDepartment, setEditDepartment] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Copy state
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const loadWorkers = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await listWorkspaceWorkers(organizationId);
      if (res.success) {
        setWorkers(res.workers);
        setPendingInvites(res.pendingInvites);
        setSeats(res.seats);
      } else {
        setErrorMessage(res.error || 'Failed to fetch workers for this workspace.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error fetching worker list.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadWorkers();
  }, [organizationId]);

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(id);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  const handleToggleWorkerStatus = async (worker: WorkspaceWorker) => {
    const nextStatus = !worker.is_active;
    try {
      const res = await updateWorkspaceWorker(worker.id, organizationId, {
        is_active: nextStatus,
      });
      if (res.success) {
        setWorkers((prev) =>
          prev.map((w) => (w.id === worker.id ? { ...w, is_active: nextStatus } : w))
        );
        setActionSuccessMessage(
          `Worker ${worker.full_name} has been ${nextStatus ? 'reactivated' : 'suspended'}.`
        );
        setTimeout(() => setActionSuccessMessage(null), 3000);
      } else {
        setErrorMessage(res.error || 'Failed to update worker status.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to change worker status.');
    }
  };

  const handleRemoveWorker = async (id: string, name: string, isInvite = false) => {
    if (
      !window.confirm(
        isInvite
          ? `Revoke pending invitation for ${name}?`
          : `Are you sure you want to remove worker ${name} from this workspace?`
      )
    ) {
      return;
    }

    try {
      const res = await removeWorkerOrInvite(id, organizationId, isInvite);
      if (res.success) {
        if (isInvite) {
          setPendingInvites((prev) => prev.filter((i) => i.id !== id));
          setActionSuccessMessage(`Invitation for ${name} revoked.`);
        } else {
          setWorkers((prev) => prev.filter((w) => w.id !== id));
          setActionSuccessMessage(`Worker ${name} removed from tenant workspace.`);
        }
        setTimeout(() => setActionSuccessMessage(null), 3000);
        // Refresh seats count
        loadWorkers(true);
      } else {
        setErrorMessage(res.error || 'Failed to remove worker.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error executing removal.');
    }
  };

  const handleSaveRoleEdit = async () => {
    if (!editTargetWorker) return;
    setIsSavingEdit(true);
    try {
      const res = await updateWorkspaceWorker(editTargetWorker.id, organizationId, {
        role: editRole,
        department: editDepartment.trim(),
      });
      if (res.success) {
        setWorkers((prev) =>
          prev.map((w) =>
            w.id === editTargetWorker.id
              ? { ...w, role: editRole, department: editDepartment.trim() }
              : w
          )
        );
        setActionSuccessMessage(`Updated profile and role for ${editTargetWorker.full_name}.`);
        setTimeout(() => setActionSuccessMessage(null), 3000);
        setEditTargetWorker(null);
      } else {
        setErrorMessage(res.error || 'Failed to update role.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error updating worker role.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleExecutePasswordReset = async () => {
    if (!resetTargetWorker || !newPassword || newPassword.length < 6) {
      setErrorMessage('New password must be at least 6 characters.');
      return;
    }

    setIsResettingPassword(true);
    try {
      const res = await resetWorkerPassword(
        resetTargetWorker.id,
        resetTargetWorker.email,
        newPassword,
        organizationName
      );
      if (res.success) {
        setActionSuccessMessage(
          `Password reset for ${resetTargetWorker.full_name}. Notification dispatched if SMTP configured.`
        );
        setTimeout(() => setActionSuccessMessage(null), 3500);
        setResetTargetWorker(null);
        setNewPassword('');
      } else {
        setErrorMessage(res.error || 'Failed to reset password.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error resetting password.');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const filteredWorkers = useMemo(() => {
    return workers.filter((w) => {
      const matchesSearch =
        w.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.department.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === 'all' || w.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [workers, searchQuery, roleFilter]);

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return {
          label: 'Administrator',
          bg: 'bg-purple-100 text-purple-800 border-purple-200',
          icon: Shield,
        };
      case 'ops_staff':
        return {
          label: 'Operations & Storage',
          bg: 'bg-blue-100 text-blue-800 border-blue-200',
          icon: Warehouse,
        };
      case 'dispatch_staff':
        return {
          label: 'Dispatch & Logistics',
          bg: 'bg-cyan-100 text-cyan-800 border-cyan-200',
          icon: Truck,
        };
      case 'sales_staff':
        return {
          label: 'Wholesale & POS',
          bg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          icon: DollarSign,
        };
      case 'viewer':
        return {
          label: 'HACCP Auditor',
          bg: 'bg-amber-100 text-amber-800 border-amber-200',
          icon: Eye,
        };
      default:
        return {
          label: role,
          bg: 'bg-slate-100 text-slate-800 border-slate-200',
          icon: Users,
        };
    }
  };

  const seatUsagePercent = Math.min(100, Math.round((seats.used / Math.max(1, seats.max)) * 100));

  return (
    <div id="workers-management-tab" className="space-y-6">
      {/* Toast Feedback */}
      {actionSuccessMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs text-emerald-800 animate-fade-in shadow-sm">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{actionSuccessMessage}</span>
          </div>
          <button
            onClick={() => setActionSuccessMessage(null)}
            className="text-emerald-600 hover:text-emerald-800 font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between text-xs text-rose-800 animate-fade-in shadow-sm">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-semibold">{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-600 hover:text-rose-800 font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Banner: Seat Capacity & Add Worker Action */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[11px] font-bold uppercase tracking-wider">
                Tenant Workforce & Access
              </span>
              <span className="text-xs text-slate-400 font-medium">Org: {organizationName}</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight">Workers & Team Access</h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Add facility workers, cold-chain technicians, dispatch drivers, and sales personnel. Every worker
              receives a dedicated role with strict Row-Level Security (RLS) isolation within your workspace.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              id="refresh-workers-btn"
              onClick={() => loadWorkers(true)}
              disabled={refreshing}
              className="flex items-center justify-center space-x-2 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-xl transition-all"
              title="Refresh workers"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            {isTenantAdmin && (
              <button
                id="open-add-worker-modal-btn"
                onClick={() => setIsAddWorkerOpen(true)}
                className="flex items-center justify-center space-x-2 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-lg shadow-blue-600/30 transition-all transform active:scale-95"
              >
                <UserPlus className="w-4 h-4" />
                <span>Add Worker to Workspace</span>
              </button>
            )}
          </div>
        </div>

        {/* Seat Allocation Bar */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div className="space-y-1.5 md:col-span-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">
                Workspace Seat Allocation ({seats.used} of {seats.max} seats occupied)
              </span>
              <span className="text-slate-400 font-bold">{seats.available} Available</span>
            </div>
            <div className="w-full h-2.5 bg-slate-700/60 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  seatUsagePercent >= 100
                    ? 'bg-rose-500'
                    : seatUsagePercent >= 80
                    ? 'bg-amber-500'
                    : 'bg-blue-500'
                }`}
                style={{ width: `${seatUsagePercent}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 text-xs">
            {onNavigateToSubscription && (
              <button
                id="upgrade-seats-link"
                onClick={onNavigateToSubscription}
                className="flex items-center space-x-1 text-blue-400 hover:text-blue-300 font-semibold transition-colors"
              >
                <span>Upgrade Seat Tier</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
          <input
            id="search-workers-input"
            type="text"
            placeholder="Search workers by name, email, bay..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center space-x-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'All Roles' },
            { id: 'ops_staff', label: 'Operations' },
            { id: 'dispatch_staff', label: 'Logistics' },
            { id: 'sales_staff', label: 'Sales' },
            { id: 'admin', label: 'Admin' },
            { id: 'viewer', label: 'Auditor' },
          ].map((rf) => (
            <button
              key={rf.id}
              id={`filter-role-${rf.id}`}
              onClick={() => setRoleFilter(rf.id)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                roleFilter === rf.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {rf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Workers Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-900">Enrolled Workspace Workers</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-bold">
              {filteredWorkers.length}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-medium">Loading workspace personnel...</p>
          </div>
        ) : filteredWorkers.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <Users className="w-6 h-6" />
            </div>
            <div className="max-w-xs mx-auto">
              <h4 className="text-sm font-bold text-slate-800">No workers match your filter</h4>
              <p className="text-xs text-slate-500 mt-1">
                {searchQuery
                  ? 'Try adjusting your search terms.'
                  : 'Start adding cold storage operators, drivers, and sales personnel.'}
              </p>
            </div>
            {isTenantAdmin && (
              <button
                onClick={() => setIsAddWorkerOpen(true)}
                className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add First Worker</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-6">Worker</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Department / Bay</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredWorkers.map((worker) => {
                  const roleBadge = getRoleBadge(worker.role);
                  const RoleIcon = roleBadge.icon;
                  const isCurrentLoggedUser = staffProfile?.email?.toLowerCase() === worker.email?.toLowerCase();

                  return (
                    <tr
                      key={worker.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        !worker.is_active ? 'opacity-60 bg-slate-50/40' : ''
                      }`}
                    >
                      {/* Name & Email */}
                      <td className="py-3.5 px-6">
                        <div className="flex items-center space-x-3">
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs uppercase shadow-xs shrink-0 ${
                              worker.is_active
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {worker.full_name?.slice(0, 2) || worker.email?.slice(0, 2)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                              <span>{worker.full_name}</span>
                              {isCurrentLoggedUser && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 font-semibold">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">{worker.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full border text-[11px] font-semibold ${roleBadge.bg}`}
                        >
                          <RoleIcon className="w-3 h-3" />
                          <span>{roleBadge.label}</span>
                        </span>
                      </td>

                      {/* Department */}
                      <td className="py-3.5 px-4">
                        <span className="text-slate-700 font-medium">{worker.department || 'Operations'}</span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {worker.is_active ? (
                          <span className="inline-flex items-center space-x-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md font-semibold text-[11px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md font-semibold text-[11px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            <span>Suspended</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-6 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {isTenantAdmin && (
                            <>
                              {/* Edit Role & Bay */}
                              <button
                                id={`edit-worker-${worker.id}-btn`}
                                onClick={() => {
                                  setEditTargetWorker(worker);
                                  setEditRole(worker.role);
                                  setEditDepartment(worker.department || 'Operations');
                                }}
                                title="Edit worker role or department"
                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              >
                                <Sliders className="w-3.5 h-3.5" />
                              </button>

                              {/* Reset Password */}
                              <button
                                id={`reset-worker-${worker.id}-pwd-btn`}
                                onClick={() => {
                                  setResetTargetWorker(worker);
                                  setNewPassword('');
                                }}
                                title="Reset worker password"
                                className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                              >
                                <Key className="w-3.5 h-3.5" />
                              </button>

                              {/* Suspend / Reactivate */}
                              {!isCurrentLoggedUser && (
                                <button
                                  id={`toggle-worker-${worker.id}-status-btn`}
                                  onClick={() => handleToggleWorkerStatus(worker)}
                                  title={worker.is_active ? 'Suspend worker' : 'Reactivate worker'}
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    worker.is_active
                                      ? 'text-slate-500 hover:text-amber-600 hover:bg-amber-50'
                                      : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'
                                  }`}
                                >
                                  {worker.is_active ? (
                                    <UserX className="w-3.5 h-3.5" />
                                  ) : (
                                    <UserCheck className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              )}

                              {/* Delete Worker */}
                              {!isCurrentLoggedUser && (
                                <button
                                  id={`delete-worker-${worker.id}-btn`}
                                  onClick={() => handleRemoveWorker(worker.id, worker.full_name)}
                                  title="Remove from workspace"
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pending Invitations Section */}
      {pendingInvites.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-amber-50/40">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-bold text-slate-900">Pending Worker Invitations</h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                {pendingInvites.length}
              </span>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {pendingInvites.map((invite) => {
              const roleBadge = getRoleBadge(invite.role);
              const inviteLink = `${window.location.origin}?token=${encodeURIComponent(invite.token)}&email=${encodeURIComponent(invite.email)}`;
              const isCopied = copiedToken === invite.id;

              return (
                <div
                  key={invite.id}
                  className="px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-bold text-slate-900 text-xs">{invite.email}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${roleBadge.bg}`}>
                        {roleBadge.label}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center space-x-3">
                      <span>Expires: {new Date(invite.expires_at).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>Code: <code className="font-mono text-slate-700">{invite.token.slice(0, 10)}...</code></span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      id={`copy-invite-${invite.id}-btn`}
                      onClick={() => handleCopyText(inviteLink, invite.id)}
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-colors"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-600">Copied Link</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Link</span>
                        </>
                      )}
                    </button>

                    {isTenantAdmin && (
                      <button
                        id={`revoke-invite-${invite.id}-btn`}
                        onClick={() => handleRemoveWorker(invite.id, invite.email, true)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Revoke invitation"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Role Permission Matrix Card */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center space-x-1.5">
          <Shield className="w-4 h-4 text-blue-600" />
          <span>Role Capabilities Matrix</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-1.5">
            <div className="font-bold text-blue-900 flex items-center space-x-1.5">
              <Warehouse className="w-4 h-4 text-blue-600" />
              <span>Operations & Cold Storage</span>
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Create catch batches, record refrigeration temperatures, conduct stock takes, generate QR asset tags.
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-1.5">
            <div className="font-bold text-cyan-900 flex items-center space-x-1.5">
              <Truck className="w-4 h-4 text-cyan-600" />
              <span>Dispatch & Logistics</span>
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Manage refrigerated transport fleets, reefer temperature manifests, dispatch packing slips, driver sign-offs.
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-1.5">
            <div className="font-bold text-purple-900 flex items-center space-x-1.5">
              <Shield className="w-4 h-4 text-purple-600" />
              <span>Facility Administrator</span>
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Add/remove workers, assign passwords, configure Cold Chain limits, upgrade licensing, full billing access.
            </p>
          </div>
        </div>
      </div>

      {/* Edit Role Modal */}
      {editTargetWorker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-sm font-bold text-slate-900">
                Edit Worker: {editTargetWorker.full_name}
              </h4>
              <button
                onClick={() => setEditTargetWorker(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Role Assignment</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as any)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ops_staff">Operations Staff / Cold Storage</option>
                  <option value="dispatch_staff">Dispatch & Reefer Logistics</option>
                  <option value="sales_staff">Wholesale & POS Sales</option>
                  <option value="admin">Facility Administrator</option>
                  <option value="viewer">HACCP Compliance Auditor</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Facility Department / Bay</label>
                <input
                  type="text"
                  value={editDepartment}
                  onChange={(e) => setEditDepartment(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setEditTargetWorker(null)}
                className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRoleEdit}
                disabled={isSavingEdit}
                className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
              >
                {isSavingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetTargetWorker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Key className="w-4 h-4 text-amber-600" />
                <h4 className="text-sm font-bold text-slate-900">
                  Reset Password for {resetTargetWorker.full_name}
                </h4>
              </div>
              <button
                onClick={() => setResetTargetWorker(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-500">
                Enter a new temporary password for <code className="font-mono text-slate-800">{resetTargetWorker.email}</code>.
              </p>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-700">New Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
                      let gen = '';
                      for (let i = 0; i < 10; i++) gen += chars.charAt(Math.floor(Math.random() * chars.length));
                      setNewPassword(gen);
                    }}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800"
                  >
                    Generate Strong Password
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="e.g. Frost#New2026"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full p-2.5 font-mono bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setResetTargetWorker(null)}
                className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleExecutePasswordReset}
                disabled={isResettingPassword || !newPassword}
                className="px-4 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm"
              >
                {isResettingPassword ? 'Updating...' : 'Set New Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Worker Modal */}
      <AddWorkerModal
        isOpen={isAddWorkerOpen}
        onClose={() => setIsAddWorkerOpen(false)}
        organizationId={organizationId}
        organizationName={organizationName}
        maxSeats={seats.max}
        usedSeats={seats.used}
        onWorkerAdded={(newWorker, newInvite) => {
          if (newWorker) {
            setWorkers((prev) => [newWorker, ...prev]);
          }
          if (newInvite) {
            setPendingInvites((prev) => [newInvite, ...prev]);
          }
          loadWorkers(true);
        }}
      />
    </div>
  );
};
