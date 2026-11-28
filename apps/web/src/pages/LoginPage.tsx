import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthShell } from '../components/AuthShell';
import { BrandLogo } from '../components/BrandLogo';
import { useAuth } from '../hooks/useAuth';
import { confirmEmailVerification } from '../services/api';

export function LoginPage() {
  const { user, loading, isConfigured, signIn, signInWithGoogle, resendVerification } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/';
  const searchParams = new URLSearchParams(location.search);
  const isVerifiedRedirect = searchParams.get('verified') === '1';
  const tokenHash = searchParams.get('token_hash');
  const tokenType = searchParams.get('type') || 'signup';
  const confirmedRef = useRef(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(
    isVerifiedRedirect
      ? '✓ Email verified! You can sign in to MyMeet now.'
      : tokenHash
        ? 'Verifying your email address...'
        : null,
  );

  useEffect(() => {
    if (!tokenHash || confirmedRef.current) return;
    confirmedRef.current = true;
    setError(null);
    setNotice('Verifying your email address...');
    void confirmEmailVerification(tokenHash, tokenType)
      .then((res) => {
        setNotice(`✓ ${res.message}`);
        navigate('/login?verified=1', { replace: true });
      })
      .catch((err) => {
        setNotice(null);
        setError(
          err instanceof Error
            ? err.message
            : 'Verification link expired or already used. You can sign in or request a new link.',
        );
      });
  }, [tokenHash, tokenType, navigate]);

  if (!loading && user) {
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await signIn(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!email.trim()) return;
    setResending(true);
    setError(null);
    try {
      const msg = await resendVerification(email.trim());
      setNotice(msg);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to resend verification email.');
    } finally {
      setResending(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleBusy(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in with Google.');
      setGoogleBusy(false);
    }
  };

  const needsVerifyPrompt = Boolean(error && /confirm|verif/i.test(error));

  return (
    <AuthShell>
      <div className="card auth-card">
        <div style={{ marginBottom: 22 }}>
          <BrandLogo size="md" showTagline />
        </div>

        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-subtitle">Sign in to start or join a meeting.</p>

        {!isConfigured && (
          <div className="alert alert-warning">
            Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to your root{' '}
            <code>.env</code> file and restart Vite.
          </div>
        )}

        {notice && <div className="alert alert-success">{notice}</div>}
        {error && (
          <div className="alert alert-danger">
            <div>{error}</div>
            {needsVerifyPrompt && email.trim() && (
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                style={{ marginTop: 10 }}
                disabled={resending}
                onClick={() => void handleResend()}
              >
                {resending ? 'Sending...' : 'Resend Verification Email'}
              </button>
            )}
          </div>
        )}

        <button
          type="button"
          className="btn-google"
          disabled={googleBusy || submitting || !isConfigured}
          onClick={() => void handleGoogleSignIn()}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
            />
          </svg>
          <span>{googleBusy ? 'Connecting to Google...' : 'Continue with Google'}</span>
        </button>

        <div className="auth-divider">
          <span>or continue with email</span>
        </div>

        <form className="form" onSubmit={handleSubmit}>
          <label className="field">
            <span className="field-label">Email address</span>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>

          <label className="field">
            <span className="field-label">Password</span>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
          </label>

          <div className="form-inline-link">
            <Link to="/forgot-password" className="text-link">
              Forgot password?
            </Link>
          </div>

          <button type="submit" className="btn btn-primary btn-full" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="auth-footer">
          New to MyMeet?{' '}
          <Link to="/signup" className="text-link">
            Create an account
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
