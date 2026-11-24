import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { VideoIcon } from '../components/Icons';
import { ThemeToggle } from '../components/ThemeToggle';
import { useAuth } from '../hooks/useAuth';

interface MainLayoutProps {
  backendConnected: boolean;
  loading: boolean;
  children: ReactNode;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'M';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function MainLayout({ backendConnected, loading, children }: MainLayoutProps) {
  const { user, profile, signOut } = useAuth();
  const location = useLocation();
  const [clockText, setClockText] = useState(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setClockText(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 30_000);
    return () => clearInterval(timer);
  }, []);

  const dotClass = loading
    ? 'dot dot-warning'
    : backendConnected
      ? 'dot dot-success'
      : 'dot dot-danger';

  const statusLabel = loading ? 'Checking' : backendConnected ? 'Online' : 'Offline';

  const displayName =
    profile?.full_name ||
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email ||
    'Account';

  return (
    <div className="layout">
      <header className="navbar">
        <div className="nav-left">
          <Link to="/" className="brand">
            <span className="brand-mark">
              <VideoIcon size={18} />
            </span>
            <span>Meet</span>
          </Link>

          {user && (
            <nav className="nav-links" aria-label="Main navigation">
              <Link
                to="/"
                className={`nav-link ${location.pathname === '/' ? 'nav-link-active' : ''}`}
              >
                Dashboard
              </Link>
              <Link
                to="/profile"
                className={`nav-link ${location.pathname === '/profile' ? 'nav-link-active' : ''}`}
              >
                Profile
              </Link>
            </nav>
          )}
        </div>

        <div className="nav-right">
          <span className="nav-clock">{clockText}</span>

          <div className="nav-status" role="status" title="Backend API status">
            <span className={dotClass} />
            <span>{statusLabel}</span>
          </div>

          <ThemeToggle />

          {user && (
            <div className="nav-user">
              <Link to="/profile" className="avatar-chip" title="Open profile">
                <span className="avatar-circle">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt={displayName} className="avatar-img" />
                  ) : (
                    getInitials(displayName)
                  )}
                </span>
                <span className="nav-user-name">{displayName}</span>
              </Link>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => void signOut()}
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="container">{children}</main>
    </div>
  );
}
