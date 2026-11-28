import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import {
  createBillingOrder,
  getBillingStatus,
  WEB_APP_URL,
  type PaidPlanCode,
  type PlanDefinition,
  type UserSubscriptionStatus,
} from '../services/api';

interface UpgradePlansModalProps {
  visible: boolean;
  accessToken: string | null;
  meetingCode?: string;
  highlightMcq?: boolean;
  onClose: () => void;
  onActivated: (subscription: UserSubscriptionStatus, planCode: PaidPlanCode) => void;
}

interface MobilePlanRow {
  text: string;
  included: boolean;
  bold?: boolean;
}

const MOBILE_PLAN_MATRIX: Record<PaidPlanCode, { subtitle: string; rows: MobilePlanRow[] }> = {
  single_9: {
    subtitle: 'Try Pro Master Notes on 1 important class or lecture only.',
    rows: [
      { text: 'Pro Master Notes for ONLY 1 class / meeting', included: true, bold: true },
      { text: 'Deep code, derivations, comparison table & exam traps', included: true },
      { text: '1-min cheat sheet + HD PDF export & permanent access', included: true },
      { text: 'Quick 20-MCQ Session Revision Test (not included)', included: false },
      { text: 'Multiple classes or unlimited regenerations', included: false },
    ],
  },
  pack_49: {
    subtitle: 'Smart bundle for regular classes — ~₹3.2 per class.',
    rows: [
      { text: 'Pro Master Notes for 15 classes / meetings', included: true, bold: true },
      { text: 'Deep code, derivations, comparison table & exam traps', included: true },
      { text: 'Premium PRO UI theme & gold profile badge', included: true },
      { text: 'Quick 20-MCQ Session Revision Test (not included)', included: false },
      { text: 'Unlimited regenerations', included: false },
    ],
  },
  pro_monthly_349: {
    subtitle: 'Full all-access subscription for daily lectures & exam prep.',
    rows: [
      { text: 'Unlimited Pro Master Notes every month (every class)', included: true, bold: true },
      { text: 'Quick 20-MCQ Session Revision Test after every meeting', included: true, bold: true },
      { text: 'Unlimited regenerations + HD PDF export', included: true },
      { text: 'Premium PRO UI theme, gold badge & priority AI', included: true },
    ],
  },
  pro_yearly_899: {
    subtitle: '365 days of unlimited Pro Notes & 20-MCQ tests — save 78%.',
    rows: [
      { text: 'Unlimited Pro Master Notes for 1 full year (365 days)', included: true, bold: true },
      { text: 'Unlimited Quick 20-MCQ Session Revision Tests', included: true, bold: true },
      { text: 'Unlimited regenerations + HD PDF export', included: true },
      { text: 'Premium PRO UI theme, gold badge & priority AI', included: true },
    ],
  },
};

export function UpgradePlansModal({
  visible,
  accessToken,
  meetingCode,
  highlightMcq = false,
  onClose,
  onActivated,
}: UpgradePlansModalProps) {
  const { colors } = useTheme();
  const [plans, setPlans] = useState<PlanDefinition[]>([]);
  const [subscription, setSubscription] = useState<UserSubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyPlan, setBusyPlan] = useState<PaidPlanCode | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !accessToken) return;
    setLoading(true);
    setError(null);
    void getBillingStatus(accessToken)
      .then((res) => {
        setSubscription(res.subscription);
        setPlans(res.plans.filter((p) => p.code !== 'free'));
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unable to load plans.');
      })
      .finally(() => setLoading(false));
  }, [visible, accessToken]);

  const handleSelectPlan = async (planCode: PaidPlanCode) => {
    if (!accessToken) return;
    setBusyPlan(planCode);
    setError(null);
    try {
      const order = await createBillingOrder(accessToken, planCode, meetingCode);
      if (order.provider === 'razorpay') {
        await Linking.openURL(`${WEB_APP_URL}/profile?upgrade=${encodeURIComponent(planCode)}`);
        setBusyPlan(null);
        return;
      }

      throw new Error('Payment gateway is not ready yet. Please try again shortly.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to activate plan.');
    } finally {
      setBusyPlan(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, borderColor: colors.borderStrong },
          ]}
        >
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.proBadge}>
                <Text style={styles.proBadgeText}>✦ MYMEET PRO</Text>
              </View>
              <Text style={[styles.title, { color: colors.text }]}>
                {highlightMcq ? 'Unlock Pro Notes + 20-MCQ Tests' : 'Compare MyMeet Pro Plans'}
              </Text>
            </View>
            <Pressable
              style={[
                styles.closeBtn,
                { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
              ]}
              onPress={onClose}
            >
              <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700' }}>Close</Text>
            </Pressable>
          </View>

          <View style={styles.clarityBanner}>
            <Text style={[styles.clarityText, { color: colors.text }]}>
              <Text style={{ fontWeight: '800' }}>Quick Guide: </Text>
              ₹9 pack gives Pro Notes for <Text style={{ fontWeight: '800' }}>1 class only</Text>{' '}
              (<Text style={{ color: '#ef4444', fontWeight: '800' }}>✕ No 20-MCQ test</Text>). Pick{' '}
              <Text style={{ fontWeight: '800' }}>₹349/mo</Text> or{' '}
              <Text style={{ fontWeight: '800' }}>₹899/yr</Text> for Unlimited Notes + Quick 20-MCQ
              Revision Tests!
            </Text>
          </View>

          {error && (
            <View
              style={[
                styles.errBox,
                { backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder },
              ]}
            >
              <Text style={{ color: colors.dangerText, fontSize: 12.5 }}>{error}</Text>
            </View>
          )}

          {loading ? (
            <View style={styles.loaderWrap}>
              <ActivityIndicator color="#F59E0B" />
              <Text style={{ color: colors.textMuted, marginTop: 8 }}>Loading plans...</Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
            >
              {plans.map((plan) => {
                const code = plan.code as PaidPlanCode;
                const isBest = code === 'pro_yearly_899';
                const isBusy = busyPlan === code;
                const matrix = MOBILE_PLAN_MATRIX[code];
                const rows: MobilePlanRow[] = matrix
                  ? matrix.rows
                  : plan.highlights.map((h) => ({ text: h, included: true }));

                return (
                  <View
                    key={plan.code}
                    style={[
                      styles.planCard,
                      {
                        backgroundColor: colors.surfaceElevated,
                        borderColor: isBest
                          ? '#F59E0B'
                          : highlightMcq && plan.mcq_enabled
                            ? '#7C3AED'
                            : colors.border,
                        borderWidth: isBest ? 2 : 1,
                      },
                    ]}
                  >
                    <View style={styles.planTopRow}>
                      <Text style={[styles.planName, { color: colors.text }]}>{plan.name}</Text>
                      {plan.badge && (
                        <View
                          style={[
                            styles.badgePill,
                            { backgroundColor: isBest ? '#F59E0B' : 'rgba(124, 58, 237, 0.2)' },
                          ]}
                        >
                          <Text
                            style={{
                              color: isBest ? '#090D16' : '#A78BFA',
                              fontSize: 10,
                              fontWeight: '800',
                            }}
                          >
                            {plan.badge}
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.priceRow}>
                      <Text style={[styles.priceText, { color: colors.text }]}>
                        ₹{plan.price_inr}
                      </Text>
                      <Text style={[styles.cycleText, { color: colors.textMuted }]}>
                        {code === 'pro_yearly_899'
                          ? '/ year (~₹75/mo)'
                          : code === 'pro_monthly_349'
                            ? '/ month'
                            : code === 'pack_49'
                              ? '/ 15 classes'
                              : '/ 1 class only'}
                      </Text>
                    </View>

                    <Text style={[styles.subCopy, { color: colors.textMuted }]}>
                      {matrix?.subtitle || plan.tagline}
                    </Text>

                    <View style={[styles.divider, { backgroundColor: colors.border }]} />

                    {rows.map((r) => (
                      <View key={r.text} style={styles.featRow}>
                        <View
                          style={[
                            styles.featMark,
                            {
                              backgroundColor: r.included
                                ? 'rgba(34, 197, 94, 0.18)'
                                : 'rgba(239, 68, 68, 0.16)',
                            },
                          ]}
                        >
                          <Text
                            style={{
                              color: r.included ? '#16a34a' : '#ef4444',
                              fontSize: 11,
                              fontWeight: '900',
                            }}
                          >
                            {r.included ? '✓' : '✕'}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.featLine,
                            {
                              color: r.included ? colors.text : colors.textMuted,
                              fontWeight: r.bold ? '700' : '500',
                              opacity: r.included ? 1 : 0.8,
                            },
                          ]}
                        >
                          {r.text}
                        </Text>
                      </View>
                    ))}

                    <Pressable
                      style={[
                        styles.ctaBtn,
                        { backgroundColor: isBest ? '#F59E0B' : '#7C3AED' },
                        Boolean(busyPlan) && { opacity: 0.6 },
                      ]}
                      disabled={Boolean(busyPlan)}
                      onPress={() => void handleSelectPlan(code)}
                    >
                      <Text
                        style={{
                          color: isBest ? '#090D16' : '#FFFFFF',
                          fontSize: 13.5,
                          fontWeight: '800',
                        }}
                      >
                        {isBusy
                          ? 'Activating...'
                          : subscription?.razorpay_live
                            ? `Pay ₹${plan.price_inr} via UPI`
                            : `Get Started · ₹${plan.price_inr}`}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '90%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 18,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  proBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#7C3AED',
    marginBottom: 6,
  },
  proBadgeText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 18.5,
    fontWeight: '800',
  },
  testTag: {
    color: '#F59E0B',
    fontSize: 11.5,
    fontWeight: '700',
    marginTop: 2,
  },
  closeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  clarityBanner: {
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.42)',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    marginBottom: 12,
  },
  clarityText: {
    fontSize: 12,
    lineHeight: 17,
  },
  errBox: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  loaderWrap: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  list: {
    gap: 12,
    paddingBottom: 24,
  },
  planCard: {
    borderRadius: 16,
    padding: 14,
    gap: 7,
  },
  planTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  planName: {
    fontSize: 15.5,
    fontWeight: '800',
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 1,
  },
  priceText: {
    fontSize: 26,
    fontWeight: '900',
  },
  cycleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  subCopy: {
    fontSize: 12,
    lineHeight: 16,
  },
  divider: {
    height: 1,
    marginVertical: 3,
  },
  featRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  featMark: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  featLine: {
    flex: 1,
    fontSize: 12.2,
    lineHeight: 17,
  },
  ctaBtn: {
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
});
