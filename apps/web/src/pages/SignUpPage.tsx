import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AuthShell } from '../components/AuthShell';
import { BrandLogo } from '../components/BrandLogo';
import { useAuth } from '../hooks/useAuth';

export function SignUpPage() {
  const { user, loading, isConfigured, signUp, resendVerification } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
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
