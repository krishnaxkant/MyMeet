import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthShell } from '../components/AuthShell';
import { BrandLogo } from '../components/BrandLogo';
import { useAuth } from '../hooks/useAuth';

export function LoginPage() {
  const { user, loading, isConfigured, signIn, resendVerification } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/';
  const isVerifiedRedirect = new URLSearchParams(location.search).get('verified') === '1';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(
    isVerifiedRedirect ? '✓ Email verified! You can sign in to MyMeet now.' : null,
  );

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
