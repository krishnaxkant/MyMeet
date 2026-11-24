import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import {
  fetchProfile,
  updateProfile,
  type UpdateProfilePayload,
  type UserProfile,
} from '../services/api';
import { isMobileSupabaseConfigured, supabase } from '../services/supabase';

interface SignUpResult {
  needsEmailConfirmation: boolean;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  profileLoading: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  saveProfile: (updates: UpdateProfilePayload) => Promise<UserProfile>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [profileLoading, setProfileLoading] = useState<boolean>(false);

  const loadProfileForSession = useCallback(async (activeSession: Session | null) => {
    if (!activeSession?.access_token) {
      setProfile(null);
      return;
    }

    setProfileLoading(true);
    try {
      const nextProfile = await fetchProfile(activeSession.access_token);
      setProfile(nextProfile);
    } catch (err) {
      console.warn('[mobile auth] Could not load profile from backend:', err);
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, []);

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
      throw new Error('Supabase is not configured. Check your root .env file and restart Expo.');
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      throw new Error(error.message);
    }
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, fullName: string): Promise<SignUpResult> => {
      if (!supabase) {
        throw new Error('Supabase is not configured. Check your root .env file and restart Expo.');
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
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

  const signOut = useCallback(async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(error.message);
    }
    setProfile(null);
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    if (!supabase) {
      throw new Error('Supabase is not configured.');
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    if (error) {
      throw new Error(error.message);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    await loadProfileForSession(session);
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
      isConfigured: isMobileSupabaseConfigured,
      signIn,
      signUp,
      signOut,
      sendPasswordReset,
      refreshProfile,
      saveProfile,
    }),
    [
      session,
      profile,
      loading,
      profileLoading,
      signIn,
      signUp,
      signOut,
      sendPasswordReset,
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
