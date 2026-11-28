import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  CalendarIcon,
  ChevronDownIcon,
  ClockIcon,
  CloseIcon,
  CrownIcon,
  HomeIcon,
  LogOutIcon,
  MenuIcon,
  MoonIcon,
  SparklesIcon,
  SunIcon,
  UserIcon,
} from '../components/Icons';
import { BrandLogo } from '../components/BrandLogo';
import { UpgradeModal } from '../components/UpgradeModal';
import { useAuth } from '../hooks/useAuth';
import { useSubscription } from '../hooks/useSubscription';
import { useTheme } from '../hooks/useTheme';

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

function formatNavClock(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function MainLayout({ backendConnected, loading, children }: MainLayoutProps) {
  const { session, user, profile, signOut } = useAuth();
  const {
    subscription,
    isPro,
    setSubscription,
    upgradeModalOpen,
    upgradeModalOptions,
    openUpgradeModal,
    closeUpgradeModal,
  } = useSubscription();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  const [clockText, setClockText] = useState(() => formatNavClock(new Date()));
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const accountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setClockText(formatNavClock(new Date()));
    const timer = setInterval(() => {
      setClockText(formatNavClock(new Date()));
    }, 1_000);
    return () => clearInterval(timer);
  }, []);

  // Close menus on route change
  useEffect(() => {
    setAccountOpen(false);
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Close account popover on outside click or Escape
  useEffect(() => {
    if (!accountOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAccountOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [accountOpen]);

  const statusTone = loading ? 'warning' : backendConnected ? 'success' : 'danger';
  const statusLabel = loading
    ? 'Syncing services...'
    : backendConnected
      ? 'All systems operational'
      : 'Backend offline';

  const displayName =
    profile?.full_name ||
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email ||
    'Account';

  const navItems = [
    { to: '/', label: 'Home', icon: HomeIcon, active: location.pathname === '/' },
    {
      to: '/schedule',
      label: 'Schedule',
      icon: CalendarIcon,
      active: location.pathname === '/schedule',
    },
    {
      to: '/history',
      label: 'History',
      icon: ClockIcon,
      active: location.pathname === '/history',
    },
    {
      to: '/profile',
      label: 'Profile',
      icon: UserIcon,
      active: location.pathname === '/profile',
    },
  ];

  const isInMeeting = location.pathname.startsWith('/meet/');
  const isActiveRoom = /^\/meet\/[^/]+\/room\/?$/i.test(location.pathname);

  // Full-bleed studio mode during an active meeting room (zero top navbar clutter)
  if (isActiveRoom) {
    return <div className="layout-room-full">{children}</div>;
  }

  return (
    <div className={`layout ${isPro ? 'layout-pro' : 'layout-basic'}`}>
      <header className={`navbar ${isPro ? 'navbar-pro' : ''}`}>
        <div className="navbar-inner">
          {/* Left Zone: Brand Signature */}
          <div className="nav-zone-left">
            <Link to="/" className="brand">
              <BrandLogo size="sm" />
              {isPro && (
                <span className="brand-pro-chip" title={`MyMeet Pro — ${subscription?.plan_name}`}>
                  <CrownIcon size={10} /> PRO
                </span>
              )}
              <span
                className={`brand-status-dot dot-${statusTone}`}
                title={statusLabel}
                aria-label={statusLabel}
              />
            </Link>
          </div>

          {/* Center Zone: Floating Icon Navigation Dock */}
          {user ? (
            <nav className="nav-center-dock" aria-label="Main navigation">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`nav-pill-link ${item.active ? 'nav-pill-link-active' : ''}`}
                    aria-current={item.active ? 'page' : undefined}
                  >
                    <Icon size={15} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
              {isInMeeting && (
                <span className="nav-live-chip">
                  <span className="nav-live-dot" />
                  <span>In Session</span>
                </span>
              )}
            </nav>
          ) : (
            <div />
          )}

          {/* Right Zone: Upgrade/Pro Pill + Utility Controls + Account Popover */}
          <div className="nav-zone-right">
            {user && (
              <button
                type="button"
                className={isPro ? 'nav-pro-status-pill' : 'nav-upgrade-btn'}
                onClick={() => openUpgradeModal()}
                title={
                  isPro
                    ? `${subscription?.plan_name} — Click to manage or add credits`
                    : 'Upgrade to MyMeet Pro starting ₹9'
                }
              >
                {isPro ? <CrownIcon size={13} /> : <SparklesIcon size={13} />}
                <span>
                  {isPro
                    ? subscription?.is_unlimited
                      ? 'PRO · Unlimited'
                      : `PRO · ${subscription?.credits_remaining ?? 0} left`
                    : 'Upgrade'}
                </span>
              </button>
            )}

            <span className="nav-time-chip" aria-label="Current time">
              {clockText}
            </span>

            <button
              type="button"
              className="nav-icon-btn"
              onClick={toggleTheme}
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
              aria-label={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
              {theme === 'light' ? <MoonIcon size={16} /> : <SunIcon size={16} />}
            </button>

            {user && (
              <div className="nav-account-wrap" ref={accountRef}>
                <button
                  type="button"
                  className={`nav-account-trigger ${accountOpen ? 'open' : ''} ${
                    isPro ? 'nav-account-pro' : ''
                  }`}
                  onClick={() => setAccountOpen((prev) => !prev)}
                  aria-expanded={accountOpen}
                  aria-haspopup="menu"
                >
                  <span className={`avatar-circle nav-avatar-sm ${isPro ? 'nav-avatar-pro' : ''}`}>
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt={displayName} className="avatar-img" />
                    ) : (
                      getInitials(displayName)
                    )}
                  </span>
                  <span className="nav-user-name">{displayName}</span>
                  <span className={`nav-chevron ${accountOpen ? 'rotated' : ''}`}>
                    <ChevronDownIcon size={13} />
                  </span>
                </button>

                {accountOpen && (
                  <div className="nav-dropdown" role="menu">
                    <div className="nav-dropdown-header">
                      <div className="nav-dropdown-name-row">
                        <span className="nav-dropdown-name">{displayName}</span>
                        {isPro && (
                          <span className="pro-pill-badge pro-pill-xs">
                            <CrownIcon size={10} /> PRO
                          </span>
                        )}
                      </div>
                      <div className="nav-dropdown-email">{user.email}</div>
                      <div className="nav-dropdown-status">
                        <span className={`dot dot-${statusTone}`} />
                        <span>{statusLabel}</span>
                      </div>
                    </div>

                    <div className="nav-dropdown-divider" />

                    <button
                      type="button"
                      className={`nav-dropdown-item ${isPro ? 'nav-dropdown-pro-item' : 'nav-dropdown-upgrade-item'}`}
                      role="menuitem"
                      onClick={() => {
                        setAccountOpen(false);
                        openUpgradeModal();
                      }}
                    >
                      {isPro ? <CrownIcon size={15} /> : <SparklesIcon size={15} />}
                      <span>
                        {isPro
                          ? `MyMeet Pro (${subscription?.plan_name})`
                          : 'Upgrade to Pro (from ₹9)'}
                      </span>
                    </button>

                    <Link to="/profile" className="nav-dropdown-item" role="menuitem">
                      <UserIcon size={15} />
                      <span>Profile &amp; Settings</span>
                    </Link>

                    <Link to="/history" className="nav-dropdown-item" role="menuitem">
                      <ClockIcon size={15} />
                      <span>History &amp; Visual AI Notes</span>
                    </Link>

                    <button
                      type="button"
                      className="nav-dropdown-item"
                      role="menuitem"
                      onClick={() => {
                        toggleTheme();
                        setAccountOpen(false);
                      }}
                    >
                      {theme === 'light' ? <MoonIcon size={15} /> : <SunIcon size={15} />}
                      <span>Switch to {theme === 'light' ? 'Dark' : 'Light'} Theme</span>
                    </button>

                    <div className="nav-dropdown-divider" />

                    <button
                      type="button"
                      className="nav-dropdown-item nav-dropdown-danger"
                      role="menuitem"
                      onClick={() => {
                        setAccountOpen(false);
                        void signOut();
                      }}
                    >
                      <LogOutIcon size={15} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {user && (
              <button
                type="button"
                className="nav-icon-btn nav-mobile-toggle"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                aria-label="Toggle navigation menu"
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <CloseIcon size={18} /> : <MenuIcon size={18} />}
              </button>
            )}
          </div>
        </div>

        {/* Clean Responsive Mobile Drawer */}
        {user && mobileMenuOpen && (
          <nav className="nav-mobile-drawer" aria-label="Mobile navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`nav-mobile-link ${item.active ? 'nav-mobile-link-active' : ''}`}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <button
              type="button"
              className="nav-mobile-link nav-mobile-upgrade"
              onClick={() => {
                setMobileMenuOpen(false);
                openUpgradeModal();
              }}
            >
              {isPro ? <CrownIcon size={16} /> : <SparklesIcon size={16} />}
              <span>
                {isPro
                  ? `PRO Active · ${subscription?.plan_name}`
                  : 'Upgrade to Pro (from ₹9)'}
              </span>
            </button>
          </nav>
        )}
      </header>

      <main className="container">{children}</main>

      {/* Global Upgrade Modal triggered from Navbar, Home, or any screen */}
      <UpgradeModal
        open={upgradeModalOpen}
        accessToken={session?.access_token ?? null}
        userEmail={profile?.email ?? user?.email ?? undefined}
        userName={displayName}
        meetingCode={upgradeModalOptions.meetingCode}
        highlightMcq={upgradeModalOptions.highlightMcq}
        onClose={closeUpgradeModal}
        onActivated={(nextSub) => {
          setSubscription(nextSub);
        }}
      />
    </div>
  );
}
