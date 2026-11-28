import { useEffect, useRef, useState } from 'react';
import { CheckIcon, CrownIcon, MonitorIcon, SparklesIcon, VideoIcon } from '../Icons';

const JOURNEY_STAGES = [
  {
    id: 'connect',
    num: '01',
    title: 'Connect',
    tagline: 'Open a room and bring everyone together in seconds.',
    description:
      'Create an instant room or join via meeting code on Web or Android. Host controls and waiting rooms keep every session focused from the start.',
  },
  {
    id: 'collaborate',
    num: '02',
    title: 'Collaborate',
    tagline: 'Explain concepts live with full-stage screen sharing and chat.',
    description:
      'Walk through slides, code, or diagrams while participants ask questions in real-time chat and raise hands without breaking the speaker’s flow.',
  },
  {
    id: 'capture',
    num: '03',
    title: 'Capture',
    tagline: 'When the call ends, AI structures what mattered most.',
    description:
      'MyMeet filters out casual chatter and transforms spoken explanations and shared screens into crisp AI Visual Notes or deep Pro Master Notes.',
  },
  {
    id: 'learn',
    num: '04',
    title: 'Learn',
    tagline: 'Reinforce understanding with 20-MCQ tests and PDF exports.',
    description:
      'Download HD PDFs or PNG slides for offline review, and test real mastery with an auto-generated 20-question session quiz and instant explanations.',
  },
] as const;

export function StickyJourney() {
  const [activeIndex, setActiveIndex] = useState(0);
  const stepRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number((entry.target as HTMLElement).dataset.stageIndex);
            if (!Number.isNaN(idx)) {
              setActiveIndex(idx);
            }
          }
        }
      },
      { rootMargin: '-32% 0px -45% 0px', threshold: 0.15 },
    );

    stepRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const currentStage = JOURNEY_STAGES[activeIndex];

  return (
    <section id="how-it-works" className="lp-section lp-journey-section">
      <div className="lp-container">
        <div className="lp-section-head">
          <span className="lp-eyebrow">
            <SparklesIcon size={12} />
            <span>FROM CONVERSATION TO KNOWLEDGE</span>
          </span>
          <h2 className="lp-section-title">
            One meeting. <span className="lp-grad-blue">Possibilities beyond the call.</span>
          </h2>
          <p className="lp-section-sub">
            Follow how a single MyMeet session naturally evolves from a live discussion into
            lasting study material.
          </p>
        </div>

        <div className="lp-journey-grid">
          {/* Left: 4 Scrollable / Clickable Narrative Stages */}
          <div className="lp-journey-steps">
            {JOURNEY_STAGES.map((stage, index) => {
              const isActive = index === activeIndex;
              return (
                <button
                  key={stage.id}
                  ref={(el) => {
                    stepRefs.current[index] = el;
                  }}
                  type="button"
                  data-stage-index={index}
                  className={`lp-journey-step ${isActive ? 'lp-journey-step-active' : ''}`}
                  onClick={() => setActiveIndex(index)}
                  aria-current={isActive ? 'step' : undefined}
                >
                  <div className="lp-journey-step-head">
                    <span className="lp-journey-num">{stage.num}</span>
                    <h3>{stage.title}</h3>
                  </div>
                  <p className="lp-journey-tagline">{stage.tagline}</p>
                  <p className="lp-journey-desc">{stage.description}</p>
                </button>
              );
            })}
          </div>

          {/* Right: Sticky Live-Transitioning Preview Panel */}
          <div className="lp-journey-sticky-wrap">
            <div className="lp-journey-stage-card" aria-live="polite">
              <div className="lp-js-topbar">
                <div className="lp-js-dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                <span className="lp-js-label">
                  Stage {currentStage.num} · {currentStage.title}
                </span>
                <span className="lp-js-demo">Preview</span>
              </div>

              <div className="lp-js-viewport">
                {activeIndex === 0 && (
                  <div className="lp-js-view lp-js-view-enter" key="connect">
                    <div className="lp-js-badge lp-js-badge-blue">
                      <VideoIcon size={13} /> Room Ready · mmt-804-q2v
                    </div>
                    <div className="lp-js-avatars">
                      <div className="lp-js-av lp-av-blue">AS</div>
                      <div className="lp-js-av lp-av-indigo">RV</div>
                      <div className="lp-js-av lp-av-teal">PM</div>
                      <div className="lp-js-av lp-av-slate">+12</div>
                    </div>
                    <div className="lp-js-status-row">
                      <span className="lp-demo-live-dot" />
                      <span>Waiting room enabled · Host admitted 15 participants</span>
                    </div>
                  </div>
                )}

                {activeIndex === 1 && (
                  <div className="lp-js-view lp-js-view-enter" key="collaborate">
                    <div className="lp-js-badge lp-js-badge-cyan">
                      <MonitorIcon size={13} /> Full-Stage Screen Share Active
                    </div>
                    <div className="lp-js-collab-board">
                      <div className="lp-js-slide-title">Neural Networks · Backpropagation</div>
                      <div className="lp-js-formula">∂L / ∂w = (∂L / ∂y) · (∂y / ∂w)</div>
                      <div className="lp-js-chat-bubble">
                        <strong>Priya:</strong> Chain rule breakdown makes total sense now!
                      </div>
                    </div>
                  </div>
                )}

                {activeIndex === 2 && (
                  <div className="lp-js-view lp-js-view-enter" key="capture">
                    <div className="lp-js-badge lp-js-badge-ai">
                      <SparklesIcon size={13} /> AI Study Notes Generated
                    </div>
                    <div className="lp-js-note-card">
                      <div className="lp-js-note-title">Backpropagation — Master Summary</div>
                      <ul>
                        <li>
                          <CheckIcon size={12} /> Forward pass computes activations &amp; loss
                        </li>
                        <li>
                          <CheckIcon size={12} /> Backward pass applies chain rule layer-by-layer
                        </li>
                        <li>
                          <CheckIcon size={12} /> Vanishing gradients &amp; ReLU mitigation noted
                        </li>
                      </ul>
                    </div>
                  </div>
                )}

                {activeIndex === 3 && (
                  <div className="lp-js-view lp-js-view-enter" key="learn">
                    <div className="lp-js-badge lp-js-badge-pro">
                      <CrownIcon size={13} /> Revision Complete · 18 / 20 (90%)
                    </div>
                    <div className="lp-js-learn-box">
                      <div className="lp-js-progress-label">
                        <span>Session Mastery Score</span>
                        <strong>90%</strong>
                      </div>
                      <div className="lp-js-progress-track">
                        <div className="lp-js-progress-fill" style={{ width: '90%' }} />
                      </div>
                      <div className="lp-js-export-row">
                        <span className="lp-js-export-pill">✓ HD PDF Saved</span>
                        <span className="lp-js-export-pill">✓ 20-MCQ Reviewed</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Stage Progress Indicator */}
              <div className="lp-js-stepper" role="tablist" aria-label="Journey stages">
                {JOURNEY_STAGES.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    role="tab"
                    aria-selected={idx === activeIndex}
                    className={`lp-js-step-dot ${idx === activeIndex ? 'active' : ''}`}
                    onClick={() => setActiveIndex(idx)}
                  >
                    {s.num}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
