import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckIcon,
  CopyIcon,
  KeyboardIcon,
  LockIcon,
  RefreshIcon,
  ShieldIcon,
  UsersIcon,
  VideoIcon,
} from '../components/Icons';
import { StatusCard } from '../components/StatusCard';
import { useAuth } from '../hooks/useAuth';
import {
  buildMeetingInviteUrl,
  createMeeting,
  extractMeetingCode,
  listMeetings,
  type HealthResponse,
  type MeetingSummary,
} from '../services/api';

interface HomePageProps {
  health: HealthResponse | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export function HomePage({ health, loading, error, onRefresh }: HomePageProps) {
  const { session, user, profile } = useAuth();
  const navigate = useNavigate();

  const [meetingCode, setMeetingCode] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [waitingRoom, setWaitingRoom] = useState(false);
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [meetings, setMeetings] = useState<MeetingSummary[]>([]);
  const [meetingsLoading, setMeetingsLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const displayName =
    profile?.full_name ||
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split('@')[0] ||
    'there';

  const todayFormatted = new Date().toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const loadMeetings = useCallback(async () => {
    if (!session?.access_token) return;
    setMeetingsLoading(true);
    try {
      const list = await listMeetings(session.access_token);
      setMeetings(list);
    } catch (err) {
      console.warn('[meetings] Failed to load recent meetings:', err);
    } finally {
      setMeetingsLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    void loadMeetings();
  }, [loadMeetings]);

  const handleCreateMeeting = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!session?.access_token) return;

    setActionError(null);
    setCreating(true);
    try {
      const created = await createMeeting(session.access_token, {
        title: newTitle.trim() || `${displayName}'s Meeting`,
        waiting_room_enabled: waitingRoom,
      });
      setShowCreateForm(false);
      setNewTitle('');
      navigate(`/meet/${created.code}`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to create meeting.');
    } finally {
      setCreating(false);
    }
  };

  const handleJoinByCode = (e: FormEvent) => {
    e.preventDefault();
    setActionError(null);
    const normalized = extractMeetingCode(meetingCode);
    if (!normalized || normalized.length < 4) {
      setActionError('Enter a valid meeting code (e.g. k9m4-x7p2-q3r8) or full meeting link.');
      return;
    }
    navigate(`/meet/${normalized}`);
  };

  const handleCopyInvite = async (code: string) => {
    try {
      await navigator.clipboard.writeText(buildMeetingInviteUrl(code));
      setCopiedCode(code);
      setTimeout(() => setCopiedCode((prev) => (prev === code ? null : prev)), 2000);
    } catch {
      // Fallback ignored
    }
  };

  return (
    <div className="hero-grid">
      <div>
        <span className="pill">
          <ShieldIcon size={14} />
          <span>{todayFormatted}</span>
        </span>
        <h1 className="hero-title">Video calls and meetings for everyone, {displayName}.</h1>
        <p className="hero-subtitle">
          Create a meeting with an unguessable code, manage a pre-join lobby and waiting room, and
          join seamlessly from Meet Web or Meet Android.
        </p>

        <form className="meeting-action-bar" onSubmit={handleJoinByCode}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={creating}
            onClick={() => setShowCreateForm((prev) => !prev)}
          >
            <VideoIcon size={18} />
            <span>{creating ? 'Creating...' : 'New Meeting'}</span>
          </button>

          <div className="code-input-wrap">
            <span className="code-input-icon">
              <KeyboardIcon size={18} />
            </span>
            <input
              type="text"
              className="code-input"
              value={meetingCode}
              onChange={(e) => setMeetingCode(e.target.value)}
              placeholder="Enter a code or link"
              aria-label="Meeting code or link"
            />
          </div>

          <button type="submit" className="btn btn-ghost" disabled={!meetingCode.trim()}>
            Join
          </button>
        </form>

        {actionError && <div className="alert alert-danger">{actionError}</div>}

        {showCreateForm && (
          <form className="card create-meeting-panel" onSubmit={handleCreateMeeting}>
            <div className="card-header" style={{ marginBottom: 12 }}>
              <h2 className="card-title">Create a New Meeting</h2>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowCreateForm(false)}
              >
                Cancel
              </button>
            </div>
            <div className="form">
              <label className="field">
                <span className="field-label">Meeting title (optional)</span>
                <input
                  type="text"
                  className="input"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={`${displayName}'s Meeting`}
                  maxLength={120}
                />
              </label>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={waitingRoom}
                  onChange={(e) => setWaitingRoom(e.target.checked)}
                />
                <span>
                  <strong>Enable Waiting Room</strong> — Host must admit guests before they enter
                </span>
              </label>

              <div className="actions-row">
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  <VideoIcon size={16} />
                  <span>{creating ? 'Creating room...' : 'Create & Open Lobby'}</span>
                </button>
              </div>
            </div>
          </form>
        )}

        <section className="card" style={{ marginTop: 24 }}>
          <div className="card-header">
            <h2 className="card-title">Your Recent Meetings</h2>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void loadMeetings()}
              disabled={meetingsLoading}
            >
              <RefreshIcon size={14} />
              <span>{meetingsLoading ? 'Loading...' : 'Refresh'}</span>
            </button>
          </div>

          {meetingsLoading && meetings.length === 0 ? (
            <p className="status-item-desc">Loading your meetings...</p>
          ) : meetings.length === 0 ? (
            <div className="empty-state">
              No meetings yet. Click <strong>New Meeting</strong> to generate your first room link.
            </div>
          ) : (
            <div className="meeting-list">
              {meetings.slice(0, 6).map((m) => (
                <div key={m.id} className="meeting-row">
                  <div className="meeting-row-main">
                    <div className="meeting-row-title">
                      <span>{m.title}</span>
                      <span
                        className={`badge ${
                          m.status === 'active'
                            ? 'badge-success'
                            : m.status === 'ended'
                              ? 'badge-danger'
                              : 'badge-warning'
                        }`}
                      >
                        {m.status}
                      </span>
                      {m.my_role === 'host' && <span className="badge badge-neutral">Host</span>}
                      {m.is_locked && (
                        <span className="inline-icon-tag" title="Meeting locked">
                          <LockIcon size={13} />
                        </span>
                      )}
                    </div>
                    <div className="meeting-row-meta">
                      <code>{m.code}</code>
                      <span>·</span>
                      <span className="inline-meta">
                        <UsersIcon size={13} />
                        {m.joined_count} in call
                      </span>
                      <span>·</span>
                      <span>{new Date(m.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="meeting-row-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => void handleCopyInvite(m.code)}
                      title="Copy invite link"
                    >
                      {copiedCode === m.code ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                      <span>{copiedCode === m.code ? 'Copied' : 'Link'}</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => navigate(`/meet/${m.code}`)}
                    >
                      {m.status === 'ended' ? 'View' : 'Open'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="right-stack">
        <div className="card preview-card">
          <div className="preview-stage">
            <div className="preview-stage-top">
              <span>Phase 3 · Meeting Management</span>
              <span className="preview-live-pill">Active</span>
            </div>
            <div>
              <div className="preview-stage-title">Shareable codes & host controls</div>
              <div className="preview-stage-sub">
                Every room gets an unguessable 12-char code, pre-join lobby, waiting room, and
                host-only lock & removal controls.
              </div>
            </div>
          </div>
          <div className="feature-strip-compact">
            <div className="status-item-desc">
              <strong>Cross-Platform:</strong> Create a meeting on Web and join it using the code on
              your Android phone (or vice versa).
            </div>
          </div>
        </div>

        <StatusCard data={health} loading={loading} error={error} onRefresh={onRefresh} />
      </div>
    </div>
  );
}
