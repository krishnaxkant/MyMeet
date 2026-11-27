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
  verifyBillingPayment,
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
        // Open MyMeet Web secure Razorpay UPI Checkout directly with this plan highlighted
        await Linking.openURL(`${WEB_APP_URL}/profile?upgrade=${encodeURIComponent(planCode)}`);
        setBusyPlan(null);
        return;
      }

      // Demo / Test Mode instant activation when Razorpay keys are not yet set
      const verified = await verifyBillingPayment(accessToken, { order_id: order.order_id });
      onActivated(verified.subscription, verified.plan_code);
      onClose();
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
                {highlightMcq ? 'Unlock Pro Notes + Session MCQs' : 'Upgrade to Pro Notes'}
              </Text>
              {subscription && !subscription.razorpay_live && (
                <Text style={styles.testTag}>Test Mode · Instant Free Preview</Text>
              )}
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
            <ScrollView contentContainerStyle={styles.list}>
              {plans.map((plan) => {
                const isBest = plan.code === 'pro_yearly_899';
                const isBusy = busyPlan === plan.code;
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
                        {plan.code === 'pro_yearly_899'
                          ? '/ year (~₹75/mo)'
                          : plan.code === 'pro_monthly_349'
                            ? '/ month'
                            : plan.code === 'pack_49'
                              ? '/ 15 credits · 30d'
                              : '/ 1 credit · 30d'}
                      </Text>
                    </View>

                    {plan.highlights.map((h) => (
                      <Text key={h} style={[styles.featLine, { color: colors.textMuted }]}>
                        ✓ {h}
                      </Text>
                    ))}

                    <Pressable
                      style={[
                        styles.ctaBtn,
                        { backgroundColor: isBest ? '#F59E0B' : '#7C3AED' },
                        Boolean(busyPlan) && { opacity: 0.6 },
                      ]}
                      disabled={Boolean(busyPlan)}
                      onPress={() => void handleSelectPlan(plan.code as PaidPlanCode)}
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
                            : `Activate ₹${plan.price_inr} (Test)`}
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
    maxHeight: '88%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    padding: 18,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
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
    fontSize: 18,
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
    gap: 6,
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
    marginVertical: 2,
  },
  priceText: {
    fontSize: 26,
    fontWeight: '900',
  },
  cycleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  featLine: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  ctaBtn: {
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
});
