import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { getSupabaseAdmin } from '../config/supabase.js';
import {
  sendSubscriptionExpiredEmail,
  sendSubscriptionWelcomeEmail,
} from './emailService.js';
import { HttpError } from './meetingService.js';

export type PlanCode = 'free' | 'single_9' | 'pack_49' | 'pro_monthly_349' | 'pro_yearly_899';
export type PaidPlanCode = Exclude<PlanCode, 'free'>;

export interface PlanDefinition {
  code: PlanCode;
  name: string;
  badge: string | null;
  price_inr: number;
  duration_days: number | null;
  credits: number | null; // null = unlimited
  is_unlimited: boolean;
  mcq_enabled: boolean;
  tagline: string;
  highlights: string[];
}

export interface UserSubscriptionStatus {
  plan_code: PlanCode;
  plan_name: string;
  is_pro: boolean;
  is_unlimited: boolean;
  mcq_enabled: boolean;
  credits_remaining: number;
  credits_total: number;
  started_at: string | null;
  expires_at: string | null;
  is_expired: boolean;
  razorpay_live: boolean;
}

interface SubscriptionRow {
  user_id: string;
  plan_code: PlanCode;
  credits_remaining: number;
  credits_total: number;
  is_unlimited: boolean;
  mcq_enabled: boolean;
  started_at: string | null;
  expires_at: string | null;
  updated_at: string;
}

interface PaymentOrderRow {
  id: string;
  user_id: string;
  plan_code: PaidPlanCode;
  meeting_code: string | null;
  amount_inr: number;
  currency: string;
  provider: 'razorpay' | 'demo';
  provider_order_id: string;
  provider_payment_id: string | null;
  status: 'created' | 'paid' | 'failed';
  created_at: string;
  paid_at: string | null;
}

export const PLAN_CATALOG: Record<PlanCode, PlanDefinition> = {
  free: {
    code: 'free',
    name: 'Basic (Free)',
    badge: null,
    price_inr: 0,
    duration_days: null,
    credits: 0,
    is_unlimited: false,
    mcq_enabled: false,
    tagline: 'Standard AI visual notes for every meeting',
    highlights: [
      'HD video meetings & screen sharing',
      'Automatic Free AI Visual Summary',
      'Upgrade any important class anytime for ₹9',
    ],
  },
  single_9: {
    code: 'single_9',
    name: 'Single Pro Credit',
    badge: 'Try Pro',
    price_inr: 9,
    duration_days: 30,
    credits: 1,
    is_unlimited: false,
    mcq_enabled: false,
    tagline: '1 Pro Note credit · 1 class only',
    highlights: [
      '1 Pro Master Notes credit (1 class/meeting)',
      'Deep derivations, code blocks & comparison tables',
      'Exam & interview traps + 1-min cheat sheet + PDF',
      'Permanent access to your unlocked class note',
    ],
  },
  pack_49: {
    code: 'pack_49',
    name: 'Starter 15 Pack',
    badge: 'Popular · ₹3.2/class',
    price_inr: 49,
    duration_days: 30,
    credits: 15,
    is_unlimited: false,
    mcq_enabled: false,
    tagline: '15 Pro Note credits · 15 classes',
    highlights: [
      '15 Pro Master Notes credits (15 classes)',
      'Save 64% compared to single ₹9 credits',
      'PRO badge on your profile + HD PDF export',
      'Permanent access to all unlocked class notes',
    ],
  },
  pro_monthly_349: {
    code: 'pro_monthly_349',
    name: 'Pro Monthly',
    badge: 'Unlimited + MCQs',
    price_inr: 349,
    duration_days: 30,
    credits: null,
    is_unlimited: true,
    mcq_enabled: true,
    tagline: 'Unlimited Pro Notes + Session MCQ Tests / month',
    highlights: [
      'Unlimited Pro Master Notes every month',
      'Interactive Session MCQ Test after every meeting',
      'Instant grading + concept explanations + retake',
      'Premium PRO profile badge + HD PDF export',
    ],
  },
  pro_yearly_899: {
    code: 'pro_yearly_899',
    name: 'Pro Yearly',
    badge: 'Best Value · Save 78%',
    price_inr: 899,
    duration_days: 365,
    credits: null,
    is_unlimited: true,
    mcq_enabled: true,
    tagline: '1 Full Year Unlimited Pro Notes + Session MCQs (~₹75/mo)',
    highlights: [
      'Unlimited Pro Master Notes for 365 days',
      'Unlimited Session MCQ Tests to master every topic',
      'Save ₹3,289/year compared to Pro Monthly',
      'Premium PRO profile badge + Priority AI engine',
    ],
  },
};

export const ORDERED_PLANS: PlanDefinition[] = [
  PLAN_CATALOG.free,
  PLAN_CATALOG.single_9,
  PLAN_CATALOG.pack_49,
  PLAN_CATALOG.pro_monthly_349,
  PLAN_CATALOG.pro_yearly_899,
];

export function isRazorpayConfigured(): boolean {
  return Boolean(
    env.razorpayKeyId &&
      env.razorpayKeySecret &&
      !env.razorpayKeyId.includes('your-') &&
      !env.razorpayKeySecret.includes('your-'),
  );
}

function requireSupabase() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new HttpError(503, 'Supabase is not configured on the backend.');
  }
  return supabase;
}

function buildFreeStatus(isExpired = false): UserSubscriptionStatus {
  return {
    plan_code: 'free',
    plan_name: PLAN_CATALOG.free.name,
    is_pro: false,
    is_unlimited: false,
    mcq_enabled: false,
    credits_remaining: 0,
    credits_total: 0,
    started_at: null,
    expires_at: null,
    is_expired: isExpired,
    razorpay_live: isRazorpayConfigured(),
  };
}

async function downgradeExpiredSubscriptionAndNotify(
  userId: string,
  previousPlanCode: PlanCode,
  reason: 'expired' | 'credits_used',
): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase || previousPlanCode === 'free') return;

  // Atomic conditional flip from paid -> 'free' guarantees the expiry email is sent EXACTLY ONCE!
  const { data: flipped, error } = await supabase
    .from('user_subscriptions')
    .update({
      plan_code: 'free',
      credits_remaining: 0,
      credits_total: 0,
      is_unlimited: false,
      mcq_enabled: false,
      expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .neq('plan_code', 'free')
    .select('user_id');

  if (error || !flipped || flipped.length === 0) {
    return;
  }

  try {
    const { data: prof } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', userId)
      .maybeSingle<{ email: string; full_name: string | null }>();

    if (prof?.email) {
      const planDef = PLAN_CATALOG[previousPlanCode] ?? PLAN_CATALOG.free;
      await sendSubscriptionExpiredEmail({
        to: prof.email,
        userName: prof.full_name || prof.email.split('@')[0],
        previousPlanName: planDef.name,
        reason,
      });
    }
  } catch (err) {
    console.warn('[billing] Failed to dispatch expiry notification email:', err);
  }
}

export async function processExpiredSubscriptions(): Promise<number> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return 0;

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('user_subscriptions')
    .select('user_id, plan_code, expires_at')
    .neq('plan_code', 'free')
    .not('expires_at', 'is', null)
    .lte('expires_at', nowIso)
    .limit(100);

  if (error || !data || data.length === 0) return 0;

  let count = 0;
  for (const row of data as Array<{ user_id: string; plan_code: PlanCode }>) {
    await downgradeExpiredSubscriptionAndNotify(row.user_id, row.plan_code, 'expired');
    count += 1;
  }
  return count;
}

let expiryWatcherStarted = false;

export function startSubscriptionExpiryWatcher(): void {
  if (expiryWatcherStarted) return;
  expiryWatcherStarted = true;

  // Initial check 15s after boot, then sweep every 5 minutes so offline users get expiry email promptly
  setTimeout(() => {
    void processExpiredSubscriptions().catch((err) => {
      console.warn('[billing] Initial expiry sweep error:', err);
    });
  }, 15_000);

  const timer = setInterval(() => {
    void processExpiredSubscriptions().catch((err) => {
      console.warn('[billing] Periodic expiry sweep error:', err);
    });
  }, 5 * 60 * 1000);

  timer.unref?.();
}

export async function getUserSubscriptionStatus(userId: string): Promise<UserSubscriptionStatus> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return buildFreeStatus(false);

  const { data, error } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle<SubscriptionRow>();

  if (error || !data) {
    // Gracefully fall back to Free if migration not run yet or user has no row
    return buildFreeStatus(false);
  }

  const now = Date.now();
  const expiresAtMs = data.expires_at ? new Date(data.expires_at).getTime() : null;
  const expired = Boolean(expiresAtMs && now >= expiresAtMs);

  if (expired || data.plan_code === 'free') {
    if (expired && data.plan_code !== 'free') {
      void downgradeExpiredSubscriptionAndNotify(userId, data.plan_code, 'expired');
    }
    return buildFreeStatus(expired);
  }

  const def = PLAN_CATALOG[data.plan_code] ?? PLAN_CATALOG.free;
  const hasActiveEntitlement = data.is_unlimited || data.credits_remaining > 0;

  if (!hasActiveEntitlement) {
    void downgradeExpiredSubscriptionAndNotify(userId, data.plan_code, 'credits_used');
    return buildFreeStatus(true);
  }

  return {
    plan_code: hasActiveEntitlement ? data.plan_code : 'free',
    plan_name: hasActiveEntitlement ? def.name : PLAN_CATALOG.free.name,
    is_pro: hasActiveEntitlement,
    is_unlimited: data.is_unlimited,
    mcq_enabled: data.mcq_enabled,
    credits_remaining: data.is_unlimited ? 0 : Math.max(0, data.credits_remaining),
    credits_total: data.is_unlimited ? 0 : Math.max(0, data.credits_total),
    started_at: data.started_at,
    expires_at: data.expires_at,
    is_expired: false,
    razorpay_live: isRazorpayConfigured(),
  };
}

export async function activatePlanForUser(
  userId: string,
  planCode: PaidPlanCode,
): Promise<UserSubscriptionStatus> {
  const supabase = requireSupabase();
  const plan = PLAN_CATALOG[planCode];
  if (!plan || plan.code === 'free') {
    throw new HttpError(400, 'Invalid plan selected.');
  }

  const current = await getUserSubscriptionStatus(userId);
  const now = new Date();
  const durationMs = (plan.duration_days ?? 30) * 24 * 60 * 60 * 1000;

  let nextPlanCode: PlanCode = planCode;
  let nextUnlimited = plan.is_unlimited;
  let nextMcq = plan.mcq_enabled;
  let nextCreditsRemaining = plan.credits ?? 0;
  let nextCreditsTotal = plan.credits ?? 0;
  let nextExpiresAt = new Date(now.getTime() + durationMs);

  if (plan.is_unlimited) {
    // Extend from current active unlimited expiry if upgrading/renewing
    const baseTime =
      current.is_unlimited && current.expires_at
        ? Math.max(now.getTime(), new Date(current.expires_at).getTime())
        : now.getTime();
    nextExpiresAt = new Date(baseTime + durationMs);
    nextCreditsRemaining = 0;
    nextCreditsTotal = 0;
  } else if (current.is_unlimited && current.expires_at) {
    // Already unlimited — keep unlimited active
    nextPlanCode = current.plan_code;
    nextUnlimited = true;
    nextMcq = current.mcq_enabled;
    nextExpiresAt = new Date(current.expires_at);
  } else {
    // Credit pack (₹9 = 1 credit, ₹49 = 15 credits) — stack onto active non-expired credits & reset 30-day window
    const carryOver = !current.is_expired ? current.credits_remaining : 0;
    const carryTotal = !current.is_expired ? current.credits_total : 0;
    nextCreditsRemaining = carryOver + (plan.credits ?? 0);
    nextCreditsTotal = carryTotal + (plan.credits ?? 0);
    nextPlanCode =
      current.plan_code === 'pack_49' || planCode === 'pack_49' ? 'pack_49' : 'single_9';
  }

  const { error } = await supabase.from('user_subscriptions').upsert(
    {
      user_id: userId,
      plan_code: nextPlanCode,
      credits_remaining: nextCreditsRemaining,
      credits_total: nextCreditsTotal,
      is_unlimited: nextUnlimited,
      mcq_enabled: nextMcq,
      started_at: current.is_pro && current.started_at ? current.started_at : now.toISOString(),
      expires_at: nextExpiresAt.toISOString(),
      updated_at: now.toISOString(),
    },
    { onConflict: 'user_id' },
  );

  if (error) {
    throw new HttpError(
      500,
      `Could not activate subscription (ensure the Pro Plans SQL migration was run): ${error.message}`,
    );
  }

  return getUserSubscriptionStatus(userId);
}

export async function consumeOneProCreditIfNeeded(
  userId: string,
): Promise<{ unlockSource: PlanCode; updatedStatus: UserSubscriptionStatus }> {
  const status = await getUserSubscriptionStatus(userId);
  if (!status.is_pro) {
    throw new HttpError(
      402,
      'You need a Pro Note credit (₹9) or active Pro plan to upgrade these notes.',
    );
  }

  if (status.is_unlimited) {
    return { unlockSource: status.plan_code, updatedStatus: status };
  }

  if (status.credits_remaining <= 0) {
    throw new HttpError(
      402,
      'Your Pro Note credits are used up. Get 1 credit for ₹9 or 15 credits for ₹49!',
    );
  }

  const supabase = requireSupabase();
  const nextRemaining = Math.max(0, status.credits_remaining - 1);
  if (nextRemaining === 0) {
    await downgradeExpiredSubscriptionAndNotify(userId, status.plan_code, 'credits_used');
    const updatedStatus = await getUserSubscriptionStatus(userId);
    return { unlockSource: status.plan_code, updatedStatus };
  }

  const { error } = await supabase
    .from('user_subscriptions')
    .update({
      credits_remaining: nextRemaining,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) {
    throw new HttpError(500, `Failed to deduct Pro Note credit: ${error.message}`);
  }

  const updatedStatus = await getUserSubscriptionStatus(userId);
  return { unlockSource: status.plan_code, updatedStatus };
}

export async function createCheckoutOrder(
  userId: string,
  planCode: PaidPlanCode,
  meetingCode?: string,
): Promise<{
  order_id: string;
  provider: 'razorpay' | 'demo';
  razorpay_key_id?: string;
  razorpay_order_id?: string;
  amount_paise: number;
  amount_inr: number;
  currency: 'INR';
  plan: PlanDefinition;
}> {
  const plan = PLAN_CATALOG[planCode];
  if (!plan || plan.code === 'free') {
    throw new HttpError(400, 'Please select a valid Pro plan.');
  }

  if (!isRazorpayConfigured()) {
    throw new HttpError(
      503,
      'Online UPI & Card payments are being enabled shortly. Please try again in a moment.',
    );
  }

  const supabase = requireSupabase();
  const amountPaise = plan.price_inr * 100;
  const auth = Buffer.from(`${env.razorpayKeyId}:${env.razorpayKeySecret}`).toString('base64');
  const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: 'INR',
      receipt: `mm_${Date.now()}`,
      notes: {
        user_id: userId,
        plan_code: planCode,
        ...(meetingCode ? { meeting_code: meetingCode } : {}),
      },
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!rzpRes.ok) {
    const errText = await rzpRes.text().catch(() => '');
    throw new HttpError(502, `Razorpay order creation failed: ${errText.slice(0, 180)}`);
  }

  const rzpData = (await rzpRes.json()) as { id: string };
  const provider: 'razorpay' = 'razorpay';
  const providerOrderId = rzpData.id;

  const { data: orderRow, error } = await supabase
    .from('payment_orders')
    .insert({
      user_id: userId,
      plan_code: planCode,
      meeting_code: meetingCode?.trim() || null,
      amount_inr: plan.price_inr,
      currency: 'INR',
      provider,
      provider_order_id: providerOrderId,
      status: 'created',
    })
    .select('*')
    .single<PaymentOrderRow>();

  if (error || !orderRow) {
    throw new HttpError(
      500,
      `Could not create payment order (make sure SQL migration 20261127000001_pro_plans_and_mcqs.sql is run): ${error?.message ?? 'Unknown'}`,
    );
  }

  return {
    order_id: orderRow.id,
    provider,
    ...(provider === 'razorpay'
      ? { razorpay_key_id: env.razorpayKeyId, razorpay_order_id: providerOrderId }
      : {}),
    amount_paise: amountPaise,
    amount_inr: plan.price_inr,
    currency: 'INR',
    plan,
  };
}

export async function verifyCheckoutOrder(
  userId: string,
  input: {
    order_id: string;
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  },
): Promise<{
  subscription: UserSubscriptionStatus;
  plan_code: PaidPlanCode;
  meeting_code: string | null;
}> {
  const supabase = requireSupabase();
  const { data: order, error } = await supabase
    .from('payment_orders')
    .select('*')
    .eq('id', input.order_id)
    .eq('user_id', userId)
    .maybeSingle<PaymentOrderRow>();

  if (error || !order) {
    throw new HttpError(404, 'Payment order not found.');
  }

  if (order.status === 'paid') {
    const subscription = await getUserSubscriptionStatus(userId);
    return {
      subscription,
      plan_code: order.plan_code,
      meeting_code: order.meeting_code,
    };
  }

  if (order.provider !== 'razorpay' || !isRazorpayConfigured()) {
    throw new HttpError(400, 'Verified Razorpay payment is required to activate a Pro plan.');
  }

  if (!input.razorpay_order_id || !input.razorpay_payment_id || !input.razorpay_signature) {
    throw new HttpError(400, 'Missing Razorpay payment verification signature.');
  }
  if (input.razorpay_order_id !== order.provider_order_id) {
    throw new HttpError(400, 'Razorpay order ID mismatch.');
  }
  const expectedSig = crypto
    .createHmac('sha256', env.razorpayKeySecret)
    .update(`${input.razorpay_order_id}|${input.razorpay_payment_id}`)
    .digest('hex');

  if (expectedSig !== input.razorpay_signature) {
    await supabase
      .from('payment_orders')
      .update({ status: 'failed' })
      .eq('id', order.id);
    throw new HttpError(400, 'Invalid Razorpay payment signature.');
  }
  const paymentId = input.razorpay_payment_id;

  await supabase
    .from('payment_orders')
    .update({
      status: 'paid',
      provider_payment_id: paymentId,
      paid_at: new Date().toISOString(),
    })
    .eq('id', order.id);

  const subscription = await activatePlanForUser(userId, order.plan_code);

  // Fire-and-forget branded MyMeet Pro subscription greeting & info email
  void (async () => {
    try {
      const { data: prof } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', userId)
        .maybeSingle<{ email: string; full_name: string | null }>();
      const planDef = PLAN_CATALOG[order.plan_code];
      if (prof?.email && planDef) {
        await sendSubscriptionWelcomeEmail({
          to: prof.email,
          userName: prof.full_name || prof.email.split('@')[0],
          planName: planDef.name,
          priceInr: planDef.price_inr,
          isUnlimited: subscription.is_unlimited,
          mcqEnabled: subscription.mcq_enabled,
          creditsRemaining: subscription.credits_remaining,
          expiresAt: subscription.expires_at,
          highlights: planDef.highlights,
        });
      }
    } catch (mailErr) {
      console.warn('[billing] Subscription email error:', mailErr);
    }
  })();

  return {
    subscription,
    plan_code: order.plan_code,
    meeting_code: order.meeting_code,
  };
}
