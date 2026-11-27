import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from 'react';
import {
  CameraIcon,
  CheckIcon,
  LogOutIcon,
  RefreshIcon,
  ShieldIcon,
  SparklesIcon,
  TrashIcon,
  UploadIcon,
} from '../components/Icons';
import { UpgradeModal } from '../components/UpgradeModal';
import { useAuth } from '../hooks/useAuth';
import { getBillingStatus, type UserSubscriptionStatus } from '../services/api';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'M';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/**
 * Center-crops and resizes any uploaded image file to a crisp 256×256 JPEG data URL (~18–35 KB).
 */
async function processAvatarFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose a JPG, PNG, or WebP image file.');
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Image is too large. Please select a photo under 10 MB.');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not read the selected image.'));
      el.src = objectUrl;
    });

    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Unable to process image in this browser.');
    }

    const minSide = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = Math.floor((img.naturalWidth - minSide) / 2);
    const sy = Math.floor((img.naturalHeight - minSide) / 2);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);

    return canvas.toDataURL('image/jpeg', 0.86);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function ProfilePage() {
  const { session, user, profile, profileLoading, saveProfile, refreshProfile, signOut } = useAuth();
  const [fullName, setFullName] = useState('');
  const [avatarData, setAvatarData] = useState<string | null>(null);
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);
  const [photoAction, setPhotoAction] = useState<'uploading' | 'removing' | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<UserSubscriptionStatus | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(() =>
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).has('upgrade')
      : false,
  );
  const [savedNotice, setSavedNotice] = useState<{
    id: number;
    text: string;
    tone: 'success' | 'danger';
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const photoMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!session?.access_token) return;
    void getBillingStatus(session.access_token)
      .then((res) => setSubscription(res.subscription))
      .catch(() => {});
  }, [session?.access_token]);

  useEffect(() => {
    setFullName(profile?.full_name ?? (user?.user_metadata?.full_name as string | undefined) ?? '');
    setAvatarData(profile?.avatar_url ?? null);
  }, [profile, user]);

  // Auto-dismiss notice banner after 3 seconds
  useEffect(() => {
    if (!savedNotice) return;
    const timer = setTimeout(() => setSavedNotice(null), 3000);
    return () => clearTimeout(timer);
  }, [savedNotice]);

  // Close photo options menu on outside click or Escape
  useEffect(() => {
    if (!photoMenuOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (photoMenuRef.current && !photoMenuRef.current.contains(e.target as Node)) {
        setPhotoMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPhotoMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [photoMenuOpen]);

  const displayName = fullName.trim() || user?.email || 'Meet User';
  const emailAddress = profile?.email ?? user?.email ?? '';
  const joinedLabel = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, {
        month: 'short',
        year: 'numeric',
      })
    : null;

  const currentSavedName =
    profile?.full_name ?? (user?.user_metadata?.full_name as string | undefined) ?? '';
  const currentSavedAvatar = profile?.avatar_url ?? null;
  const hasChanges =
    fullName.trim() !== currentSavedName.trim() || (avatarData || null) !== currentSavedAvatar;

  const handlePhotoFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setSavedNotice(null);
    setPhotoAction('uploading');
    setPhotoMenuOpen(false);
    try {
      const processed = await processAvatarFile(file);
      setAvatarData(processed);
      await saveProfile({ avatar_url: processed });
      setSavedNotice({ id: Date.now(), text: 'Profile photo uploaded.', tone: 'success' });
    } catch (err) {
      setAvatarData(profile?.avatar_url ?? null);
      setError(err instanceof Error ? err.message : 'Unable to save profile photo.');
    } finally {
      setPhotoAction(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemovePhoto = async () => {
    setPhotoMenuOpen(false);
    setError(null);
    setSavedNotice(null);
    setPhotoAction('removing');
    try {
      setAvatarData(null);
      await saveProfile({ avatar_url: null });
      setSavedNotice({ id: Date.now(), text: 'Profile photo removed.', tone: 'danger' });
    } catch (err) {
      setAvatarData(profile?.avatar_url ?? null);
      setError(err instanceof Error ? err.message : 'Unable to remove profile photo.');
    } finally {
      setPhotoAction(null);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    void handlePhotoFile(e.target.files?.[0]);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    void handlePhotoFile(e.dataTransfer.files?.[0]);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSavedNotice(null);
    setSaving(true);

    try {
      await saveProfile({
        full_name: fullName.trim() || null,
        avatar_url: avatarData || null,
      });
      setSavedNotice({ id: Date.now(), text: 'Your profile has been updated.', tone: 'success' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="profile-shell">
      <div className="profile-page-head">
        <div>
          <h1 className="settings-page-title">Your Profile</h1>
          <p className="settings-page-sub">
            Customize how you appear across meetings, chat, and invitations.
          </p>
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

      <section className={`card profile-hero-card ${subscription?.is_pro ? 'pro-hero-card' : ''}`}>
        {/* Studio Mesh Gradient Cover */}
        <div className={`profile-cover ${subscription?.is_pro ? 'pro-cover-premium' : ''}`}>
          <div className="profile-banner-pill">
            {subscription?.is_pro ? <SparklesIcon size={13} /> : <ShieldIcon size={13} />}
            <span>{subscription?.is_pro ? `MYMEET PRO · ${subscription.plan_name}` : 'Verified Account'}</span>
          </div>
        </div>

        {/* Clean Identity Section (Name sits cleanly below the gradient banner) */}
        <div className="profile-hero-body">
          <div className="profile-identity-header">
            <div className="profile-avatar-bar">
              <div
                ref={photoMenuRef}
                className={`profile-avatar-uploader ${dragOver ? 'drag-over' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <div
                  className={`avatar-circle profile-avatar-xxl ${
                    subscription?.is_pro ? 'pro-avatar-ring' : ''
                  }`}
                >
                  {avatarData ? (
                    <img src={avatarData} alt={displayName} className="avatar-img" />
                  ) : (
                    getInitials(displayName)
                  )}
                </div>

                <button
                  type="button"
                  className={`profile-avatar-camera ${photoMenuOpen ? 'active' : ''}`}
                  onClick={() => setPhotoMenuOpen((prev) => !prev)}
                  disabled={Boolean(photoAction)}
                  title="Photo options"
                  aria-label="Profile photo options"
                  aria-expanded={photoMenuOpen}
                  aria-haspopup="menu"
                >
                  <CameraIcon size={15} />
                </button>

                {photoMenuOpen && (
                  <div className="avatar-photo-menu" role="menu">
                    <button
                      type="button"
                      className="avatar-photo-menu-item"
                      role="menuitem"
                      onClick={() => {
                        setPhotoMenuOpen(false);
                        fileInputRef.current?.click();
                      }}
                    >
                      <UploadIcon size={15} />
                      <span>Upload Photo</span>
                    </button>

                    {avatarData && (
                      <button
                        type="button"
                        className="avatar-photo-menu-item avatar-photo-menu-danger"
                        role="menuitem"
                        onClick={() => void handleRemovePhoto()}
                      >
                        <TrashIcon size={15} />
                        <span>Remove Photo</span>
                      </button>
                    )}
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileChange}
                  className="sr-only-input"
                />
              </div>

              {joinedLabel && (
                <div className="profile-meta-pills">
                  <span className="profile-joined-chip">Member since {joinedLabel}</span>
                </div>
              )}
            </div>

            <div className="profile-name-block">
              <h2 className="profile-name-display">{displayName}</h2>
              {subscription?.is_pro && (
                <div style={{ marginTop: 4, marginBottom: 4 }}>
                  <span className="pro-pill-badge">
                    <SparklesIcon size={12} /> PRO · {subscription.plan_name}
                  </span>
                </div>
              )}
              <div className="profile-email-row">
                <span className="profile-email">{emailAddress}</span>
                {photoAction && (
                  <span className="profile-processing-chip">
                    {photoAction === 'removing' ? 'Removing photo...' : 'Uploading photo...'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Subscription & Credits Dashboard Card */}
          <div className={`pro-status-panel ${subscription?.is_pro ? 'pro-status-panel-active' : ''}`}>
            <div className="pro-status-panel-head">
              <div>
                <div className="pro-status-label">CURRENT SUBSCRIPTION</div>
                <div className="pro-status-plan-name">
                  {subscription?.plan_name || 'Basic (Free)'}
                </div>
              </div>
              <button
                type="button"
                className={`btn btn-sm ${subscription?.is_pro ? 'btn-secondary' : 'btn-pro-gold'}`}
                onClick={() => setUpgradeOpen(true)}
              >
                <SparklesIcon size={14} />
                <span>{subscription?.is_pro ? 'Manage / Add Credits' : 'Upgrade to Pro'}</span>
              </button>
            </div>

            <div className="pro-status-metrics">
              <div className="pro-metric-box">
                <span className="pro-metric-label">Pro Notes Credits</span>
                <strong className="pro-metric-val">
                  {subscription?.is_unlimited
                    ? '∞ Unlimited'
                    : subscription?.is_pro
                      ? `${subscription.credits_remaining} / ${Math.max(
                          subscription.credits_remaining,
                          subscription.credits_total,
                        )} left`
                      : '0 Credits'}
                </strong>
              </div>
              <div className="pro-metric-box">
                <span className="pro-metric-label">Session MCQ Tests</span>
                <strong className="pro-metric-val">
                  {subscription?.mcq_enabled ? '✓ Unlocked' : 'Locked (₹349/mo+)'}
                </strong>
              </div>
              <div className="pro-metric-box">
                <span className="pro-metric-label">Validity</span>
                <strong className="pro-metric-val">
                  {subscription?.is_pro && subscription.expires_at
                    ? `Till ${new Date(subscription.expires_at).toLocaleDateString(undefined, {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}`
                    : 'Free Forever'}
                </strong>
              </div>
            </div>
          </div>

          {error && <div className="alert alert-danger">{error}</div>}
          {savedNotice && (
            <div
              className={`alert ${savedNotice.tone === 'danger' ? 'alert-danger' : 'alert-success'}`}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              {savedNotice.tone === 'danger' ? <TrashIcon size={15} /> : <CheckIcon size={16} />}
              <span>{savedNotice.text}</span>
            </div>
          )}

          {/* Account Details Form */}
          <form className="form" onSubmit={handleSubmit}>
            <div className="profile-fields-grid">
              <label className="field">
                <span className="field-label">Display name</span>
                <input
                  type="text"
                  className="input input-clean"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    setSavedNotice(null);
                  }}
                  placeholder="Enter your name"
                  maxLength={100}
                />
              </label>

              <label className="field">
                <span className="field-label">Email address</span>
                <div className="email-readonly-wrap">
                  <input
                    type="email"
                    className="input input-clean"
                    value={emailAddress}
                    disabled
                  />
                  <span className="email-verified-tag">Verified</span>
                </div>
              </label>
            </div>

            <div className="profile-form-footer">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving || Boolean(photoAction) || !hasChanges}
              >
                {saving ? 'Saving...' : hasChanges ? 'Save Changes' : 'All Changes Saved'}
              </button>
              <button
                type="button"
                className="btn btn-danger-soft btn-sm"
                onClick={() => void signOut()}
              >
                <LogOutIcon size={14} />
                <span>Sign Out</span>
              </button>
            </div>
          </form>
        </div>
      </section>

      <UpgradeModal
        open={upgradeOpen}
        accessToken={session?.access_token ?? null}
        userEmail={emailAddress}
        userName={displayName}
        onClose={() => setUpgradeOpen(false)}
        onActivated={(nextSub) => {
          setSubscription(nextSub);
          setSavedNotice({
            id: Date.now(),
            text: `✨ ${nextSub.plan_name} activated! Your Pro credits are ready.`,
            tone: 'success',
          });
        }}
      />
    </div>
  );
}
