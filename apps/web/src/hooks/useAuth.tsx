import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import {
  fetchProfile,
  registerAccountWithVerification,
  resendVerificationEmail,
  updateProfile,
  type UpdateProfilePayload,
  type UserProfile,
} from '../services/api';
import { isWebSupabaseConfigured, supabase } from '../services/supabase';

interface SignUpResult {
  needsEmailConfirmation: boolean;
  message?: string;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  profileLoading: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<SignUpResult>;
  resendVerification: (email: string) => Promise<string>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  saveProfile: (updates: UpdateProfilePayload) => Promise<UserProfile>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [profileLoading, setProfileLoading] = useState<boolean>(false);
  const lastFetchedTokenRef = useRef<string | null>(null);

  const loadProfileForSession = useCallback(
    async (activeSession: Session | null, force = false) => {
      if (!activeSession?.access_token) {
        lastFetchedTokenRef.current = null;
        setProfile(null);
        return;
      }

      if (!force && lastFetchedTokenRef.current === activeSession.access_token) {
        return;
      }
      lastFetchedTokenRef.current = activeSession.access_token;

      setProfileLoading(true);
      try {
        const nextProfile = await fetchProfile(activeSession.access_token);
        setProfile(nextProfile);
      } catch (err) {
        lastFetchedTokenRef.current = null;
        console.warn('[auth] Could not load profile from backend:', err);
        setProfile(null);
      } finally {
        setProfileLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setLoading(false);
      void loadProfileForSession(data.session ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession ?? null);
      setLoading(false);
      void loadProfileForSession(nextSession ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfileForSession]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      throw new Error('Supabase is not configured. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.');
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      throw new Error(error.message);
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) {
      throw new Error('Supabase is not configured. Check your .env file and restart Vite.');
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
        queryParams: {
          prompt: 'select_account',
        },
      },
    });
    if (error) {
      throw new Error(error.message);
    }
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, fullName: string): Promise<SignUpResult> => {
      if (!supabase) {
        throw new Error('Supabase is not configured. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.');
      }

      // Use branded MyMeet SMTP verification endpoint first (no 2/hr rate limit!)
      try {
        const reg = await registerAccountWithVerification({
          email: email.trim(),
          password,
          full_name: fullName.trim(),
        });
        if (reg.status === 'verification_sent') {
          return {
            needsEmailConfirmation: true,
            message: reg.message,
          };
        }
      } catch (regErr) {
        // Re-throw real validation / duplicate email errors directly to the user
        const msg = regErr instanceof Error ? regErr.message : '';
        if (msg && !/failed to fetch|networkerror|load failed/i.test(msg)) {
          throw regErr;
        }
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
          emailRedirectTo: `${window.location.origin}/login?verified=1`,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      return {
        needsEmailConfirmation: !data.session,
      };
    },
    [],
  );

  const resendVerification = useCallback(async (email: string): Promise<string> => {
    const res = await resendVerificationEmail(email.trim());
    return res.message;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    try {
      // Sign out only this device so other active devices (e.g. Android) stay signed in
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // Ignore storage/network errors on sign-out
    } finally {
      setSession(null);
      setProfile(null);
    }
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    if (!supabase) {
      throw new Error('Supabase is not configured.');
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      throw new Error(error.message);
    }
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    if (!supabase) {
      throw new Error('Supabase is not configured.');
    }
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) {
      throw new Error(error.message);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    await loadProfileForSession(session, true);
  }, [loadProfileForSession, session]);

  const saveProfile = useCallback(
    async (updates: UpdateProfilePayload): Promise<UserProfile> => {
      if (!session?.access_token) {
        throw new Error('You must be signed in to update your profile.');
      }
      const updated = await updateProfile(session.access_token, updates);
      setProfile(updated);
      return updated;
    },
    [session],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      profileLoading,
      isConfigured: isWebSupabaseConfigured,
      signIn,
      signInWithGoogle,
      signUp,
      resendVerification,
      signOut,
      sendPasswordReset,
      updatePassword,
      refreshProfile,
      saveProfile,
    }),
    [
      session,
      profile,
      loading,
      profileLoading,
      signIn,
      signInWithGoogle,
      signUp,
      resendVerification,
      signOut,
      sendPasswordReset,
      updatePassword,
      refreshProfile,
      saveProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return ctx;
}
