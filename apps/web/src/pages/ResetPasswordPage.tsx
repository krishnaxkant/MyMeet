import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthShell } from '../components/AuthShell';
import { VideoIcon } from '../components/Icons';
import { useAuth } from '../hooks/useAuth';

export function ResetPasswordPage() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await updatePassword(password);
      setDone(true);
      setTimeout(() => navigate('/', { replace: true }), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <div className="card auth-card">
        <div className="brand" style={{ marginBottom: 20 }}>
          <span className="brand-mark">
            <VideoIcon size={18} />
          </span>
          <span>Meet</span>
        </div>

        <h1 className="auth-title">Choose a new password</h1>
        <p className="auth-subtitle">Enter your new password below to regain access.</p>

        {error && <div className="alert alert-danger">{error}</div>}
        {done && (
          <div className="alert alert-success">Password updated! Redirecting to dashboard...</div>
        )}

        <form className="form" onSubmit={handleSubmit}>
          <label className="field">
            <span className="field-label">New password</span>
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

          <label className="field">
            <span className="field-label">Confirm new password</span>
            <input
              type="password"
              className="input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat your new password"
              autoComplete="new-password"
              minLength={6}
              required
            />
          </label>

          <button type="submit" className="btn btn-primary btn-full" disabled={submitting || done}>
            {submitting ? 'Updating...' : 'Update Password'}
          </button>
        </form>

        <p className="auth-footer">
          <Link to="/login" className="text-link">
            Return to Sign In
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
