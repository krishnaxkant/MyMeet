import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import type { MeetingMcqQuiz } from '../services/api';

interface McqProgressPayload {
  status: 'in_progress' | 'completed';
  attempted_count: number;
  correct_count: number;
  total_questions: number;
}

interface SessionMcqModalProps {
  visible: boolean;
  quiz: MeetingMcqQuiz | null;
  meetingTitle: string;
  onProgress?: (payload: McqProgressPayload) => void;
  onClose: () => void;
}

const LETTERS = ['A', 'B', 'C', 'D'];

export function SessionMcqModal({
  visible,
  quiz,
  meetingTitle,
  onProgress,
  onClose,
}: SessionMcqModalProps) {
  const { colors } = useTheme();
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [done, setDone] = useState(false);

  if (!quiz || quiz.questions.length === 0) return null;

  const total = quiz.questions.length;
  const q = quiz.questions[idx] ?? quiz.questions[0];
  const selected = answers[q.id];
  const answered = typeof selected === 'number';
  const isRight = selected === q.correct_index;

  // Sequential unlock: student CANNOT access a future question before attempting the current one
  const firstUnansweredIdx = quiz.questions.findIndex((item) => typeof answers[item.id] !== 'number');
  const maxUnlockedIdx = firstUnansweredIdx === -1 ? total - 1 : firstUnansweredIdx;

  const score = quiz.questions.reduce(
    (acc, item) => acc + (answers[item.id] === item.correct_index ? 1 : 0),
    0,
  );
  const pct = Math.round((score / total) * 100);
  const weakConcepts = Array.from(
    new Set(quiz.questions.filter((item) => answers[item.id] !== item.correct_index).map((i) => i.concept)),
  );

  const handleRetake = () => {
    setAnswers({});
    setIdx(0);
    setDone(false);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, borderColor: colors.borderStrong },
          ]}
        >
          <View style={styles.headRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.pill}>
                <Text style={styles.pillText}>🎯 SESSION MCQ TEST</Text>
              </View>
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
                {quiz.topic_label || `${meetingTitle} Quiz`}
              </Text>
            </View>
            <Pressable
              style={[
                styles.closeBtn,
                { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
              ]}
              onPress={onClose}
            >
              <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700' }}>Close</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body}>
            {done ? (
              <View style={{ gap: 14 }}>
                <View style={styles.scoreCard}>
                  <Text style={styles.scoreBig}>
                    {score} / {total}
                  </Text>
                  <Text style={styles.scorePct}>{pct}% Concept Mastery</Text>
                  <Text style={{ color: '#CBD5E1', fontSize: 13, textAlign: 'center' }}>
                    {pct >= 80
                      ? 'Outstanding! You mastered today’s session concepts.'
                      : pct >= 50
                        ? 'Good work! Polish the weak concepts below and retake.'
                        : 'Nice practice run! Review Pro Notes & retake to boost your score.'}
                  </Text>
                </View>

                {weakConcepts.length > 0 && (
                  <View
                    style={[
                      styles.weakBox,
                      { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                    ]}
                  >
                    <Text style={{ color: colors.text, fontWeight: '800', fontSize: 13 }}>
                      Concepts to Polish:
                    </Text>
                    <View style={styles.chipsWrap}>
                      {weakConcepts.map((c) => (
                        <View key={c} style={styles.weakChip}>
                          <Text style={styles.weakChipText}>{c}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                <View style={styles.navRow}>
                  <Pressable
                    style={[
                      styles.navBtn,
                      { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                    ]}
                    onPress={handleRetake}
                  >
                    <Text style={{ color: colors.text, fontWeight: '700' }}>Retake Quiz</Text>
                  </Pressable>
                  <Pressable style={[styles.navBtn, styles.navBtnPrimary]} onPress={onClose}>
                    <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>Done</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                <View style={styles.metaRow}>
                  <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700' }}>
                    Q{idx + 1} / {total} · Score: {score}/{Object.keys(answers).length}
                  </Text>
                  <Text style={styles.conceptTag}>
                    {q.concept} · {q.difficulty.toUpperCase()}
                  </Text>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.paletteRow}
                >
                  {quiz.questions.map((item, i) => {
                    const ans = answers[item.id];
                    const isDone = typeof ans === 'number';
                    const isGood = isDone && ans === item.correct_index;
                    const isLocked = i > maxUnlockedIdx;
                    return (
                      <Pressable
                        key={item.id}
                        disabled={isLocked}
                        style={[
                          styles.paletteDot,
                          isLocked && { opacity: 0.32 },
                          {
                            backgroundColor: isDone
                              ? isGood
                                ? 'rgba(34, 197, 94, 0.22)'
                                : 'rgba(239, 68, 68, 0.22)'
                              : colors.surfaceElevated,
                            borderColor:
                              i === idx
                                ? '#7C3AED'
                                : isDone
                                  ? isGood
                                    ? '#22C55E'
                                    : '#EF4444'
                                  : colors.border,
                          },
                        ]}
                        onPress={() => {
                          if (!isLocked) setIdx(i);
                        }}
                      >
                        <Text
                          style={{
                            color: isDone ? (isGood ? '#22C55E' : '#EF4444') : colors.text,
                            fontSize: 11,
                            fontWeight: '800',
                          }}
                        >
                          {i + 1}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <Text style={[styles.qText, { color: colors.text }]}>{q.question}</Text>

                {q.options.map((opt, oi) => {
                  const isSel = selected === oi;
                  const isCorrectOpt = oi === q.correct_index;
                  let borderColor = colors.border;
                  let bg = colors.surfaceElevated;
                  if (answered) {
                    if (isCorrectOpt) {
                      borderColor = '#22C55E';
                      bg = 'rgba(34, 197, 94, 0.16)';
                    } else if (isSel) {
                      borderColor = '#EF4444';
                      bg = 'rgba(239, 68, 68, 0.16)';
                    }
                  }
                  return (
                    <Pressable
                      key={oi}
                      style={[styles.optBtn, { backgroundColor: bg, borderColor }]}
                      onPress={() => {
                        if (!answered) {
                          const nextAnswers = { ...answers, [q.id]: oi };
                          setAnswers(nextAnswers);
                          const nextAttempted = Object.keys(nextAnswers).length;
                          const nextCorrect = quiz.questions.reduce(
                            (acc, item) =>
                              acc + (nextAnswers[item.id] === item.correct_index ? 1 : 0),
                            0,
                          );
                          onProgress?.({
                            status: 'in_progress',
                            attempted_count: nextAttempted,
                            correct_count: nextCorrect,
                            total_questions: total,
                          });
                        }
                      }}
                    >
                      <View
                        style={[
                          styles.letterBox,
                          { backgroundColor: colors.surface, borderColor: colors.border },
                        ]}
                      >
                        <Text style={{ color: colors.text, fontSize: 12, fontWeight: '800' }}>
                          {LETTERS[oi]}
                        </Text>
                      </View>
                      <Text style={{ color: colors.text, flex: 1, fontSize: 13.5, fontWeight: '600' }}>
                        {opt}
                      </Text>
                    </Pressable>
                  );
                })}

                {answered ? (
                  <View
                    style={[
                      styles.expBox,
                      {
                        backgroundColor: isRight
                          ? 'rgba(34, 197, 94, 0.14)'
                          : 'rgba(245, 158, 11, 0.14)',
                        borderColor: isRight ? '#22C55E' : '#F59E0B',
                      },
                    ]}
                  >
                    <Text style={{ color: colors.text, fontWeight: '800', fontSize: 13 }}>
                      {isRight ? '✓ Correct Answer!' : `✕ Right Answer: ${LETTERS[q.correct_index]}`}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12.5, marginTop: 4, lineHeight: 18 }}>
                      {q.explanation}
                    </Text>
                  </View>
                ) : (
                  <Text
                    style={{
                      color: colors.textMuted,
                      fontSize: 12,
                      textAlign: 'center',
                      paddingVertical: 4,
                    }}
                  >
                    Select an option above to unlock the next question.
                  </Text>
                )}

                <View style={styles.navRow}>
                  <Pressable
                    style={[
                      styles.navBtn,
                      { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                      idx === 0 && { opacity: 0.45 },
                    ]}
                    disabled={idx === 0}
                    onPress={() => setIdx((i) => Math.max(0, i - 1))}
                  >
                    <Text style={{ color: colors.text, fontWeight: '700' }}>Prev</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.navBtn,
                      styles.navBtnPrimary,
                      !answered && { opacity: 0.45 },
                    ]}
                    disabled={!answered}
                    onPress={() => {
                      if (idx < total - 1) {
                        setIdx((i) => i + 1);
                      } else {
                        setDone(true);
                        onProgress?.({
                          status: 'completed',
                          attempted_count: Object.keys(answers).length,
                          correct_count: score,
                          total_questions: total,
                        });
                      }
                    }}
                  >
                    <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>
                      {idx < total - 1 ? 'Next →' : 'View Score →'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.78)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '90%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    padding: 18,
  },
  headRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#7C3AED',
    marginBottom: 6,
  },
  pillText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '800' },
  title: { fontSize: 17, fontWeight: '800' },
  closeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  body: { paddingBottom: 24 },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  conceptTag: {
    color: '#A78BFA',
    fontSize: 11,
    fontWeight: '800',
  },
  qText: {
    fontSize: 15.5,
    fontWeight: '700',
    lineHeight: 22,
  },
  optBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  letterBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 6,
  },
  navBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  navBtnPrimary: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  scoreCard: {
    backgroundColor: '#0F172A',
    borderColor: '#F59E0B',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  scoreBig: { color: '#FFFFFF', fontSize: 34, fontWeight: '900' },
  scorePct: { color: '#F59E0B', fontSize: 15, fontWeight: '800' },
  weakBox: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  weakChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  weakChipText: { color: '#F59E0B', fontSize: 11.5, fontWeight: '700' },
  paletteRow: { flexDirection: 'row', gap: 6, paddingVertical: 2 },
  paletteDot: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
