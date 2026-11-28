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
import { Linking } from 'react-native';
import type { Session, User } from '@supabase/supabase-js';
import {
  fetchProfile,
  registerAccountWithVerification,
  resendVerificationEmail,
  updateProfile,
  type UpdateProfilePayload,
  type UserProfile,
} from '../services/api';
import { isMobileSupabaseConfigured, supabase } from '../services/supabase';

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
        console.warn('[mobile auth] Could not load profile from backend:', err);
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

    const handleOAuthRedirectUrl = async (url: string | null | undefined) => {
      if (!url || !supabase || !url.includes('auth-callback')) return;
      try {
        const queryPart = url.split('?')[1]?.split('#')[0] ?? '';
        const hashPart = url.split('#')[1] ?? '';
        const queryParams = new URLSearchParams(queryPart);
        const hashParams = new URLSearchParams(hashPart);

        const code = queryParams.get('code');
        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
          return;
        }

        const accessToken = hashParams.get('access_token') || queryParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token');
        if (accessToken && refreshToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
        }
      } catch (err) {
        console.warn('[mobile auth] OAuth callback handling failed:', err);
      }
    };

    void Linking.getInitialURL().then((initialUrl) => {
      if (mounted) void handleOAuthRedirectUrl(initialUrl);
    });
    const urlSub = Linking.addEventListener('url', ({ url }) => {
      if (mounted) void handleOAuthRedirectUrl(url);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      urlSub.remove();
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

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) {
      throw new Error('Supabase is not configured. Check your root .env file and restart Expo.');
    }
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'mymeet://auth-callback',
        skipBrowserRedirect: true,
        queryParams: {
          prompt: 'select_account',
        },
      },
    });
    if (error || !data?.url) {
      throw new Error(error?.message || 'Unable to start Google sign-in.');
    }
    await Linking.openURL(data.url);
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, fullName: string): Promise<SignUpResult> => {
      if (!supabase) {
        throw new Error('Supabase is not configured. Check your root .env file and restart Expo.');
      }

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
        const msg = regErr instanceof Error ? regErr.message : '';
        if (msg && !/failed to fetch|network request failed/i.test(msg)) {
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
      // Sign out only this device so other active devices (e.g. Web) stay signed in
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
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
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
      isConfigured: isMobileSupabaseConfigured,
      signIn,
      signInWithGoogle,
      signUp,
      resendVerification,
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
      signInWithGoogle,
      signUp,
      resendVerification,
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
