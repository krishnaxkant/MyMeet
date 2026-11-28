import { useState } from 'react';
import {
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  CrownIcon,
  MonitorIcon,
  SparklesIcon,
  VideoIcon,
} from '../Icons';

const DEMO_MCQ = {
  question: 'Sample Quiz · Why add random jitter to cache TTL values?',
  options: [
    { id: 'a', label: 'To increase memory allocation per key', correct: false },
    { id: 'b', label: 'To prevent synchronized cache stampedes', correct: true },
    { id: 'c', label: 'To disable write-through persistence', correct: false },
  ],
  explanation:
    'Adding small random jitter spreads out expiry times so thousands of keys do not expire and hit the database simultaneously.',
};

export function BentoFeatures() {
  const [selectedOpt, setSelectedOpt] = useState<string | null>(null);
  const picked = DEMO_MCQ.options.find((o) => o.id === selectedOpt);

  return (
    <section id="features" className="lp-section lp-reveal">
      <div className="lp-container">
        <div className="lp-section-head">
          <span className="lp-eyebrow">
            <SparklesIcon size={12} />
            <span>EVERYTHING CONNECTED</span>
          </span>
          <h2 className="lp-section-title">
            More than meetings. <span className="lp-grad-blue">Everything that comes after.</span>
          </h2>
          <p className="lp-section-sub">
            One intelligent workspace for communication, collaboration, and continuous learning.
          </p>
        </div>

        <div className="lp-bento-grid">
          {/* Feature 01 — Seamless HD Meetings (Wide) */}
          <article className="lp-bento-card lp-bento-span-7">
            <div className="lp-bento-meta">
              <span className="lp-bento-index">01</span>
              <span className="lp-bento-pill">
                <VideoIcon size={12} /> HD Meetings
              </span>
            </div>
            <h3>Seamless HD Meetings</h3>
            <p className="lp-bento-lead">Be present, wherever you are.</p>
            <p className="lp-bento-copy">
              Start instant rooms with shareable codes, clear real-time audio, waiting-room host
              controls, and active-speaker focus across desktop and mobile.
            </p>
            <div className="lp-mini-stage lp-mini-meetings" aria-hidden="true">
              <div className="lp-mini-tile lp-mini-tile-active">
                <span className="lp-mini-av lp-av-blue">AR</span>
                <div className="lp-mini-tile-row">
                  <span>Aarav · Speaking</span>
                  <span className="lp-voice-bars">
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
              </div>
              <div className="lp-mini-tile">
                <span className="lp-mini-av lp-av-indigo">MK</span>
                <div className="lp-mini-tile-row">
                  <span>Meera · Host</span>
                </div>
              </div>
              <div className="lp-mini-tile">
                <span className="lp-mini-av lp-av-teal">SK</span>
                <div className="lp-mini-tile-row">
                  <span>Siddharth</span>
                </div>
              </div>
            </div>
          </article>

          {/* Feature 02 — AI Visual Notes (Prominent Emerald-Teal Card) */}
          <article className="lp-bento-card lp-bento-span-5 lp-bento-ai">
            <div className="lp-bento-meta">
              <span className="lp-bento-index">02</span>
              <span className="lp-bento-pill lp-pill-ai">
                <SparklesIcon size={12} /> AI Visual Notes
              </span>
            </div>
            <h3>AI Visual Notes</h3>
            <p className="lp-bento-lead">Your conversation, intelligently organized.</p>
            <p className="lp-bento-copy">
              Filters small talk and automatically builds structured black-canvas visual study
              slides after every ended session — ready for PDF and PNG export.
            </p>
            <div className="lp-mini-stage lp-mini-ai-board">
              <div className="lp-ai-board-top">
                <span className="lp-ai-dot" />
                <span>Auto Visual Summary</span>
                <span className="lp-ai-export-tags">PDF · PNG</span>
              </div>
              <div className="lp-ai-board-heading">Key Takeaways Captured</div>
              <ul className="lp-ai-board-points">
                <li>
                  <CheckIcon size={11} /> Core definitions &amp; architecture flow
                </li>
                <li>
                  <CheckIcon size={11} /> Shared screen diagrams extracted
                </li>
                <li>
                  <CheckIcon size={11} /> Clean slide export in one click
                </li>
              </ul>
            </div>
          </article>

          {/* Feature 03 — Pro Master Notes (Gold Accent) */}
          <article className="lp-bento-card lp-bento-span-5 lp-bento-pro">
            <div className="lp-bento-meta">
              <span className="lp-bento-index">03</span>
              <span className="lp-bento-pill lp-pill-pro">
                <CrownIcon size={12} /> Pro Master Notes
              </span>
            </div>
            <h3>Pro Master Notes</h3>
            <p className="lp-bento-lead">From complex discussions to clear understanding.</p>
            <p className="lp-bento-copy">
              Editorial-grade study documents with organized headings, worked examples, code blocks,
              comparison tables, exam traps, and a 1-minute cheat sheet.
            </p>
            <div className="lp-mini-stage lp-mini-doc">
              <div className="lp-mini-doc-head">
                <span className="lp-doc-tag">MASTER GUIDE</span>
                <span className="lp-doc-pdf">HD PDF</span>
              </div>
              <div className="lp-mini-doc-title">1. Complexity &amp; Trade-offs</div>
              <div className="lp-mini-code">
                <code>O(1) lookup · O(n) space · LRU Eviction</code>
              </div>
              <div className="lp-mini-doc-note">
                <strong>Exam Trap:</strong> Distinguish cache hit ratio from memory overhead.
              </div>
            </div>
          </article>

          {/* Feature 04 — Interactive MCQ Assessments */}
          <article className="lp-bento-card lp-bento-span-7">
            <div className="lp-bento-meta">
              <span className="lp-bento-index">04</span>
              <span className="lp-bento-pill lp-pill-pro">
                <CrownIcon size={12} /> 20-MCQ Assessments
              </span>
              <span className="lp-demo-inline-badge">Interactive Demo</span>
            </div>
            <h3>Intelligent MCQ Assessments</h3>
            <p className="lp-bento-lead">Don&apos;t just attend. Understand.</p>
            <p className="lp-bento-copy">
              20-question progressive revision quizzes generated from each meeting to reinforce
              concepts with instant explanations and host score tracking. Try the sample below:
            </p>

            <div className="lp-mini-stage lp-mini-mcq">
              <div className="lp-mcq-q">{DEMO_MCQ.question}</div>
              <div className="lp-mcq-options" role="radiogroup" aria-label="Sample quiz question">
                {DEMO_MCQ.options.map((opt) => {
                  const isPicked = selectedOpt === opt.id;
                  const stateClass = isPicked
                    ? opt.correct
                      ? 'lp-mcq-opt-correct'
                      : 'lp-mcq-opt-wrong'
                    : selectedOpt && opt.correct
                      ? 'lp-mcq-opt-reveal'
                      : '';
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      className={`lp-mcq-opt ${stateClass}`}
                      onClick={() => setSelectedOpt(opt.id)}
                      aria-pressed={isPicked}
                    >
                      <span className="lp-mcq-key">{opt.id.toUpperCase()}</span>
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
              {picked && (
                <div
                  className={`lp-mcq-feedback ${
                    picked.correct ? 'lp-mcq-fb-ok' : 'lp-mcq-fb-no'
                  }`}
                >
                  <strong>{picked.correct ? 'Correct!' : 'Not quite —'}</strong>{' '}
                  {DEMO_MCQ.explanation}
                </div>
              )}
            </div>
          </article>

          {/* Feature 05 — Screen Sharing & Collaboration */}
          <article className="lp-bento-card lp-bento-span-6">
            <div className="lp-bento-meta">
              <span className="lp-bento-index">05</span>
              <span className="lp-bento-pill">
                <MonitorIcon size={12} /> Collaboration
              </span>
            </div>
            <h3>Screen Sharing &amp; Collaboration</h3>
            <p className="lp-bento-lead">Show ideas, not just faces.</p>
            <p className="lp-bento-copy">
              Full-stage screen sharing with host picture-in-picture, live chat, and raise-hand
              cues built for live teaching and team reviews.
            </p>
            <div className="lp-mini-stage lp-mini-share" aria-hidden="true">
              <div className="lp-share-slide">
                <div className="lp-share-bar">
                  <span className="lp-share-live">● Presenting Slide 6</span>
                  <span>16:9 HD</span>
                </div>
                <div className="lp-share-diagram">
                  <span className="lp-node">Client</span>
                  <span className="lp-edge" />
                  <span className="lp-node lp-node-accent">SFU Media</span>
                  <span className="lp-edge" />
                  <span className="lp-node">AI Notes</span>
                </div>
              </div>
              <div className="lp-share-pip">Host PiP</div>
            </div>
          </article>

          {/* Feature 06 — Instant & Scheduled Meetings */}
          <article className="lp-bento-card lp-bento-span-6">
            <div className="lp-bento-meta">
              <span className="lp-bento-index">06</span>
              <span className="lp-bento-pill">
                <CalendarIcon size={12} /> Scheduling
              </span>
            </div>
            <h3>Instant &amp; Scheduled Meetings</h3>
            <p className="lp-bento-lead">Meet now. Or plan what&apos;s next.</p>
            <p className="lp-bento-copy">
              Launch an instant meeting room in one click or schedule upcoming sessions with
              shareable codes and direct email invitations.
            </p>
            <div className="lp-mini-stage lp-mini-schedule">
              <div className="lp-sched-row">
                <div>
                  <div className="lp-sched-title">Algorithms Doubt Session</div>
                  <div className="lp-sched-time">Today · 7:00 PM IST · Code: alg-204-x8m</div>
                </div>
                <span className="lp-sched-btn">Start</span>
              </div>
              <div className="lp-sched-row lp-sched-row-muted">
                <div>
                  <div className="lp-sched-title">Weekly Product Sync</div>
                  <div className="lp-sched-time">Tomorrow · 11:00 AM IST · 6 invited</div>
                </div>
                <span className="lp-sched-chip">Scheduled</span>
              </div>
            </div>
          </article>

          {/* Feature 07 — Meeting History */}
          <article className="lp-bento-card lp-bento-span-6">
            <div className="lp-bento-meta">
              <span className="lp-bento-index">07</span>
              <span className="lp-bento-pill">
                <ClockIcon size={12} /> History
              </span>
            </div>
            <h3>Meeting History</h3>
            <p className="lp-bento-lead">Pick up where you left off.</p>
            <p className="lp-bento-copy">
              Every past meeting stays organized in one searchable timeline with instant access to
              Visual Notes, unlocked Pro Master Notes, and MCQ scorecards.
            </p>
            <div className="lp-mini-stage lp-mini-history">
              <div className="lp-hist-item">
                <div>
                  <div className="lp-hist-name">Operating Systems · Deadlocks</div>
                  <div className="lp-hist-sub">Ended · 52 min · 18 participants</div>
                </div>
                <div className="lp-hist-pills">
                  <span className="lp-hp-pro">Pro Notes</span>
                  <span className="lp-hp-mcq">MCQ</span>
                </div>
              </div>
              <div className="lp-hist-item">
                <div>
                  <div className="lp-hist-name">Sprint 12 Architecture Review</div>
                  <div className="lp-hist-sub">Ended · 34 min · 6 participants</div>
                </div>
                <div className="lp-hist-pills">
                  <span className="lp-hp-ai">Visual Notes</span>
                </div>
              </div>
            </div>
          </article>

          {/* Feature 08 — Adaptive Workspace */}
          <article className="lp-bento-card lp-bento-span-6">
            <div className="lp-bento-meta">
              <span className="lp-bento-index">08</span>
              <span className="lp-bento-pill">Web &amp; Android</span>
            </div>
            <h3>A Workspace That Adapts to You</h3>
            <p className="lp-bento-lead">Your meetings. Your environment.</p>
            <p className="lp-bento-copy">
              Switch smoothly between Dark and Light studio themes across desktop browsers and
              Android phones — synced under one MyMeet account.
            </p>
            <div className="lp-mini-stage lp-mini-themes" aria-hidden="true">
              <div className="lp-theme-sample lp-theme-sample-dark">
                <div className="lp-ts-bar">
                  <span className="lp-ts-dot" /> Dark Studio
                </div>
                <div className="lp-ts-lines">
                  <span className="lp-ts-l1" />
                  <span className="lp-ts-l2" />
                </div>
              </div>
              <div className="lp-theme-sample lp-theme-sample-light">
                <div className="lp-ts-bar">
                  <span className="lp-ts-dot" /> Light Studio
                </div>
                <div className="lp-ts-lines">
                  <span className="lp-ts-l1" />
                  <span className="lp-ts-l2" />
                </div>
              </div>
              <div className="lp-theme-phone">
                <div className="lp-phone-notch" />
                <span>Android</span>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
