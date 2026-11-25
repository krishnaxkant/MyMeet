import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BackButton } from '../components/BackButton';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import {
  generateAiSummary,
  getHistoryDetail,
  listHistory,
  type MeetingAiSummary,
  type MeetingHistoryDetail,
  type MeetingHistoryItem,
  type VisualNoteKind,
  type VisualNoteStep,
} from '../services/api';

interface HistoryScreenProps {
  initialCode?: string;
  onBack: () => void;
  onOpenLobby: (code: string) => void;
}

const KIND_THEME: Record<
  VisualNoteKind,
  { label: string; accent: string; softBg: string; border: string }
> = {
  concept: {
    label: 'CONCEPT',
    accent: '#38BDF8',
    softBg: 'rgba(56, 189, 248, 0.14)',
    border: 'rgba(56, 189, 248, 0.52)',
  },
  formula: {
    label: 'FORMULA / RULE',
    accent: '#FBBF24',
    softBg: 'rgba(251, 191, 36, 0.15)',
    border: 'rgba(251, 191, 36, 0.58)',
  },
  step: {
    label: 'EXPLANATION',
    accent: '#34D399',
    softBg: 'rgba(52, 211, 153, 0.14)',
    border: 'rgba(52, 211, 153, 0.5)',
  },
  example: {
    label: 'WORKED EXAMPLE',
    accent: '#C084FC',
    softBg: 'rgba(192, 132, 252, 0.15)',
    border: 'rgba(192, 132, 252, 0.55)',
  },
  takeaway: {
    label: 'KEY TAKEAWAY',
    accent: '#FB7185',
    softBg: 'rgba(251, 113, 133, 0.15)',
    border: 'rgba(251, 113, 133, 0.55)',
  },
};

function cleanLegacyPrefix(text: string): string {
  return text.replace(/^\[(Screen|Voice|Chat)\s*·[^\]]+\]\s*/i, '').trim();
}

function resolveVisualFlow(summary: MeetingAiSummary, title: string): VisualNoteStep[] {
  const existing = summary.sources_summary?.visual_flow;
  if (Array.isArray(existing) && existing.length > 0) {
    return existing;
  }

  const cleanedPoints = (summary.key_points || [])
    .map(cleanLegacyPrefix)
    .filter((p) => p.length > 0 && !p.toLowerCase().includes('no voice captions'));

  if (cleanedPoints.length > 0) {
    return cleanedPoints.slice(0, 8).map((pt, idx, arr) => {
      const hasFormula = /[=^∫√∑±]|=>|\b(formula|equation|theorem)\b/i.test(pt);
      const kind: VisualNoteKind = hasFormula
        ? 'formula'
        : idx === 0
          ? 'concept'
          : idx === arr.length - 1
            ? 'takeaway'
            : 'step';
      return {
        title:
          kind === 'formula'
            ? 'Key Formula & Rule'
            : idx === 0
              ? 'Core Concept'
              : idx === arr.length - 1
                ? 'Key Conclusion'
                : `Topic Point ${idx + 1}`,
        kind,
        body: pt,
        show_arrow: kind === 'formula' && idx < arr.length - 1,
        ...(kind === 'formula' && idx < arr.length - 1 ? { arrow_label: 'Application' } : {}),
      };
    });
  }

  return [
    {
      title: title || 'Study Notes',
      kind: 'concept',
      body: summary.overview || 'Summary of discussed content.',
      show_arrow: false,
    },
  ];
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}

function formatExactTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function FlowArrow({ color, label }: { color: string; label?: string }) {
  return (
    <View style={styles.arrowWrap}>
      <View style={[styles.arrowDot, { backgroundColor: color }]} />
      <View style={[styles.arrowShaft, { backgroundColor: color }]} />
      {label ? (
        <View style={[styles.arrowLabelPill, { borderColor: color }]}>
          <Text style={[styles.arrowLabelText, { color }]}>{label.toUpperCase()}</Text>
        </View>
      ) : null}
      <View style={[styles.arrowShaftShort, { backgroundColor: color }]} />
      <View style={[styles.arrowHead, { borderTopColor: color }]} />
    </View>
  );
}

function BlackVisualBoard({
  title,
  summary,
}: {
  title: string;
  summary: MeetingAiSummary;
}) {
  const flowSteps = useMemo(() => resolveVisualFlow(summary, title), [summary, title]);
  const keyPoints = useMemo(
    () =>
      (summary.key_points || [])
        .map(cleanLegacyPrefix)
        .filter((k) => k.length > 0 && !k.toLowerCase().includes('no voice captions')),
    [summary.key_points],
  );
  const actionItems = useMemo(
    () => (summary.action_items || []).map(cleanLegacyPrefix).filter((a) => a.length > 0),
    [summary.action_items],
  );

  return (
    <View style={styles.blackBoard}>
      {/* Environment Pill */}
      <View style={styles.boardEnvPill}>
        <Text style={styles.boardEnvText}>
          ✦ {(summary.environment_label || 'VISUAL STUDY NOTES').toUpperCase()}
        </Text>
      </View>

      {/* Topic Title */}
      <Text style={styles.boardTitle}>{title}</Text>
      <View style={styles.boardDividerLine} />

      {/* Session Overview */}
      {summary.overview ? (
        <View style={styles.coreCard}>
          <View style={styles.coreAccentBar} />
          <View style={styles.flex1}>
            <Text style={styles.coreLabel}>SESSION OVERVIEW</Text>
            <Text style={styles.coreBody}>{summary.overview}</Text>
          </View>
        </View>
      ) : null}

      {/* Deep Study Sections (Arrows ONLY when step.show_arrow === true) */}
      <View style={styles.sectionsWrap}>
        {flowSteps.map((step, idx) => {
          const theme = KIND_THEME[step.kind] || KIND_THEME.concept;
          const nextTheme =
            idx < flowSteps.length - 1
              ? KIND_THEME[flowSteps[idx + 1].kind] || theme
              : theme;
          const showArrow = Boolean(step.show_arrow) && idx < flowSteps.length - 1;

          return (
            <View key={`${step.title}-${idx}`}>
              <View style={[styles.flowCard, { borderColor: theme.border }]}>
                <View style={[styles.flowLeftStripe, { backgroundColor: theme.accent }]} />
                <View style={styles.flowCardInner}>
                  <View style={styles.flowHeaderRow}>
                    <View style={styles.flowTitleLeft}>
                      <View
                        style={[
                          styles.stepCircle,
                          { backgroundColor: theme.softBg, borderColor: theme.accent },
                        ]}
                      >
                        <Text style={[styles.stepCircleText, { color: theme.accent }]}>
                          {String(idx + 1).padStart(2, '0')}
                        </Text>
                      </View>
                      <Text style={styles.flowStepTitle}>{step.title}</Text>
                    </View>
                    <View
                      style={[
                        styles.kindBadge,
                        { backgroundColor: theme.softBg, borderColor: theme.border },
                      ]}
                    >
                      <Text style={[styles.kindBadgeText, { color: theme.accent }]}>
                        {theme.label}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.flowStepBody}>{step.body}</Text>

                  {step.formula ? (
                    <View style={styles.formulaBox}>
                      <View style={styles.formulaStripe} />
                      <Text style={styles.formulaText}>{step.formula}</Text>
                    </View>
                  ) : null}

                  {step.bullets && step.bullets.length > 0 ? (
                    <View style={styles.bulletsWrap}>
                      {step.bullets.map((b, bIdx) => (
                        <View key={bIdx} style={styles.bulletRow}>
                          <Text style={[styles.bulletMarker, { color: theme.accent }]}>
                            {step.kind === 'example' ? `${bIdx + 1}.` : '•'}
                          </Text>
                          <Text style={styles.bulletBody}>{b}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              </View>

              {showArrow ? (
                <FlowArrow color={nextTheme.accent} label={step.arrow_label} />
              ) : (
                <View style={{ height: 12 }} />
              )}
            </View>
          );
        })}
      </View>

      {/* Quick Revision · Key Takeaways */}
      {keyPoints.length > 0 && (
        <View style={styles.keyBox}>
          <Text style={styles.keyBoxHeading}>QUICK REVISION · KEY TAKEAWAYS</Text>
          {keyPoints.map((pt, i) => (
            <View key={i} style={styles.keyRow}>
              <Text style={styles.keyArrowIcon}>▸</Text>
              <Text style={styles.keyText}>{pt}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Practice / Homework / Next Steps (ONLY if actually discussed) */}
      {actionItems.length > 0 && (
        <View style={styles.actionCard}>
          <Text style={styles.actionHeading}>PRACTICE / HOMEWORK / NEXT STEPS</Text>
          {actionItems.map((act, i) => (
            <View key={i} style={styles.actionRow}>
              <Text style={styles.actionArrowIcon}>☐</Text>
              <Text style={styles.actionText}>{act}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.boardFooter}>
        <Text style={styles.boardFooterText}>MEET · AI STUDY NOTES</Text>
        <Text style={styles.boardFooterText}>CONTENT-ONLY SUMMARY</Text>
      </View>
    </View>
  );
}

export function HistoryScreen({ initialCode, onBack, onOpenLobby }: HistoryScreenProps) {
  const { session } = useAuth();
  const { colors } = useTheme();

  const [items, setItems] = useState<MeetingHistoryItem[]>([]);
  const [selected, setSelected] = useState<MeetingHistoryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [fullBoardOpen, setFullBoardOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const list = await listHistory(session.access_token);
      setItems(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load meeting history.');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const handleInspect = useCallback(
    async (code: string) => {
      if (!session?.access_token) return;
      setDetailLoading(true);
      setError(null);
      try {
        const detail = await getHistoryDetail(session.access_token, code);
        setSelected(detail);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load visual notes.');
      } finally {
        setDetailLoading(false);
      }
    },
    [session?.access_token],
  );

  useEffect(() => {
    if (initialCode && session?.access_token) {
      void handleInspect(initialCode);
    }
  }, [initialCode, session?.access_token, handleInspect]);

  const handleGenerateAi = async () => {
    if (!session?.access_token || !selected) return;
    setGeneratingAi(true);
    setError(null);
    try {
      const summary = await generateAiSummary(session.access_token, selected.code);
      setSelected((prev) => (prev ? { ...prev, ai_summary: summary } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate AI visual notes.');
    } finally {
      setGeneratingAi(false);
    }
  };

  const isHost = selected?.my_role === 'host';

  return (
    <>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <BackButton
            label={selected ? 'History List' : 'Home'}
            onPress={selected ? () => setSelected(null) : onBack}
          />
          {!selected ? (
            <Pressable
              style={[
                styles.secondaryButton,
                { backgroundColor: colors.surface, borderColor: colors.borderStrong },
              ]}
              onPress={() => void loadHistory()}
              disabled={loading}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
                {loading ? 'Loading...' : 'Refresh'}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.topActionRow}>
              <Pressable
                style={[styles.genBtn, { backgroundColor: colors.accent }]}
                disabled={generatingAi}
                onPress={() => void handleGenerateAi()}
              >
                <Text style={styles.shareBtnText}>
                  {generatingAi
                    ? 'Analyzing...'
                    : selected.ai_summary
                      ? 'Regenerate'
                      : 'Generate'}
                </Text>
              </Pressable>
              {selected.ai_summary && (
                <Pressable
                  style={[
                    styles.secondaryButton,
                    { backgroundColor: '#000000', borderColor: '#38BDF8' },
                  ]}
                  onPress={() => setFullBoardOpen(true)}
                >
                  <Text style={{ color: '#38BDF8', fontSize: 12, fontWeight: '700' }}>
                    Full Board
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </View>

        {error && (
          <View
            style={[
              styles.alert,
              { backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder },
            ]}
          >
            <Text style={{ color: colors.dangerText, fontSize: 13 }}>{error}</Text>
          </View>
        )}

        {detailLoading ? (
          <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 24 }} />
        ) : selected ? (
          <View style={{ gap: 14 }}>
            {selected.ai_summary ? (
              <BlackVisualBoard title={selected.title} summary={selected.ai_summary} />
            ) : (
              <View
                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Text style={[styles.cardTitle, { color: colors.text }]}>{selected.title}</Text>
                <Text style={[styles.subText, { color: colors.textMuted }]}>
                  No visual notes generated for this meeting yet. Tap Generate to build your
                  black-background study notes.
                </Text>
                <Pressable
                  style={[styles.rejoinBtn, { backgroundColor: colors.accent }]}
                  disabled={generatingAi}
                  onPress={() => void handleGenerateAi()}
                >
                  <Text style={styles.rejoinText}>
                    {generatingAi ? 'Analyzing Discussion...' : 'Generate Visual Notes'}
                  </Text>
                </Pressable>
              </View>
            )}

            {/* HOST-ONLY Participants History */}
            {isHost && (
              <View
                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={styles.itemRowHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    Participants History ({selected.participants.length})
                  </Text>
                  <StatusBadge label="Host Only" tone="success" />
                </View>

                {selected.participants.length === 0 ? (
                  <Text style={[styles.subText, { color: colors.textMuted }]}>
                    No participants recorded for this meeting.
                  </Text>
                ) : (
                  selected.participants.map((p) => (
                    <View
                      key={p.id}
                      style={[
                        styles.rosterRow,
                        { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                      ]}
                    >
                      <View style={styles.flex1}>
                        <Text style={[styles.itemTitle, { color: colors.text }]}>
                          {p.full_name || p.email}
                        </Text>
                        <Text style={[styles.subText, { color: colors.textMuted }]}>
                          Joined {formatExactTime(p.joined_at)}
                          {p.left_at ? ` · Left ${formatExactTime(p.left_at)}` : ''}
                        </Text>
                      </View>
                      <StatusBadge
                        label={p.role}
                        tone={p.role === 'host' ? 'success' : 'warning'}
                      />
                    </View>
                  ))
                )}
              </View>
            )}
          </View>
        ) : (
          <View
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Meeting History & Visual Notes ({items.length})
            </Text>

            {items.length === 0 ? (
              <Text style={[styles.subText, { color: colors.textMuted }]}>
                {loading ? 'Loading history...' : 'No meetings in your history yet.'}
              </Text>
            ) : (
              items.map((item) => (
                <Pressable
                  key={item.id}
                  style={[
                    styles.itemBox,
                    { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                  ]}
                  onPress={() => void handleInspect(item.code)}
                >
                  <View style={styles.itemRowHeader}>
                    <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <StatusBadge
                      label={item.status}
                      tone={item.status === 'active' ? 'success' : 'warning'}
                    />
                  </View>
                  <Text style={[styles.subText, { color: colors.textMuted }]}>
                    {new Date(item.created_at).toLocaleDateString()} ·{' '}
                    {formatDuration(item.duration_seconds)}
                    {item.my_role === 'host' ? ' · Host · Notes & Roster' : ' · Tap for Visual Notes'}
                  </Text>
                  {item.status === 'active' && (
                    <Pressable
                      style={[styles.rejoinBtn, { backgroundColor: colors.accent }]}
                      onPress={() => onOpenLobby(item.code)}
                    >
                      <Text style={styles.rejoinText}>Rejoin Active Meeting</Text>
                    </Pressable>
                  )}
                </Pressable>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Edge-to-edge Pure Black Full-Screen Visual Notes Modal */}
      <Modal
        visible={fullBoardOpen && Boolean(selected?.ai_summary)}
        animationType="slide"
        onRequestClose={() => setFullBoardOpen(false)}
      >
        <View style={styles.fullModalWrap}>
          <View style={styles.fullModalHeader}>
            <Text style={styles.fullModalTitle} numberOfLines={1}>
              {selected?.title || 'Visual Study Notes'}
            </Text>
            <Pressable style={styles.closeModalBtn} onPress={() => setFullBoardOpen(false)}>
              <Text style={styles.closeModalBtnText}>Close</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.fullModalScroll}>
            {selected?.ai_summary && (
              <BlackVisualBoard title={selected.title} summary={selected.ai_summary} />
            )}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 14 },
  flex1: { flex: 1 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  topActionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  secondaryButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  secondaryButtonText: { fontSize: 13, fontWeight: '600' },
  shareBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  genBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  card: { borderRadius: 18, padding: 18, borderWidth: 1, gap: 12 },
  cardTitle: { fontSize: 18, fontWeight: '800' },
  sectionTitle: { fontSize: 15, fontWeight: '800' },
  itemBox: { padding: 13, borderRadius: 13, borderWidth: 1, gap: 6 },
  rosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 11,
    borderRadius: 11,
    borderWidth: 1,
    gap: 8,
  },
  itemRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  itemTitle: { fontSize: 14, fontWeight: '700', flex: 1 },
  subText: { fontSize: 12, lineHeight: 18 },
  rejoinBtn: { marginTop: 4, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  rejoinText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  alert: { padding: 12, borderRadius: 11, borderWidth: 1 },

  // Pure Black Visual Notes Board
  blackBoard: {
    backgroundColor: '#000000',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(148, 163, 184, 0.22)',
    padding: 18,
  },
  boardEnvPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(56, 189, 248, 0.14)',
    borderColor: 'rgba(56, 189, 248, 0.55)',
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 10,
  },
  boardEnvText: { color: '#7DD3FC', fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  boardTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  boardDividerLine: {
    height: 2,
    backgroundColor: '#38BDF8',
    marginTop: 10,
    marginBottom: 16,
    borderRadius: 2,
  },
  coreCard: {
    flexDirection: 'row',
    backgroundColor: '#090D16',
    borderColor: 'rgba(56, 189, 248, 0.35)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 13,
    gap: 10,
    marginBottom: 14,
  },
  coreAccentBar: { width: 4, borderRadius: 3, backgroundColor: '#38BDF8' },
  coreLabel: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
    marginBottom: 4,
  },
  coreBody: { color: '#E2E8F0', fontSize: 13, lineHeight: 20 },
  sectionsWrap: { marginTop: 2 },

  // Visual Flow Card
  flowCard: {
    flexDirection: 'row',
    backgroundColor: '#0A0D14',
    borderWidth: 1.5,
    borderRadius: 15,
    overflow: 'hidden',
  },
  flowLeftStripe: { width: 4 },
  flowCardInner: { flex: 1, padding: 13, gap: 8 },
  flowHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  flowTitleLeft: { flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1 },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleText: { fontSize: 11, fontWeight: '800' },
  flowStepTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', flex: 1 },
  kindBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  kindBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  flowStepBody: { color: '#CBD5E1', fontSize: 13, lineHeight: 20 },
  formulaBox: {
    flexDirection: 'row',
    backgroundColor: '#030508',
    borderColor: 'rgba(251, 191, 36, 0.45)',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 9,
  },
  formulaStripe: { width: 3, borderRadius: 2, backgroundColor: '#FBBF24' },
  formulaText: { color: '#FDE68A', fontSize: 13, fontWeight: '700', flex: 1 },
  bulletsWrap: { gap: 5, paddingTop: 2 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  bulletMarker: { fontSize: 12, fontWeight: '800', minWidth: 15 },
  bulletBody: { color: '#E2E8F0', fontSize: 12.5, lineHeight: 19, flex: 1 },

  // Geometric Vertical Vector Arrow (Selective)
  arrowWrap: { alignItems: 'center', paddingVertical: 3 },
  arrowDot: { width: 6, height: 6, borderRadius: 3 },
  arrowShaft: { width: 2.5, height: 10 },
  arrowShaftShort: { width: 2.5, height: 8 },
  arrowLabelPill: {
    backgroundColor: '#06080D',
    borderWidth: 1.2,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 2,
    marginVertical: 2,
  },
  arrowLabelText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  arrowHead: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },

  // Quick Revision Box
  keyBox: {
    backgroundColor: '#090D16',
    borderColor: 'rgba(56, 189, 248, 0.35)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 13,
    gap: 7,
    marginTop: 4,
  },
  keyBoxHeading: { color: '#38BDF8', fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  keyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  keyArrowIcon: { color: '#38BDF8', fontSize: 13, fontWeight: '800', marginTop: 1 },
  keyText: { color: '#F1F5F9', fontSize: 13, lineHeight: 19, flex: 1 },

  // Practice / Next Steps
  actionCard: {
    backgroundColor: '#06120E',
    borderColor: 'rgba(52, 211, 153, 0.45)',
    borderWidth: 1.2,
    borderRadius: 14,
    padding: 13,
    gap: 8,
    marginTop: 12,
  },
  actionHeading: { color: '#34D399', fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  actionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  actionArrowIcon: { color: '#34D399', fontSize: 13, fontWeight: '800', marginTop: 1 },
  actionText: { color: '#ECFDF5', fontSize: 13, lineHeight: 19, flex: 1 },

  boardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.14)',
  },
  boardFooterText: { color: '#475569', fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },

  // Fullscreen Black Board Modal
  fullModalWrap: { flex: 1, backgroundColor: '#000000' },
  fullModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.2)',
    gap: 10,
  },
  fullModalTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', flex: 1 },
  closeModalBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 9,
  },
  closeModalBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  fullModalScroll: { padding: 14, paddingBottom: 32 },
});
