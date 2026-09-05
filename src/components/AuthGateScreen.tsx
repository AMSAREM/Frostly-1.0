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
  KeyRound,
  ShieldCheck,
  MailCheck,
  Server
} from 'lucide-react';
import { GoogleSmtpModal } from './GoogleSmtpModal';
import { sendDirectGoogleSmtpConfirmation } from '../services/googleSmtpService';
import { 
  signIn, 
  signInAsTestUser, 
  signInAsCreator,
  signUpAndCreateOrganization, 
  signUpAndAcceptInvite,
  resendConfirmationEmail,
  DEFAULT_TEST_USER_EMAIL,
  DEFAULT_TEST_USER_PASSWORD,
  DEFAULT_CREATOR_EMAIL,
  DEFAULT_CREATOR_PASSWORD
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
  const [isResending, setIsResending] = useState(false);
  const [resendSuccessMessage, setResendSuccessMessage] = useState<string | null>(null);
  const [resendErrorMessage, setResendErrorMessage] = useState<string | null>(null);
  const [showSmtpModal, setShowSmtpModal] = useState(false);

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
    setResendSuccessMessage(null);
    setResendErrorMessage(null);
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
        if (result.error.toLowerCase().includes('invalid login credentials')) {
          setErrorMessage(
            'Invalid credentials. Please verify your email and password, or click one of the quick sign-in buttons below.'
          );
        } else {
          setErrorMessage(result.error);
        }
      } else {
        if (onAuthSuccess) onAuthSuccess();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to sign in. Please verify your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  // Tenant Admin Quick-Login Handler
  const handleDevQuickLogin = async () => {
    setEmail(DEFAULT_TEST_USER_EMAIL);
    setPassword(DEFAULT_TEST_USER_PASSWORD);
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await signIn(DEFAULT_TEST_USER_EMAIL, DEFAULT_TEST_USER_PASSWORD);
      if (result.error) {
        setErrorMessage(result.error);
      } else {
        if (onAuthSuccess) onAuthSuccess();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Tenant admin sign-in failed.');
    } finally {
      setIsLoading(false);
    }
  };

  // Creator Quick-Login Handler (Platform Owner)
  const handleCreatorQuickLogin = async () => {
    setEmail(DEFAULT_CREATOR_EMAIL);
    setPassword(DEFAULT_CREATOR_PASSWORD);
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await signIn(DEFAULT_CREATOR_EMAIL, DEFAULT_CREATOR_PASSWORD);
      if (result.error) {
        setErrorMessage(result.error);
      } else {
        if (onAuthSuccess) onAuthSuccess();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Creator sign-in failed.');
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
        if (
          res.error.toLowerCase().includes('confirmation') ||
          res.error.toLowerCase().includes('confirm your email') ||
          !res.session
        ) {
          setPendingEmail(email.trim());
          setMode('pending_confirmation');
          // Dispatch confirmation notice via Google SMTP if configured
          sendDirectGoogleSmtpConfirmation({
            email: email.trim(),
            orgName: orgName.trim(),
            adminName: adminFullName.trim(),
          }).catch(console.warn);
        } else {
          setErrorMessage(res.error);
        }
      } else if (!res.session) {
        setPendingEmail(email.trim());
        setMode('pending_confirmation');
        sendDirectGoogleSmtpConfirmation({
          email: email.trim(),
          orgName: orgName.trim(),
          adminName: adminFullName.trim(),
        }).catch(console.warn);
      } else {
        if (onAuthSuccess) onAuthSuccess();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to create organization.');
    } finally {
      setIsLoading(false);
    }
  };

  // Resend Confirmation Email Handler via Google SMTP & Supabase
  const handleResendConfirmation = async () => {
    if (!pendingEmail) return;
    setIsResending(true);
    setResendSuccessMessage(null);
    setResendErrorMessage(null);

    try {
      // Trigger Supabase email resend
      const res = await resendConfirmationEmail(pendingEmail);
      
      // Also invoke server-side Google SMTP dispatch
      sendDirectGoogleSmtpConfirmation({
        email: pendingEmail,
        orgName: orgName || 'Your Organization',
        adminName: adminFullName || pendingEmail.split('@')[0],
      }).catch(console.warn);

      if (res.error) {
        setResendErrorMessage(res.error);
      } else {
        setResendSuccessMessage('A fresh verification link has been dispatched via Google SMTP to your inbox.');
      }
    } catch (err: any) {
      setResendErrorMessage(err?.message || 'Failed to send verification email via Google SMTP.');
    } finally {
      setIsResending(false);
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
              <div className="p-5 rounded-2xl bg-white border border-slate-200 text-center space-y-3.5 shadow-xs">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center mx-auto shadow-2xs">
                  <MailCheck className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold uppercase tracking-wider mb-2">
                    <Server className="w-2.5 h-2.5 text-emerald-600" />
                    <span>Dispatched via Google SMTP</span>
                  </div>
                  <h2 className="text-base font-bold font-heading text-slate-900">
                    Confirm your administrator email
                  </h2>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed max-w-sm mx-auto">
                    We sent an activation link to:
                  </p>
                  <div className="mt-2 inline-block px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-mono font-semibold text-slate-900 border border-slate-200">
                    {pendingEmail}
                  </div>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    Please click the link in your email to verify your address and launch your organization workspace.
                  </p>
                </div>

                {resendSuccessMessage && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 text-left font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{resendSuccessMessage}</span>
                  </div>
                )}

                {resendErrorMessage && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 text-left font-medium">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{resendErrorMessage}</span>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                  <button
                    id="btn-resend-confirmation-email"
                    type="button"
                    onClick={handleResendConfirmation}
                    disabled={isResending}
                    className="w-full py-2 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 border border-indigo-200/60"
                  >
                    {isResending ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                        <span>Sending via Google SMTP...</span>
                      </>
                    ) : (
                      <>
                        <Mail className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Send Fresh Link via Google SMTP</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      id="btn-edit-registration-email"
                      type="button"
                      onClick={() => {
                        setEmail(pendingEmail);
                        setMode('create_org');
                      }}
                      className="text-xs text-slate-500 hover:text-slate-700 cursor-pointer font-medium"
                    >
                      Mistyped email? <span className="text-indigo-600 font-semibold">Change address</span>
                    </button>

                    <button
                      id="btn-view-google-smtp-config"
                      type="button"
                      onClick={() => setShowSmtpModal(true)}
                      className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer font-medium inline-flex items-center gap-1"
                    >
                      <Server className="w-3 h-3 text-slate-400" />
                      <span>SMTP Diagnostic</span>
                    </button>
                  </div>
                </div>
              </div>

              <button
                id="btn-back-to-login-after-confirmation"
                type="button"
                onClick={() => {
                  setEmail(pendingEmail);
                  resetFormState('login');
                }}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer text-center flex items-center justify-center gap-2"
              >
                <span>Confirmed? Go to Log In</span>
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

              {/* Dev-Only Quick Login Buttons & Credentials Box */}
              {!import.meta.env.PROD && (
                <div className="mt-3 space-y-2">
                  <button
                    id="auth-gate-creator-login-btn"
                    type="button"
                    onClick={handleCreatorQuickLogin}
                    disabled={isLoading}
                    className="w-full py-2 px-3 border border-dashed border-indigo-300 hover:border-indigo-400 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-700 rounded-xl text-xs font-mono-code transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    title={`Sign in as Platform Creator (${DEFAULT_CREATOR_EMAIL})`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Quick Sign-In: [CREATOR] Platform Owner</span>
                  </button>

                  <button
                    id="auth-gate-dev-login-btn"
                    type="button"
                    onClick={handleDevQuickLogin}
                    disabled={isLoading}
                    className="w-full py-2 px-3 border border-dashed border-slate-300 hover:border-slate-400 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-mono-code transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    title={`Quick-login as dev tenant admin (${DEFAULT_TEST_USER_EMAIL})`}
                  >
                    <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                    <span>Quick Sign-In: [TENANT] Org Admin</span>
                  </button>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Verified Test Credentials (Click to Auto-Fill):
                    </div>
                    
                    {/* Account 1: Creator */}
                    <button
                      type="button"
                      id="auth-gate-fill-creator-btn"
                      onClick={() => {
                        setEmail(DEFAULT_CREATOR_EMAIL);
                        setPassword(DEFAULT_CREATOR_PASSWORD);
                        setErrorMessage(null);
                      }}
                      className="w-full text-left p-2 rounded-lg bg-white border border-slate-200/80 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-indigo-700 text-xs">Platform Creator</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 font-mono">Fill</span>
                      </div>
                      <div className="font-mono text-[10px] text-slate-600 mt-0.5">
                        {DEFAULT_CREATOR_EMAIL} • <span className="text-slate-800 font-semibold">{DEFAULT_CREATOR_PASSWORD}</span>
                      </div>
                    </button>

                    {/* Account 2: Tenant Admin */}
                    <button
                      type="button"
                      id="auth-gate-fill-admin-btn"
                      onClick={() => {
                        setEmail(DEFAULT_TEST_USER_EMAIL);
                        setPassword(DEFAULT_TEST_USER_PASSWORD);
                        setErrorMessage(null);
                      }}
                      className="w-full text-left p-2 rounded-lg bg-white border border-slate-200/80 hover:border-slate-300 hover:bg-slate-100/50 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800 text-xs">Tenant Org Admin</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono">Fill</span>
                      </div>
                      <div className="font-mono text-[10px] text-slate-600 mt-0.5">
                        {DEFAULT_TEST_USER_EMAIL} • <span className="text-slate-800 font-semibold">{DEFAULT_TEST_USER_PASSWORD}</span>
                      </div>
                    </button>
                  </div>
                </div>
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

              {/* Email Confirmation Notice via Google SMTP */}
              <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-100 flex items-start gap-2.5 text-xs text-indigo-950">
                <MailCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-indigo-900 block">Google SMTP Confirmation</span>
                    <button
                      type="button"
                      onClick={() => setShowSmtpModal(true)}
                      className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer underline"
                    >
                      SMTP Settings
                    </button>
                  </div>
                  A verification link will be dispatched via Google SMTP (<code className="text-[10px] bg-indigo-100/60 px-1 py-0.5 rounded">smtp.gmail.com:465</code>) to your work email.
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
                    <span>Sending Confirmation via Google SMTP...</span>
                  </>
                ) : (
                  <>
                    <MailCheck className="w-4 h-4 text-indigo-200" />
                    <span>Create Organization &amp; Send Confirmation Email</span>
                  </>
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

      {/* Google SMTP Diagnostics & Setup Modal */}
      <GoogleSmtpModal
        isOpen={showSmtpModal}
        onClose={() => setShowSmtpModal(false)}
        defaultTestEmail={pendingEmail || email}
      />
    </div>
  );
};
