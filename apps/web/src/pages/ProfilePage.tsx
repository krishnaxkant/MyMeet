import { useEffect, useState, type FormEvent } from 'react';
import { MoonIcon, RefreshIcon, SunIcon } from '../components/Icons';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'M';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function ProfilePage() {
  const { user, profile, profileLoading, saveProfile, refreshProfile, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    setFullName(profile?.full_name ?? (user?.user_metadata?.full_name as string | undefined) ?? '');
    setAvatarUrl(profile?.avatar_url ?? '');
  }, [profile, user]);

  const displayName = fullName.trim() || user?.email || 'Meet User';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSavedNotice(null);
    setSaving(true);

    try {
      await saveProfile({
        full_name: fullName.trim() || null,
        avatar_url: avatarUrl.trim() || null,
      });
      setSavedNotice('Profile saved via Meet Backend (/api/me).');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="profile-grid">
      <section className="card">
        <div className="card-header">
          <h1 className="card-title">Profile Settings</h1>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void refreshProfile()}
            disabled={profileLoading}
          >
            <RefreshIcon size={14} />
            <span>{profileLoading ? 'Syncing...' : 'Sync'}</span>
          </button>
        </div>

        <div className="profile-header-row">
          <div className="avatar-circle avatar-circle-lg">
            {avatarUrl.trim() ? (
              <img src={avatarUrl.trim()} alt={displayName} className="avatar-img" />
            ) : (
              getInitials(displayName)
            )}
          </div>
          <div>
            <div className="profile-name">{displayName}</div>
            <div className="profile-email">{profile?.email ?? user?.email ?? ''}</div>
          </div>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}
        {savedNotice && <div className="alert alert-success">{savedNotice}</div>}

        <form className="form" onSubmit={handleSubmit}>
          <label className="field">
            <span className="field-label">Email address</span>
            <input type="email" className="input" value={profile?.email ?? user?.email ?? ''} disabled />
          </label>

          <label className="field">
            <span className="field-label">Display name</span>
            <input
              type="text"
              className="input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your display name"
              maxLength={100}
            />
          </label>

          <label className="field">
            <span className="field-label">Avatar URL (optional)</span>
            <input
              type="url"
              className="input"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/avatar.png"
            />
          </label>

          <div className="actions-row">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              className="btn btn-danger-soft"
              onClick={() => void signOut()}
            >
              Sign Out
            </button>
          </div>
        </form>
      </section>

      <div className="right-stack">
        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Appearance</h2>
            <span className="badge badge-success">{theme === 'light' ? 'Light' : 'Dark'}</span>
          </div>
          <div className="theme-picker-grid">
            <button
              type="button"
              className={`theme-choice-card ${theme === 'light' ? 'selected' : ''}`}
              onClick={() => setTheme('light')}
            >
              <div className="theme-swatch theme-swatch-light">
                <div className="theme-swatch-bar" />
                <div className="theme-swatch-line" />
              </div>
              <div className="theme-choice-title">
                <SunIcon size={14} />
                <span>Light Theme</span>
              </div>
              <div className="theme-choice-sub">Bright, clean workspace</div>
            </button>

            <button
              type="button"
              className={`theme-choice-card ${theme === 'dark' ? 'selected' : ''}`}
              onClick={() => setTheme('dark')}
            >
              <div className="theme-swatch theme-swatch-dark">
                <div className="theme-swatch-bar" />
                <div className="theme-swatch-line" />
              </div>
              <div className="theme-choice-title">
                <MoonIcon size={14} />
                <span>Dark Theme</span>
              </div>
              <div className="theme-choice-sub">Low-glare studio mode</div>
            </button>
          </div>
        </section>

        <section className="card">
          <h2 className="card-title" style={{ marginBottom: 14 }}>
            Session & Account
          </h2>
          <div className="status-list">
            <div className="status-item">
              <div>
                <div className="status-item-label">User ID</div>
                <div className="status-item-desc">{user?.id ?? '—'}</div>
              </div>
              <span className="badge badge-success">Verified</span>
            </div>
            <div className="status-item">
              <div>
                <div className="status-item-label">Backend Profile Sync</div>
                <div className="status-item-desc">
                  {profile ? 'Authenticated via GET /api/me' : 'Waiting for backend sync'}
                </div>
              </div>
              <span className={profile ? 'badge badge-success' : 'badge badge-warning'}>
                {profile ? 'Synced' : 'Pending'}
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
