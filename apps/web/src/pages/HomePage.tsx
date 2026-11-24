import { useState } from 'react';
import { KeyboardIcon, ShieldIcon, VideoIcon } from '../components/Icons';
import { StatusCard } from '../components/StatusCard';
import { useAuth } from '../hooks/useAuth';
import type { HealthResponse } from '../services/api';

interface HomePageProps {
  health: HealthResponse | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export function HomePage({ health, loading, error, onRefresh }: HomePageProps) {
  const { user, profile } = useAuth();
  const [meetingCode, setMeetingCode] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

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

  const handleUpcomingAction = (action: string) => {
    setNotice(`${action} is coming next in Phase 3 (Meeting Management).`);
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
          Start an instant meeting, share a secure link, or join from Meet Web and Meet Android with
          crystal-clear audio and video.
        </p>

        <div className="meeting-action-bar">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => handleUpcomingAction('Creating a new meeting')}
          >
            <VideoIcon size={18} />
            <span>New Meeting</span>
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

          <button
            type="button"
            className="btn btn-ghost"
            disabled={!meetingCode.trim()}
            onClick={() => handleUpcomingAction(`Joining "${meetingCode.trim()}"`)}
          >
            Join
          </button>
        </div>

        <div className="hint-box">
          <ShieldIcon size={18} />
          <span>
            {notice ??
              'Your account is signed in and verified via Supabase Auth & Meet Backend. Switch between Light and Dark themes anytime from the top bar.'}
          </span>
        </div>

        <div className="feature-strip">
          <div className="feature-chip">
            <div className="feature-chip-title">HD Group Video</div>
            <div className="feature-chip-desc">Powered by LiveKit SFU architecture</div>
          </div>
          <div className="feature-chip">
            <div className="feature-chip-title">Web & Android</div>
            <div className="feature-chip-desc">Synced account across browser & mobile</div>
          </div>
          <div className="feature-chip">
            <div className="feature-chip-title">Host Controls</div>
            <div className="feature-chip-desc">Waiting room, lock & secure meeting codes</div>
          </div>
        </div>
      </div>

      <div className="right-stack">
        <div className="card preview-card">
          <div className="preview-stage">
            <div className="preview-stage-top">
              <span>Meet Room Preview</span>
              <span className="preview-live-pill">Ready for Phase 3</span>
            </div>
            <div>
              <div className="preview-stage-title">Get a link you can share</div>
              <div className="preview-stage-sub">
                Click New Meeting to generate an encrypted room link and invite participants.
              </div>
            </div>
          </div>
          <div className="status-item-desc">
            Tip: Try toggling <strong>Light</strong> and <strong>Dark</strong> themes in the top bar
            or in your Profile settings.
          </div>
        </div>

        <StatusCard data={health} loading={loading} error={error} onRefresh={onRefresh} />
      </div>
    </div>
  );
}
