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
  KeyRound
} from 'lucide-react';
import { 
  signIn, 
  signInAsTestUser, 
  signOut, 
  getSession, 
  getStaffProfile, 
  onAuthStateChange,
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

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onAuthSuccess }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
        // Trigger sync of any queued offline mutations
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
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Database & Staff Authentication</h3>
              <p className="text-[11px] text-slate-500">Supabase Row-Level Security (RLS) Gate</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Status Banner */}
          <div className={`p-3.5 rounded-xl border text-xs flex items-start gap-3 ${
            session 
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' 
              : 'bg-amber-50/70 border-amber-200 text-amber-900'
          }`}>
            {session ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <div className="font-semibold">
                {session ? 'Authenticated with Supabase' : 'Offline / Local-Only Session'}
              </div>
              <div className="text-[11px] leading-relaxed text-slate-600">
                {session ? (
                  <span>
                    RLS policies are unlocked for your staff profile. Queries and mutations will synchronize live with PostgreSQL.
                  </span>
                ) : (
                  <span>
                    All Supabase tables are protected by Row-Level Security (<code className="font-mono text-[10px] bg-amber-100/60 px-1 py-0.5 rounded">TO authenticated</code>). Sign in to activate live multi-device synchronization.
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Feedback messages */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="break-words">{error}</div>
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
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Current Staff</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">
                    <Database className="w-3 h-3" />
                    {profile?.role ? profile.role.toUpperCase() : 'AUTHENTICATED'}
                  </span>
                </div>
                <div className="text-xs font-semibold text-slate-800 flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  {session.user.email}
                </div>
                {profile?.full_name && (
                  <div className="text-xs text-slate-600 flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    {profile.full_name} {profile.department ? `(${profile.department})` : ''}
                  </div>
                )}
                <div className="pt-2 text-[10px] text-slate-400 font-mono">
                  User ID: {session.user.id.slice(0, 18)}...
                </div>
              </div>

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
              {/* Quick Dev Login (Only enabled in development when configured) */}
              {!import.meta.env.PROD && (
                <div className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-indigo-900">
                      <KeyRound className="w-4 h-4 text-indigo-600" />
                      Development Staff Account
                    </div>
                    <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-semibold">
                      Dev Only
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Quickly verify repository operations with the configured dev account (<code className="font-mono text-slate-800 bg-white px-1.5 py-0.5 rounded border">{DEFAULT_TEST_USER_EMAIL}</code>) against live Supabase RLS.
                  </p>
                  <div className="flex gap-2">
                    <button
                      id="fill-demo-creds-button"
                      type="button"
                      onClick={() => {
                        setEmail('admin@frostly.com');
                        setPassword('FrostlyAdmin2026!');
                      }}
                      className="px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-700 bg-white hover:bg-indigo-50 text-[11px] font-semibold transition-colors cursor-pointer"
                    >
                      Fill Admin Demo
                    </button>
                    <button
                      id="quick-test-signin-button"
                      type="button"
                      onClick={async () => {
                        setIsLoading(true);
                        setError(null);
                        setSuccessMsg(null);
                        try {
                          const result = await signIn('admin@frostly.com', 'FrostlyAdmin2026!');
                          if (result.error) {
                            setError(`Sign in failed: ${result.error}`);
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
                      }}
                      disabled={isLoading || !isSupabaseConfigured}
                      className="flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      {isLoading ? 'Authenticating...' : '1-Click Admin Sign In'}
                    </button>
                  </div>
                </div>
              )}

              {/* Custom Credential Sign In Form */}
              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  or custom credentials
                </span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <form onSubmit={handleCustomSignIn} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Staff Email</label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="auth-email-input"
                      type="email"
                      required
                      placeholder="staff@frostly.com"
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
