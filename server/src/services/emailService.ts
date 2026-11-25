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
  const fromAddress = env.smtpFrom || `Meet <${env.smtpUser}>`;

  const safeInviter = escapeHtml(params.inviterName);
  const safeTitle = escapeHtml(params.meetingTitle);
  const safeCode = escapeHtml(params.meetingCode);

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; background: #f6f8fc; border-radius: 14px;">
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px;">
        <div style="font-size: 18px; font-weight: 800; color: #2563eb; margin-bottom: 12px;">Meet</div>
        <h2 style="margin: 0 0 8px; color: #0f172a; font-size: 20px;">You're invited to a meeting</h2>
        <p style="margin: 0 0 18px; color: #475569; font-size: 15px;">
          <strong>${safeInviter}</strong> invited you to join <strong>${safeTitle}</strong>.
        </p>
        <div style="background: #f1f5f9; border-radius: 10px; padding: 14px; margin-bottom: 20px;">
          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Meeting Code</div>
          <div style="font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 4px; font-family: monospace;">${safeCode}</div>
        </div>
        <a href="${joinUrl}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; font-weight: 700; padding: 12px 22px; border-radius: 10px; font-size: 15px;">
          Join Meeting
        </a>
        <p style="margin: 18px 0 0; color: #64748b; font-size: 12px;">
          Or open this link in your browser: <a href="${joinUrl}" style="color: #2563eb;">${joinUrl}</a>
        </p>
      </div>
    </div>
  `;

  const text = [
    `${params.inviterName} invited you to join "${params.meetingTitle}" on Meet.`,
    '',
    `Meeting Code: ${params.meetingCode}`,
    `Join Link: ${joinUrl}`,
  ].join('\n');

  try {
    await mailer.sendMail({
      from: fromAddress,
      to: params.to,
      subject: `Meet Invitation: ${params.meetingTitle}`,
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
