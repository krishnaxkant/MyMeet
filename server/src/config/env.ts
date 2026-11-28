import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load root .env first, then allow server/.env overrides
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });

const parsePort = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const rawWebAppUrl = (process.env.WEB_APP_URL || '').trim().replace(/\/$/, '');
const isProd = (process.env.NODE_ENV || 'development') === 'production';
const resolvedWebAppUrl =
  !rawWebAppUrl || (isProd && /localhost|127\.0\.0\.1/i.test(rawWebAppUrl))
    ? isProd
      ? 'https://mymeet-live.vercel.app'
      : 'http://localhost:5173'
    : rawWebAppUrl;

export const env = {
  port: parsePort(process.env.PORT, 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  webAppUrl: resolvedWebAppUrl,
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  livekitUrl: process.env.LIVEKIT_URL || '',
  livekitApiKey: process.env.LIVEKIT_API_KEY || '',
  livekitApiSecret: process.env.LIVEKIT_API_SECRET || '',
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: parsePort(process.env.SMTP_PORT, 587),
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  smtpFrom: process.env.SMTP_FROM || '',
  adminAlertEmail: (process.env.ADMIN_ALERT_EMAIL || process.env.SMTP_USER || '').trim(),
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel:
    !process.env.GEMINI_MODEL || process.env.GEMINI_MODEL.trim() === 'gemini-2.5-flash'
      ? 'gemini-3.5-flash-lite'
      : process.env.GEMINI_MODEL.trim(),
  geminiProModel: process.env.GEMINI_PRO_MODEL?.trim() || 'gemini-3.1-pro-preview',
  razorpayKeyId: process.env.RAZORPAY_KEY_ID?.trim() || '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET?.trim() || '',
} as const;
