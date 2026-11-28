import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  getBillingStatus,
  type PlanDefinition,
  type UserSubscriptionStatus,
} from '../services/api';
import { useAuth } from './useAuth';

interface UpgradeModalOptions {
  highlightMcq?: boolean;
  meetingCode?: string;
}

interface SubscriptionContextValue {
  subscription: UserSubscriptionStatus | null;
  plans: PlanDefinition[];
  loading: boolean;
  isPro: boolean;
  isUnlimited: boolean;
  refreshSubscription: () => Promise<void>;
  setSubscription: (sub: UserSubscriptionStatus | null) => void;
  upgradeModalOpen: boolean;
  upgradeModalOptions: UpgradeModalOptions;
  openUpgradeModal: (options?: UpgradeModalOptions) => void;
  closeUpgradeModal: () => void;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { session, user } = useAuth();
  const [subscription, setSubscriptionState] = useState<UserSubscriptionStatus | null>(null);
  const [plans, setPlans] = useState<PlanDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeModalOptions, setUpgradeModalOptions] = useState<UpgradeModalOptions>({});

  const refreshSubscription = useCallback(async () => {
    if (!session?.access_token) {
      setSubscriptionState(null);
      setPlans([]);
      return;
    }
    setLoading(true);
    try {
      const res = await getBillingStatus(session.access_token);
      setSubscriptionState(res.subscription);
      setPlans(res.plans);
    } catch {
      // Keep previous subscription state on transient network error
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (!user || !session?.access_token) {
      setSubscriptionState(null);
      setPlans([]);
      return;
    }
    void refreshSubscription();
  }, [user, session?.access_token, refreshSubscription]);

  const isPro = Boolean(
    subscription?.is_pro &&
      !subscription.is_expired &&
      (!subscription.expires_at || new Date(subscription.expires_at).getTime() > Date.now()),
  );
  const isUnlimited = Boolean(isPro && subscription?.is_unlimited);

  // Automatically re-sync right when an active Pro subscription expires or when user returns to tab
  useEffect(() => {
    if (!user || !session?.access_token) return;
    const handleFocus = () => {
      void refreshSubscription();
    };
    window.addEventListener('focus', handleFocus);

    let expiryTimer: number | null = null;
    if (subscription?.is_pro && subscription.expires_at) {
      const msUntilExpiry = new Date(subscription.expires_at).getTime() - Date.now();
      // setTimeout caps cleanly around 24.8 days (2^31 - 1 ms)
      if (msUntilExpiry > 0 && msUntilExpiry < 2_000_000_000) {
        expiryTimer = window.setTimeout(() => {
          void refreshSubscription();
        }, msUntilExpiry + 1500);
      }
    }

    return () => {
      window.removeEventListener('focus', handleFocus);
      if (expiryTimer !== null) window.clearTimeout(expiryTimer);
    };
  }, [user, session?.access_token, subscription?.is_pro, subscription?.expires_at, refreshSubscription]);

  // Sync tier attribute on <html> so CSS theme tokens adapt globally between Basic & Pro
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-tier', isPro ? 'pro' : 'basic');
    return () => {
      document.documentElement.setAttribute('data-tier', 'basic');
    };
  }, [isPro]);

  const setSubscription = useCallback((sub: UserSubscriptionStatus | null) => {
    setSubscriptionState(sub);
  }, []);

  const openUpgradeModal = useCallback((options?: UpgradeModalOptions) => {
    setUpgradeModalOptions(options ?? {});
    setUpgradeModalOpen(true);
  }, []);

  const closeUpgradeModal = useCallback(() => {
    setUpgradeModalOpen(false);
  }, []);

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      subscription,
      plans,
      loading,
      isPro,
      isUnlimited,
      refreshSubscription,
      setSubscription,
      upgradeModalOpen,
      upgradeModalOptions,
      openUpgradeModal,
      closeUpgradeModal,
    }),
    [
      subscription,
      plans,
      loading,
      isPro,
      isUnlimited,
      refreshSubscription,
      setSubscription,
      upgradeModalOpen,
      upgradeModalOptions,
      openUpgradeModal,
      closeUpgradeModal,
    ],
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return ctx;
}
