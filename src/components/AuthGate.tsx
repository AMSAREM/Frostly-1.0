import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../utils/supabase';
import { getStaffProfile, signOut as authSignOut, StaffProfile } from '../data/auth';
import { AuthGateScreen } from './AuthGateScreen';

export interface AuthContextType {
  session: Session | null;
  user: User | null;
  staffProfile: StaffProfile | null;
  isCheckingSession: boolean;
  refreshProfile: () => Promise<StaffProfile | null>;
  signOut: () => Promise<void>;
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
 * 1. Single source of truth for Supabase Auth session via getSession() + onAuthStateChange.
 * 2. Instant unmount of protected tenant tree upon sign-out, token revocation, or session expiration.
 * 3. Smooth, flash-free session checking with a minimal centered loader.
 * 4. Renders full-screen AuthGateScreen when unauthenticated.
 */
export const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState<boolean>(true);

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

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsCheckingSession(false);
      return;
    }

    let isMounted = true;

    // 1. Initial synchronous/asynchronous session retrieval
    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) return;
      if (error) {
        console.warn('[AuthGate] Error retrieving initial session:', error.message);
        setSession(null);
        setStaffProfile(null);
        setIsCheckingSession(false);
        return;
      }

      setSession(data.session);
      if (data.session) {
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

    // 2. Authoritative auth state listener: fires on SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, USER_UPDATED
    // When tokens expire and fail to refresh or are revoked, newSession will be null or event will be SIGNED_OUT
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
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
      authListener?.subscription.unsubscribe();
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

  // State 2: No active session - render full-screen AuthGateScreen
  if (!session) {
    return (
      <AuthGateScreen 
        onAuthSuccess={() => {
          // Profile & session update is reactively handled by onAuthStateChange
        }} 
      />
    );
  }

  // State 3: Active session - render protected app shell inside AuthContext
  return (
    <AuthContext.Provider
      value={{
        session,
        user: session.user,
        staffProfile,
        isCheckingSession,
        refreshProfile,
        signOut: handleSignOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
