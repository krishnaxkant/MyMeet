import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BackButton } from '../components/BackButton';
import { SessionMcqModal } from '../components/SessionMcqModal';
import { StatusBadge } from '../components/StatusBadge';
import { UpgradePlansModal } from '../components/UpgradePlansModal';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import {
  generateAiSummary,
  getBillingStatus,
  getHistoryDetail,
  getOrGenerateMeetingMcqs,
  listHistory,
  recordMeetingMcqAttempt,
  upgradeMeetingProNotes,
  type MeetingAiSummary,
  type MeetingHistoryDetail,
  type MeetingHistoryItem,
  type MeetingMcqQuiz,
  type UserSubscriptionStatus,
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
    label: 'Concept',
    accent: '#60A5FA',
    softBg: 'rgba(96, 165, 250, 0.14)',
    border: 'rgba(148, 163, 184, 0.18)',
  },
  formula: {
    label: 'Formula & Rule',
    accent: '#FBBF24',
    softBg: 'rgba(251, 191, 36, 0.14)',
    border: 'rgba(251, 191, 36, 0.28)',
  },
  step: {
    label: 'Explanation',
    accent: '#34D399',
    softBg: 'rgba(52, 211, 153, 0.14)',
    border: 'rgba(148, 163, 184, 0.18)',
  },
  example: {
    label: 'Worked Example',
    accent: '#A78BFA',
    softBg: 'rgba(167, 139, 250, 0.14)',
    border: 'rgba(148, 163, 184, 0.18)',
  },
  takeaway: {
    label: 'Key Takeaway',
    accent: '#FB7185',
    softBg: 'rgba(251, 113, 133, 0.14)',
    border: 'rgba(148, 163, 184, 0.18)',
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
        <Text style={styles.boardFooterText}>MYMEET · AI STUDY NOTES</Text>
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
  const [upgradingPro, setUpgradingPro] = useState(false);
  const [loadingMcq, setLoadingMcq] = useState(false);
  const [subscription, setSubscription] = useState<UserSubscriptionStatus | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeForMcq, setUpgradeForMcq] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState<MeetingMcqQuiz | null>(null);
  const [quizOpen, setQuizOpen] = useState(false);
  const [localRegenCounts, setLocalRegenCounts] = useState<Record<string, number>>({});
  const [fullBoardOpen, setFullBoardOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoProTriggeredRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!session?.access_token) return;
    void getBillingStatus(session.access_token)
      .then((res) => setSubscription(res.subscription))
      .catch(() => {});
  }, [session?.access_token]);

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
        const stored = await AsyncStorage.getItem(`mymeet_regen_${detail.code}`).catch(() => null);
        const parsed = Number(stored);
        if (Number.isFinite(parsed) && parsed > 0) {
          setLocalRegenCounts((prev) => ({ ...prev, [detail.code]: parsed }));
        }
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
    const hadSummary = Boolean(selected.ai_summary);
    const currentUsed = Math.max(
      selected.ai_summary?.sources_summary?.regenerate_count ?? 0,
      localRegenCounts[selected.code] ?? 0,
    );
    if (hadSummary && !subscription?.is_unlimited && currentUsed >= 2) {
      setUpgradeForMcq(false);
      setUpgradeOpen(true);
      return;
    }

    setGeneratingAi(true);
    setError(null);
    try {
      const summary = await generateAiSummary(session.access_token, selected.code);
      const nextCount = hadSummary
        ? Math.max(summary.sources_summary?.regenerate_count ?? 0, currentUsed + 1)
        : (summary.sources_summary?.regenerate_count ?? 0);
      if (hadSummary) {
        void AsyncStorage.setItem(`mymeet_regen_${selected.code}`, String(nextCount)).catch(
          () => {},
        );
        setLocalRegenCounts((prev) => ({ ...prev, [selected.code]: nextCount }));
      }
      setSelected((prev) =>
        prev
          ? {
              ...prev,
              ai_summary: {
                ...summary,
                sources_summary: {
                  ...(summary.sources_summary ?? {}),
                  regenerate_count: nextCount,
                },
              },
            }
          : prev,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate AI visual notes.');
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleUpgradeToPro = async (overrideSub?: UserSubscriptionStatus) => {
    if (!session?.access_token || !selected) return;
    const sub = overrideSub ?? subscription;
    const canUnlock = Boolean(sub?.is_pro && (sub.is_unlimited || sub.credits_remaining > 0));
    if (!canUnlock) {
      setUpgradeForMcq(false);
      setUpgradeOpen(true);
      return;
    }
    setUpgradingPro(true);
    setError(null);
    try {
      const res = await upgradeMeetingProNotes(session.access_token, selected.code);
      setSelected((prev) => (prev ? { ...prev, pro_notes: res.pro_notes } : prev));
      setSubscription(res.subscription);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to upgrade notes to Pro.');
    } finally {
      setUpgradingPro(false);
    }
  };

  const handleOpenMcq = async (overrideSub?: UserSubscriptionStatus) => {
    if (!session?.access_token || !selected) return;
    const sub = overrideSub ?? subscription;
    if (!sub?.mcq_enabled) {
      setUpgradeForMcq(true);
      setUpgradeOpen(true);
      return;
    }
    setLoadingMcq(true);
    setError(null);
    try {
      const quiz = await getOrGenerateMeetingMcqs(session.access_token, selected.code);
      setActiveQuiz(quiz);
      setQuizOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load Session MCQ Test.');
    } finally {
      setLoadingMcq(false);
    }
  };

  const hasImportantNotes = Boolean(
    selected?.ai_summary &&
      selected.ai_summary.environment_type !== 'no_important_content' &&
      ((selected.ai_summary.sources_summary?.visual_flow?.length ?? 0) > 0 ||
        (selected.ai_summary.key_points?.length ?? 0) > 0),
  );

  const isHost = selected?.my_role === 'host';
  const hideBasicNotes = Boolean(
    selected &&
      (selected.pro_notes || (subscription?.is_unlimited && hasImportantNotes)),
  );

  // Automatically generate Pro Master Notes for Unlimited Pro subscribers (hide Basic Free Notes)
  useEffect(() => {
    if (!session?.access_token || !selected || !subscription?.is_unlimited) return;
    if (!hasImportantNotes || selected.pro_notes || upgradingPro) return;
    if (autoProTriggeredRef.current.has(selected.code)) return;

    autoProTriggeredRef.current.add(selected.code);
    setUpgradingPro(true);
    setError(null);
    void upgradeMeetingProNotes(session.access_token, selected.code)
      .then((res) => {
        setSelected((prev) =>
          prev && prev.code === selected.code ? { ...prev, pro_notes: res.pro_notes } : prev,
        );
        setSubscription(res.subscription);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unable to build Pro Master Notes.');
      })
      .finally(() => setUpgradingPro(false));
  }, [session?.access_token, selected, subscription?.is_unlimited, hasImportantNotes, upgradingPro]);

  const effectiveRegenCount = selected
    ? Math.max(
        selected.ai_summary?.sources_summary?.regenerate_count ?? 0,
        localRegenCounts[selected.code] ?? 0,
      )
    : 0;
  const regenerateLimitReached = Boolean(
    selected?.ai_summary && !subscription?.is_unlimited && effectiveRegenCount >= 2,
  );

  // Step-by-step Android Back inside History: Modals -> Detail -> History List -> Previous Screen
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (quizOpen) {
        setQuizOpen(false);
        return true;
      }
      if (upgradeOpen) {
        setUpgradeOpen(false);
        return true;
      }
      if (fullBoardOpen) {
        setFullBoardOpen(false);
        return true;
      }
      if (selected) {
        setSelected(null);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [quizOpen, upgradeOpen, fullBoardOpen, selected]);

  return (
    <>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <BackButton
            label={selected ? 'History List' : 'Back'}
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
                style={[
                  styles.genBtn,
                  { backgroundColor: regenerateLimitReached ? '#F59E0B' : colors.accent },
                  generatingAi && { opacity: 0.7 },
                ]}
                disabled={generatingAi}
                onPress={() => {
                  if (regenerateLimitReached) {
                    setUpgradeForMcq(false);
                    setUpgradeOpen(true);
                    return;
                  }
                  void handleGenerateAi();
                }}
              >
                <Text
                  style={[
                    styles.shareBtnText,
                    regenerateLimitReached && { color: '#090D16', fontWeight: '800' },
                  ]}
                >
                  {generatingAi
                    ? 'Analyzing...'
                    : regenerateLimitReached
                      ? '✦ Pro'
                      : selected.ai_summary
                        ? subscription?.is_unlimited
                          ? 'Regenerate'
                          : `Regenerate (${2 - effectiveRegenCount})`
                        : 'Generate'}
                </Text>
              </Pressable>
              {selected.ai_summary && !hideBasicNotes && (
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
            {/* Basic Free Notes — hidden whenever user has Pro Notes unlocked or an Unlimited Pro subscription */}
            {!hideBasicNotes &&
              (selected.ai_summary ? (
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
              ))}

            {/* Auto-building Pro Master Notes placeholder for Unlimited Pro subscribers */}
            {hideBasicNotes && !selected.pro_notes && (
              <View style={styles.proNotesCard}>
                <View style={styles.proPill}>
                  <Text style={styles.proPillText}>✦ MYMEET PRO · MASTER NOTES</Text>
                </View>
                <Text style={styles.proBannerTitle}>
                  {upgradingPro
                    ? `Building Pro Master Notes...`
                    : `Pro Master Notes for ${selected.title}`}
                </Text>
                <Text style={styles.proBannerSub}>
                  Crafting deep explanations, code / derivations, comparison table, exam traps &amp;
                  1-min cheat sheet.
                </Text>
                {upgradingPro ? (
                  <ActivityIndicator color="#F59E0B" style={{ marginTop: 6 }} />
                ) : (
                  <Pressable style={styles.proGoldBtn} onPress={() => void handleUpgradeToPro()}>
                    <Text style={styles.proGoldBtnText}>Generate Pro Master Notes</Text>
                  </Pressable>
                )}
              </View>
            )}

            {/* Get Pro Notes at ₹9 Only CTA Banner at the end of Free Notes */}
            {hasImportantNotes && !selected.pro_notes && (
              <View style={styles.proBanner}>
                <View style={styles.proPill}>
                  <Text style={styles.proPillText}>✦ MYMEET PRO NOTES</Text>
                </View>
                <Text style={styles.proBannerTitle}>
                  Get Pro Notes at ₹9 Only
                </Text>
                <Text style={styles.proBannerSub}>
                  Code snippets / derivations, comparison table, exam traps, 1-min cheat sheet, PDF
                  &amp; 20-MCQ session practice tests.
                </Text>
                {subscription?.is_pro && subscription.credits_remaining > 0 ? (
                  <>
                    <Pressable
                      style={[styles.proGoldBtn, upgradingPro && { opacity: 0.65 }]}
                      disabled={upgradingPro}
                      onPress={() => void handleUpgradeToPro()}
                    >
                      <Text style={styles.proGoldBtnText}>
                        {upgradingPro
                          ? 'Building Pro Notes...'
                          : `Upgrade with 1 Credit (${subscription.credits_remaining} left)`}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={styles.proPlansLink}
                      onPress={() => {
                        setUpgradeForMcq(false);
                        setUpgradeOpen(true);
                      }}
                    >
                      <Text style={styles.proPlansLinkText}>
                        See All Offers (₹9 · ₹49 · ₹349 · ₹899)
                      </Text>
                    </Pressable>
                  </>
                ) : (
                  <Pressable
                    style={styles.proGoldBtn}
                    onPress={() => {
                      setUpgradeForMcq(false);
                      setUpgradeOpen(true);
                    }}
                  >
                    <Text style={styles.proGoldBtnText}>
                      Get Pro Notes at ₹9 Only · See All Offers
                    </Text>
                  </Pressable>
                )}
              </View>
            )}

            {/* MYMEET PRO Master Notes — Clean Theme-Adaptive Editorial Document */}
            {selected.pro_notes && (
              <View
                style={[
                  styles.proDocCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.borderStrong,
                  },
                ]}
              >
                <View style={styles.itemRowHeader}>
                  <View style={styles.proPill}>
                    <Text style={styles.proPillText}>✦ PRO MASTER NOTES</Text>
                  </View>
                  <Pressable
                    style={styles.proShareChip}
                    onPress={() =>
                      void Share.share({
                        title: `${selected.title} — MyMeet Pro Notes`,
                        message: selected.pro_notes?.pro_markdown || selected.pro_notes?.pro_overview || '',
                      }).catch(() => {})
                    }
                  >
                    <Text style={{ color: '#D97706', fontSize: 11.5, fontWeight: '800' }}>
                      Share Notes
                    </Text>
                  </Pressable>
                </View>

                <Text style={[styles.proDocTitle, { color: colors.text }]}>{selected.title}</Text>
                {selected.pro_notes.environment_label ? (
                  <Text style={[styles.proDocEnv, { color: colors.textMuted }]}>
                    {selected.pro_notes.environment_label}
                  </Text>
                ) : null}

                <View
                  style={[
                    styles.proOverviewWrap,
                    { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.proKicker, { color: colors.textMuted }]}>
                    EXECUTIVE SUMMARY
                  </Text>
                  <Text style={[styles.proOverviewText, { color: colors.text }]}>
                    {selected.pro_notes.pro_overview}
                  </Text>
                </View>

                {selected.pro_notes.deep_sections.map((sec, idx) => (
                  <View
                    key={`${sec.title}-${idx}`}
                    style={[
                      styles.proSecBlock,
                      { borderBottomColor: colors.border },
                    ]}
                  >
                    <View style={styles.proSecHeadRow}>
                      <View style={styles.proSecNumBadge}>
                        <Text style={styles.proSecNumText}>
                          {String(idx + 1).padStart(2, '0')}
                        </Text>
                      </View>
                      <Text style={[styles.proSecTitle, { color: colors.text }]}>{sec.title}</Text>
                    </View>

                    <Text style={[styles.proSecBody, { color: colors.textMuted }]}>
                      {sec.explanation}
                    </Text>

                    {sec.code_or_formula ? (
                      <View style={styles.proCodeBox}>
                        <Text style={styles.proCodeKicker}>CODE / FORMULA</Text>
                        <Text style={styles.proCodeText}>{sec.code_or_formula}</Text>
                      </View>
                    ) : null}

                    {sec.bullets && sec.bullets.length > 0 ? (
                      <View style={styles.proBulletsList}>
                        {sec.bullets.map((b, bi) => (
                          <View key={bi} style={styles.proBulletRow}>
                            <Text style={styles.proBulletDot}>•</Text>
                            <Text style={[styles.proSecBullet, { color: colors.text }]}>{b}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}

                    {sec.worked_example ? (
                      <View style={styles.proExampleBox}>
                        <Text style={styles.proExampleKicker}>WORKED EXAMPLE</Text>
                        <Text style={[styles.proExampleText, { color: colors.text }]}>
                          {sec.worked_example}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ))}

                {selected.pro_notes.comparison_table && (
                  <View
                    style={[
                      styles.proSubBox,
                      { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.proKicker, { color: colors.textMuted }]}>COMPARISON</Text>
                    <Text style={[styles.proSubHeading, { color: colors.text }]}>
                      {selected.pro_notes.comparison_table.title || 'Comparison Matrix'}
                    </Text>
                    <Text style={[styles.proTableHeader, { color: colors.accentText }]}>
                      {selected.pro_notes.comparison_table.headers.join('  ·  ')}
                    </Text>
                    {selected.pro_notes.comparison_table.rows.map((r, ri) => (
                      <Text key={ri} style={[styles.proSecBullet, { color: colors.text }]}>
                        • {r.join('  —  ')}
                      </Text>
                    ))}
                  </View>
                )}

                {selected.pro_notes.exam_traps.length > 0 && (
                  <View style={styles.proTrapCard}>
                    <Text style={styles.proTrapHeading}>EXAM &amp; INTERVIEW TRAPS</Text>
                    {selected.pro_notes.exam_traps.map((t, ti) => (
                      <View key={ti} style={styles.proTrapBlock}>
                        <Text style={[styles.proTrapLine, { color: colors.text }]}>
                          <Text style={{ color: '#ef4444', fontWeight: '800' }}>Trap: </Text>
                          {t.trap}
                        </Text>
                        <Text style={[styles.proFixLine, { color: colors.textMuted }]}>
                          <Text style={{ color: '#16a34a', fontWeight: '800' }}>Fix: </Text>
                          {t.fix}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {selected.pro_notes.cheat_sheet.length > 0 && (
                  <View style={styles.proCheatCard}>
                    <Text style={styles.proCheatHeading}>1-MINUTE CHEAT SHEET</Text>
                    {selected.pro_notes.cheat_sheet.map((c, ci) => (
                      <View key={ci} style={styles.proBulletRow}>
                        <Text style={styles.proCheatNum}>
                          {String(ci + 1).padStart(2, '0')}
                        </Text>
                        <Text style={[styles.proSecBullet, { color: colors.text }]}>{c}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Today's Session MCQ Practice Test Card */}
            {hasImportantNotes && (
              <View style={styles.mcqCard}>
                <View style={styles.proPill}>
                  <Text style={styles.proPillText}>🎯 SESSION MCQ PRACTICE TEST</Text>
                </View>
                <Text style={styles.proBannerTitle}>
                  Take MCQ Test for Today&apos;s Session
                </Text>
                <Text style={styles.proBannerSub}>
                  {subscription?.mcq_enabled
                    ? 'Attempt 20 high-level MCQs built strictly from this session + instant concept explanations.'
                    : 'Attempt 20 exam-level MCQs for every session — included in Pro Monthly (₹349/mo) & Pro Yearly (₹899/yr).'}
                </Text>
                <Pressable
                  style={[
                    styles.proGoldBtn,
                    { backgroundColor: subscription?.mcq_enabled ? '#7C3AED' : '#F59E0B' },
                    loadingMcq && { opacity: 0.65 },
                  ]}
                  disabled={loadingMcq}
                  onPress={() => void handleOpenMcq()}
                >
                  <Text
                    style={{
                      color: subscription?.mcq_enabled ? '#FFFFFF' : '#090D16',
                      fontSize: 13.5,
                      fontWeight: '800',
                    }}
                  >
                    {loadingMcq
                      ? 'Preparing 20 MCQs...'
                      : subscription?.mcq_enabled
                        ? 'Take 20-MCQ Test Now →'
                        : 'Unlock 20-MCQ Tests · ₹349/mo'}
                  </Text>
                </Pressable>
              </View>
            )}

            {/* HOST-ONLY Participants History & Revision MCQ Scores */}
            {isHost && (
              <View
                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={styles.itemRowHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.text, flex: 1 }]}>
                    Participants &amp; MCQ Scores ({selected.participants.length})
                  </Text>
                  <StatusBadge label="Host Only" tone="success" />
                </View>

                {selected.participants.length === 0 ? (
                  <Text style={[styles.subText, { color: colors.textMuted }]}>
                    No participants recorded for this meeting.
                  </Text>
                ) : (
                  selected.participants.map((p) => {
                    const prog = p.mcq_progress;
                    const pillColors =
                      prog?.status === 'completed'
                        ? { bg: 'rgba(22, 163, 74, 0.14)', border: 'rgba(22, 163, 74, 0.4)', text: '#16a34a' }
                        : prog?.status === 'left_in_between'
                          ? { bg: 'rgba(245, 158, 11, 0.14)', border: 'rgba(245, 158, 11, 0.45)', text: '#d97706' }
                          : prog?.status === 'not_attempted'
                            ? { bg: 'rgba(99, 102, 241, 0.14)', border: 'rgba(99, 102, 241, 0.38)', text: '#6366f1' }
                            : { bg: colors.surface, border: colors.borderStrong, text: colors.textMuted };

                    return (
                      <View
                        key={p.id}
                        style={[
                          styles.rosterRowCol,
                          { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                        ]}
                      >
                        <View style={styles.itemRowHeader}>
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
                        {prog && (
                          <View
                            style={[
                              styles.mcqScorePill,
                              { backgroundColor: pillColors.bg, borderColor: pillColors.border },
                            ]}
                          >
                            <Text style={[styles.mcqScorePillText, { color: pillColors.text }]}>
                              {prog.status === 'completed'
                                ? `✓ ${prog.label}`
                                : prog.status === 'left_in_between'
                                  ? `◷ ${prog.label}`
                                  : prog.label}
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  })
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
      <UpgradePlansModal
        visible={upgradeOpen}
        accessToken={session?.access_token ?? null}
        meetingCode={selected?.code}
        highlightMcq={upgradeForMcq}
        onClose={() => setUpgradeOpen(false)}
        onActivated={(nextSub, planCode) => {
          setSubscription(nextSub);
          if (upgradeForMcq && nextSub.mcq_enabled) {
            void handleOpenMcq(nextSub);
          } else if (
            selected &&
            !selected.pro_notes &&
            (planCode === 'single_9' || planCode === 'pack_49' || nextSub.is_unlimited)
          ) {
            void handleUpgradeToPro(nextSub);
          }
        }}
      />

      <SessionMcqModal
        visible={quizOpen}
        quiz={activeQuiz}
        meetingTitle={selected?.title ?? 'Session'}
        onProgress={(payload) => {
          if (!session?.access_token || !selected) return;
          void recordMeetingMcqAttempt(session.access_token, selected.code, payload).catch(
            () => {},
          );
        }}
        onClose={() => {
          setQuizOpen(false);
          if (selected && isHost) {
            void handleInspect(selected.code);
          }
        }}
      />
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
  rosterRowCol: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  mcqScorePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  mcqScorePillText: {
    fontSize: 11.5,
    fontWeight: '700',
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

  // Calm Editorial Dark-Ink Basic Notes Board
  blackBoard: {
    backgroundColor: '#090C12',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.16)',
    padding: 20,
  },
  boardEnvPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(96, 165, 250, 0.12)',
    borderColor: 'rgba(96, 165, 250, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 10,
  },
  boardEnvText: { color: '#93C5FD', fontSize: 10.5, fontWeight: '700', letterSpacing: 0.5 },
  boardTitle: { color: '#F8FAFC', fontSize: 23, fontWeight: '800', letterSpacing: -0.4, lineHeight: 30 },
  boardDividerLine: {
    height: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
    marginTop: 12,
    marginBottom: 18,
  },
  coreCard: {
    flexDirection: 'row',
    backgroundColor: '#0F141F',
    borderColor: 'rgba(148, 163, 184, 0.14)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 15,
    gap: 12,
    marginBottom: 16,
  },
  coreAccentBar: { width: 3.5, borderRadius: 2, backgroundColor: '#60A5FA' },
  coreLabel: {
    color: '#93C5FD',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 5,
  },
  coreBody: { color: '#E2E8F0', fontSize: 14.5, lineHeight: 23 },
  sectionsWrap: { marginTop: 2 },

  // Clean Calm Visual Flow Card
  flowCard: {
    flexDirection: 'row',
    backgroundColor: '#0F141F',
    borderWidth: 1,
    borderRadius: 15,
    overflow: 'hidden',
  },
  flowLeftStripe: { width: 3.5 },
  flowCardInner: { flex: 1, padding: 15, gap: 10 },
  flowHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  flowTitleLeft: { flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1 },
  stepCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleText: { fontSize: 11, fontWeight: '800' },
  flowStepTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '700', flex: 1, lineHeight: 22 },
  kindBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 0 },
  kindBadgeText: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.3 },
  flowStepBody: { color: '#CBD5E1', fontSize: 14.5, lineHeight: 23 },
  formulaBox: {
    flexDirection: 'row',
    backgroundColor: '#06090F',
    borderColor: 'rgba(251, 191, 36, 0.28)',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  formulaStripe: { width: 3, borderRadius: 2, backgroundColor: '#FBBF24' },
  formulaText: { color: '#FDE68A', fontSize: 13.5, fontWeight: '600', flex: 1, lineHeight: 21 },
  bulletsWrap: { gap: 7, paddingTop: 2 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  bulletMarker: { fontSize: 13, fontWeight: '800', minWidth: 15 },
  bulletBody: { color: '#E2E8F0', fontSize: 14, lineHeight: 22, flex: 1 },

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
  proBanner: {
    backgroundColor: '#0F172A',
    borderColor: '#F59E0B',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 15,
    gap: 8,
  },
  mcqCard: {
    backgroundColor: '#0F172A',
    borderColor: '#7C3AED',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 15,
    gap: 8,
  },
  proPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#7C3AED',
  },
  proPillText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  proBannerTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  proBannerSub: { color: '#CBD5E1', fontSize: 12.5, lineHeight: 18 },
  proGoldBtn: {
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 2,
  },
  proGoldBtnText: { color: '#090D16', fontSize: 13.5, fontWeight: '800' },
  proPlansLink: { alignItems: 'center', paddingVertical: 4 },
  proPlansLinkText: { color: '#93C5FD', fontSize: 12, fontWeight: '700' },
  proNotesCard: {
    backgroundColor: '#0B0F1A',
    borderColor: 'rgba(245, 158, 11, 0.45)',
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    gap: 12,
    overflow: 'hidden',
  },
  proDocCard: {
    borderWidth: 1,
    borderTopWidth: 3,
    borderTopColor: '#F59E0B',
    borderRadius: 20,
    padding: 20,
    gap: 16,
  },
  proDocTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 28,
    marginTop: 2,
  },
  proDocEnv: {
    fontSize: 12.5,
    fontWeight: '600',
    marginTop: -10,
  },
  proKicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.9,
    marginBottom: 4,
  },
  proOverviewWrap: {
    borderWidth: 1,
    borderLeftWidth: 3.5,
    borderLeftColor: '#6366F1',
    borderRadius: 12,
    padding: 14,
  },
  proShareChip: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.45)',
  },
  proOverviewText: { fontSize: 14.5, lineHeight: 23 },
  proSecBlock: {
    paddingBottom: 16,
    borderBottomWidth: 1,
    gap: 10,
  },
  proSecHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  proSecNumBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
    backgroundColor: 'rgba(124, 58, 237, 0.14)',
  },
  proSecNumText: {
    color: '#7C3AED',
    fontSize: 11.5,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  proSecTitle: { fontSize: 16.5, fontWeight: '700', flex: 1, lineHeight: 22 },
  proSecBody: { fontSize: 14.5, lineHeight: 23 },
  proCodeBox: {
    backgroundColor: '#0A0F1C',
    borderColor: 'rgba(148, 163, 184, 0.22)',
    borderWidth: 1,
    borderRadius: 11,
    padding: 13,
    gap: 6,
  },
  proCodeKicker: {
    color: '#94A3B8',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.8,
    fontFamily: 'monospace',
  },
  proCodeText: { color: '#E2E8F0', fontSize: 12.5, lineHeight: 20, fontFamily: 'monospace' },
  proBulletsList: { gap: 7 },
  proBulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  proBulletDot: { color: '#7C3AED', fontSize: 15, fontWeight: '800', lineHeight: 22 },
  proSecBullet: { fontSize: 14, lineHeight: 22, flex: 1 },
  proExampleBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.09)',
    borderColor: 'rgba(16, 185, 129, 0.28)',
    borderWidth: 1,
    borderLeftWidth: 3.5,
    borderLeftColor: '#10B981',
    borderRadius: 11,
    padding: 12,
    gap: 4,
  },
  proExampleKicker: {
    color: '#059669',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  proExampleText: { fontSize: 13.8, lineHeight: 21 },
  proSubBox: {
    borderWidth: 1,
    borderRadius: 13,
    padding: 14,
    gap: 6,
  },
  proSubHeading: { fontSize: 15.5, fontWeight: '700', marginBottom: 2 },
  proTableHeader: { fontSize: 12.5, fontWeight: '800', marginBottom: 4 },
  proTrapCard: {
    backgroundColor: 'rgba(245, 158, 11, 0.09)',
    borderColor: 'rgba(245, 158, 11, 0.34)',
    borderWidth: 1,
    borderRadius: 13,
    padding: 15,
    gap: 10,
  },
  proTrapBlock: { gap: 3 },
  proTrapHeading: { color: '#D97706', fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8 },
  proTrapLine: { fontSize: 13.8, lineHeight: 21 },
  proFixLine: { fontSize: 13.5, lineHeight: 20 },
  proCheatCard: {
    backgroundColor: 'rgba(99, 102, 241, 0.09)',
    borderColor: 'rgba(99, 102, 241, 0.3)',
    borderWidth: 1,
    borderRadius: 13,
    padding: 15,
    gap: 8,
  },
  proCheatHeading: { color: '#6366F1', fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8 },
  proCheatNum: {
    color: '#6366F1',
    fontSize: 11.5,
    fontWeight: '800',
    fontFamily: 'monospace',
    minWidth: 22,
    marginTop: 2,
  },
});
