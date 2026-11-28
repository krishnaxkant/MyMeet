import { useEffect, useState } from 'react';
import { CheckIcon, CrossIcon, CrownIcon, SparklesIcon } from './Icons';
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

interface PlanComparisonRow {
  text: string;
  included: boolean;
  emphasis?: boolean;
}

const PLAN_COMPARISON_MATRIX: Record<PaidPlanCode, { subtitle: string; rows: PlanComparisonRow[] }> = {
  single_9: {
    subtitle: 'Try Pro Master Notes on 1 important class or lecture only.',
    rows: [
      { text: 'Pro Master Notes for ONLY 1 class / meeting (valid 30 days)', included: true, emphasis: true },
      { text: 'Deep code snippets, formulas, derivations & worked examples', included: true },
      { text: 'Comparison table, exam & interview traps + 1-min cheat sheet', included: true },
      { text: 'HD printable PDF export & permanent access to that note', included: true },
      { text: 'Quick 20-MCQ Session Revision Test (not included)', included: false },
      { text: 'Multiple classes or unlimited regenerations', included: false },
    ],
  },
  pack_49: {
    subtitle: 'Smart bundle for regular students — just ~₹3.2 per class.',
    rows: [
      { text: 'Pro Master Notes for 15 classes / meetings (valid 30 days)', included: true, emphasis: true },
      { text: 'Deep code, derivations, comparison table & exam traps', included: true },
      { text: '1-min rapid revision cheat sheet + HD printable PDF export', included: true },
      { text: 'Premium PRO UI theme & gold profile badge', included: true },
      { text: 'Quick 20-MCQ Session Revision Test (not included)', included: false },
      { text: 'Unlimited regenerations (max 2 free regenerates/class)', included: false },
    ],
  },
  pro_monthly_349: {
    subtitle: 'Full all-access subscription for daily classes & exam prep.',
    rows: [
      { text: 'Unlimited Pro Master Notes for 30 days (every class)', included: true, emphasis: true },
      { text: 'Quick 20-MCQ Session Revision Test after every meeting', included: true, emphasis: true },
      { text: 'Unlimited note regenerations + HD PDF export', included: true },
      { text: 'Auto-builds Pro Notes (no Basic Free Notes clutter)', included: true },
      { text: 'Premium PRO luxury UI theme, gold badge & priority AI', included: true },
    ],
  },
  pro_yearly_899: {
    subtitle: '365 days of unlimited Pro Notes & 20-MCQ tests — save 78%.',
    rows: [
      { text: 'Unlimited Pro Master Notes for 1 full year (365 days)', included: true, emphasis: true },
      { text: 'Unlimited Quick 20-MCQ Session Revision Tests + weak-topic tracker', included: true, emphasis: true },
      { text: 'Unlimited note regenerations + HD PDF export', included: true },
      { text: 'Auto-builds Pro Notes (no Basic Free Notes clutter)', included: true },
      { text: 'Premium PRO luxury UI theme, gold badge & priority AI', included: true },
    ],
  },
};

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
          theme: { color: '#7C3AED' },
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
      className="visual-lightbox-backdrop pro-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="MyMeet Pro Plans"
      onClick={onClose}
    >
      <div className="pro-modal-shell" onClick={(e) => e.stopPropagation()}>
        <div className="pro-modal-top-bar" />

        <div className="pro-modal-head">
          <div className="pro-modal-title-group">
            <div className="pro-modal-badges">
              <span className="pro-pill-badge">
                <CrownIcon size={12} /> MYMEET PRO
              </span>
              {subscription && !subscription.razorpay_live && (
                <span className="badge badge-warning">Test Mode · Instant Free Preview</span>
              )}
              {subscription?.is_pro && (
                <span className="badge badge-success">
                  Active: {subscription.plan_name}
                  {subscription.is_unlimited
                    ? ' (Unlimited)'
                    : ` (${subscription.credits_remaining} credits left)`}
                </span>
              )}
            </div>
            <h2 className="pro-modal-title">
              {highlightMcq
                ? 'Unlock Unlimited Pro Notes & 20-MCQ Session Tests'
                : 'Choose Your MyMeet Pro Plan'}
            </h2>
            <p className="pro-modal-subtitle">
              Transparent pricing with zero hidden catches — compare exactly what you get in every
              pack with clear <strong className="legend-tick">✓ Included</strong> and{' '}
              <strong className="legend-cross">✕ Not included</strong> details.
            </p>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>

        {/* Crystal-clear callout about ₹9 vs Unlimited + MCQ */}
        <div className="pro-clarity-banner">
          <div className="pro-clarity-dot">
            <SparklesIcon size={15} />
          </div>
          <div className="pro-clarity-text">
            <strong>Quick Guide:</strong> The <strong>₹9 pack</strong> unlocks Pro Master Notes for{' '}
            <strong>1 single class only</strong> and does{' '}
            <strong className="legend-cross">not include Quick 20-MCQ revision</strong>. Pick{' '}
            <strong>Pro Monthly (₹349)</strong> or <strong>Pro Yearly (₹899 · Save 78%)</strong>{' '}
            for Unlimited Pro Notes + Quick 20-MCQ Session Revision Tests!
          </div>
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
            <div className="pro-plans-grid pro-plans-grid-4">
              {plans.map((plan) => {
                const code = plan.code as PaidPlanCode;
                const isBest = code === 'pro_yearly_899';
                const isMonthly = code === 'pro_monthly_349';
                const isMcqHighlighted = highlightMcq && plan.mcq_enabled;
                const isCurrent = subscription?.plan_code === code && subscription.is_pro;
                const isBusy = busyPlan === code;
                const matrix = PLAN_COMPARISON_MATRIX[code];
                const rows: PlanComparisonRow[] = matrix
                  ? matrix.rows
                  : plan.highlights.map((h) => ({ text: h, included: true }));

                return (
                  <div
                    key={plan.code}
                    className={`pro-plan-card ${isBest ? 'pro-plan-card-best' : ''} ${
                      isMcqHighlighted && !isBest
                        ? 'pro-plan-card-accent'
                        : isMonthly && !isBest
                          ? 'pro-plan-card-pro'
                          : ''
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
                        {code === 'pro_yearly_899'
                          ? '/ year · ~₹75/mo'
                          : code === 'pro_monthly_349'
                            ? '/ month · 30d'
                            : code === 'pack_49'
                              ? '/ 15 classes · 30d'
                              : '/ 1 class only · 30d'}
                      </span>
                    </div>

                    <p className="pro-plan-tagline">{matrix?.subtitle || plan.tagline}</p>

                    <div className="pro-plan-divider" />

                    <ul className="pro-plan-features">
                      {rows.map((row) => (
                        <li
                          key={row.text}
                          className={
                            row.included
                              ? row.emphasis
                                ? 'pro-feat-yes pro-feat-strong'
                                : 'pro-feat-yes'
                              : 'pro-feat-no'
                          }
                        >
                          <span
                            className={`pro-feat-icon ${row.included ? 'icon-yes' : 'icon-no'}`}
                            aria-hidden="true"
                          >
                            {row.included ? <CheckIcon size={12} /> : <CrossIcon size={11} />}
                          </span>
                          <span>{row.text}</span>
                        </li>
                      ))}
                    </ul>

                    <button
                      type="button"
                      className={`btn ${
                        isBest ? 'btn-pro-gold' : isMonthly ? 'btn-pro-royal' : 'btn-primary'
                      }`}
                      style={{ width: '100%', marginTop: 'auto' }}
                      disabled={Boolean(busyPlan)}
                      onClick={() => void handleSelectPlan(code)}
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
              <span>🔒 Razorpay Secured (UPI · GPay · PhonePe · Cards)</span>
              <span>·</span>
              <span>⚡ Instant Pro Activation</span>
              <span>·</span>
              <span>📄 Permanent Access to Unlocked Notes</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
