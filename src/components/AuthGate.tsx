import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';
import { 
  getSession, 
  getStaffProfile, 
  signOut as authSignOut, 
  signInAsTestUser,
  onAuthStateChange,
  StaffProfile 
} from '../data/auth';
import { AuthGateScreen } from './AuthGateScreen';
import { TenantOnboardingScreen } from './TenantOnboardingScreen';
import { LandingPage } from './LandingPage';
import { PosCustomerView } from './PosCustomerView';
import {
  preparePosSecurityExitToLogin,
  isPosSecurityReauthActive,
  clearPosSecurityReauth,
} from '../services/posCustomerService';

export interface AuthContextType {
  session: Session | null;
  user: User | null;
  staffProfile: StaffProfile | null;
  isCheckingSession: boolean;
  refreshProfile: () => Promise<StaffProfile | null>;
  signOut: () => Promise<void>;
  exitCustomerViewToLogin: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthGate provider');
  }
  return context;
};

interface AuthGateProps {
  children: ReactNode;
}

/**
 * AuthGate - The single, authoritative boundary for session enforcement in Frostly.
 * 
 * Enforces:
 * 1. Single source of truth for session via getSession() + onAuthStateChange.
 * 2. Instant unmount of protected tenant tree upon sign-out, token revocation, or session expiration.
 * 3. Smooth, flash-free session checking with a minimal centered loader.
 * 4. Renders full-screen AuthGateScreen or LandingPage when unauthenticated.
 */
export const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState<boolean>(true);

  // Navigation state for unauthenticated visitors: defaults to the Landing Page
  const [unauthView, setUnauthView] = useState<'landing' | 'login' | 'create_org' | 'accept_invite' | 'pos_customer'>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.toLowerCase();
      if (hash === '#pos-customer') return 'pos_customer';
      if (hash === '#login' || isPosSecurityReauthActive()) return 'login';
      if (hash === '#signup' || hash === '#register' || hash === '#create-org') return 'create_org';
      if (hash === '#accept-invite') return 'accept_invite';
      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get('view') || params.get('auth');
      if (viewParam === 'pos-customer') return 'pos_customer';
      if (viewParam === 'login') return 'login';
      if (viewParam === 'signup' || viewParam === 'create_org') return 'create_org';
      if (viewParam === 'accept_invite') return 'accept_invite';
    }
    return 'landing';
  });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash === '#pos-customer') setUnauthView('pos_customer');
      else if (hash === '#login') setUnauthView('login');
      else if (hash === '#signup' || hash === '#register' || hash === '#create-org') setUnauthView('create_org');
      else if (hash === '#accept-invite') setUnauthView('accept_invite');
      else if (hash === '#landing' || hash === '' || hash === '#') setUnauthView('landing');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const refreshProfile = async (): Promise<StaffProfile | null> => {
    if (!session) {
      setStaffProfile(null);
      return null;
    }
    const profile = await getStaffProfile(true);
    setStaffProfile(profile);
    return profile;
  };

  const handleSignOut = async (): Promise<void> => {
    try {
      await authSignOut();
    } finally {
      setSession(null);
      setStaffProfile(null);
    }
  };

  const exitCustomerViewToLogin = async (): Promise<void> => {
    preparePosSecurityExitToLogin();
    setUnauthView('login');
    setSession(null);
    setStaffProfile(null);
    try {
      await authSignOut();
    } catch (err) {
      console.warn('[AuthGate] Error signing out during Customer View exit:', err);
    }
  };

  useEffect(() => {
    let isMounted = true;

    // 1. Initial session retrieval (handles both Supabase and offline/demo sessions)
    getSession().then((initialSession) => {
      if (!isMounted) return;
      setSession(initialSession);
      if (initialSession) {
        getStaffProfile(true).then((profile) => {
          if (isMounted) {
            setStaffProfile(profile);
            setIsCheckingSession(false);
          }
        }).catch(() => {
          if (isMounted) setIsCheckingSession(false);
        });
      } else {
        setIsCheckingSession(false);
      }
    }).catch((err) => {
      console.warn('[AuthGate] Exception during getSession:', err);
      if (isMounted) setIsCheckingSession(false);
    });

    // 2. Authoritative auth state listener: fires on SIGNED_IN, SIGNED_OUT, or local demo auth
    const unsubscribe = onAuthStateChange(async (newSession) => {
      if (!isMounted) return;

      setSession(newSession);

      if (newSession) {
        try {
          const profile = await getStaffProfile(true);
          if (isMounted) setStaffProfile(profile);
        } catch (e) {
          console.warn('[AuthGate] Error fetching updated profile:', e);
        }
      } else {
        setStaffProfile(null);
      }

      setIsCheckingSession(false);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // State 1: Brief centered session-check loader (no form flash)
  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 animate-in fade-in duration-200">
          <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-xs">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
          </div>
          <span className="text-xs font-semibold text-slate-500">
            Checking session...
          </span>
        </div>
      </div>
    );
  }

  // State 2: No active session - render PosCustomerView (paired counter display), LandingPage, or AuthGateScreen
  if (!session) {
    if (unauthView === 'pos_customer') {
      const regParam =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('register') || 'REG-1'
          : 'REG-1';
      return (
        <PosCustomerView
          registerId={regParam}
          onExitToCashier={exitCustomerViewToLogin}
        />
      );
    }

    if (unauthView === 'landing') {
      return (
        <LandingPage
          onSignIn={() => {
            window.location.hash = '#login';
            setUnauthView('login');
          }}
          onGetStarted={() => {
            window.location.hash = '#signup';
            setUnauthView('create_org');
          }}
          onExploreDemo={() => {
            window.location.hash = '#login';
            setUnauthView('login');
          }}
        />
      );
    }

    return (
      <AuthGateScreen 
        initialMode={
          unauthView === 'create_org' ? 'create_org' : 
          unauthView === 'accept_invite' ? 'accept_invite' : 'login'
        }
        requireStaffCredentials={isPosSecurityReauthActive()}
        onBackToLanding={() => {
          clearPosSecurityReauth();
          window.location.hash = '';
          setUnauthView('landing');
        }}
        onAuthSuccess={async () => {
          clearPosSecurityReauth();
          try {
            if (typeof window !== 'undefined' && window.location.hash.toLowerCase() === '#login') {
              window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
            }
          } catch {}
          const s = await getSession();
          setSession(s);
          if (s) {
            const p = await getStaffProfile(true);
            setStaffProfile(p);
          }
        }} 
      />
    );
  }

  // State 2.5: User profile exists but account is deactivated
  if (staffProfile && staffProfile.is_active === false) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Account Deactivated</h2>
          <p className="text-slate-300 text-sm mb-6 leading-relaxed">
            Your account has been deactivated. Contact your administrator.
          </p>
          <button
            onClick={handleSignOut}
            className="w-full px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-xl transition"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // State 3: User authenticated but needs workspace initialization / onboarding
  if (staffProfile?.needs_onboarding) {
    return (
      <TenantOnboardingScreen
        user={session.user}
        onCompleted={async () => {
          const profile = await getStaffProfile(true);
          if (profile) {
            setStaffProfile({ ...profile, needs_onboarding: false });
          } else {
            setStaffProfile(null);
          }
        }}
        onSignOut={handleSignOut}
      />
    );
  }

  // State 4: Active session with provisioned tenant - render protected app shell inside AuthContext
  return (
    <AuthContext.Provider
      value={{
        session,
        user: session.user,
        staffProfile,
        isCheckingSession,
        refreshProfile,
        signOut: handleSignOut,
        exitCustomerViewToLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
