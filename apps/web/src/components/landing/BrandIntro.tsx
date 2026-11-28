import { useEffect, useState } from 'react';

const INTRO_SESSION_KEY = 'mymeet-landing-intro-seen';

const PARTICLES = [
  { id: 1, sx: '-170px', sy: '-110px', delay: '0ms', size: 10 },
  { id: 2, sx: '180px', sy: '-95px', delay: '40ms', size: 9 },
  { id: 3, sx: '-150px', sy: '120px', delay: '70ms', size: 8 },
  { id: 4, sx: '165px', sy: '115px', delay: '30ms', size: 10 },
  { id: 5, sx: '0px', sy: '-175px', delay: '60ms', size: 8 },
  { id: 6, sx: '-210px', sy: '12px', delay: '90ms', size: 7 },
  { id: 7, sx: '210px', sy: '-10px', delay: '50ms', size: 7 },
  { id: 8, sx: '15px', sy: '168px', delay: '80ms', size: 9 },
];

export function BrandIntro({ onComplete }: { onComplete?: () => void }) {
  const [visible, setVisible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      if (window.sessionStorage.getItem(INTRO_SESSION_KEY) === '1') {
        return false;
      }
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        window.sessionStorage.setItem(INTRO_SESSION_KEY, '1');
        return false;
      }
      return true;
    } catch {
      return false;
    }
  });
  const [stage, setStage] = useState<'connect' | 'assemble' | 'reveal' | 'exit'>('connect');

  useEffect(() => {
    if (!visible) return;
    try {
      window.sessionStorage.setItem(INTRO_SESSION_KEY, '1');
    } catch {
      // Ignore storage errors in restricted contexts
    }

    const t1 = window.setTimeout(() => setStage('assemble'), 420);
    const t2 = window.setTimeout(() => setStage('reveal'), 920);
    const t3 = window.setTimeout(() => setStage('exit'), 1820);
    const t4 = window.setTimeout(() => {
      setVisible(false);
      onComplete?.();
    }, 2300);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.clearTimeout(t4);
    };
  }, [visible, onComplete]);

  if (!visible) return null;

  const handleSkip = () => {
    setStage('exit');
    window.setTimeout(() => {
      setVisible(false);
      onComplete?.();
    }, 180);
  };

  return (
    <div
      className={`lp-intro lp-intro-${stage}`}
      role="status"
      aria-live="polite"
      aria-label="Welcome to MyMeet"
    >
      <div className="lp-intro-grid" aria-hidden="true" />
      <div className="lp-intro-aura" aria-hidden="true" />

      <div className="lp-intro-stage">
        {/* Stage 1: Luminous particles converging toward center */}
        <div className="lp-intro-particles" aria-hidden="true">
          {PARTICLES.map((p) => (
            <span
              key={p.id}
              className="lp-intro-particle"
              style={
                {
                  '--sx': p.sx,
                  '--sy': p.sy,
                  '--delay': p.delay,
                  width: `${p.size}px`,
                  height: `${p.size}px`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>

        {/* Stage 2: Official MyMeet emblem assembling with soft elastic spring */}
        <div className="lp-intro-logo-wrap">
          <div className="lp-intro-ring" aria-hidden="true" />
          <img
            src="/mymeet-mark.png?v=2"
            alt="MyMeet"
            width={78}
            height={78}
            className="lp-intro-emblem"
          />
        </div>

        {/* Stage 3: Wordmark + Sequential Tagline Reveal */}
        <div className="lp-intro-copy">
          <div className="lp-intro-wordmark">
            <span className="lp-intro-my">My</span>
            <span className="lp-intro-meet">Meet</span>
          </div>
          <div className="lp-intro-tagline">
            <span className="lp-intro-word lp-intro-word-1">Connect.</span>
            <span className="lp-intro-word lp-intro-word-2">Collaborate.</span>
            <span className="lp-intro-word lp-intro-word-3">Together.</span>
          </div>
        </div>
      </div>

      <button type="button" className="lp-intro-skip" onClick={handleSkip}>
        Skip intro
      </button>
    </div>
  );
}
