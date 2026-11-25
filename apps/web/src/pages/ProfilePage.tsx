import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { BellIcon, MoonIcon, RefreshIcon, SunIcon } from '../components/Icons';
import { StatusCard } from '../components/StatusCard';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import {
  deleteDevice,
  listDevices,
  registerDevice,
  type HealthResponse,
  type UserDevice,
} from '../services/api';

interface ProfilePageProps {
  health: HealthResponse | null;
  healthLoading: boolean;
  healthError: string | null;
  onRefreshHealth: () => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'M';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function ProfilePage({
  health,
  healthLoading,
  healthError,
  onRefreshHealth,
}: ProfilePageProps) {
  const { session, user, profile, profileLoading, saveProfile, refreshProfile, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [devices, setDevices] = useState<UserDevice[]>([]);
  const [deviceBusy, setDeviceBusy] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name ?? (user?.user_metadata?.full_name as string | undefined) ?? '');
    setAvatarUrl(profile?.avatar_url ?? '');
  }, [profile, user]);

  const loadDevices = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const list = await listDevices(session.access_token);
      setDevices(list);
    } catch {
      // Ignore transient errors
    }
  }, [session?.access_token]);

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

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
      setSavedNotice('Profile updated successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleEnableBrowserNotifications = async () => {
    if (!session?.access_token) return;
    setDeviceBusy(true);
    setError(null);
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        await Notification.requestPermission();
      }
      const tokenId = `web-${user?.id?.slice(0, 8) ?? 'browser'}-${navigator.platform || 'desktop'}`;
      await registerDevice(session.access_token, {
        platform: 'web',
        push_token: tokenId,
        device_name: `${navigator.platform || 'Web'} Browser`,
      });
      await loadDevices();
      setSavedNotice('Browser registered for meeting notifications.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to register device.');
    } finally {
      setDeviceBusy(false);
    }
  };

  const handleRemoveDevice = async (deviceId: string) => {
    if (!session?.access_token) return;
    setDeviceBusy(true);
    try {
      await deleteDevice(session.access_token, deviceId);
      setDevices((prev) => prev.filter((d) => d.id !== deviceId));
    } finally {
      setDeviceBusy(false);
    }
  };

  return (
    <div className="profile-grid">
      <section className="card">
        <div className="profile-banner" />
        <div className="profile-header-row">
          <div className="avatar-circle avatar-circle-xl">
            {avatarUrl.trim() ? (
              <img src={avatarUrl.trim()} alt={displayName} className="avatar-img" />
            ) : (
              getInitials(displayName)
            )}
          </div>
          <div style={{ flex: 1, paddingBottom: 4 }}>
            <div className="profile-name">{displayName}</div>
            <div className="profile-email">{profile?.email ?? user?.email ?? ''}</div>
          </div>
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
            <button type="button" className="btn btn-danger-soft" onClick={() => void signOut()}>
              Sign Out
            </button>
          </div>
        </form>
      </section>

      <div className="right-stack">
        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Appearance</h2>
            <span className="badge badge-success">{theme === 'light' ? 'Daylight' : 'Midnight'}</span>
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
              <div className="theme-choice-sub">Crisp & airy daylight</div>
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
              <div className="theme-choice-sub">Midnight studio mode</div>
            </button>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <BellIcon size={16} />
              <span>Notification Devices</span>
            </h2>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={deviceBusy}
              onClick={() => void handleEnableBrowserNotifications()}
            >
              Register Browser
            </button>
          </div>
          {devices.length === 0 ? (
            <div className="status-item-desc">
              No devices registered yet. Register your browser or Android phone to receive invite
              alerts.
            </div>
          ) : (
            <div className="status-list">
              {devices.map((d) => (
                <div key={d.id} className="status-item">
                  <div>
                    <div className="status-item-label">
                      {d.device_name || `${d.platform.toUpperCase()} Device`}
                    </div>
                    <div className="status-item-desc">
                      {d.platform.toUpperCase()} · Active{' '}
                      {new Date(d.last_active_at).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-danger-soft btn-xs"
                    disabled={deviceBusy}
                    onClick={() => void handleRemoveDevice(d.id)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <StatusCard
          data={health}
          loading={healthLoading}
          error={healthError}
          onRefresh={onRefreshHealth}
        />
      </div>
    </div>
  );
}
