import { useEffect, useMemo, useState, type ComponentType } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useAuth } from '../hooks/useAuth';
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

// Cast WebView for React 19 JSX compatibility with react-native-webview types
const CheckoutWebView = WebView as unknown as ComponentType<Record<string, unknown>>;

interface ActiveRazorpayCheckout {
  orderId: string;
  planCode: PaidPlanCode;
  planName: string;
  planTagline: string;
  amountInr: number;
  amountPaise: number;
  currency: 'INR';
  razorpayKeyId: string;
  razorpayOrderId: string;
  userName: string;
  userEmail: string;
}

function buildRazorpayCheckoutHtml(checkout: ActiveRazorpayCheckout): string {
  const optionsJson = JSON.stringify({
    key: checkout.razorpayKeyId,
    amount: checkout.amountPaise,
    currency: checkout.currency,
    name: 'MyMeet Pro',
    description: `${checkout.planName} — ${checkout.planTagline}`,
    image: `${WEB_APP_URL.replace(/\/$/, '')}/mymeet-icon-192.png`,
    order_id: checkout.razorpayOrderId,
    prefill: {
      name: checkout.userName,
      email: checkout.userEmail,
    },
    theme: { color: '#7C3AED' },
  });

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>MyMeet Secure Checkout</title>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background: #070b14;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .loader-box {
      text-align: center;
      padding: 24px;
      max-width: 300px;
    }
    .spinner {
      width: 34px;
      height: 34px;
      border-radius: 999px;
      border: 3px solid rgba(124, 58, 237, 0.25);
      border-top-color: #8b5cf6;
      margin: 0 auto 14px;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .title { font-size: 16px; font-weight: 700; margin: 0 0 6px; }
    .sub { font-size: 13px; color: #94a3b8; margin: 0 0 18px; line-height: 1.5; }
    .retry-btn {
      display: none;
      padding: 10px 18px;
      border-radius: 10px;
      border: 0;
      background: #7c3aed;
      color: #ffffff;
      font-weight: 700;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="loader-box">
    <div class="spinner" id="sp"></div>
    <p class="title">Opening Razorpay Checkout…</p>
    <p class="sub">Complete your UPI, Card, or Netbanking payment securely inside MyMeet.</p>
    <button type="button" class="retry-btn" id="reopenBtn" onclick="openCheckout()">Open Payment Window</button>
  </div>
  <script>
    function postMsg(payload) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
    }
    var baseOptions = ${optionsJson};
    var openedOnce = false;

    function openCheckout() {
      if (!window.Razorpay) {
        postMsg({ type: 'error', message: 'Unable to load Razorpay Checkout. Check your internet connection.' });
        return;
      }
      var opts = Object.assign({}, baseOptions, {
        handler: function (resp) {
          postMsg({
            type: 'success',
            razorpay_order_id: resp.razorpay_order_id,
            razorpay_payment_id: resp.razorpay_payment_id,
            razorpay_signature: resp.razorpay_signature
          });
        },
        modal: {
          ondismiss: function () {
            postMsg({ type: 'dismiss' });
          },
          escape: true,
          backdropclose: false
        }
      });
      var rzp = new window.Razorpay(opts);
      rzp.on('payment.failed', function (resp) {
        var msg = (resp && resp.error && (resp.error.description || resp.error.reason)) || 'Payment failed. Please try again.';
        postMsg({ type: 'failed', message: msg });
      });
      rzp.open();
      openedOnce = true;
      var btn = document.getElementById('reopenBtn');
      if (btn) btn.style.display = 'inline-block';
    }
  </script>
  <script
    src="https://checkout.razorpay.com/v1/checkout.js"
    onload="openCheckout()"
    onerror="postMsg({ type: 'error', message: 'Could not reach Razorpay. Please check your connection and try again.' })"
  ></script>
</body>
</html>`;
}

function handleExternalPaymentUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  if (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('about:') ||
    lower.startsWith('data:') ||
    lower.startsWith('blob:')
  ) {
    return true;
  }

  // Handle Android intent:// UPI deep-links (e.g. GPay, PhonePe, Paytm, BHIM)
  if (lower.startsWith('intent://')) {
    const schemeMatch = url.match(/scheme=([^;]+)/i);
    const fallbackMatch = url.match(/S\.browser_fallback_url=([^;]+)/i);
    const directUrl = schemeMatch
      ? `${schemeMatch[1]}://${url.slice('intent://'.length).split('#Intent')[0]}`
      : url;
    void Linking.openURL(directUrl).catch(() => {
      if (fallbackMatch?.[1]) {
        void Linking.openURL(decodeURIComponent(fallbackMatch[1])).catch(() => {});
      }
    });
    return false;
  }

  // Open native UPI apps (upi://, tez://, gpay://, phonepe://, paytmmp://, bhim://, etc.)
  void Linking.openURL(url).catch(() => {});
  return false;
}

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
  const { user, profile } = useAuth();
  const [plans, setPlans] = useState<PlanDefinition[]>([]);
  const [subscription, setSubscription] = useState<UserSubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyPlan, setBusyPlan] = useState<PaidPlanCode | null>(null);
  const [activeCheckout, setActiveCheckout] = useState<ActiveRazorpayCheckout | null>(null);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setActiveCheckout(null);
      setVerifyingPayment(false);
      setBusyPlan(null);
      return;
    }
    if (!accessToken) return;
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
      if (order.provider === 'razorpay' && order.razorpay_key_id && order.razorpay_order_id) {
        const displayName =
          profile?.full_name ||
          (typeof user?.user_metadata?.full_name === 'string'
            ? user.user_metadata.full_name
            : '') ||
          '';
        const email = profile?.email || user?.email || '';
        setActiveCheckout({
          orderId: order.order_id,
          planCode,
          planName: order.plan.name,
          planTagline: order.plan.tagline,
          amountInr: order.amount_inr,
          amountPaise: order.amount_paise,
          currency: order.currency,
          razorpayKeyId: order.razorpay_key_id,
          razorpayOrderId: order.razorpay_order_id,
          userName: displayName,
          userEmail: email,
        });
        return;
      }

      throw new Error('Payment gateway is not ready yet. Please try again shortly.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to activate plan.');
      setBusyPlan(null);
    }
  };

  const checkoutSource = useMemo(
    () =>
      activeCheckout
        ? {
            html: buildRazorpayCheckoutHtml(activeCheckout),
            baseUrl: WEB_APP_URL,
          }
        : null,
    [activeCheckout],
  );

  const handleCheckoutMessage = async (event: { nativeEvent?: { data?: string } }) => {
    if (!activeCheckout || !accessToken) return;
    let payload: {
      type?: string;
      message?: string;
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
    };
    try {
      payload = JSON.parse(event?.nativeEvent?.data ?? '');
    } catch {
      return;
    }

    if (payload.type === 'dismiss') {
      setActiveCheckout(null);
      setBusyPlan(null);
      return;
    }

    if (payload.type === 'failed' || payload.type === 'error') {
      setActiveCheckout(null);
      setBusyPlan(null);
      setError(payload.message || 'Payment could not be completed. Please try again.');
      return;
    }

    if (payload.type === 'success') {
      const current = activeCheckout;
      setActiveCheckout(null);
      setVerifyingPayment(true);
      setError(null);
      try {
        const verified = await verifyBillingPayment(accessToken, {
          order_id: current.orderId,
          razorpay_order_id: payload.razorpay_order_id,
          razorpay_payment_id: payload.razorpay_payment_id,
          razorpay_signature: payload.razorpay_signature,
        });
        onActivated(verified.subscription, verified.plan_code);
        onClose();
      } catch (verifyErr) {
        setError(
          verifyErr instanceof Error
            ? verifyErr.message
            : 'Payment verification failed. Please contact support if money was debited.',
        );
      } finally {
        setVerifyingPayment(false);
        setBusyPlan(null);
      }
    }
  };

  const handleModalRequestClose = () => {
    if (verifyingPayment) return;
    if (activeCheckout) {
      setActiveCheckout(null);
      setBusyPlan(null);
      return;
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleModalRequestClose}
    >
      {activeCheckout ? (
        <SafeAreaView style={styles.checkoutFullScreen}>
          <View style={styles.checkoutTopBar}>
            <View style={{ flex: 1 }}>
              <Text style={styles.checkoutTitle}>Secure Razorpay Checkout</Text>
              <Text style={styles.checkoutSub} numberOfLines={1}>
                {activeCheckout.planName} · ₹{activeCheckout.amountInr}
              </Text>
            </View>
            <Pressable
              style={styles.checkoutCancelBtn}
              onPress={() => {
                setActiveCheckout(null);
                setBusyPlan(null);
              }}
            >
              <Text style={styles.checkoutCancelText}>Cancel</Text>
            </Pressable>
          </View>
          {checkoutSource && (
            <CheckoutWebView
              style={{ flex: 1, backgroundColor: '#070B14' }}
              source={checkoutSource}
              originWhitelist={['*']}
              javaScriptEnabled
              domStorageEnabled
              thirdPartyCookiesEnabled
              mixedContentMode="compatibility"
              setSupportMultipleWindows={false}
              onShouldStartLoadWithRequest={(req: { url?: string }) =>
                handleExternalPaymentUrl(req?.url ?? '')
              }
              onMessage={(e: { nativeEvent?: { data?: string } }) =>
                void handleCheckoutMessage(e)
              }
            />
          )}
        </SafeAreaView>
      ) : (
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
                          ? 'Opening Checkout...'
                          : `Pay ₹${plan.price_inr} via UPI / Card`}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>
          )}
          {verifyingPayment && (
            <View style={styles.verifyingOverlay}>
              <ActivityIndicator size="large" color="#F59E0B" />
              <Text style={styles.verifyingTitle}>Verifying Razorpay Payment…</Text>
              <Text style={styles.verifyingSub}>
                Please wait a moment while we unlock your MyMeet Pro plan.
              </Text>
            </View>
          )}
        </View>
      </View>
      )}
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
  checkoutFullScreen: {
    flex: 1,
    backgroundColor: '#070B14',
  },
  checkoutTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.2)',
  },
  checkoutTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
  },
  checkoutSub: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  checkoutCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: 'rgba(248, 250, 252, 0.1)',
  },
  checkoutCancelText: {
    color: '#F8FAFC',
    fontSize: 12.5,
    fontWeight: '700',
  },
  verifyingOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(7, 11, 20, 0.92)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
  },
  verifyingTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  verifyingSub: {
    color: '#CBD5E1',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
});
