import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  CheckIcon,
  CopyIcon,
  LockIcon,
  MicIcon,
  MicOffIcon,
  PhoneOffIcon,
  ShieldIcon,
  UnlockIcon,
  UsersIcon,
  VideoIcon,
  VideoOffIcon,
} from '../components/Icons';
import { useAuth } from '../hooks/useAuth';
import {
  admitParticipant,
  buildMeetingInviteUrl,
  endMeeting,
  getMeeting,
  leaveMeeting,
  removeParticipant,
  updateMeetingSettings,
  type MeetingDetail,
} from '../services/api';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'M';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatElapsed(startedAt: string | null): string {
  if (!startedAt) return '00:00';
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  const hrs = Math.floor(diffSec / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  const secs = diffSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hrs > 0 ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;
}

export function MeetingRoomPage() {
  const { code = '' } = useParams<{ code: string }>();
  const { session, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const navState = (location.state as { micEnabled?: boolean; camEnabled?: boolean } | null) ?? {};

  const [meeting, setMeeting] = useState<MeetingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const [micEnabled, setMicEnabled] = useState(navState.micEnabled ?? true);
  const [camEnabled, setCamEnabled] = useState(navState.camEnabled ?? false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [elapsed, setElapsed] = useState('00:00');

  const fetchRoomState = useCallback(async () => {
    if (!session?.access_token || !code) return;
    try {
      const detail = await getMeeting(session.access_token, code);
      setMeeting(detail);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sync meeting room.');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, code]);

  useEffect(() => {
    void fetchRoomState();
    const poll = setInterval(() => {
      void fetchRoomState();
    }, 3000);
    return () => clearInterval(poll);
  }, [fetchRoomState]);

  useEffect(() => {
    if (!meeting?.started_at) return;
    setElapsed(formatElapsed(meeting.started_at));
    const tick = setInterval(() => {
      setElapsed(formatElapsed(meeting.started_at));
    }, 1000);
    return () => clearInterval(tick);
  }, [meeting?.started_at]);

  // If user is not joined (e.g. removed, waiting, or direct URL), redirect back to lobby
  useEffect(() => {
    if (!meeting) return;
    if (meeting.status === 'ended') return;
    if (!meeting.is_host && meeting.my_status !== 'joined') {
      navigate(`/meet/${meeting.code}`, { replace: true });
    }
  }, [meeting, navigate]);

  const handleCopyLink = async () => {
    if (!meeting) return;
    try {
      await navigator.clipboard.writeText(buildMeetingInviteUrl(meeting.code));
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Ignore clipboard failures
    }
  };

  const handleLeave = async () => {
    if (!session?.access_token || !meeting) {
      navigate('/', { replace: true });
      return;
    }
    setActionBusy(true);
    try {
      await leaveMeeting(session.access_token, meeting.code);
    } finally {
      navigate('/', { replace: true });
    }
  };

  const handleToggleLock = async () => {
    if (!session?.access_token || !meeting) return;
    setActionBusy(true);
    setError(null);
    try {
      const updated = await updateMeetingSettings(session.access_token, meeting.code, {
        is_locked: !meeting.is_locked,
      });
      setMeeting(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update lock status.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleToggleWaitingRoom = async () => {
    if (!session?.access_token || !meeting) return;
    setActionBusy(true);
    setError(null);
    try {
      const updated = await updateMeetingSettings(session.access_token, meeting.code, {
        waiting_room_enabled: !meeting.waiting_room_enabled,
      });
      setMeeting(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle waiting room.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleAdmit = async (targetUserId: string) => {
    if (!session?.access_token || !meeting) return;
    setActionBusy(true);
    setError(null);
    try {
      const updated = await admitParticipant(session.access_token, meeting.code, targetUserId);
      setMeeting(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to admit participant.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleRemove = async (targetUserId: string) => {
    if (!session?.access_token || !meeting) return;
    setActionBusy(true);
    setError(null);
    try {
      const updated = await removeParticipant(session.access_token, meeting.code, targetUserId);
      setMeeting(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove participant.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleEndForAll = async () => {
    if (!session?.access_token || !meeting) return;
    setActionBusy(true);
    setError(null);
    try {
      const updated = await endMeeting(session.access_token, meeting.code);
      setMeeting(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to end meeting.');
    } finally {
      setActionBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="card" style={{ maxWidth: 520, margin: '32px auto' }}>
        <p className="status-item-desc">Connecting to meeting room...</p>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="card" style={{ maxWidth: 520, margin: '32px auto' }}>
        <div className="alert alert-danger">{error ?? 'Meeting not found.'}</div>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/')}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (meeting.status === 'ended') {
    return (
      <div className="card" style={{ maxWidth: 520, margin: '40px auto', textAlign: 'center' }}>
        <h1 className="auth-title">Meeting Ended</h1>
        <p className="auth-subtitle">
          <strong>{meeting.title}</strong> ({meeting.code}) has been ended by the host.
        </p>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/')}>
          Return to Dashboard
        </button>
      </div>
    );
  }

  const joinedParticipants = meeting.participants.filter((p) => p.status === 'joined');
  const waitingParticipants = meeting.participants.filter((p) => p.status === 'waiting');

  return (
    <div className="room-shell">
      <div className="room-header card">
        <div className="room-header-left">
          <h1 className="room-title">{meeting.title}</h1>
          <div className="room-meta-row">
            <code>{meeting.code}</code>
            <span>·</span>
            <span>{elapsed}</span>
            {meeting.is_locked && (
              <span className="badge badge-danger">
                <LockIcon size={11} /> Locked
              </span>
            )}
            {meeting.waiting_room_enabled && (
              <span className="badge badge-warning">Waiting Room</span>
            )}
          </div>
        </div>

        <div className="actions-row">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void handleCopyLink()}>
            {copiedLink ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
            <span>{copiedLink ? 'Invite Copied' : 'Copy Invite Link'}</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setShowSidebar((prev) => !prev)}
          >
            <UsersIcon size={14} />
            <span>
              Participants ({joinedParticipants.length}
              {waitingParticipants.length > 0 ? ` + ${waitingParticipants.length} waiting` : ''})
            </span>
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className={`room-body ${showSidebar ? '' : 'room-body-full'}`}>
        <section className="room-stage card">
          <div className="stage-banner">
            <ShieldIcon size={15} />
            <span>
              Phase 3 Room Active — LiveKit real-time video & audio streams connect into these tiles
              in Phase 4.
            </span>
          </div>

          <div className="participant-tiles-grid">
            {joinedParticipants.map((participant) => {
              const name = participant.full_name || participant.email || 'Participant';
              const isMe = participant.user_id === user?.id;
              return (
                <div key={participant.id} className={`video-tile ${isMe ? 'video-tile-me' : ''}`}>
                  <div className="avatar-circle avatar-circle-lg">{getInitials(name)}</div>
                  <div className="video-tile-footer">
                    <span className="video-tile-name">
                      {name} {isMe ? '(You)' : ''}
                    </span>
                    <div className="video-tile-badges">
                      {participant.role === 'host' && (
                        <span className="badge badge-success">Host</span>
                      )}
                      {isMe && !micEnabled && <span className="badge badge-danger">Muted</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {showSidebar && (
          <aside className="room-sidebar card">
            {meeting.is_host && (
              <div className="sidebar-section">
                <h2 className="sidebar-title">
                  <ShieldIcon size={15} /> Host Controls
                </h2>
                <div className="host-controls-stack">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm btn-full"
                    disabled={actionBusy}
                    onClick={() => void handleToggleLock()}
                  >
                    {meeting.is_locked ? <UnlockIcon size={14} /> : <LockIcon size={14} />}
                    <span>{meeting.is_locked ? 'Unlock Meeting' : 'Lock Meeting'}</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm btn-full"
                    disabled={actionBusy}
                    onClick={() => void handleToggleWaitingRoom()}
                  >
                    <ShieldIcon size={14} />
                    <span>
                      {meeting.waiting_room_enabled
                        ? 'Disable Waiting Room'
                        : 'Enable Waiting Room'}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {meeting.is_host && waitingParticipants.length > 0 && (
              <div className="sidebar-section">
                <h2 className="sidebar-title">
                  Waiting Room ({waitingParticipants.length})
                </h2>
                <div className="roster-list">
                  {waitingParticipants.map((p) => (
                    <div key={p.id} className="roster-row">
                      <div className="roster-info">
                        <div className="roster-name">{p.full_name || p.email}</div>
                        <div className="roster-sub">Waiting to join</div>
                      </div>
                      <div className="roster-actions">
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={actionBusy}
                          onClick={() => void handleAdmit(p.user_id)}
                        >
                          Admit
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger-soft btn-sm"
                          disabled={actionBusy}
                          onClick={() => void handleRemove(p.user_id)}
                        >
                          Deny
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="sidebar-section">
              <h2 className="sidebar-title">
                In This Meeting ({joinedParticipants.length})
              </h2>
              <div className="roster-list">
                {joinedParticipants.map((p) => {
                  const isMe = p.user_id === user?.id;
                  return (
                    <div key={p.id} className="roster-row">
                      <div className="roster-info">
                        <div className="roster-name">
                          {p.full_name || p.email} {isMe ? '(You)' : ''}
                        </div>
                        <div className="roster-sub">
                          {p.role === 'host' ? 'Host' : 'Participant'}
                        </div>
                      </div>
                      {meeting.is_host && !isMe && (
                        <button
                          type="button"
                          className="btn btn-danger-soft btn-sm"
                          disabled={actionBusy}
                          onClick={() => void handleRemove(p.user_id)}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        )}
      </div>

      <footer className="room-controls-bar card">
        <div className="controls-group">
          <button
            type="button"
            className={`media-btn ${micEnabled ? 'media-btn-on' : 'media-btn-off'}`}
            onClick={() => setMicEnabled((prev) => !prev)}
            title={micEnabled ? 'Mute mic' : 'Unmute mic'}
          >
            {micEnabled ? <MicIcon size={18} /> : <MicOffIcon size={18} />}
          </button>
          <button
            type="button"
            className={`media-btn ${camEnabled ? 'media-btn-on' : 'media-btn-off'}`}
            onClick={() => setCamEnabled((prev) => !prev)}
            title={camEnabled ? 'Turn camera off' : 'Turn camera on'}
          >
            {camEnabled ? <VideoIcon size={18} /> : <VideoOffIcon size={18} />}
          </button>
        </div>

        <div className="controls-group">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={actionBusy}
            onClick={() => void handleLeave()}
          >
            <PhoneOffIcon size={16} />
            <span>Leave</span>
          </button>

          {meeting.is_host && (
            <button
              type="button"
              className="btn btn-danger"
              disabled={actionBusy}
              onClick={() => void handleEndForAll()}
            >
              <PhoneOffIcon size={16} />
              <span>End for All</span>
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
