import { useState } from 'react';
import { CheckIcon, SparklesIcon } from './Icons';
import type { MeetingMcqQuiz } from '../services/api';

interface McqProgressPayload {
  status: 'in_progress' | 'completed';
  attempted_count: number;
  correct_count: number;
  total_questions: number;
}

interface SessionMcqModalProps {
  open: boolean;
  quiz: MeetingMcqQuiz | null;
  meetingTitle: string;
  onProgress?: (payload: McqProgressPayload) => void;
  onClose: () => void;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

export function SessionMcqModal({
  open,
  quiz,
  meetingTitle,
  onProgress,
  onClose,
}: SessionMcqModalProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [showSummary, setShowSummary] = useState(false);

  if (!open || !quiz || quiz.questions.length === 0) return null;

  const total = quiz.questions.length;
  const question = quiz.questions[currentIdx] ?? quiz.questions[0];
  const selectedOpt = answers[question.id];
  const hasAnsweredCurrent = typeof selectedOpt === 'number';
  const isCorrectCurrent = selectedOpt === question.correct_index;

  // Sequential unlock: student CANNOT access a future question before attempting the current one
  const firstUnansweredIdx = quiz.questions.findIndex((q) => typeof answers[q.id] !== 'number');
  const maxUnlockedIdx = firstUnansweredIdx === -1 ? total - 1 : firstUnansweredIdx;

  const answeredCount = Object.keys(answers).length;
  const correctCount = quiz.questions.reduce(
    (acc, q) => acc + (answers[q.id] === q.correct_index ? 1 : 0),
    0,
  );
  const pct = Math.round((correctCount / total) * 100);

  const handleSelectOption = (idx: number) => {
    if (hasAnsweredCurrent) return;
    const nextAnswers = { ...answers, [question.id]: idx };
    setAnswers(nextAnswers);
    const nextAttempted = Object.keys(nextAnswers).length;
    const nextCorrect = quiz.questions.reduce(
      (acc, qItem) => acc + (nextAnswers[qItem.id] === qItem.correct_index ? 1 : 0),
      0,
    );
    onProgress?.({
      status: 'in_progress',
      attempted_count: nextAttempted,
      correct_count: nextCorrect,
      total_questions: total,
    });
  };

  const handleFinishQuiz = () => {
    setShowSummary(true);
    onProgress?.({
      status: 'completed',
      attempted_count: answeredCount,
      correct_count: correctCount,
      total_questions: total,
    });
  };

  const handleRetake = () => {
    setAnswers({});
    setCurrentIdx(0);
    setShowSummary(false);
  };

  const weakConcepts = Array.from(
    new Set(
      quiz.questions.filter((q) => answers[q.id] !== q.correct_index).map((q) => q.concept),
    ),
  );

  return (
    <div
      className="visual-lightbox-backdrop mcq-studio-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="mcq-studio-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mcq-studio-glow-bar" />

        <div className="mcq-studio-header">
          <div className="mcq-studio-title-wrap">
            <span className="pro-pill-badge">
              <SparklesIcon size={11} /> SESSION MASTERY TEST · {total} Qs
            </span>
            <h2 className="mcq-studio-title">
              {quiz.topic_label || `${meetingTitle} · Practice Test`}
            </h2>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>

        {showSummary ? (
          <div className="mcq-studio-body">
            <div className="mcq-score-card">
              <div className="mcq-score-ring">
                <span className="mcq-score-pct-ring">{pct}%</span>
              </div>
              <div className="mcq-score-big">
                {correctCount} <span className="mcq-score-denom">/ {total}</span>
              </div>
              <div className="mcq-score-pct">
                {pct >= 85
                  ? 'Exam-Ready Mastery'
                  : pct >= 60
                    ? 'Solid Understanding'
                    : 'Concept Review Recommended'}
              </div>
              <p className="mcq-score-sub">
                {pct >= 85
                  ? 'Outstanding performance — you nailed today’s session concepts.'
                  : pct >= 60
                    ? 'Great attempt! Polish the weak concepts below and retake to hit 90%+.'
                    : 'Good practice run — review the Pro Master Notes cheat sheet and try again.'}
              </p>
            </div>

            {weakConcepts.length > 0 && (
              <div className="mcq-review-box">
                <div className="mcq-review-title">Concepts to Polish ({weakConcepts.length})</div>
                <div className="mcq-review-chips">
                  {weakConcepts.map((c) => (
                    <span key={c} className="mcq-weak-chip">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mcq-footer-nav">
              <button type="button" className="btn btn-secondary" onClick={handleRetake}>
                Retake All {total} Questions
              </button>
              <button type="button" className="btn btn-pro-gold" onClick={onClose}>
                Finish &amp; Return to Notes
              </button>
            </div>
          </div>
        ) : (
          <div className="mcq-studio-body">
            <div className="mcq-progress-row">
              <div className="mcq-counter-pill">
                Question <strong>{currentIdx + 1}</strong> of {total}
              </div>
              <div className="mcq-meta-tags">
                <span className="mcq-score-chip">
                  Score: {correctCount}/{answeredCount}
                </span>
                <span className="mcq-concept-chip">{question.concept}</span>
                <span className={`mcq-diff-chip mcq-diff-${question.difficulty}`}>
                  {question.difficulty}
                </span>
              </div>
            </div>

            {/* Sequential 20-Question Palette (future questions locked until current is attempted) */}
            <div className="mcq-palette">
              {quiz.questions.map((item, i) => {
                const ans = answers[item.id];
                const isDone = typeof ans === 'number';
                const isGood = isDone && ans === item.correct_index;
                const isLocked = i > maxUnlockedIdx;
                const cls = [
                  'mcq-palette-dot',
                  i === currentIdx ? 'mcq-palette-current' : '',
                  isDone ? (isGood ? 'mcq-palette-ok' : 'mcq-palette-bad') : '',
                  isLocked ? 'mcq-palette-locked' : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={isLocked}
                    className={cls}
                    onClick={() => {
                      if (!isLocked) setCurrentIdx(i);
                    }}
                    title={
                      isLocked
                        ? `Attempt Question ${maxUnlockedIdx + 1} first to unlock`
                        : `Question ${i + 1}`
                    }
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>

            <div className="mcq-progress-track">
              <div
                className="mcq-progress-fill"
                style={{ width: `${(answeredCount / total) * 100}%` }}
              />
            </div>

            <div className="mcq-question-card">
              <div className="mcq-question-text">{question.question}</div>

              <div className="mcq-options-list">
                {question.options.map((opt, idx) => {
                  const isSelected = selectedOpt === idx;
                  const isRight = idx === question.correct_index;
                  let cls = 'mcq-option-btn';
                  if (hasAnsweredCurrent) {
                    if (isRight) cls += ' mcq-option-correct';
                    else if (isSelected) cls += ' mcq-option-wrong';
                    else cls += ' mcq-option-dim';
                  }
                  return (
                    <button
                      key={idx}
                      type="button"
                      className={cls}
                      disabled={hasAnsweredCurrent}
                      onClick={() => handleSelectOption(idx)}
                    >
                      <span className="mcq-option-letter">{OPTION_LETTERS[idx]}</span>
                      <span className="mcq-option-label">{opt}</span>
                      {hasAnsweredCurrent && isRight && (
                        <span className="mcq-option-check">
                          <CheckIcon size={15} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {hasAnsweredCurrent ? (
              <div
                className={`mcq-explanation ${
                  isCorrectCurrent ? 'mcq-explanation-ok' : 'mcq-explanation-warn'
                }`}
              >
                <div className="mcq-explanation-head">
                  {isCorrectCurrent
                    ? '✓ Correct Answer'
                    : `✕ Correct Answer: Option ${OPTION_LETTERS[question.correct_index]}`}
                </div>
                <p className="mcq-explanation-body">{question.explanation}</p>
              </div>
            ) : (
              <div className="mcq-attempt-hint">
                Select an option above to unlock the next question.
              </div>
            )}

            <div className="mcq-footer-nav">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={currentIdx === 0}
                onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
              >
                ← Previous
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
                  onClick={handleFinishQuiz}
                >
                  View Mastery Score →
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
