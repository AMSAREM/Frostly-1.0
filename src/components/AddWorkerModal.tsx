import React, { useState } from 'react';
import {
  X,
  UserPlus,
  Mail,
  User,
  Shield,
  Key,
  Building,
  CheckCircle2,
  Copy,
  Check,
  AlertCircle,
  Sparkles,
  Lock,
  Send,
  Warehouse,
  Truck,
  DollarSign,
  Eye,
} from 'lucide-react';
import { addWorkerToWorkspace, WorkspaceWorker, WorkspacePendingInvite } from '../data/auth';

interface AddWorkerModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
  organizationName: string;
  maxSeats: number;
  usedSeats: number;
  onWorkerAdded: (worker?: WorkspaceWorker, invite?: WorkspacePendingInvite) => void;
}

type ProvisioningMode = 'direct_password' | 'invite_link';

export const AddWorkerModal: React.FC<AddWorkerModalProps> = ({
  isOpen,
  onClose,
  organizationId,
  organizationName,
  maxSeats,
  usedSeats,
  onWorkerAdded,
}) => {
  const [mode, setMode] = useState<ProvisioningMode>('direct_password');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'ops_staff' | 'sales_staff' | 'dispatch_staff' | 'viewer'>('ops_staff');
  const [department, setDepartment] = useState('Cold Storage Bay #1');
  const [password, setPassword] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Success state
  const [result, setResult] = useState<{
    success: boolean;
    mode?: string;
    message?: string;
    credentials?: { email: string; password?: string; role: string };
    inviteToken?: string;
    inviteAcceptUrl?: string;
  } | null>(null);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const seatsAvailable = Math.max(0, maxSeats - usedSeats);
  const isSeatLimitReached = seatsAvailable <= 0;

  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let generated = '';
    for (let i = 0; i < 10; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(generated);
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !email.includes('@')) {
      setError('Please provide a valid worker email address.');
      return;
    }

    if (mode === 'direct_password' && (!password || password.length < 6)) {
      setError('Please assign an initial password of at least 6 characters for direct account creation.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        organizationId,
        email: email.trim(),
        fullName: fullName.trim() || email.split('@')[0],
        role,
        department: department.trim() || 'Operations',
        password: mode === 'direct_password' ? password : undefined,
        sendEmail,
      };

      const res = await addWorkerToWorkspace(payload);

      if (!res.success) {
        setError(res.error || 'Failed to add worker to tenant workspace.');
        setLoading(false);
        return;
      }

      setResult({
        success: true,
        mode: res.mode,
        message: res.message,
        credentials: res.credentials,
        inviteToken: res.inviteToken,
        inviteAcceptUrl: res.inviteAcceptUrl,
      });

      onWorkerAdded(res.worker, res.invite);
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred while adding the worker.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetForm = () => {
    setResult(null);
    setFullName('');
    setEmail('');
    setPassword('');
    setRole('ops_staff');
    setDepartment('Cold Storage Bay #1');
    setError(null);
  };

  const rolesConfig = [
    {
      id: 'ops_staff',
      name: 'Operations / Cold Store Worker',
      desc: 'Log catch batches, record refrigeration temperatures, scan QR barcodes, manage warehouse racks.',
      icon: Warehouse,
      color: 'border-blue-500 bg-blue-50/50 text-blue-900',
      badge: 'bg-blue-100 text-blue-800',
    },
    {
      id: 'dispatch_staff',
      name: 'Dispatch & Reefer Logistics',
      desc: 'Assign cold-chain delivery runs, reefer temperature manifests, driver route confirmations.',
      icon: Truck,
      color: 'border-cyan-500 bg-cyan-50/50 text-cyan-900',
      badge: 'bg-cyan-100 text-cyan-800',
    },
    {
      id: 'sales_staff',
      name: 'Wholesale & POS Sales',
      desc: 'Issue sales orders, manage customer accounts, wholesale pricing, invoice receipts.',
      icon: DollarSign,
      color: 'border-emerald-500 bg-emerald-50/50 text-emerald-900',
      badge: 'bg-emerald-100 text-emerald-800',
    },
    {
      id: 'admin',
      name: 'Facility Administrator',
      desc: 'Full administrative control over facility settings, inventory, subscriptions, and team workers.',
      icon: Shield,
      color: 'border-purple-500 bg-purple-50/50 text-purple-900',
      badge: 'bg-purple-100 text-purple-800',
    },
    {
      id: 'viewer',
      name: 'Compliance & HACCP Auditor',
      desc: 'Read-only access to cold-chain audit trails, batch pedigree, temperature charts, and inspection logs.',
      icon: Eye,
      color: 'border-amber-500 bg-amber-50/50 text-amber-900',
      badge: 'bg-amber-100 text-amber-800',
    },
  ];

  return (
    <div
      id="add-worker-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="add-worker-modal-container"
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/20">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Add Worker to Workspace</h2>
              <p className="text-xs text-slate-500 font-medium">
                Tenant: <span className="text-slate-800 font-semibold">{organizationName}</span> • Seats:{' '}
                <span className={seatsAvailable > 0 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                  {usedSeats} / {maxSeats} Used
                </span>
              </p>
            </div>
          </div>
          <button
            id="close-add-worker-modal-button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Seat Limit Warning */}
        {isSeatLimitReached && !result && (
          <div className="mx-6 mt-6 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800">
              <p className="font-bold">Workspace Seat Limit Reached ({maxSeats}/{maxSeats})</p>
              <p className="mt-0.5">
                All staff seats for your current subscription plan are allocated. Please upgrade your tier in the
                Subscription tab or deactivate an existing worker before adding more team members.
              </p>
            </div>
          </div>
        )}

        {/* Success View */}
        {result ? (
          <div className="p-6 space-y-6">
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-5 flex items-start space-x-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-bold text-emerald-900">
                  {result.mode === 'direct_provisioned'
                    ? 'Worker Account Created & Provisioned'
                    : 'Workspace Invitation Issued'}
                </h3>
                <p className="text-xs text-emerald-700 mt-1">
                  {result.message ||
                    `User ${email} has been added to the ${organizationName} tenant workspace.`}
                </p>
              </div>
            </div>

            {result.credentials && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Worker Login Credentials
                  </span>
                  <button
                    id="copy-all-credentials-btn"
                    onClick={() =>
                      handleCopy(
                        `Workspace: ${organizationName}\nEmail: ${result.credentials?.email}\nPassword: ${result.credentials?.password}\nRole: ${result.credentials?.role}`,
                        'all'
                      )
                    }
                    className="flex items-center space-x-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    {copiedKey === 'all' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-600">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy All</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-lg text-xs">
                    <span className="text-slate-500 font-medium">Worker Email:</span>
                    <div className="flex items-center space-x-2">
                      <code className="font-mono font-bold text-slate-800">{result.credentials.email}</code>
                      <button
                        onClick={() => handleCopy(result.credentials!.email, 'email')}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        {copiedKey === 'email' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-lg text-xs">
                    <span className="text-slate-500 font-medium">Temporary Password:</span>
                    <div className="flex items-center space-x-2">
                      <code className="font-mono font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
                        {result.credentials.password}
                      </code>
                      <button
                        onClick={() => handleCopy(result.credentials!.password || '', 'pwd')}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        {copiedKey === 'pwd' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-lg text-xs">
                    <span className="text-slate-500 font-medium">Assigned Role:</span>
                    <span className="font-semibold text-slate-800">{result.credentials.role}</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500">
                  The worker can sign in immediately at this URL using these credentials. If Google SMTP is configured,
                  an email notification was automatically dispatched to the worker.
                </p>
              </div>
            )}

            {result.inviteAcceptUrl && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Invitation Share Link
                  </span>
                  <button
                    onClick={() => handleCopy(result.inviteAcceptUrl || '', 'invite_link')}
                    className="flex items-center space-x-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800"
                  >
                    {copiedKey === 'invite_link' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-600">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded-lg text-xs font-mono break-all text-slate-700">
                  {result.inviteAcceptUrl}
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Invite Token: <code className="font-mono font-bold text-slate-700">{result.inviteToken}</code></span>
                  <span>Expires in 7 days</span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                id="add-another-worker-button"
                onClick={handleResetForm}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Add Another Worker
              </button>
              <button
                id="done-add-worker-button"
                onClick={onClose}
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Form View */
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start space-x-2.5 text-xs text-rose-800">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="font-medium">{error}</div>
              </div>
            )}

            {/* Provisioning Mode Toggle */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Enrollment Method
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  id="mode-direct-password-btn"
                  onClick={() => setMode('direct_password')}
                  className={`flex items-center space-x-3 p-3.5 rounded-xl border text-left transition-all ${
                    mode === 'direct_password'
                      ? 'border-blue-600 bg-blue-50/60 shadow-sm ring-1 ring-blue-500/30'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      mode === 'direct_password' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">Direct Provisioning</div>
                    <div className="text-[11px] text-slate-500">Set initial password; worker can log in right away</div>
                  </div>
                </button>

                <button
                  type="button"
                  id="mode-invite-link-btn"
                  onClick={() => setMode('invite_link')}
                  className={`flex items-center space-x-3 p-3.5 rounded-xl border text-left transition-all ${
                    mode === 'invite_link'
                      ? 'border-blue-600 bg-blue-50/60 shadow-sm ring-1 ring-blue-500/30'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      mode === 'invite_link' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <Send className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">Send Invite Link</div>
                    <div className="text-[11px] text-slate-500">Sends 7-day invite code; worker sets own password</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Worker Full Name</span>
                </label>
                <input
                  id="worker-full-name-input"
                  type="text"
                  placeholder="e.g. Kwame Mensah"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-900 placeholder:text-slate-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>Worker Business Email *</span>
                </label>
                <input
                  id="worker-email-input"
                  type="email"
                  required
                  placeholder="e.g. worker@organization.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-900 placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Department / Storage Bay */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                <Building className="w-3.5 h-3.5 text-slate-400" />
                <span>Department / Facility Bay</span>
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {[
                  'Cold Storage Bay #1',
                  'Blast Freezers',
                  'Processing & Gutting',
                  'Dispatch & Reefer Fleet',
                  'Quality & HACCP Inspection',
                  'Wholesale & Sales Desk',
                ].map((dept) => (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => setDepartment(dept)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
                      department === dept
                        ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {dept}
                  </button>
                ))}
              </div>
              <input
                id="worker-department-input"
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Or custom department..."
                className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900"
              />
            </div>

            {/* Role Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1">
                <Shield className="w-3.5 h-3.5 text-slate-400" />
                <span>Assign Workspace Role *</span>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {rolesConfig.map((r) => {
                  const Icon = r.icon;
                  const isSelected = role === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      id={`select-role-${r.id}`}
                      onClick={() => setRole(r.id as any)}
                      className={`p-3 rounded-xl border text-left flex items-start space-x-2.5 transition-all ${
                        isSelected
                          ? `${r.color} ring-1 ring-blue-500/40 shadow-sm font-medium`
                          : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                          isSelected ? 'bg-white shadow-xs' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold leading-snug">{r.name}</div>
                        <div className="text-[10px] text-slate-500 line-clamp-2 mt-0.5 leading-tight">{r.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Direct Password Input (if direct_password mode) */}
            {mode === 'direct_password' && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                    <Key className="w-3.5 h-3.5 text-slate-500" />
                    <span>Assign Temporary Password *</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    className="flex items-center space-x-1 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate Strong Password</span>
                  </button>
                </div>
                <input
                  id="worker-password-input"
                  type="text"
                  required
                  placeholder="e.g. Frost#2026!Fish"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs font-mono bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900"
                />
                <p className="text-[11px] text-slate-500">
                  Minimum 6 characters. The worker can immediately sign in with this password.
                </p>
              </div>
            )}

            {/* Notification Checkbox */}
            <div className="flex items-center space-x-2.5">
              <input
                id="send-worker-email-checkbox"
                type="checkbox"
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
              />
              <label htmlFor="send-worker-email-checkbox" className="text-xs text-slate-600 select-none">
                Dispatch email notification with credentials and website link to the worker
              </label>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                id="cancel-add-worker-btn"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                id="submit-add-worker-btn"
                disabled={loading || isSeatLimitReached}
                className="flex items-center space-x-2 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-sm shadow-blue-500/20 transition-all"
              >
                {loading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Adding Worker...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>
                      {mode === 'direct_password' ? 'Create Worker Account' : 'Generate & Send Invite'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
