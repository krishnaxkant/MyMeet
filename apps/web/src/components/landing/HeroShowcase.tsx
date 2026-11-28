import { useEffect, useRef, useState } from 'react';
import {
  CameraIcon,
  CheckIcon,
  CrownIcon,
  MicIcon,
  MonitorIcon,
  SparklesIcon,
} from '../Icons';

const DEMO_PARTICIPANTS = [
  { initials: 'AS', name: 'Ananya S.', role: 'Host · Speaking', tone: 'blue', speaking: true },
  { initials: 'RV', name: 'Rohan V.', role: 'Participant', tone: 'indigo', speaking: false },
  { initials: 'PM', name: 'Priya M.', role: 'Participant', tone: 'teal', speaking: false },
  { initials: 'DK', name: 'Dev K.', role: 'Participant', tone: 'slate', speaking: false },
];

export function HeroShowcase() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const [activeBeat, setActiveBeat] = useState<0 | 1 | 2>(0);

  // Subtle story cycle: 0 = Live discussion -> 1 = AI Notes emerging -> 2 = MCQ Ready
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) return;
    const interval = window.setInterval(() => {
      setActiveBeat((prev) => ((prev + 1) % 3) as 0 | 1 | 2);
    }, 3400);
    return () => window.clearInterval(interval);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = stageRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ rx: Number((-y * 6).toFixed(2)), ry: Number((x * 7).toFixed(2)) });
  };

  const handleMouseLeave = () => {
    setTilt({ rx: 0, ry: 0 });
  };

  return (
    <div
      ref={stageRef}
      className="lp-hero-visual"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      aria-label="Interactive MyMeet product demonstration"
    >
      <div className="lp-hero-orb lp-hero-orb-blue" aria-hidden="true" />
      <div className="lp-hero-orb lp-hero-orb-teal" aria-hidden="true" />

      <div
        className="lp-hero-stage"
        style={{
          transform: `perspective(1200px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
        }}
      >
        {/* Main Floating Meeting Interface */}
        <div className="lp-demo-window">
          <div className="lp-demo-topbar">
            <div className="lp-demo-title-group">
              <span className="lp-demo-live-dot" />
              <span className="lp-demo-room-title">System Design · Lecture 04</span>
              <span className="lp-demo-code">mmt-482-k9x</span>
            </div>
            <div className="lp-demo-meta">
              <span className="lp-demo-timer">42:18</span>
              <span className="lp-demo-tag">Product Demo</span>
            </div>
          </div>

          <div className="lp-demo-body">
            <div className="lp-demo-grid">
              {DEMO_PARTICIPANTS.map((p) => (
                <div
                  key={p.initials}
                  className={`lp-demo-tile lp-tile-${p.tone} ${p.speaking ? 'lp-tile-speaking' : ''}`}
                >
                  <div className="lp-demo-avatar">{p.initials}</div>
                  <div className="lp-demo-tile-foot">
                    <span className="lp-demo-name">{p.name}</span>
                    {p.speaking && (
                      <span className="lp-voice-bars" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Compact In-Call Chat Preview */}
            <aside className="lp-demo-chat" aria-label="Sample meeting chat">
              <div className="lp-demo-chat-head">Live Chat</div>
              <div className="lp-demo-msg">
                <strong>Rohan</strong>
                <span>Can we revisit cache invalidation?</span>
              </div>
              <div className="lp-demo-msg lp-demo-msg-accent">
                <strong>Ananya (Host)</strong>
                <span>Sharing the write-through diagram now.</span>
              </div>
              <div className="lp-demo-ai-capture">
                <SparklesIcon size={12} />
                <span>AI Notes capturing key concepts…</span>
              </div>
            </aside>
          </div>

          {/* Realistic Control Dock */}
          <div className="lp-demo-dock">
            <span className="lp-dock-btn lp-dock-btn-on" aria-hidden="true">
              <MicIcon size={14} />
            </span>
            <span className="lp-dock-btn lp-dock-btn-on" aria-hidden="true">
              <CameraIcon size={14} />
            </span>
            <span className="lp-dock-btn lp-dock-btn-share" aria-hidden="true">
              <MonitorIcon size={14} />
              <span>Sharing</span>
            </span>
            <span className="lp-dock-pill">4 in room</span>
            <span className="lp-dock-end" aria-hidden="true">
              End Call
            </span>
          </div>
        </div>

        {/* Emerging Floating AI Visual Notes Card */}
        <div className={`lp-float-card lp-float-notes ${activeBeat >= 1 ? 'lp-float-active' : ''}`}>
          <div className="lp-float-head">
            <span className="lp-float-badge lp-float-badge-ai">
              <SparklesIcon size={11} />
              <span>AI Visual Notes</span>
            </span>
            <span className="lp-float-meta">PDF · PNG</span>
          </div>
          <div className="lp-float-title">Distributed Caching Summary</div>
          <ul className="lp-float-list">
            <li>
              <CheckIcon size={11} />
              <span>Write-through vs Write-back trade-offs</span>
            </li>
            <li>
              <CheckIcon size={11} />
              <span>TTL + jitter prevents cache stampede</span>
            </li>
          </ul>
        </div>

        {/* Emerging Floating Assessment Card */}
        <div className={`lp-float-card lp-float-mcq ${activeBeat === 2 ? 'lp-float-active' : ''}`}>
          <div className="lp-float-head">
            <span className="lp-float-badge lp-float-badge-pro">
              <CrownIcon size={11} />
              <span>20-MCQ Ready</span>
            </span>
            <span className="lp-float-meta">Pro</span>
          </div>
          <div className="lp-float-title">Q1 · Which strategy avoids stale reads?</div>
          <div className="lp-float-option lp-float-option-correct">
            <span>✓ Write-through caching</span>
          </div>
        </div>
      </div>
    </div>
  );
}
