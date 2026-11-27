import { useState } from 'react';
import { CheckIcon, SparklesIcon } from './Icons';
import type { MeetingMcqQuiz } from '../services/api';

interface SessionMcqModalProps {
  open: boolean;
  quiz: MeetingMcqQuiz | null;
  meetingTitle: string;
  onClose: () => void;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

export function SessionMcqModal({ open, quiz, meetingTitle, onClose }: SessionMcqModalProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [showSummary, setShowSummary] = useState(false);

  if (!open || !quiz || quiz.questions.length === 0) return null;

  const total = quiz.questions.length;
  const question = quiz.questions[currentIdx] ?? quiz.questions[0];
  const selectedOpt = answers[question.id];
  const hasAnsweredCurrent = typeof selectedOpt === 'number';
  const isCorrectCurrent = selectedOpt === question.correct_index;

  const correctCount = quiz.questions.reduce(
    (acc, q) => acc + (answers[q.id] === q.correct_index ? 1 : 0),
    0,
  );
  const pct = Math.round((correctCount / total) * 100);

  const handleSelectOption = (idx: number) => {
    if (hasAnsweredCurrent) return;
    setAnswers((prev) => ({ ...prev, [question.id]: idx }));
  };

  const handleRetake = () => {
    setAnswers({});
    setCurrentIdx(0);
    setShowSummary(false);
  };

  const weakConcepts = quiz.questions
    .filter((q) => answers[q.id] !== q.correct_index)
    .map((q) => q.concept);

  return (
    <div
      className="visual-lightbox-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{ padding: 16 }}
    >
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 680,
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: 24,
          borderRadius: 20,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div>
            <span className="pro-pill-badge">
              <SparklesIcon size={12} /> SESSION MCQ TEST
            </span>
            <h2 style={{ margin: '6px 0 2px', fontSize: 19, fontWeight: 800 }}>
              {quiz.topic_label || `${meetingTitle} · Practice Test`}
            </h2>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>

        {showSummary ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="mcq-score-card">
              <div className="mcq-score-big">
                {correctCount} / {total}
              </div>
              <div className="mcq-score-pct">{pct}% Concept Mastery</div>
              <p className="status-item-desc" style={{ margin: 0 }}>
                {pct >= 80
                  ? 'Outstanding mastery! You nailed today’s core concepts.'
                  : pct >= 50
                    ? 'Good progress! Review the highlighted concepts below and retake.'
                    : 'Great practice run — revisit the Pro Notes cheat sheet and try again!'}
              </p>
            </div>

            {weakConcepts.length > 0 && (
              <div className="mcq-review-box">
                <strong style={{ fontSize: 13 }}>Concepts to Polish:</strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {Array.from(new Set(weakConcepts)).map((c) => (
                    <span key={c} className="badge badge-warning">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={handleRetake}>
                Retake Quiz
              </button>
              <button type="button" className="btn btn-primary" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="mcq-progress-row">
              <span style={{ fontSize: 12.5, fontWeight: 700 }}>
                Question {currentIdx + 1} of {total}
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <span className="badge badge-neutral">{question.concept}</span>
                <span
                  className={`badge ${
                    question.difficulty === 'hard'
                      ? 'badge-warning'
                      : question.difficulty === 'easy'
                        ? 'badge-success'
                        : 'badge-neutral'
                  }`}
                >
                  {question.difficulty}
                </span>
              </div>
            </div>

            <div className="mcq-progress-track">
              <div
                className="mcq-progress-fill"
                style={{ width: `${((currentIdx + 1) / total) * 100}%` }}
              />
            </div>

            <div className="mcq-question-text">{question.question}</div>

            <div className="mcq-options-list">
              {question.options.map((opt, idx) => {
                const isSelected = selectedOpt === idx;
                const isRight = idx === question.correct_index;
                let cls = 'mcq-option-btn';
                if (hasAnsweredCurrent) {
                  if (isRight) cls += ' mcq-option-correct';
                  else if (isSelected) cls += ' mcq-option-wrong';
                }
                return (
                  <button
                    key={idx}
                    type="button"
                    className={cls}
                    onClick={() => handleSelectOption(idx)}
                  >
                    <span className="mcq-option-letter">{OPTION_LETTERS[idx]}</span>
                    <span style={{ flex: 1, textAlign: 'left' }}>{opt}</span>
                    {hasAnsweredCurrent && isRight && <CheckIcon size={16} />}
                  </button>
                );
              })}
            </div>

            {hasAnsweredCurrent && (
              <div
                className={`mcq-explanation ${
                  isCorrectCurrent ? 'mcq-explanation-ok' : 'mcq-explanation-warn'
                }`}
              >
                <strong>
                  {isCorrectCurrent
                    ? '✓ Correct!'
                    : `✕ Correct Answer: ${OPTION_LETTERS[question.correct_index]}`}
                </strong>
                <p style={{ margin: '4px 0 0', fontSize: 13.5, lineHeight: 1.5 }}>
                  {question.explanation}
                </p>
              </div>
            )}

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 6,
              }}
            >
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={currentIdx === 0}
                onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
              >
                Previous
              </button>
              {currentIdx < total - 1 ? (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={!hasAnsweredCurrent}
                  onClick={() => setCurrentIdx((i) => Math.min(total - 1, i + 1))}
                >
                  Next Question →
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-pro-gold btn-sm"
                  disabled={!hasAnsweredCurrent}
                  onClick={() => setShowSummary(true)}
                >
                  View Final Score →
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
