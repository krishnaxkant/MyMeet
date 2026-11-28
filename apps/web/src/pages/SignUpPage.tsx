import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AuthShell } from '../components/AuthShell';
import { BrandLogo } from '../components/BrandLogo';
import { useAuth } from '../hooks/useAuth';

export function SignUpPage() {
  const { user, loading, isConfigured, signUp, signInWithGoogle, resendVerification } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await signUp(email, password, fullName);
      if (result.needsEmailConfirmation) {
        setPendingEmail(email.trim());
        setSuccessMessage(
          result.message ||
            'Account created! Check your inbox to verify your email address, then sign in.',
        );
      } else {
        navigate('/', { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create account.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    const targetEmail = pendingEmail || email.trim();
    if (!targetEmail) return;
    setResending(true);
    setError(null);
    try {
      const msg = await resendVerification(targetEmail);
      setSuccessMessage(msg);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to resend verification email.');
    } finally {
      setResending(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setError(null);
    setGoogleBusy(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in with Google.');
      setGoogleBusy(false);
    }
  };

  return (
    <AuthShell>
      <div className="card auth-card">
        <div style={{ marginBottom: 22 }}>
          <BrandLogo size="md" showTagline />
        </div>

        <h1 className="auth-title">Create your account</h1>
        <p className="auth-subtitle">One account for MyMeet Web and MyMeet Android.</p>

        {!isConfigured && (
          <div className="alert alert-warning">
            Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to your root{' '}
            <code>.env</code> file.
          </div>
        )}

        {error && <div className="alert alert-danger">{error}</div>}
        {successMessage && (
          <div className="alert alert-success">
            <div>{successMessage}</div>
            {pendingEmail && (
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
          onClick={() => void handleGoogleSignUp()}
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
          <span>or sign up with email</span>
        </div>

        <form className="form" onSubmit={handleSubmit}>
          <label className="field">
            <span className="field-label">Full name</span>
            <input
              type="text"
              className="input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Alex Rivera"
              autoComplete="name"
              required
            />
          </label>

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
              placeholder="At least 6 characters"
              autoComplete="new-password"
              minLength={6}
              required
            />
          </label>

          <button type="submit" className="btn btn-primary btn-full" disabled={submitting}>
            {submitting ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account?{' '}
          <Link to="/login" className="text-link">
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
