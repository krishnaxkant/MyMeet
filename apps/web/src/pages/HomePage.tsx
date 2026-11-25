import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  CopyIcon,
  KeyboardIcon,
  LockIcon,
  MailIcon,
  RefreshIcon,
  ShieldIcon,
  UsersIcon,
  VideoIcon,
} from '../components/Icons';
import { useAuth } from '../hooks/useAuth';
import {
  buildMeetingInviteUrl,
  createMeeting,
  extractMeetingCode,
  listMeetings,
  listMyInvitations,
  listSchedules,
  respondToInvitation,
  startSchedule,
  type MeetingInvitation,
  type MeetingSummary,
  type ScheduledMeeting,
} from '../services/api';

const SPOTLIGHT_SLIDES = [
  {
    badge: 'Instant Rooms',
    title: 'Get a link you can share in seconds',
    copy: 'Click New Meeting to generate an encrypted room link, preview your camera in the lobby, and invite anyone by code or email.',
  },
  {
    badge: 'Built for Privacy',
    title: 'Your meetings stay under your control',
    copy: 'Use Waiting Rooms, Co-Host permissions, one-click meeting lock, and explicit recording alerts for every participant.',
  },
  {
    badge: 'Everywhere You Work',
    title: 'Seamless across Web & Android',
    copy: 'Start a call on your laptop and chat, schedule, or manage participants from your Android phone with one synced account.',
  },
];

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function HomePage() {
  const { session, user, profile } = useAuth();
  const navigate = useNavigate();

  const [meetingCode, setMeetingCode] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [waitingRoom, setWaitingRoom] = useState(false);
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [meetings, setMeetings] = useState<MeetingSummary[]>([]);
  const [schedules, setSchedules] = useState<ScheduledMeeting[]>([]);
  const [invitations, setInvitations] = useState<MeetingInvitation[]>([]);
  const [meetingsLoading, setMeetingsLoading] = useState(true);
  const [inviteBusyId, setInviteBusyId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [slideIdx, setSlideIdx] = useState(0);

  const firstName = (
    profile?.full_name ||
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split('@')[0] ||
    'there'
  ).split(' ')[0];

  const todayFormatted = new Date().toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const loadDashboardData = useCallback(async () => {
    if (!session?.access_token) return;
    setMeetingsLoading(true);
    try {
      const [list, invites, upcoming] = await Promise.all([
        listMeetings(session.access_token),
        listMyInvitations(session.access_token).catch(() => []),
        listSchedules(session.access_token).catch(() => []),
      ]);
      setMeetings(list);
      setInvitations(invites);
      setSchedules(upcoming);
    } catch (err) {
      console.warn('[meetings] Failed to load dashboard data:', err);
    } finally {
      setMeetingsLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  const handleCreateMeeting = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!session?.access_token) return;

    setActionError(null);
    setCreating(true);
    try {
      const created = await createMeeting(session.access_token, {
        title: newTitle.trim() || `${firstName}'s Meeting`,
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

  const handleRespondInvite = async (
    invitation: MeetingInvitation,
    action: 'accepted' | 'declined',
  ) => {
    if (!session?.access_token) return;
    setInviteBusyId(invitation.id);
    setActionError(null);
    try {
      const updated = await respondToInvitation(session.access_token, invitation.id, action);
      setInvitations((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      if (action === 'accepted') {
        navigate(`/meet/${invitation.meeting_code}`);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to respond to invitation.');
    } finally {
      setInviteBusyId(null);
    }
  };

  const handleStartScheduled = async (sched: ScheduledMeeting) => {
    if (!session?.access_token) return;
    try {
      const started = await startSchedule(session.access_token, sched.id);
      if (started.meeting_code) navigate(`/meet/${started.meeting_code}`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to start scheduled meeting.');
    }
  };

  const handleCopyInvite = async (code: string) => {
    try {
      await navigator.clipboard.writeText(buildMeetingInviteUrl(code));
      setCopiedCode(code);
      setTimeout(() => setCopiedCode((prev) => (prev === code ? null : prev)), 2000);
    } catch {
      // Ignore clipboard failures
    }
  };

  const pendingInvites = invitations.filter(
    (inv) => inv.status === 'pending' && inv.meeting_status !== 'ended',
  );
  const nextSchedule = schedules.find((s) => s.meeting_status !== 'ended') ?? null;
  const activeSlide = SPOTLIGHT_SLIDES[slideIdx];

  return (
    <div className="hero-grid">
      <div>
        <span className="greeting-pill">
          <ShieldIcon size={14} />
          <span>{todayFormatted}</span>
        </span>
        <h1 className="hero-title">
          {getTimeGreeting()}, {firstName}.
        </h1>
        <p className="hero-subtitle">
          Start a crystal-clear video meeting, schedule ahead with your team, or join an existing
          room with a code or link.
        </p>

        <form className="launch-bar" onSubmit={handleJoinByCode}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={creating}
            onClick={() => setShowCreateForm((prev) => !prev)}
          >
            <VideoIcon size={18} />
            <span>{creating ? 'Creating...' : 'New Meeting'}</span>
          </button>

          <Link to="/schedule" className="btn btn-secondary">
            <CalendarIcon size={16} />
            <span>Schedule</span>
          </Link>

          <div className="join-capsule">
            <span className="join-capsule-icon">
              <KeyboardIcon size={17} />
            </span>
            <input
              type="text"
              className="join-capsule-input"
              value={meetingCode}
              onChange={(e) => setMeetingCode(e.target.value)}
              placeholder="Enter code or link"
              aria-label="Meeting code or link"
            />
            <button type="submit" className="btn btn-ghost btn-sm" disabled={!meetingCode.trim()}>
              Join
            </button>
          </div>
        </form>

        {actionError && <div className="alert alert-danger">{actionError}</div>}

        {showCreateForm && (
          <form className="card create-meeting-panel" onSubmit={handleCreateMeeting}>
            <div className="card-header" style={{ marginBottom: 14 }}>
              <h2 className="card-title">Start a New Meeting</h2>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowCreateForm(false)}
              >
                Close
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
                  placeholder={`${firstName}'s Meeting`}
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
                  <strong>Enable Waiting Room</strong> — Approve guests before they join
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

        {pendingInvites.length > 0 && (
          <section className="card invite-highlight-card" style={{ marginTop: 22 }}>
            <div className="card-header" style={{ marginBottom: 12 }}>
              <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MailIcon size={17} />
                <span>Meeting Invitations</span>
              </h2>
              <span className="badge badge-warning">{pendingInvites.length} pending</span>
            </div>

            <div className="meeting-list">
              {pendingInvites.map((inv) => (
                <div key={inv.id} className="meeting-row">
                  <div className="meeting-row-main">
                    <div className="meeting-row-title">
                      <span>{inv.meeting_title}</span>
                      <span className="badge badge-success">Invited</span>
                    </div>
                    <div className="meeting-row-meta">
                      <span>
                        From <strong>{inv.inviter_name || inv.inviter_email || 'Host'}</strong>
                      </span>
                      <span>·</span>
                      <code>{inv.meeting_code}</code>
                    </div>
                  </div>
                  <div className="meeting-row-actions">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={inviteBusyId === inv.id}
                      onClick={() => void handleRespondInvite(inv, 'accepted')}
                    >
                      Accept & Join
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger-soft btn-sm"
                      disabled={inviteBusyId === inv.id}
                      onClick={() => void handleRespondInvite(inv, 'declined')}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="card" style={{ marginTop: 22 }}>
          <div className="card-header">
            <h2 className="card-title">Recent Meetings</h2>
            <div className="actions-row">
              <Link to="/history" className="text-link">
                View all history
              </Link>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => void loadDashboardData()}
                disabled={meetingsLoading}
              >
                <RefreshIcon size={14} />
              </button>
            </div>
          </div>

          {meetingsLoading && meetings.length === 0 ? (
            <p className="status-item-desc">Loading your meetings...</p>
          ) : meetings.length === 0 ? (
            <div className="empty-state">
              No meetings yet. Click <strong>New Meeting</strong> to start your first room.
            </div>
          ) : (
            <div className="meeting-list">
              {meetings.slice(0, 5).map((m) => (
                <div key={m.id} className="meeting-row">
                  <div className="meeting-row-main">
                    <div className="meeting-row-title">
                      <span>{m.title}</span>
                      <span
                        className={`badge ${
                          m.status === 'active'
                            ? 'badge-success'
                            : m.status === 'ended'
                              ? 'badge-neutral'
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
                      {m.status === 'ended' ? 'Details' : 'Open'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="right-stack">
        <section className="card spotlight-card">
          <div className="spotlight-visual">
            <span className="spotlight-badge">{activeSlide.badge}</span>
            <div>
              <h2 className="spotlight-heading">{activeSlide.title}</h2>
              <p className="spotlight-copy">{activeSlide.copy}</p>
            </div>
          </div>
          <div className="carousel-controls">
            <div className="carousel-dots" role="tablist" aria-label="Meet highlights">
              {SPOTLIGHT_SLIDES.map((s, idx) => (
                <button
                  key={s.badge}
                  type="button"
                  className={`carousel-dot ${idx === slideIdx ? 'active' : ''}`}
                  aria-label={s.badge}
                  onClick={() => setSlideIdx(idx)}
                />
              ))}
            </div>
            <div className="actions-row">
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                onClick={() =>
                  setSlideIdx((prev) => (prev - 1 + SPOTLIGHT_SLIDES.length) % SPOTLIGHT_SLIDES.length)
                }
              >
                ←
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                onClick={() => setSlideIdx((prev) => (prev + 1) % SPOTLIGHT_SLIDES.length)}
              >
                →
              </button>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-header" style={{ marginBottom: 14 }}>
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CalendarIcon size={17} />
              <span>Up Next</span>
            </h2>
            <Link to="/schedule" className="text-link">
              Manage schedule
            </Link>
          </div>

          {nextSchedule ? (
            <div className="meeting-row roster-row-col">
              <div className="roster-top-line">
                <div className="meeting-row-title">{nextSchedule.title}</div>
                <span className="badge badge-success">
                  {nextSchedule.is_host ? 'Host' : 'Invited'}
                </span>
              </div>
              <div className="meeting-row-meta">
                <span className="inline-meta">
                  <ClockIcon size={13} />
                  {new Date(nextSchedule.scheduled_start).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                {nextSchedule.meeting_code && (
                  <>
                    <span>·</span>
                    <code>{nextSchedule.meeting_code}</code>
                  </>
                )}
              </div>
              <div className="actions-row" style={{ marginTop: 4 }}>
                {nextSchedule.is_host ? (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => void handleStartScheduled(nextSchedule)}
                  >
                    <VideoIcon size={14} />
                    <span>Start Meeting</span>
                  </button>
                ) : nextSchedule.meeting_code ? (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => navigate(`/meet/${nextSchedule.meeting_code}`)}
                  >
                    Open Lobby
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="empty-state">
              No upcoming scheduled calls.{' '}
              <Link to="/schedule" className="text-link">
                Schedule one now
              </Link>
              .
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
