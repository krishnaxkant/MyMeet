import { useEffect, useState } from 'react';
import { CheckIcon, SparklesIcon } from './Icons';
import {
  createBillingOrder,
  getBillingStatus,
  verifyBillingPayment,
  type PaidPlanCode,
  type PlanDefinition,
  type UserSubscriptionStatus,
} from '../services/api';

interface UpgradeModalProps {
  open: boolean;
  accessToken: string | null;
  userEmail?: string;
  userName?: string;
  meetingCode?: string;
  highlightMcq?: boolean;
  onClose: () => void;
  onActivated: (subscription: UserSubscriptionStatus, planCode: PaidPlanCode) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function UpgradeModal({
  open,
  accessToken,
  userEmail,
  userName,
  meetingCode,
  highlightMcq = false,
  onClose,
  onActivated,
}: UpgradeModalProps) {
  const [plans, setPlans] = useState<PlanDefinition[]>([]);
  const [subscription, setSubscription] = useState<UserSubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyPlan, setBusyPlan] = useState<PaidPlanCode | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !accessToken) return;
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
  }, [open, accessToken]);

  if (!open) return null;

  const handleSelectPlan = async (planCode: PaidPlanCode) => {
    if (!accessToken) return;
    setBusyPlan(planCode);
    setError(null);
    try {
      const order = await createBillingOrder(accessToken, planCode, meetingCode);
      if (order.provider === 'razorpay' && order.razorpay_key_id && order.razorpay_order_id) {
        const loaded = await loadRazorpayScript();
        if (!loaded || !window.Razorpay) {
          throw new Error('Unable to load Razorpay checkout. Please check your internet connection.');
        }

        const rzp = new window.Razorpay({
          key: order.razorpay_key_id,
          amount: order.amount_paise,
          currency: order.currency,
          name: 'MyMeet Pro',
          description: `${order.plan.name} — ${order.plan.tagline}`,
          order_id: order.razorpay_order_id,
          prefill: {
            name: userName || '',
            email: userEmail || '',
          },
          theme: { color: '#6366F1' },
          handler: async (resp: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) => {
            try {
              const verified = await verifyBillingPayment(accessToken, {
                order_id: order.order_id,
                razorpay_order_id: resp.razorpay_order_id,
                razorpay_payment_id: resp.razorpay_payment_id,
                razorpay_signature: resp.razorpay_signature,
              });
              onActivated(verified.subscription, verified.plan_code);
              onClose();
            } catch (verifyErr) {
              setError(
                verifyErr instanceof Error ? verifyErr.message : 'Payment verification failed.',
              );
            } finally {
              setBusyPlan(null);
            }
          },
          modal: {
            ondismiss: () => setBusyPlan(null),
          },
        });
        rzp.open();
        return;
      }

      // Test / Demo Instant Activation when Razorpay keys are not yet configured on backend
      const verified = await verifyBillingPayment(accessToken, { order_id: order.order_id });
      onActivated(verified.subscription, verified.plan_code);
      onClose();
      setBusyPlan(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start checkout.');
      setBusyPlan(null);
    }
  };

  return (
    <div
      className="visual-lightbox-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{ padding: 16 }}
    >
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 920,
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: 24,
          borderRadius: 20,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span className="pro-pill-badge">
                <SparklesIcon size={12} /> MYMEET PRO
              </span>
              {subscription && !subscription.razorpay_live && (
                <span className="badge badge-warning">Test Mode · Instant Free Preview</span>
              )}
            </div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>
              {highlightMcq
                ? 'Unlock Unlimited Pro Notes & Session MCQ Tests'
                : 'Upgrade Your Meeting Notes to Pro'}
            </h2>
            <p className="status-item-desc" style={{ marginTop: 4 }}>
              Deep code & derivations, comparison tables, exam traps, 1-min cheat sheet, HD PDF &
              interactive MCQ tests.
            </p>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>

        {error && (
          <div className="alert alert-danger" style={{ marginBottom: 14 }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="empty-state">Loading MyMeet Pro plans...</div>
        ) : (
          <>
            <div className="pro-plans-grid">
              {plans.map((plan) => {
                const isBest = plan.code === 'pro_yearly_899';
                const isMcqHighlighted = highlightMcq && plan.mcq_enabled;
                const isCurrent = subscription?.plan_code === plan.code && subscription.is_pro;
                const isBusy = busyPlan === plan.code;
                return (
                  <div
                    key={plan.code}
                    className={`pro-plan-card ${isBest ? 'pro-plan-card-best' : ''} ${
                      isMcqHighlighted && !isBest ? 'pro-plan-card-accent' : ''
                    }`}
                  >
                    <div className="pro-plan-top">
                      <div className="pro-plan-name">{plan.name}</div>
                      {plan.badge && (
                        <span className={`pro-plan-tag ${isBest ? 'pro-plan-tag-gold' : ''}`}>
                          {plan.badge}
                        </span>
                      )}
                    </div>

                    <div className="pro-plan-price-row">
                      <span className="pro-plan-price">₹{plan.price_inr}</span>
                      <span className="pro-plan-cycle">
                        {plan.code === 'pro_yearly_899'
                          ? '/ year (~₹75/mo)'
                          : plan.code === 'pro_monthly_349'
                            ? '/ month'
                            : plan.code === 'pack_49'
                              ? '/ 15 credits · 30d'
                              : '/ 1 credit · 30d'}
                      </span>
                    </div>

                    <p className="pro-plan-tagline">{plan.tagline}</p>

                    <div className="pro-plan-divider" />

                    <ul className="pro-plan-features">
                      {plan.highlights.map((feat) => (
                        <li key={feat}>
                          <CheckIcon size={14} />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>

                    <button
                      type="button"
                      className={`btn ${isBest ? 'btn-pro-gold' : 'btn-primary'}`}
                      style={{ width: '100%', marginTop: 'auto' }}
                      disabled={Boolean(busyPlan)}
                      onClick={() => void handleSelectPlan(plan.code as PaidPlanCode)}
                    >
                      {isBusy
                        ? 'Opening Checkout...'
                        : isCurrent && plan.is_unlimited
                          ? `Extend ${plan.name} (₹${plan.price_inr})`
                          : subscription?.razorpay_live
                            ? `Pay ₹${plan.price_inr} · UPI / Card`
                            : `Activate ₹${plan.price_inr} (Test)`}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="pro-trust-strip">
              <span>🔒 Secured by Razorpay (UPI · GPay · PhonePe · Cards)</span>
              <span>·</span>
              <span>⚡ Instant Pro Activation</span>
              <span>·</span>
              <span>📄 Permanent Access to Unlocked Meeting Notes</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
