import React, { useState, useEffect } from 'react';
import { 
  Snowflake, 
  Eye, 
  EyeOff, 
  ArrowLeft, 
  WifiOff, 
  Mail, 
  CheckCircle2, 
  AlertTriangle,
  Loader2,
  Building2,
  Ticket,
  KeyRound
} from 'lucide-react';
import { 
  signIn, 
  signInAsTestUser, 
  signUpAndCreateOrganization, 
  signUpAndAcceptInvite,
  DEFAULT_TEST_USER_EMAIL 
} from '../data/auth';

export type AuthScreenMode = 'login' | 'create_org' | 'accept_invite' | 'pending_confirmation';

interface AuthGateScreenProps {
  onAuthSuccess?: () => void;
}

export const AuthGateScreen: React.FC<AuthGateScreenProps> = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState<AuthScreenMode>('login');

  // Input states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Create Org inputs
  const [orgName, setOrgName] = useState('');
  const [adminFullName, setAdminFullName] = useState('');
  const [adminDepartment, setAdminDepartment] = useState('Executive');

  // Accept Invite inputs
  const [inviteToken, setInviteToken] = useState('');
  const [inviteFullName, setInviteFullName] = useState('');
  const [inviteDepartment, setInviteDepartment] = useState('Operations');

  // Confirmation email storage
  const [pendingEmail, setPendingEmail] = useState('');

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Monitor network connectivity
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const resetFormState = (newMode: AuthScreenMode) => {
    setMode(newMode);
    setErrorMessage(null);
  };

  // Sign In Handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMessage('Please enter both your work email and password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await signIn(email.trim(), password);
      if (result.error) {
        setErrorMessage(result.error);
      } else {
        if (onAuthSuccess) onAuthSuccess();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to sign in. Please verify your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  // Dev Quick-Login Handler
  const handleDevQuickLogin = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await signInAsTestUser();
      if (result.error) {
        setErrorMessage(result.error);
      } else {
        if (onAuthSuccess) onAuthSuccess();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Dev quick-login failed.');
    } finally {
      setIsLoading(false);
    }
  };

  // Create Organization Handler
  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) {
      setErrorMessage('Please provide an organization name.');
      return;
    }
    if (!email.trim() || !password) {
      setErrorMessage('Please enter an admin email and password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await signUpAndCreateOrganization(
        email.trim(),
        password,
        orgName.trim(),
        adminFullName.trim() || email.trim().split('@')[0],
        adminDepartment.trim() || 'Executive'
      );

      if (res.error) {
        // If email confirmation is required by Supabase settings, show confirmation screen
        if (res.error.includes('Email confirmation is enabled') || !res.session) {
          setPendingEmail(email.trim());
          setMode('pending_confirmation');
        } else {
          setErrorMessage(res.error);
        }
      } else {
        if (onAuthSuccess) onAuthSuccess();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to create organization.');
    } finally {
      setIsLoading(false);
    }
  };

  // Accept Invite Handler
  const handleAcceptInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteToken.trim()) {
      setErrorMessage('Please paste the invitation token.');
      return;
    }
    if (!email.trim() || !password) {
      setErrorMessage('Please enter your work email and create a password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await signUpAndAcceptInvite(
        email.trim(),
        password,
        inviteToken.trim(),
        inviteFullName.trim() || email.trim().split('@')[0],
        inviteDepartment.trim() || 'Operations'
      );

      if (res.error) {
        if (res.error.includes('Email confirmation is enabled') || !res.session) {
          setPendingEmail(email.trim());
          setMode('pending_confirmation');
        } else {
          setErrorMessage(res.error);
        }
      } else {
        if (onAuthSuccess) onAuthSuccess();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to accept invitation.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md mx-auto">
        {/* Main Card Container - Flat white surface, slate-200 border, no gradients */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-6 sm:p-8">
          
          {/* Top Brand Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                <Snowflake className="w-5 h-5 text-indigo-600" />
              </span>
              <span className="text-2xl font-black font-heading tracking-tight text-slate-900">
                Frostly
              </span>
            </div>

            {mode === 'login' && (
              <div className="mt-4">
                <h1 className="text-xl font-bold font-heading text-slate-900">
                  Welcome back.
                </h1>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Sign in to access your cold-chain management workspace.
                </p>
              </div>
            )}

            {mode === 'create_org' && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => resetFormState('login')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer mb-2"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to log in</span>
                </button>
                <h1 className="text-xl font-bold font-heading text-slate-900 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-indigo-600" />
                  Create your organization
                </h1>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Set up a new cold-chain enterprise and initial administrator credentials.
                </p>
              </div>
            )}

            {mode === 'accept_invite' && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => resetFormState('login')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer mb-2"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to log in</span>
                </button>
                <h1 className="text-xl font-bold font-heading text-slate-900 flex items-center gap-2">
                  <Ticket className="w-5 h-5 text-indigo-600" />
                  Join with Invitation
                </h1>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Enter your team invitation token to join an existing organization.
                </p>
              </div>
            )}
          </div>

          {/* State 1: No Network and No Cached Session Banner */}
          {!isOnline && (
            <div className="mb-5 p-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-xs flex items-start gap-2.5">
              <WifiOff className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong className="font-semibold block text-slate-900">Network Offline</strong>
                No internet connection detected and no offline session cached. An active connection is required to authenticate against Supabase.
              </div>
            </div>
          )}

          {/* Error Message Banner */}
          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed font-medium">
                {errorMessage}
              </div>
            </div>
          )}

          {/* State 2: Post-Signup Pending Email Confirmation Screen */}
          {mode === 'pending_confirmation' ? (
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center mx-auto">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold font-heading text-slate-900">
                    Check your email
                  </h2>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    We sent an activation link to <strong className="font-semibold text-slate-900">{pendingEmail}</strong>. Please confirm your email address, then return here to log in.
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-[11px] text-slate-500 text-left leading-relaxed">
                  <span className="font-semibold text-slate-700 block mb-0.5">Admin Note:</span>
                  To enable instant 1-step registration without email confirmation, disable <em>&quot;Confirm email&quot;</em> in your Supabase Project Dashboard under <em>Authentication &gt; Providers &gt; Email</em>.
                </div>
              </div>

              <button
                type="button"
                onClick={() => resetFormState('login')}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer text-center"
              >
                Back to log in
              </button>
            </div>
          ) : mode === 'login' ? (
            /* FORM 1: LOG IN */
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Work Email
                </label>
                <input
                  id="auth-gate-email-input"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 transition-colors disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="auth-gate-password-input"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    className="w-full px-3.5 py-2.5 pr-10 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 transition-colors disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                id="auth-gate-login-button"
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Log In</span>
                )}
              </button>

              {/* Dev-Only Quick Login Button: Distinct dashed border, slate palette */}
              {!import.meta.env.PROD && (
                <button
                  id="auth-gate-dev-login-btn"
                  type="button"
                  onClick={handleDevQuickLogin}
                  disabled={isLoading}
                  className="w-full mt-3 py-2 px-3 border border-dashed border-slate-300 hover:border-slate-400 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-mono-code transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  title="Quick-login as dev test user (admin@frostly.com)"
                >
                  <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                  <span>[DEV] Quick Login ({DEFAULT_TEST_USER_EMAIL})</span>
                </button>
              )}

              {/* Quiet Divider */}
              <div className="pt-4 border-t border-slate-200 mt-5">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
                  <button
                    id="auth-gate-switch-create-org-btn"
                    type="button"
                    onClick={() => resetFormState('create_org')}
                    className="text-indigo-600 hover:text-indigo-700 font-semibold cursor-pointer transition-colors"
                  >
                    Create your organization
                  </button>
                  <span className="hidden sm:inline text-slate-300">•</span>
                  <button
                    id="auth-gate-switch-accept-invite-btn"
                    type="button"
                    onClick={() => resetFormState('accept_invite')}
                    className="text-indigo-600 hover:text-indigo-700 font-semibold cursor-pointer transition-colors"
                  >
                    I have an invite
                  </button>
                </div>
              </div>
            </form>
          ) : mode === 'create_org' ? (
            /* FORM 2: CREATE ORGANIZATION (In-Place Swap) */
            <form onSubmit={handleCreateOrg} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Organization Name *
                </label>
                <input
                  id="auth-gate-create-org-name"
                  type="text"
                  required
                  placeholder="e.g. Tema Cold Store Ltd"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 transition-colors disabled:opacity-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Your Full Name
                  </label>
                  <input
                    id="auth-gate-create-admin-name"
                    type="text"
                    placeholder="e.g. Kofi Mensah"
                    value={adminFullName}
                    onChange={(e) => setAdminFullName(e.target.value)}
                    disabled={isLoading}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 transition-colors disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Department
                  </label>
                  <input
                    id="auth-gate-create-admin-dept"
                    type="text"
                    placeholder="Executive"
                    value={adminDepartment}
                    onChange={(e) => setAdminDepartment(e.target.value)}
                    disabled={isLoading}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 transition-colors disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Administrator Work Email *
                </label>
                <input
                  id="auth-gate-create-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="admin@temacold.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 transition-colors disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Password *
                </label>
                <div className="relative">
                  <input
                    id="auth-gate-create-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    className="w-full px-3.5 py-2 pr-10 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 transition-colors disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                id="auth-gate-submit-create-org"
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Provisioning Organization...</span>
                  </>
                ) : (
                  <span>Create Organization &amp; Continue</span>
                )}
              </button>

              <div className="pt-3 border-t border-slate-200 text-center">
                <button
                  type="button"
                  onClick={() => resetFormState('login')}
                  className="text-xs text-slate-500 hover:text-slate-700 cursor-pointer font-medium"
                >
                  Already registered? <span className="text-indigo-600 font-semibold">Log in</span>
                </button>
              </div>
            </form>
          ) : (
            /* FORM 3: ACCEPT INVITE (In-Place Swap) */
            <form onSubmit={handleAcceptInvite} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Invitation Token *
                </label>
                <input
                  id="auth-gate-invite-token"
                  type="text"
                  required
                  placeholder="Paste 48-character invite code"
                  value={inviteToken}
                  onChange={(e) => setInviteToken(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-3.5 py-2 text-xs font-mono-code bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 transition-colors disabled:opacity-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Your Full Name
                  </label>
                  <input
                    id="auth-gate-invite-name"
                    type="text"
                    placeholder="e.g. Ama Serwaa"
                    value={inviteFullName}
                    onChange={(e) => setInviteFullName(e.target.value)}
                    disabled={isLoading}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 transition-colors disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Department
                  </label>
                  <input
                    id="auth-gate-invite-dept"
                    type="text"
                    placeholder="Operations"
                    value={inviteDepartment}
                    onChange={(e) => setInviteDepartment(e.target.value)}
                    disabled={isLoading}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 transition-colors disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Your Work Email *
                </label>
                <input
                  id="auth-gate-invite-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="your.name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 transition-colors disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Choose Password *
                </label>
                <div className="relative">
                  <input
                    id="auth-gate-invite-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    className="w-full px-3.5 py-2 pr-10 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 transition-colors disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                id="auth-gate-submit-accept-invite"
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Validating Token &amp; Joining...</span>
                  </>
                ) : (
                  <span>Accept Invite &amp; Join</span>
                )}
              </button>

              <div className="pt-3 border-t border-slate-200 text-center">
                <button
                  type="button"
                  onClick={() => resetFormState('login')}
                  className="text-xs text-slate-500 hover:text-slate-700 cursor-pointer font-medium"
                >
                  Already have an account? <span className="text-indigo-600 font-semibold">Log in</span>
                </button>
              </div>
            </form>
          )}

        </div>

        {/* Footer info note */}
        <p className="text-center text-[11px] text-slate-400 mt-4">
          Frostly Enterprise Cold-Chain Platform &bull; Tenancy Isolated by PostgreSQL RLS
        </p>
      </div>
    </div>
  );
};
