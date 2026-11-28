import { createClient } from '@supabase/supabase-js';
import { Router } from 'express';
import { env } from '../config/env.js';
import { getSupabaseAdmin } from '../config/supabase.js';
import { isSmtpConfigured, sendEmailVerificationEmail } from '../services/emailService.js';

const router = Router();

function buildDirectVerifyUrl(hashedToken: string | undefined, type: 'signup' | 'magiclink', fallbackUrl: string): string {
  if (!hashedToken) return fallbackUrl;
  const base = env.webAppUrl.replace(/\/$/, '');
  return `${base}/login?token_hash=${encodeURIComponent(hashedToken)}&type=${encodeURIComponent(type)}`;
}

/**
 * POST /api/auth/register
 * Creates an unconfirmed Supabase Auth user and sends a branded MyMeet verification email via SMTP.
 * Avoids Supabase's free-tier 2-emails/hour limit while keeping official Supabase cryptographic verification!
 */
router.post('/register', async (req, res, next) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : '';

    if (!email || !email.includes('@')) {
      res.status(400).json({ error: 'Bad Request', message: 'Please enter a valid email address.' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Bad Request', message: 'Password must be at least 6 characters.' });
      return;
    }

    const supabase = getSupabaseAdmin();
    if (!supabase || !isSmtpConfigured()) {
      res.json({
        status: 'fallback_client_signup',
        message: 'Use client signup flow.',
      });
      return;
    }

    const redirectTo = `${env.webAppUrl.replace(/\/$/, '')}/login?verified=1`;
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'signup',
      email,
      password,
      options: {
        data: {
          full_name: fullName || email.split('@')[0],
        },
        redirectTo,
      },
    });

    if (error || !data?.properties?.action_link) {
      const msg = error?.message || 'Unable to create account.';
      const statusCode = /already|registered|exists/i.test(msg) ? 409 : 400;
      res.status(statusCode).json({ error: 'Registration Error', message: msg });
      return;
    }

    const verifyUrl = buildDirectVerifyUrl(
      data.properties.hashed_token,
      'signup',
      data.properties.action_link,
    );

    const mailResult = await sendEmailVerificationEmail({
      to: email,
      fullName: fullName || email.split('@')[0],
      verifyUrl,
    });

    if (!mailResult.sent) {
      res.status(502).json({
        error: 'Email Error',
        message:
          'Your account was created, but we could not send the verification email. Please try resending in a moment.',
      });
      return;
    }

    res.status(201).json({
      status: 'verification_sent',
      email,
      message: `Account created! We sent a verification link to ${email}. Please verify your email before signing in.`,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/resend-verification
 * Re-sends a branded MyMeet email verification link for unverified accounts.
 */
router.post('/resend-verification', async (req, res, next) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!email || !email.includes('@')) {
      res.status(400).json({ error: 'Bad Request', message: 'Please enter a valid email address.' });
      return;
    }

    const supabase = getSupabaseAdmin();
    if (!supabase || !isSmtpConfigured()) {
      res.status(503).json({
        error: 'Unavailable',
        message: 'Email verification service is not configured.',
      });
      return;
    }

    // Look up profile by email to check if account exists and is still unconfirmed
    const { data: prof } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('email', email)
      .maybeSingle<{ id: string; full_name: string | null; email: string }>();

    if (prof) {
      const { data: authUser } = await supabase.auth.admin.getUserById(prof.id);
      if (authUser?.user?.email_confirmed_at) {
        res.json({
          status: 'already_verified',
          message: 'This email is already verified. You can sign in directly!',
        });
        return;
      }
    }

    const redirectTo = `${env.webAppUrl.replace(/\/$/, '')}/login?verified=1`;
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo },
    });

    if (error || !data?.properties?.action_link) {
      res.status(400).json({
        error: 'Resend Error',
        message: error?.message || 'Unable to resend verification email for this address.',
      });
      return;
    }

    const verifyUrl = buildDirectVerifyUrl(
      data.properties.hashed_token,
      'magiclink',
      data.properties.action_link,
    );

    const mailResult = await sendEmailVerificationEmail({
      to: email,
      fullName: prof?.full_name || email.split('@')[0],
      verifyUrl,
    });

    if (!mailResult.sent) {
      res.status(502).json({ error: 'Email Error', message: mailResult.message });
      return;
    }

    res.json({
      status: 'verification_sent',
      message: `Verification link re-sent to ${email}. Please check your inbox and spam folder.`,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/confirm
 * Confirms an email verification token_hash directly so users always land on mymeet-live.vercel.app
 * instead of Supabase's default localhost Site URL.
 */
router.post('/confirm', async (req, res, next) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const tokenHash = typeof body.token_hash === 'string' ? body.token_hash.trim() : '';
    const rawType = typeof body.type === 'string' ? body.type.trim() : 'signup';
    const allowedTypes = new Set(['signup', 'magiclink', 'email', 'invite', 'recovery', 'email_change']);
    const type = (allowedTypes.has(rawType) ? rawType : 'signup') as
      | 'signup'
      | 'magiclink'
      | 'email'
      | 'invite'
      | 'recovery'
      | 'email_change';

    if (!tokenHash) {
      res.status(400).json({ error: 'Bad Request', message: 'Missing verification token.' });
      return;
    }

    if (!env.supabaseUrl || !env.supabaseAnonKey) {
      res.status(503).json({ error: 'Unavailable', message: 'Supabase is not configured.' });
      return;
    }

    // Isolated client with persistSession: false so we never mutate shared admin state
    const verifier = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error } = await verifier.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (error) {
      res.status(400).json({
        error: 'Verification Failed',
        message: error.message || 'Verification link is invalid or has expired. Please request a new one.',
      });
      return;
    }

    res.json({
      verified: true,
      message: 'Email verified successfully! You can sign in to MyMeet now.',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
