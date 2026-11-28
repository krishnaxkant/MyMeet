import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env.js';

export interface EmailSendResult {
  sent: boolean;
  status: 'sent' | 'not_configured' | 'failed';
  message: string;
}

const isPlaceholder = (value: string): boolean => {
  return !value || value.includes('your-') || value.trim().length === 0;
};

export function isSmtpConfigured(): boolean {
  return !isPlaceholder(env.smtpHost) && !isPlaceholder(env.smtpUser) && !isPlaceholder(env.smtpPass);
}

let transporter: Transporter | null = null;
let onEmailSentHook: (() => void) | null = null;

export function registerEmailSentHook(fn: () => void): void {
  onEmailSentHook = fn;
}

function getTransporter(): Transporter | null {
  if (!isSmtpConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpPort === 465,
      auth: {
        user: env.smtpUser,
        pass: env.smtpPass,
      },
    });
  }
  return transporter;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getPublicBaseUrl(): string {
  return (env.webAppUrl || 'https://mymeet-live.vercel.app').replace(/\/$/, '');
}

/**
 * Ensures From address always aligns with SMTP_USER (critical for Gmail SPF/DKIM pass
 * and avoiding Gmail Spam folder when sending via Gmail SMTP).
 */
function getAlignedFromAddress(displayName = 'MyMeet'): string {
  const user = env.smtpUser.trim();
  const rawFrom = env.smtpFrom.trim();
  if (rawFrom && user && rawFrom.toLowerCase().includes(user.toLowerCase())) {
    return rawFrom;
  }
  return user ? `${displayName} <${user}>` : rawFrom || 'MyMeet <noreply@mymeet.app>';
}

function renderBrandHeader(): string {
  const logoUrl = `${getPublicBaseUrl()}/mymeet-mark.png?v=2`;
  return `
    <table role="presentation" style="border-collapse: collapse; margin-bottom: 18px;">
      <tr>
        <td style="padding-right: 10px; vertical-align: middle;">
          <img src="${logoUrl}" alt="MyMeet" width="32" height="32" style="display: block; border: 0; border-radius: 6px;" />
        </td>
        <td style="vertical-align: middle;">
          <div style="font-size: 20px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.1;">
            <span style="color: #0b132b;">My</span><span style="color: #2563eb;">Meet</span>
          </div>
          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Connect. Collaborate. Together.</div>
        </td>
      </tr>
    </table>
  `;
}

function renderEmailFooter(note?: string): string {
  const base = getPublicBaseUrl();
  return `
    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 12px; line-height: 1.6;">
      ${note ? `<div style="margin-bottom: 6px;">${note}</div>` : ''}
      <div>
        <strong style="color: #64748b;">MyMeet</strong> · Connect. Collaborate. Together.
      </div>
      <div style="margin-top: 4px;">
        <a href="${base}/pricing" style="color: #64748b; text-decoration: none;">Pricing</a> ·
        <a href="${base}/refund" style="color: #64748b; text-decoration: none;">Refund Policy</a> ·
        <a href="${base}/privacy" style="color: #64748b; text-decoration: none;">Privacy</a> ·
        <a href="${base}/contact" style="color: #64748b; text-decoration: none;">Contact Support</a>
      </div>
    </div>
  `;
}

/* ==========================================================================
   1. MEETING INVITATION EMAIL
   ========================================================================== */

export async function sendMeetingInviteEmail(params: {
  to: string;
  inviterName: string;
  meetingTitle: string;
  meetingCode: string;
}): Promise<EmailSendResult> {
  const mailer = getTransporter();
  if (!mailer) {
    return {
      sent: false,
      status: 'not_configured',
      message:
        'In-app invite sent. Configure SMTP_HOST, SMTP_USER, and SMTP_PASS in .env to deliver emails.',
    };
  }

  const joinUrl = `${getPublicBaseUrl()}/meet/${params.meetingCode}`;
  const fromAddress = getAlignedFromAddress('MyMeet');

  const safeInviter = escapeHtml(params.inviterName);
  const safeTitle = escapeHtml(params.meetingTitle);
  const safeCode = escapeHtml(params.meetingCode);

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #f8fafc;">
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-top: 4px solid #2563eb; border-radius: 16px; padding: 28px;">
        ${renderBrandHeader()}

        <h1 style="margin: 0 0 8px; color: #0f172a; font-size: 22px; letter-spacing: -0.02em;">
          You're invited to a MyMeet session
        </h1>
        <p style="margin: 0 0 18px; color: #475569; font-size: 15px; line-height: 1.6;">
          <strong>${safeInviter}</strong> invited you to join <strong>${safeTitle}</strong>.
        </p>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; margin-bottom: 20px;">
          <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em;">
            Meeting Code
          </div>
          <div style="font-size: 22px; font-weight: 800; color: #0f172a; margin-top: 4px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: 0.04em;">
            ${safeCode}
          </div>
        </div>

        <a href="${joinUrl}" style="display: inline-block; background: linear-gradient(135deg, #00a8ff 0%, #2563eb 55%, #4f46e5 100%); color: #ffffff; text-decoration: none; font-weight: 700; padding: 12px 24px; border-radius: 10px; font-size: 15px;">
          Join MyMeet →
        </a>

        <p style="margin: 18px 0 0; color: #64748b; font-size: 12.5px; word-break: break-all;">
          Or open directly in your browser:<br/>
          <a href="${joinUrl}" style="color: #2563eb;">${escapeHtml(joinUrl)}</a>
        </p>

        ${renderEmailFooter()}
      </div>
    </div>
  `;

  const text = [
    `${params.inviterName} invited you to join "${params.meetingTitle}" on MyMeet.`,
    '',
    `Meeting Code: ${params.meetingCode}`,
    `Join Link: ${joinUrl}`,
  ].join('\n');

  try {
    await mailer.sendMail({
      from: fromAddress,
      to: params.to,
      subject: `MyMeet Invitation: ${params.meetingTitle}`,
      text,
      html,
    });
    onEmailSentHook?.();

    return {
      sent: true,
      status: 'sent',
      message: `Invitation email sent to ${params.to}.`,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'SMTP error';
    console.warn('[email] Failed to send invitation email:', reason);
    return {
      sent: false,
      status: 'failed',
      message: `In-app invite saved, but email delivery failed: ${reason}`,
    };
  }
}

/* ==========================================================================
   2. SUBSCRIPTION / PRO PACK PURCHASE CONFIRMATION EMAIL (PLAN-ACCURATE!)
   ========================================================================== */

export async function sendSubscriptionWelcomeEmail(params: {
  to: string;
  userName: string;
  planCode: 'single_9' | 'pack_49' | 'pro_monthly_349' | 'pro_yearly_899';
  planName: string;
  priceInr: number;
  isUnlimited: boolean;
  mcqEnabled: boolean;
  creditsIncluded: number;
  creditsRemaining: number;
  expiresAt: string | null;
  paymentId?: string | null;
  highlights: string[];
}): Promise<EmailSendResult> {
  const mailer = getTransporter();
  if (!mailer) {
    return {
      sent: false,
      status: 'not_configured',
      message: 'SMTP not configured; skipping subscription confirmation email.',
    };
  }

  const fromAddress = getAlignedFromAddress('MyMeet');
  const safeName = escapeHtml(params.userName || 'there');
  const safePlan = escapeHtml(params.planName);
  const dashboardUrl = `${getPublicBaseUrl()}/history`;
  const hasProThemeAndBadge = params.planCode !== 'single_9';

  const validTill =
    params.isUnlimited && params.expiresAt
      ? new Date(params.expiresAt).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : null;

  // Plan-accurate badge, headline, subject & intro paragraph (ZERO false claims!)
  let badgeText = '✦ MYMEET PRO ACTIVATED';
  let headlineText = `Welcome to MyMeet Pro, ${safeName}!`;
  let introHtml = `Thank you for upgrading to <strong>${safePlan}</strong>. Unlimited Pro Master Notes, Quick 20-MCQ Session Revision Tests, your luxury PRO workspace theme, and gold profile badge are now live across both Web and Android.`;
  let subjectLine = `MyMeet Pro Activated — ${params.planName} (₹${params.priceInr})`;
  let accentBorder = '#f59e0b';

  if (params.planCode === 'single_9') {
    badgeText = '✦ PRO NOTE PASS UNLOCKED';
    headlineText = `Your ${safePlan} is ready, ${safeName}!`;
    introHtml = `Thank you for purchasing <strong>${safePlan} (₹${params.priceInr})</strong>. You now have <strong>1 Pro Master Notes credit</strong> ready to unlock deep AI study notes, code blocks, derivations, and HD PDF export for any 1 class or meeting across Web and Android.`;
    subjectLine = `MyMeet Receipt — ${params.planName} (₹${params.priceInr}) Ready`;
    accentBorder = '#7c3aed';
  } else if (params.planCode === 'pack_49') {
    badgeText = '✦ 15 PRO NOTES PACK ACTIVATED';
    headlineText = `Your ${safePlan} is active, ${safeName}!`;
    introHtml = `Thank you for purchasing <strong>${safePlan} (₹${params.priceInr})</strong>. Your <strong>15 Pro Master Notes credits</strong>, premium PRO workspace theme, and gold profile badge are now live across both Web and Android.`;
    subjectLine = `MyMeet Receipt — ${params.planName} (₹${params.priceInr}) Activated`;
    accentBorder = '#7c3aed';
  }

  const notesValue = params.isUnlimited
    ? '∞ Unlimited (Every class &amp; meeting)'
    : params.creditsRemaining > params.creditsIncluded
      ? `${params.creditsIncluded} Credit${params.creditsIncluded === 1 ? '' : 's'} added (${params.creditsRemaining} total active)`
      : `${params.creditsIncluded} Class Credit${params.creditsIncluded === 1 ? '' : 's'}`;

  const summaryRows: Array<{ label: string; valueHtml: string }> = [
    {
      label: 'Plan Purchased',
      valueHtml: `<span style="color: #0f172a; font-weight: 700;">${safePlan} (₹${params.priceInr})</span>`,
    },
    {
      label: 'Pro Master Notes',
      valueHtml: `<span style="color: #0f172a; font-weight: 700;">${notesValue}</span>`,
    },
    {
      label: 'Quick 20-MCQ Revision Tests',
      valueHtml: params.mcqEnabled
        ? `<span style="color: #15803d; font-weight: 700;">✓ Unlocked</span>`
        : `<span style="color: #64748b; font-weight: 600;">✕ Not included (Pro Monthly / Yearly only)</span>`,
    },
    {
      label: 'PRO Theme &amp; Gold Badge',
      valueHtml: hasProThemeAndBadge
        ? `<span style="color: #15803d; font-weight: 700;">✓ Included</span>`
        : `<span style="color: #64748b; font-weight: 600;">✕ Not included in Single Pass</span>`,
    },
  ];

  if (validTill) {
    summaryRows.push({
      label: 'Valid Till',
      valueHtml: `<span style="color: #0f172a; font-weight: 700;">${escapeHtml(validTill)}</span>`,
    });
  }

  if (params.paymentId) {
    summaryRows.push({
      label: 'Payment Receipt ID',
      valueHtml: `<span style="color: #334155; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; font-weight: 600;">${escapeHtml(params.paymentId)}</span>`,
    });
  }

  const summaryTableHtml = summaryRows
    .map(
      (row) => `
      <tr>
        <td style="padding: 6px 0; color: #64748b; border-bottom: 1px solid #eef2f6;">${row.label}</td>
        <td style="padding: 6px 0; text-align: right; border-bottom: 1px solid #eef2f6;">${row.valueHtml}</td>
      </tr>`,
    )
    .join('');

  const benefitItems = params.highlights
    .map(
      (item) =>
        `<li style="margin: 6px 0; color: #334155; font-size: 14px; line-height: 1.5;">✓ ${escapeHtml(item)}</li>`,
    )
    .join('');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; background: #f8fafc;">
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-top: 4px solid ${accentBorder}; border-radius: 16px; padding: 28px;">
        ${renderBrandHeader()}

        <div style="display: inline-block; padding: 4px 12px; border-radius: 999px; background: linear-gradient(135deg, #f59e0b, #7c3aed); color: #ffffff; font-size: 11px; font-weight: 800; letter-spacing: 0.06em; margin-bottom: 14px;">
          ${badgeText}
        </div>
        <h1 style="margin: 0 0 8px; color: #0f172a; font-size: 23px; letter-spacing: -0.02em;">
          ${headlineText}
        </h1>
        <p style="margin: 0 0 20px; color: #475569; font-size: 15px; line-height: 1.6;">
          ${introHtml}
        </p>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 18px; margin-bottom: 20px;">
          <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px;">
            Order &amp; Plan Summary
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 13.5px;">
            ${summaryTableHtml}
          </table>
        </div>

        <div style="margin-bottom: 22px;">
          <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 6px;">What's included in your plan:</div>
          <ul style="list-style: none; padding: 0; margin: 0;">${benefitItems}</ul>
        </div>

        <a href="${dashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); color: #ffffff; text-decoration: none; font-weight: 700; padding: 12px 24px; border-radius: 10px; font-size: 14.5px;">
          Open MyMeet Pro Notes →
        </a>

        ${renderEmailFooter('Questions about your order? Simply reply to this email and our team will help you out.')}
      </div>
    </div>
  `;

  const textLines = [
    headlineText,
    '',
    `Plan: ${params.planName} (₹${params.priceInr})`,
    `Pro Master Notes: ${params.isUnlimited ? 'Unlimited' : `${params.creditsIncluded} class credit(s) (${params.creditsRemaining} total active)`}`,
    `Quick 20-MCQ Revision Tests: ${params.mcqEnabled ? 'Unlocked' : 'Not included (Pro Monthly / Yearly only)'}`,
    `PRO Theme & Gold Badge: ${hasProThemeAndBadge ? 'Included' : 'Not included in Single Pass'}`,
    ...(validTill ? [`Valid Till: ${validTill}`] : []),
    ...(params.paymentId ? [`Payment Receipt ID: ${params.paymentId}`] : []),
    '',
    `Open your notes: ${dashboardUrl}`,
  ];

  try {
    await mailer.sendMail({
      from: fromAddress,
      to: params.to,
      subject: subjectLine,
      text: textLines.join('\n'),
      html,
    });
    onEmailSentHook?.();
    return {
      sent: true,
      status: 'sent',
      message: `Subscription confirmation email sent to ${params.to}.`,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'SMTP error';
    console.warn('[email] Failed to send subscription welcome email:', reason);
    return {
      sent: false,
      status: 'failed',
      message: `Subscription activated, but email failed: ${reason}`,
    };
  }
}

/* ==========================================================================
   3. SIGNUP EMAIL VERIFICATION
   ========================================================================== */

export async function sendEmailVerificationEmail(params: {
  to: string;
  fullName: string;
  verifyUrl: string;
}): Promise<EmailSendResult> {
  const mailer = getTransporter();
  if (!mailer) {
    return {
      sent: false,
      status: 'not_configured',
      message: 'SMTP is not configured on backend.',
    };
  }

  const fromAddress = getAlignedFromAddress('MyMeet');
  const safeName = escapeHtml(params.fullName || 'there');

  // Ultra-clean transactional email (low HTML weight, single primary domain link, zero external image trackers)
  // to maximize Gmail Primary Inbox placement.
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 20px; color: #0f172a;">
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 26px;">
        <div style="font-size: 19px; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 18px;">
          <span style="color: #0b132b;">My</span><span style="color: #2563eb;">Meet</span>
        </div>

        <p style="margin: 0 0 12px; font-size: 15px; line-height: 1.6; color: #1e293b;">
          Hi ${safeName},
        </p>
        <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #475569;">
          Thanks for signing up for MyMeet. Please confirm your email address to activate your account on Web and Android.
        </p>

        <p style="margin: 0 0 22px;">
          <a href="${params.verifyUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-weight: 600; padding: 12px 22px; border-radius: 8px; font-size: 14.5px;">
            Verify Email Address
          </a>
        </p>

        <p style="margin: 0 0 14px; color: #64748b; font-size: 12.5px; line-height: 1.5; word-break: break-all;">
          Or open this link directly:<br/>
          <a href="${params.verifyUrl}" style="color: #2563eb;">${escapeHtml(params.verifyUrl)}</a>
        </p>

        <p style="margin: 18px 0 0; padding-top: 14px; border-top: 1px solid #f1f5f9; color: #94a3b8; font-size: 12px;">
          If you did not create a MyMeet account, you can ignore this message.
        </p>
      </div>
    </div>
  `;

  const text = [
    `Hi ${params.fullName || 'there'},`,
    '',
    'Thanks for signing up for MyMeet. Please confirm your email address by opening this link:',
    params.verifyUrl,
    '',
    'Once confirmed, you can sign in on both MyMeet Web and Android.',
    '',
    'If you did not create a MyMeet account, you can ignore this message.',
  ].join('\n');

  try {
    await mailer.sendMail({
      from: fromAddress,
      replyTo: env.smtpUser || undefined,
      to: params.to,
      subject: 'Confirm your email for MyMeet',
      text,
      html,
    });
    onEmailSentHook?.();
    return {
      sent: true,
      status: 'sent',
      message: `Verification email sent to ${params.to}.`,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'SMTP error';
    console.warn('[email] Failed to send verification email:', reason);
    return {
      sent: false,
      status: 'failed',
      message: `Unable to send verification email: ${reason}`,
    };
  }
}

/* ==========================================================================
   4. SUBSCRIPTION EXPIRY / CREDITS COMPLETED EMAIL
   ========================================================================== */

export async function sendSubscriptionExpiredEmail(params: {
  to: string;
  userName: string;
  previousPlanName: string;
  reason: 'expired' | 'credits_used';
}): Promise<EmailSendResult> {
  const mailer = getTransporter();
  if (!mailer) {
    return {
      sent: false,
      status: 'not_configured',
      message: 'SMTP not configured; skipping subscription expiry email.',
    };
  }

  const fromAddress = getAlignedFromAddress('MyMeet');
  const safeName = escapeHtml(params.userName || 'there');
  const safePlan = escapeHtml(params.previousPlanName);
  const renewUrl = `${getPublicBaseUrl()}/pricing`;

  const isCreditsUsed = params.reason === 'credits_used';
  const headline = isCreditsUsed
    ? `Your ${safePlan} credits are complete`
    : `Your ${safePlan} subscription has ended`;

  const bodyCopy = isCreditsUsed
    ? `You've used all Pro Master Notes credits from your <strong>${safePlan}</strong>. Your account is now back on the free <strong>MyMeet Basic</strong> tier with zero recurring charges.`
    : `Your <strong>${safePlan}</strong> subscription period has ended and your account has automatically returned to the free <strong>MyMeet Basic</strong> tier with zero auto-debit charges.`;

  const nextStepNote = isCreditsUsed
    ? 'Grab another pass anytime starting at ₹9, or upgrade to Pro Monthly / Yearly for Unlimited Pro Master Notes &amp; Quick 20-MCQ Session Revision Tests.'
    : 'Renew anytime to restore Unlimited Pro Master Notes, Quick 20-MCQ Session Revision Tests, and your luxury MyMeet Pro workspace.';

  const ctaLabel = isCreditsUsed ? 'View Pro Plans →' : 'Renew MyMeet Pro →';

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #f8fafc;">
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-top: 4px solid #6366f1; border-radius: 16px; padding: 28px;">
        ${renderBrandHeader()}

        <h1 style="margin: 0 0 10px; color: #0f172a; font-size: 22px; letter-spacing: -0.02em;">
          ${headline}
        </h1>
        <p style="margin: 0 0 16px; color: #475569; font-size: 15px; line-height: 1.6;">
          Hi <strong>${safeName}</strong>, ${bodyCopy}
        </p>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; margin-bottom: 20px; font-size: 13.5px; color: #334155; line-height: 1.6;">
          <strong>Good news:</strong> Every Pro Master Note you already unlocked remains permanently saved in your MyMeet History.<br/>
          ${nextStepNote}
        </div>

        <a href="${renewUrl}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); color: #ffffff; text-decoration: none; font-weight: 700; padding: 12px 24px; border-radius: 10px; font-size: 14.5px;">
          ${ctaLabel}
        </a>

        ${renderEmailFooter()}
      </div>
    </div>
  `;

  const text = [
    `Hi ${params.userName || 'there'},`,
    '',
    isCreditsUsed
      ? `All Pro credits in your ${params.previousPlanName} have been used. Your account is now back on MyMeet Basic with zero recurring charges.`
      : `Your ${params.previousPlanName} subscription has ended. Your account is now back on MyMeet Basic with zero auto-debit charges.`,
    '',
    'Every Pro Master Note you already unlocked remains permanently saved in your History.',
    `View plans: ${renewUrl}`,
  ].join('\n');

  try {
    await mailer.sendMail({
      from: fromAddress,
      to: params.to,
      subject: isCreditsUsed
        ? `MyMeet: Your ${params.previousPlanName} credits are complete`
        : `MyMeet: Your ${params.previousPlanName} subscription has ended`,
      text,
      html,
    });
    onEmailSentHook?.();
    return {
      sent: true,
      status: 'sent',
      message: `Expiry email sent to ${params.to}.`,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'SMTP error';
    console.warn('[email] Failed to send subscription expiry email:', reason);
    return {
      sent: false,
      status: 'failed',
      message: `Subscription expired, but email failed: ${reason}`,
    };
  }
}

/* ==========================================================================
   5. FOUNDER OPS / SYSTEM SCALING ALERT EMAIL
   ========================================================================== */

export async function sendFounderAlertEmail(params: {
  to: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  summary: string;
  metrics: Array<{ label: string; value: string }>;
  actionSteps: string[];
}): Promise<EmailSendResult> {
  const mailer = getTransporter();
  if (!mailer || !params.to) {
    return {
      sent: false,
      status: 'not_configured',
      message: 'SMTP or admin alert email not configured.',
    };
  }

  const fromAddress = getAlignedFromAddress('MyMeet Ops');
  const accent =
    params.severity === 'critical'
      ? '#dc2626'
      : params.severity === 'warning'
        ? '#d97706'
        : '#2563eb';
  const badgeLabel =
    params.severity === 'critical'
      ? 'CRITICAL ALERT'
      : params.severity === 'warning'
        ? 'SCALING WARNING'
        : 'GROWTH ALERT';

  const metricsRows = params.metrics
    .map(
      (m) => `
      <tr>
        <td style="padding: 6px 0; color: #64748b; font-size: 13.5px; border-bottom: 1px solid #eef2f6;">${escapeHtml(m.label)}</td>
        <td style="padding: 6px 0; color: #0f172a; font-weight: 700; font-size: 13.5px; text-align: right; border-bottom: 1px solid #eef2f6;">${escapeHtml(m.value)}</td>
      </tr>`,
    )
    .join('');

  const stepsHtml = params.actionSteps
    .map(
      (s, i) =>
        `<li style="margin: 7px 0; color: #1e293b; font-size: 14px; line-height: 1.55;"><strong>${i + 1}.</strong> ${escapeHtml(s)}</li>`,
    )
    .join('');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; background: #f8fafc;">
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-top: 4px solid ${accent}; border-radius: 16px; padding: 26px;">
        ${renderBrandHeader()}

        <div style="display: inline-block; padding: 4px 10px; border-radius: 999px; background: ${accent}; color: #ffffff; font-size: 10.5px; font-weight: 800; letter-spacing: 0.06em; margin-bottom: 12px;">
          MYMEET OPS · ${badgeLabel}
        </div>
        <h1 style="margin: 0 0 8px; color: #0f172a; font-size: 21px; letter-spacing: -0.02em;">
          ${escapeHtml(params.title)}
        </h1>
        <p style="margin: 0 0 18px; color: #475569; font-size: 14.5px; line-height: 1.6;">
          ${escapeHtml(params.summary)}
        </p>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; margin-bottom: 18px;">
          <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px;">
            Live Server Snapshot
          </div>
          <table style="width: 100%; border-collapse: collapse;">${metricsRows}</table>
        </div>

        <div style="margin-bottom: 18px;">
          <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 6px;">Recommended Action:</div>
          <ol style="list-style: none; padding: 0; margin: 0;">${stepsHtml}</ol>
        </div>

        ${renderEmailFooter('Automated alert from MyMeet Backend Monitor (max 1 alert per issue every 4 hours).')}
      </div>
    </div>
  `;

  const text = [
    `[MyMeet ${badgeLabel}] ${params.title}`,
    '',
    params.summary,
    '',
    'Metrics:',
    ...params.metrics.map((m) => `- ${m.label}: ${m.value}`),
    '',
    'Recommended Actions:',
    ...params.actionSteps.map((s, i) => `${i + 1}. ${s}`),
  ].join('\n');

  try {
    await mailer.sendMail({
      from: fromAddress,
      to: params.to,
      subject: `[MyMeet ${badgeLabel}] ${params.title}`,
      text,
      html,
    });
    return {
      sent: true,
      status: 'sent',
      message: `Founder alert sent to ${params.to}.`,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'SMTP error';
    console.warn('[monitor] Failed to send founder alert email:', reason);
    return {
      sent: false,
      status: 'failed',
      message: reason,
    };
  }
}
