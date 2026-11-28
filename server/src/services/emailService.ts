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
      message: 'In-app invite sent. Configure SMTP_HOST, SMTP_USER, and SMTP_PASS in .env to deliver emails.',
    };
  }

  const joinUrl = `${env.webAppUrl}/meet/${params.meetingCode}`;
  const fromAddress = env.smtpFrom || `MyMeet <${env.smtpUser}>`;

  const safeInviter = escapeHtml(params.inviterName);
  const safeTitle = escapeHtml(params.meetingTitle);
  const safeCode = escapeHtml(params.meetingCode);

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; background: #f6f8fc; border-radius: 14px;">
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px;">
        <div style="font-size: 20px; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 2px;">
          <span style="color: #0b132b;">My</span><span style="color: #2563eb;">Meet</span>
        </div>
        <div style="font-size: 11px; color: #64748b; margin-bottom: 14px;">Connect. Collaborate. Together.</div>
        <h2 style="margin: 0 0 8px; color: #0f172a; font-size: 20px;">You're invited to a meeting</h2>
        <p style="margin: 0 0 18px; color: #475569; font-size: 15px;">
          <strong>${safeInviter}</strong> invited you to join <strong>${safeTitle}</strong>.
        </p>
        <div style="background: #f1f5f9; border-radius: 10px; padding: 14px; margin-bottom: 20px;">
          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Meeting Code</div>
          <div style="font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 4px; font-family: monospace;">${safeCode}</div>
        </div>
        <a href="${joinUrl}" style="display: inline-block; background: linear-gradient(90deg, #00a8ff, #2563eb, #7c3aed); color: #ffffff; text-decoration: none; font-weight: 700; padding: 12px 22px; border-radius: 10px; font-size: 15px;">
          Join MyMeet
        </a>
        <p style="margin: 18px 0 0; color: #64748b; font-size: 12px;">
          Or open this link in your browser: <a href="${joinUrl}" style="color: #2563eb;">${joinUrl}</a>
        </p>
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

export async function sendSubscriptionWelcomeEmail(params: {
  to: string;
  userName: string;
  planName: string;
  priceInr: number;
  isUnlimited: boolean;
  mcqEnabled: boolean;
  creditsRemaining: number;
  expiresAt: string | null;
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

  const fromAddress = env.smtpFrom || `MyMeet <${env.smtpUser}>`;
  const safeName = escapeHtml(params.userName || 'there');
  const safePlan = escapeHtml(params.planName);
  const dashboardUrl = `${env.webAppUrl}/history`;
  const validTill = params.expiresAt
    ? new Date(params.expiresAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'Active';

  const benefitItems = params.highlights
    .map(
      (item) =>
        `<li style="margin: 6px 0; color: #334155; font-size: 14px; line-height: 1.5;">✓ ${escapeHtml(item)}</li>`,
    )
    .join('');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #f8fafc;">
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-top: 4px solid #f59e0b; border-radius: 16px; padding: 28px;">
        <div style="display: inline-block; padding: 4px 12px; border-radius: 999px; background: linear-gradient(135deg, #f59e0b, #7c3aed); color: #ffffff; font-size: 11px; font-weight: 800; letter-spacing: 0.06em; margin-bottom: 14px;">
          ✦ MYMEET PRO ACTIVATED
        </div>
        <h1 style="margin: 0 0 8px; color: #0f172a; font-size: 24px; letter-spacing: -0.02em;">
          Welcome to MyMeet Pro, ${safeName}!
        </h1>
        <p style="margin: 0 0 20px; color: #475569; font-size: 15px; line-height: 1.6;">
          Thank you for upgrading to <strong>${safePlan}</strong>. Your premium MyMeet workspace, gold profile badge, and Pro study tools are now live across both Web and Android.
        </p>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 18px; margin-bottom: 20px;">
          <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 10px;">
            Subscription Summary
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 5px 0; color: #64748b;">Plan</td>
              <td style="padding: 5px 0; color: #0f172a; font-weight: 700; text-align: right;">${safePlan} (₹${params.priceInr})</td>
            </tr>
            <tr>
              <td style="padding: 5px 0; color: #64748b;">Pro Master Notes</td>
              <td style="padding: 5px 0; color: #0f172a; font-weight: 700; text-align: right;">${
                params.isUnlimited ? '∞ Unlimited' : `${params.creditsRemaining} Credit${params.creditsRemaining === 1 ? '' : 's'} Active`
              }</td>
            </tr>
            <tr>
              <td style="padding: 5px 0; color: #64748b;">Quick 20-MCQ Revision Tests</td>
              <td style="padding: 5px 0; color: ${params.mcqEnabled ? '#15803d' : '#b45309'}; font-weight: 700; text-align: right;">${
                params.mcqEnabled ? '✓ Unlocked' : 'Not included in credit packs'
              }</td>
            </tr>
            <tr>
              <td style="padding: 5px 0; color: #64748b;">Valid Till</td>
              <td style="padding: 5px 0; color: #0f172a; font-weight: 700; text-align: right;">${escapeHtml(validTill)}</td>
            </tr>
          </table>
        </div>

        <div style="margin-bottom: 22px;">
          <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 6px;">What's included in your plan:</div>
          <ul style="list-style: none; padding: 0; margin: 0;">${benefitItems}</ul>
        </div>

        <a href="${dashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #7c3aed 100%); color: #ffffff; text-decoration: none; font-weight: 700; padding: 12px 24px; border-radius: 10px; font-size: 14.5px;">
          Open MyMeet Pro Notes →
        </a>

        <p style="margin: 22px 0 0; color: #94a3b8; font-size: 12px; line-height: 1.5;">
          MyMeet · Connect. Collaborate. Together.<br/>
          Questions? Simply reply to this email and our team will help you out.
        </p>
      </div>
    </div>
  `;

  const text = [
    `Welcome to MyMeet Pro, ${params.userName || 'there'}!`,
    '',
    `Your ${params.planName} (₹${params.priceInr}) plan is now active.`,
    `Pro Master Notes: ${params.isUnlimited ? 'Unlimited' : `${params.creditsRemaining} credits`}`,
    `Quick 20-MCQ Revision Tests: ${params.mcqEnabled ? 'Unlocked' : 'Not included in credit packs'}`,
    `Valid Till: ${validTill}`,
    '',
    `Open your notes: ${dashboardUrl}`,
  ].join('\n');

  try {
    await mailer.sendMail({
      from: fromAddress,
      to: params.to,
      subject: `Welcome to MyMeet Pro — ${params.planName} Activated!`,
      text,
      html,
    });
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

  const fromAddress = env.smtpFrom || `MyMeet <${env.smtpUser}>`;
  const safeName = escapeHtml(params.fullName || 'there');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; background: #f8fafc;">
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-top: 4px solid #2563eb; border-radius: 16px; padding: 28px;">
        <div style="font-size: 21px; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 2px;">
          <span style="color: #0b132b;">My</span><span style="color: #2563eb;">Meet</span>
        </div>
        <div style="font-size: 11.5px; color: #64748b; margin-bottom: 18px;">Connect. Collaborate. Together.</div>

        <h1 style="margin: 0 0 10px; color: #0f172a; font-size: 22px; letter-spacing: -0.02em;">
          Verify your email address
        </h1>
        <p style="margin: 0 0 20px; color: #475569; font-size: 15px; line-height: 1.6;">
          Hi <strong>${safeName}</strong>, welcome to MyMeet! Click the button below to confirm your email address and activate your account across Web and Android.
        </p>

        <a href="${params.verifyUrl}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); color: #ffffff; text-decoration: none; font-weight: 700; padding: 13px 26px; border-radius: 10px; font-size: 15px;">
          Verify My Email →
        </a>

        <p style="margin: 20px 0 0; color: #64748b; font-size: 12.5px; line-height: 1.55; word-break: break-all;">
          If the button doesn't work, copy and paste this link into your browser:<br/>
          <a href="${params.verifyUrl}" style="color: #2563eb;">${escapeHtml(params.verifyUrl)}</a>
        </p>
        <p style="margin: 16px 0 0; color: #94a3b8; font-size: 12px;">
          If you didn't create a MyMeet account, you can safely ignore this email.
        </p>
      </div>
    </div>
  `;

  const text = [
    `Hi ${params.fullName || 'there'},`,
    '',
    'Welcome to MyMeet! Please verify your email address by opening this link:',
    params.verifyUrl,
    '',
    'Once verified, you can sign in on both MyMeet Web and Android.',
  ].join('\n');

  try {
    await mailer.sendMail({
      from: fromAddress,
      to: params.to,
      subject: 'Verify your MyMeet account email',
      text,
      html,
    });
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

  const fromAddress = env.smtpFrom || `MyMeet <${env.smtpUser}>`;
  const safeName = escapeHtml(params.userName || 'there');
  const safePlan = escapeHtml(params.previousPlanName);
  const renewUrl = `${env.webAppUrl.replace(/\/$/, '')}/profile?upgrade=pro_monthly_349`;

  const headline =
    params.reason === 'credits_used'
      ? `Your ${safePlan} credits have been used`
      : `Your ${safePlan} subscription has ended`;

  const bodyCopy =
    params.reason === 'credits_used'
      ? `You have used all Pro Master Notes credits in your <strong>${safePlan}</strong> pack. Your account has now switched back to the <strong>MyMeet Basic</strong> dashboard.`
      : `Your <strong>${safePlan}</strong> plan has expired and your account has now switched back to the <strong>MyMeet Basic</strong> dashboard.`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #f8fafc;">
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-top: 4px solid #6366f1; border-radius: 16px; padding: 28px;">
        <div style="font-size: 20px; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 2px;">
          <span style="color: #0b132b;">My</span><span style="color: #2563eb;">Meet</span>
        </div>
        <div style="font-size: 11px; color: #64748b; margin-bottom: 18px;">Connect. Collaborate. Together.</div>

        <h1 style="margin: 0 0 10px; color: #0f172a; font-size: 22px; letter-spacing: -0.02em;">
          ${headline}
        </h1>
        <p style="margin: 0 0 16px; color: #475569; font-size: 15px; line-height: 1.6;">
          Hi <strong>${safeName}</strong>, ${bodyCopy}
        </p>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; margin-bottom: 20px; font-size: 13.5px; color: #334155; line-height: 1.6;">
          <strong>Good news:</strong> Every Pro Master Note you already unlocked remains permanently saved in your MyMeet History.<br/>
          Renew anytime to restore Unlimited Pro Master Notes, Quick 20-MCQ Session Revision Tests, and your MyMeet Pro workspace.
        </div>

        <a href="${renewUrl}" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #7c3aed 100%); color: #ffffff; text-decoration: none; font-weight: 700; padding: 12px 24px; border-radius: 10px; font-size: 14.5px;">
          Renew MyMeet Pro →
        </a>

        <p style="margin: 22px 0 0; color: #94a3b8; font-size: 12px;">
          MyMeet · Connect. Collaborate. Together.
        </p>
      </div>
    </div>
  `;

  const text = [
    `Hi ${params.userName || 'there'},`,
    '',
    params.reason === 'credits_used'
      ? `All Pro credits in your ${params.previousPlanName} pack have been used. Your account is now back on MyMeet Basic.`
      : `Your ${params.previousPlanName} subscription has expired. Your account is now back on MyMeet Basic.`,
    '',
    'All Pro Master Notes you already unlocked remain permanently saved in your History.',
    `Renew anytime: ${renewUrl}`,
  ].join('\n');

  try {
    await mailer.sendMail({
      from: fromAddress,
      to: params.to,
      subject:
        params.reason === 'credits_used'
          ? `MyMeet: Your ${params.previousPlanName} credits are complete`
          : `MyMeet: Your ${params.previousPlanName} subscription has expired`,
      text,
      html,
    });
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
