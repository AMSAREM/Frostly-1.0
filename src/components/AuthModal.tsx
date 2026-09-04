import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  User, 
  Lock, 
  Mail, 
  LogIn, 
  LogOut, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  X, 
  Database,
  Cloud,
  KeyRound,
  Building2,
  UserPlus,
  Ticket,
  Copy,
  Check
} from 'lucide-react';
import { 
  signIn, 
  signInAsTestUser, 
  signOut, 
  getSession, 
  getStaffProfile, 
  onAuthStateChange,
  createInvite,
  signUpAndCreateOrganization,
  signUpAndAcceptInvite,
  DEFAULT_TEST_USER_EMAIL,
  StaffProfile
} from '../data/auth';
import { isSupabaseConfigured } from '../utils/supabase';
import { syncManager } from '../sync/syncManager';
import { Session } from '@supabase/supabase-js';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess?: () => void;
}

type AuthTab = 'signin' | 'create_org' | 'accept_invite';

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onAuthSuccess }) => {
  const [activeTab, setActiveTab] = useState<AuthTab>('signin');
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<StaffProfile | null>(null);

  // Sign In inputs
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // New Org inputs
  const [orgName, setOrgName] = useState('');
  const [adminFullName, setAdminFullName] = useState('');
  const [adminDepartment, setAdminDepartment] = useState('Executive');

  // Accept Invite inputs
  const [inviteToken, setInviteToken] = useState('');
  const [inviteFullName, setInviteFullName] = useState('');
  const [inviteDepartment, setInviteDepartment] = useState('Operations');

  // Admin Invite Creator inputs
  const [newInviteEmail, setNewInviteEmail] = useState('');
  const [newInviteRole, setNewInviteRole] = useState<StaffProfile['role']>('ops_staff');
  const [createdInviteToken, setCreatedInviteToken] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    getSession().then((sess) => {
      if (isMounted) {
        setSession(sess);
        if (sess) {
          getStaffProfile().then((p) => {
            if (isMounted) setProfile(p);
          });
        }
      }
    });

    const unsubscribe = onAuthStateChange((sess) => {
      if (isMounted) {
        setSession(sess);
        if (sess) {
          getStaffProfile(true).then((p) => {
            if (isMounted) setProfile(p);
          });
        } else {
          setProfile(null);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestSignIn = async () => {
    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const result = await signInAsTestUser();
      if (result.error) {
        setError(`Sign in failed: ${result.error}. Ensure the test user exists in your Supabase Auth project or sign up with your credentials.`);
      } else {
        setSuccessMsg(`Successfully authenticated as ${result.session?.user.email}`);
        syncManager.flushAll().catch(console.warn);
        if (onAuthSuccess) onAuthSuccess();
      }
    } catch (e: any) {
      setError(e?.message || 'Authentication error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide both email and password');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const result = await signIn(email, password);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccessMsg(`Signed in as ${result.session?.user.email}`);
        syncManager.flushAll().catch(console.warn);
        if (onAuthSuccess) onAuthSuccess();
      }
    } catch (e: any) {
      setError(e?.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) {
      setError('Please provide an organization name');
      return;
    }
    if (!email || !password) {
      setError('Please enter admin credentials (email & password)');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await signUpAndCreateOrganization(
        email,
        password,
        orgName,
        adminFullName || email.split('@')[0],
        adminDepartment
      );
      if (res.error) {
        setError(res.error);
      } else {
        setSuccessMsg(`Organization "${orgName}" created! Signed in as Admin.`);
        syncManager.flushAll().catch(console.warn);
        if (onAuthSuccess) onAuthSuccess();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to initialize organization');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteToken.trim()) {
      setError('Please paste your invitation token');
      return;
    }
    if (!email || !password) {
      setError('Please enter your staff email and desired password');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await signUpAndAcceptInvite(
        email,
        password,
        inviteToken,
        inviteFullName || email.split('@')[0],
        inviteDepartment
      );
      if (res.error) {
        setError(res.error);
      } else {
        setSuccessMsg(`Welcome to the organization! Staff account activated as ${res.profile?.role}.`);
        syncManager.flushAll().catch(console.warn);
        if (onAuthSuccess) onAuthSuccess();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to accept invitation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInviteEmail.trim()) {
      setError('Please provide recipient email');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await createInvite(newInviteEmail, newInviteRole);
      if (!res.success) {
        setError(res.error || 'Failed to generate invite');
      } else {
        setCreatedInviteToken(res.data?.token || null);
        setSuccessMsg(`Invite generated for ${newInviteEmail}`);
      }
    } catch (err: any) {
      setError(err?.message || 'Error creating invite');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signOut();
      setSession(null);
      setProfile(null);
      setSuccessMsg('Signed out. The application is now in offline/local cache mode.');
    } catch (e: any) {
      setError(e?.message || 'Sign out failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    setError(null);
    try {
      const res = await syncManager.flushAll();
      setSuccessMsg(`Sync complete: ${res.totalProcessed} records updated (${res.totalFailed} failed)`);
    } catch (e: any) {
      setError(e?.message || 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div 
      id="auth-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        id="auth-modal-card"
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Multi-Tenant Cold-Chain Auth</h3>
              <p className="text-[11px] text-slate-500">Postgres RLS & Organization Security</p>
            </div>
          </div>
          <button
            id="close-auth-modal-button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body with Scroll */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {/* Supabase Status Banner */}
          <div className={`p-3 rounded-xl text-xs flex items-center justify-between ${
            isSupabaseConfigured 
              ? 'bg-emerald-50/80 border border-emerald-200 text-emerald-800' 
              : 'bg-amber-50/80 border border-amber-200 text-amber-800'
          }`}>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isSupabaseConfigured ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span className="font-semibold">
                {isSupabaseConfigured ? 'Cloud Postgres Gateway Connected' : 'Supabase Not Configured (Offline Mode)'}
              </span>
            </div>
            <span className="text-[10px] font-mono opacity-75">
              {isSupabaseConfigured ? 'RLS Active' : 'Local Fallback'}
            </span>
          </div>

          {/* Feedback messages */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>{successMsg}</div>
            </div>
          )}

          {/* Connected Session Card */}
          {session ? (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-bold text-slate-800">
                      {profile?.organization_name || 'Organization Workspace'}
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">
                    <Database className="w-3 h-3" />
                    {profile?.role ? profile.role.toUpperCase() : 'AUTHENTICATED'}
                  </span>
                </div>

                <div className="text-xs font-medium text-slate-700 space-y-1">
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>{session.user.email}</span>
                  </div>
                  {profile?.full_name && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>{profile.full_name} {profile.department ? `(${profile.department})` : ''}</span>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-200/60 flex flex-col gap-0.5 text-[10px] text-slate-400 font-mono">
                  <div>Tenant Org ID: {profile?.organization_id || 'Global Seed'}</div>
                  <div>User ID: {session.user.id.slice(0, 20)}...</div>
                </div>
              </div>

              {/* Admin Invite Generator Section */}
              {profile?.role === 'admin' && (
                <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                      <Ticket className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Issue Staff Invitation</span>
                    </div>
                    <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-semibold">
                      Admin Only
                    </span>
                  </div>

                  <form onSubmit={handleGenerateInvite} className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        id="invite-recipient-email"
                        type="email"
                        required
                        placeholder="newstaff@firm.com"
                        value={newInviteEmail}
                        onChange={(e) => setNewInviteEmail(e.target.value)}
                        className="bg-white border border-indigo-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <select
                        id="invite-recipient-role"
                        value={newInviteRole}
                        onChange={(e) => setNewInviteRole(e.target.value as any)}
                        className="bg-white border border-indigo-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="ops_staff">Operations Staff</option>
                        <option value="sales_staff">Sales Staff</option>
                        <option value="dispatch_staff">Dispatch Staff</option>
                        <option value="viewer">Viewer (Read-Only)</option>
                        <option value="admin">Administrator</option>
                      </select>
                    </div>

                    <button
                      id="generate-invite-button"
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {isLoading ? 'Issuing...' : 'Generate Invite Token'}
                    </button>
                  </form>

                  {createdInviteToken && (
                    <div className="p-2.5 rounded-lg bg-white border border-indigo-200 space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Invite Token:</span>
                      <div className="flex items-center gap-2">
                        <code className="text-[11px] font-mono bg-slate-100 px-2 py-1 rounded text-indigo-700 break-all flex-1">
                          {createdInviteToken}
                        </code>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(createdInviteToken);
                            setCopiedToken(true);
                            setTimeout(() => setCopiedToken(false), 2000);
                          }}
                          className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                        >
                          {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  id="sync-now-button"
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-indigo-600' : 'text-slate-500'}`} />
                  {isSyncing ? 'Flushing Queue...' : 'Sync Pending Queue'}
                </button>

                <button
                  id="sign-out-button"
                  onClick={handleSignOut}
                  disabled={isLoading}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Tab Navigation */}
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl">
                <button
                  id="tab-signin"
                  type="button"
                  onClick={() => { setActiveTab('signin'); setError(null); }}
                  className={`py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    activeTab === 'signin' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Sign In
                </button>
                <button
                  id="tab-create-org"
                  type="button"
                  onClick={() => { setActiveTab('create_org'); setError(null); }}
                  className={`py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    activeTab === 'create_org' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  New Tenant Org
                </button>
                <button
                  id="tab-accept-invite"
                  type="button"
                  onClick={() => { setActiveTab('accept_invite'); setError(null); }}
                  className={`py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    activeTab === 'accept_invite' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Join Invite
                </button>
              </div>

              {/* TAB 1: EXISTING SIGN IN */}
              {activeTab === 'signin' && (
                <div className="space-y-3">
                  {!import.meta.env.PROD && (
                    <div className="bg-indigo-50/50 rounded-xl p-3.5 border border-indigo-100 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-bold text-indigo-900">
                          <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                          Development Staff Account
                        </div>
                        <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-semibold">
                          Dev Only
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600">
                        Quickly connect default tenant (<code className="font-mono text-slate-800 bg-white px-1 py-0.5 rounded border">{DEFAULT_TEST_USER_EMAIL}</code>) against live Supabase RLS.
                      </p>
                      <div className="flex gap-2">
                        <button
                          id="fill-demo-creds-button"
                          type="button"
                          onClick={() => {
                            setEmail('admin@frostly.com');
                            setPassword('FrostlyAdmin2026!');
                          }}
                          className="px-2.5 py-1.5 rounded-lg border border-indigo-200 text-indigo-700 bg-white hover:bg-indigo-50 text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          Fill Admin Demo
                        </button>
                        <button
                          id="quick-test-signin-button"
                          type="button"
                          onClick={handleTestSignIn}
                          disabled={isLoading || !isSupabaseConfigured}
                          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <LogIn className="w-3.5 h-3.5" />
                          {isLoading ? 'Authenticating...' : '1-Click Admin Sign In'}
                        </button>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleCustomSignIn} className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Staff Email</label>
                      <div className="relative">
                        <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          id="auth-email-input"
                          type="email"
                          required
                          placeholder="staff@firm.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Password</label>
                      <div className="relative">
                        <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          id="auth-password-input"
                          type="password"
                          required
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    <button
                      id="custom-auth-signin-button"
                      type="submit"
                      disabled={isLoading}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      {isLoading ? 'Verifying...' : 'Sign In with Supabase'}
                    </button>
                  </form>
                </div>
              )}

              {/* TAB 2: REGISTER NEW ORGANIZATION */}
              {activeTab === 'create_org' && (
                <form onSubmit={handleCreateOrg} className="space-y-3">
                  <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-[11px] text-slate-600 flex items-start gap-2">
                    <Building2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                      Initializes an independent cold-chain tenant organization and automatically grants your account Administrator privileges.
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Organization / Company Name *</label>
                    <input
                      id="create-org-name-input"
                      type="text"
                      required
                      placeholder="e.g. Atlantic Deep Sea Coldstores Ltd"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Admin Full Name</label>
                      <input
                        id="create-org-admin-name"
                        type="text"
                        placeholder="e.g. Kwame Mensah"
                        value={adminFullName}
                        onChange={(e) => setAdminFullName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Department</label>
                      <input
                        id="create-org-department"
                        type="text"
                        placeholder="Executive"
                        value={adminDepartment}
                        onChange={(e) => setAdminDepartment(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Admin Account Email *</label>
                    <input
                      id="create-org-email-input"
                      type="email"
                      required
                      placeholder="admin@atlanticcold.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Password *</label>
                    <input
                      id="create-org-password-input"
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>

                  <button
                    id="submit-create-org-button"
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    {isLoading ? 'Creating Tenant Workspace...' : 'Create Organization & Sign In'}
                  </button>
                </form>
              )}

              {/* TAB 3: JOIN WITH INVITE */}
              {activeTab === 'accept_invite' && (
                <form onSubmit={handleAcceptInvite} className="space-y-3">
                  <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 text-[11px] text-slate-600 flex items-start gap-2">
                    <Ticket className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      Paste the invitation token issued by your organization's Administrator to activate your staff role.
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Invitation Token *</label>
                    <input
                      id="accept-invite-token-input"
                      type="text"
                      required
                      placeholder="e.g. 48-character hex code"
                      value={inviteToken}
                      onChange={(e) => setInviteToken(e.target.value)}
                      className="w-full font-mono bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Your Full Name</label>
                      <input
                        id="accept-invite-name-input"
                        type="text"
                        placeholder="e.g. Ama Serwaa"
                        value={inviteFullName}
                        onChange={(e) => setInviteFullName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Department</label>
                      <input
                        id="accept-invite-department-input"
                        type="text"
                        placeholder="Operations"
                        value={inviteDepartment}
                        onChange={(e) => setInviteDepartment(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Your Work Email *</label>
                    <input
                      id="accept-invite-email-input"
                      type="email"
                      required
                      placeholder="your.name@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Choose Password *</label>
                    <input
                      id="accept-invite-password-input"
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>

                  <button
                    id="submit-accept-invite-button"
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {isLoading ? 'Validating Token & Joining...' : 'Accept Invite & Join'}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Sync Queue summary */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5">
              <Cloud className="w-3.5 h-3.5 text-slate-400" />
              <span>Offline queue:</span>
            </div>
            <span className="font-semibold text-slate-700">
              {syncManager.getPendingCount()} operations pending
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
