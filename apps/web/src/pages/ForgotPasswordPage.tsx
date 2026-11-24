import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { VideoIcon } from '../components/Icons';
import { ThemeToggle } from '../components/ThemeToggle';
import { useAuth } from '../hooks/useAuth';

export function ForgotPasswordPage() {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await sendPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send reset email.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-topbar">
        <ThemeToggle />
      </div>

      <div className="card auth-card">
        <div className="brand" style={{ marginBottom: 18 }}>
          <span className="brand-mark">
            <VideoIcon size={18} />
          </span>
          <span>Meet</span>
        </div>

        <h1 className="auth-title">Reset your password</h1>
        <p className="auth-subtitle">
          Enter your email and we&apos;ll send you a password recovery link.
        </p>

        {error && <div className="alert alert-danger">{error}</div>}
        {sent && (
          <div className="alert alert-success">
            Recovery email sent! Open the link in your inbox to choose a new password.
          </div>
        )}

        <form className="form" onSubmit={handleSubmit}>
          <label className="field">
            <span className="field-label">Email</span>
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

          <button type="submit" className="btn btn-primary btn-full" disabled={submitting}>
            {submitting ? 'Sending link...' : 'Send Recovery Link'}
          </button>
        </form>

        <p className="auth-footer">
          Remembered your password?{' '}
          <Link to="/login" className="text-link">
            Back to Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
