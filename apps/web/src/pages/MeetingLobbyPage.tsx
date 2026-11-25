import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeftIcon,
  CheckIcon,
  CopyIcon,
  LockIcon,
  MicIcon,
  MicOffIcon,
  ShieldIcon,
  UsersIcon,
  VideoIcon,
  VideoOffIcon,
} from '../components/Icons';
import { useAuth } from '../hooks/useAuth';
import {
  buildMeetingInviteUrl,
  getMeeting,
  joinMeeting,
  type MeetingDetail,
} from '../services/api';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'M';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function MeetingLobbyPage() {
  const { code = '' } = useParams<{ code: string }>();
  const { session, user, profile } = useAuth();
  const navigate = useNavigate();

  const [meeting, setMeeting] = useState<MeetingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedTarget, setCopiedTarget] = useState<'link' | 'code' | null>(null);

  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const displayName =
    profile?.full_name ||
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email ||
    'You';

  const loadMeeting = useCallback(async () => {
    if (!session?.access_token || !code) return;
    try {
      const detail = await getMeeting(session.access_token, code);
      setMeeting(detail);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load meeting.');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, code]);

  useEffect(() => {
    setLoading(true);
    void loadMeeting();
  }, [loadMeeting]);

  // If user is in waiting room, poll every 3s until host admits or removes them
  useEffect(() => {
    if (meeting?.my_status !== 'waiting' || meeting.status !== 'active') return;
    const interval = setInterval(() => {
      void loadMeeting();
    }, 3000);
    return () => clearInterval(interval);
  }, [meeting?.my_status, meeting?.status, loadMeeting]);

  // Auto-enter room once admitted from waiting room
  const wasWaitingRef = useRef(false);
  useEffect(() => {
    if (meeting?.my_status === 'waiting') {
      wasWaitingRef.current = true;
    } else if (wasWaitingRef.current && meeting?.my_status === 'joined') {
      wasWaitingRef.current = false;
      navigate(`/meet/${meeting.code}/room`, {
        replace: true,
        state: { micEnabled, camEnabled },
      });
    }
  }, [meeting?.my_status, meeting?.code, navigate, micEnabled, camEnabled]);

  // Manage local browser camera preview when user enables camera in lobby
  useEffect(() => {
    let cancelled = false;

    const stopStream = () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };

    if (!camEnabled) {
      stopStream();
      setCameraError(null);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera preview is unavailable in this browser context.');
      setCamEnabled(false);
      return;
    }

    void navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        setCameraError(null);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(() => {
        if (cancelled) return;
        setCameraError('Could not access camera. Check browser permissions.');
        setCamEnabled(false);
      });

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [camEnabled]);

  const handleCopy = async (target: 'link' | 'code') => {
    if (!meeting) return;
    const value = target === 'link' ? buildMeetingInviteUrl(meeting.code) : meeting.code;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedTarget(target);
      setTimeout(() => setCopiedTarget(null), 2000);
    } catch {
      // Ignore clipboard failures
    }
  };

  const handleJoin = async () => {
    if (!session?.access_token || !meeting) return;
    setError(null);
    setJoining(true);
    try {
      const updated = await joinMeeting(session.access_token, meeting.code);
      setMeeting(updated);
      if (updated.my_status === 'joined') {
        navigate(`/meet/${updated.code}/room`, {
          state: { micEnabled, camEnabled },
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to join meeting.');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="card" style={{ maxWidth: 520, margin: '32px auto' }}>
        <p className="status-item-desc">Loading meeting lobby...</p>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="card" style={{ maxWidth: 520, margin: '32px auto' }}>
        <h1 className="card-title" style={{ marginBottom: 10 }}>
          Unable to open meeting
        </h1>
        <div className="alert alert-danger">{error ?? 'Meeting not found.'}</div>
        <Link to="/" className="btn btn-primary">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const isWaiting = meeting.my_status === 'waiting';
  const isRemoved = meeting.my_status === 'removed' && !meeting.is_host;
  const isEnded = meeting.status === 'ended';
  const isBlockedByLock = meeting.is_locked && !meeting.is_host && meeting.my_status !== 'joined';

  return (
    <div className="lobby-grid">
      <section className="card lobby-preview-card">
        <div className="lobby-video-box">
          {camEnabled ? (
            <video ref={videoRef} autoPlay playsInline muted className="lobby-video-element" />
          ) : (
            <div className="lobby-avatar-placeholder">
              <div className="avatar-circle avatar-circle-lg">{getInitials(displayName)}</div>
              <div className="lobby-placeholder-name">{displayName}</div>
              <div className="lobby-placeholder-sub">Camera is off</div>
            </div>
          )}

          <div className="lobby-media-controls">
            <button
              type="button"
              className={`media-btn ${micEnabled ? 'media-btn-on' : 'media-btn-off'}`}
              onClick={() => setMicEnabled((prev) => !prev)}
              title={micEnabled ? 'Mute microphone' : 'Unmute microphone'}
            >
              {micEnabled ? <MicIcon size={18} /> : <MicOffIcon size={18} />}
            </button>
            <button
              type="button"
              className={`media-btn ${camEnabled ? 'media-btn-on' : 'media-btn-off'}`}
              onClick={() => setCamEnabled((prev) => !prev)}
              title={camEnabled ? 'Turn off camera preview' : 'Turn on camera preview'}
            >
              {camEnabled ? <VideoIcon size={18} /> : <VideoOffIcon size={18} />}
            </button>
          </div>
        </div>

        {cameraError && (
          <div className="alert alert-warning" style={{ marginTop: 12, marginBottom: 0 }}>
            {cameraError}
          </div>
        )}
      </section>

      <section className="card lobby-info-card">
        <div className="card-header" style={{ marginBottom: 10 }}>
          <span
            className={`badge ${
              isEnded ? 'badge-danger' : meeting.is_host ? 'badge-success' : 'badge-warning'
            }`}
          >
            {isEnded ? 'Ended' : meeting.is_host ? 'You are the Host' : 'Meeting Lobby'}
          </span>
          <Link to="/" className="back-pill-link">
            <ArrowLeftIcon size={14} />
            <span>Back to Home</span>
          </Link>
        </div>

        <h1 className="lobby-title">{meeting.title}</h1>
        <p className="lobby-host">
          Hosted by <strong>{meeting.host_name || meeting.host_email || 'Meet Host'}</strong>
        </p>

        <div className="lobby-meta-pills">
          <span className="meta-pill">
            <UsersIcon size={14} />
            {meeting.joined_count} {meeting.joined_count === 1 ? 'participant' : 'participants'} in
            call
          </span>
          {meeting.waiting_room_enabled && (
            <span className="meta-pill">
              <ShieldIcon size={14} />
              Waiting room on
            </span>
          )}
          {meeting.is_locked && (
            <span className="meta-pill meta-pill-danger">
              <LockIcon size={14} />
              Locked
            </span>
          )}
        </div>

        <div className="invite-box">
          <div>
            <div className="invite-box-label">Meeting Code</div>
            <code className="invite-code">{meeting.code}</code>
          </div>
          <div className="actions-row">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void handleCopy('code')}
            >
              {copiedTarget === 'code' ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
              <span>{copiedTarget === 'code' ? 'Copied' : 'Code'}</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void handleCopy('link')}
            >
              {copiedTarget === 'link' ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
              <span>{copiedTarget === 'link' ? 'Copied Link' : 'Copy Link'}</span>
            </button>
          </div>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        {isEnded && (
          <div className="alert alert-danger">
            This meeting has ended. Return to the dashboard to start a new meeting.
          </div>
        )}

        {isRemoved && !isEnded && (
          <div className="alert alert-danger">
            You were removed from this meeting by the host and cannot rejoin.
          </div>
        )}

        {isBlockedByLock && !isEnded && !isRemoved && (
          <div className="alert alert-warning">
            This meeting is currently locked by the host. Ask the host to unlock it before joining.
          </div>
        )}

        {isWaiting && !isEnded && (
          <div className="alert alert-warning">
            <strong>Waiting for the host to let you in...</strong> You&apos;ll enter automatically
            as soon as the host admits you.
          </div>
        )}

        <div className="actions-row" style={{ marginTop: 8 }}>
          <button
            type="button"
            className="btn btn-primary btn-full"
            disabled={joining || isEnded || isRemoved || isBlockedByLock || isWaiting}
            onClick={() => void handleJoin()}
          >
            <VideoIcon size={18} />
            <span>
              {joining
                ? 'Joining...'
                : isWaiting
                  ? 'Waiting for Host Approval...'
                  : meeting.is_host
                    ? 'Enter Meeting as Host'
                    : meeting.waiting_room_enabled && meeting.my_status !== 'joined'
                      ? 'Ask to Join'
                      : 'Join Now'}
            </span>
          </button>
        </div>
      </section>
    </div>
  );
}
