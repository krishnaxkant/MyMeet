import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { BrandLogo } from '../components/BrandLogo';
import { StatusBadge } from '../components/StatusBadge';
import { ThemeToggle } from '../components/ThemeToggle';
import { UpgradePlansModal } from '../components/UpgradePlansModal';
import { useAuth } from '../hooks/useAuth';
import { useBackendHealth } from '../hooks/useBackendHealth';
import { useTheme } from '../hooks/useTheme';
import {
  createMeeting,
  extractMeetingCode,
  getBillingStatus,
  listMeetings,
  listMyInvitations,
  listSchedules,
  respondToInvitation,
  startSchedule,
  type MeetingInvitation,
  type MeetingSummary,
  type ScheduledMeeting,
  type UserSubscriptionStatus,
} from '../services/api';

interface HomeScreenProps {
  onOpenProfile: () => void;
  onOpenLobby: (code: string) => void;
  onOpenSchedule: () => void;
  onOpenHistory: (code?: string) => void;
}

const FEATURE_SPOTLIGHTS = [
  {
    id: 'rooms',
    tag: 'INSTANT HD ROOMS',
    title: 'Full-stage screen share & 100-user calls',
    copy: 'Share screen full-stage with Host PiP, Waiting Room security & crisp live audio.',
    accent: '#2563EB',
    pro: false,
  },
  {
    id: 'free-notes',
    tag: 'AI VISUAL NOTES · FREE',
    title: 'Auto black-canvas study slides',
    copy: 'Included free on every session — key takeaways, PDF & PNG downloads.',
    accent: '#0D9488',
    pro: false,
  },
  {
    id: 'pro-notes',
    tag: 'PRO MASTER NOTES · FROM ₹9',
    title: 'Code, derivations, traps & cheat sheet',
    copy: '₹9 unlocks 1 class only (no MCQs). ₹49 unlocks 15 classes. HD printable PDF!',
    accent: '#7C3AED',
    pro: true,
  },
  {
    id: 'pro-mcqs',
    tag: 'PRO UNLIMITED · ₹349/MO+',
    title: '20-Question Session Mastery MCQs',
    copy: 'Sequential Easy → Hard exam quiz with instant explanations + Unlimited Pro Notes.',
    accent: '#D97706',
    pro: true,
  },
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'M';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function HomeScreen({
  onOpenProfile,
  onOpenLobby,
  onOpenSchedule,
  onOpenHistory,
}: HomeScreenProps) {
  const { session, user, profile } = useAuth();
  const { colors } = useTheme();
  const { data: healthData, loading: healthLoading } = useBackendHealth();

  const [meetingCode, setMeetingCode] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [waitingRoom, setWaitingRoom] = useState(false);
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [meetings, setMeetings] = useState<MeetingSummary[]>([]);
  const [schedules, setSchedules] = useState<ScheduledMeeting[]>([]);
  const [invitations, setInvitations] = useState<MeetingInvitation[]>([]);
  const [subscription, setSubscription] = useState<UserSubscriptionStatus | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeForMcq, setUpgradeForMcq] = useState(false);
  const [meetingsLoading, setMeetingsLoading] = useState(true);
  const [inviteBusyId, setInviteBusyId] = useState<string | null>(null);
  const [clockText, setClockText] = useState(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  );

  useEffect(() => {
    const tick = setInterval(() => {
      setClockText(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  const firstName = (
    profile?.full_name ||
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split('@')[0] ||
    'there'
  ).split(' ')[0];

  const loadDashboard = useCallback(async () => {
    if (!session?.access_token) return;
    setMeetingsLoading(true);
    try {
      const [list, invites, upcoming, billing] = await Promise.all([
        listMeetings(session.access_token),
        listMyInvitations(session.access_token).catch(() => []),
        listSchedules(session.access_token).catch(() => []),
        getBillingStatus(session.access_token).catch(() => null),
      ]);
      setMeetings(list);
      setInvitations(invites);
      setSchedules(upcoming);
      if (billing?.subscription) setSubscription(billing.subscription);
    } catch (err) {
      console.warn('[mobile meetings] Failed to load dashboard:', err);
    } finally {
      setMeetingsLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const handleCreateMeeting = async () => {
    if (!session?.access_token) return;
    setActionError(null);
    setCreating(true);
    try {
      const created = await createMeeting(session.access_token, {
        title: newTitle.trim() || `${firstName}'s Meeting`,
        waiting_room_enabled: waitingRoom,
      });
      setShowCreateForm(false);
      setNewTitle('');
      onOpenLobby(created.code);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to create meeting.');
    } finally {
      setCreating(false);
    }
  };

  const handleJoinByCode = () => {
    setActionError(null);
    const normalized = extractMeetingCode(meetingCode);
    if (!normalized || normalized.length < 4) {
      setActionError('Enter a valid meeting code (e.g. k9m4-x7p2-q3r8) or meeting link.');
      return;
    }
    onOpenLobby(normalized);
  };

  const handleRespondInvite = async (
    invitation: MeetingInvitation,
    action: 'accepted' | 'declined',
  ) => {
    if (!session?.access_token) return;
    setInviteBusyId(invitation.id);
    setActionError(null);
    try {
      const updated = await respondToInvitation(session.access_token, invitation.id, action);
      setInvitations((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      if (action === 'accepted') {
        onOpenLobby(invitation.meeting_code);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to respond to invitation.');
    } finally {
      setInviteBusyId(null);
    }
  };

  const handleStartScheduled = async (sched: ScheduledMeeting) => {
    if (!session?.access_token) return;
    try {
      const started = await startSchedule(session.access_token, sched.id);
      if (started.meeting_code) onOpenLobby(started.meeting_code);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to start scheduled meeting.');
    }
  };

  const pendingInvites = invitations.filter(
    (inv) => inv.status === 'pending' && inv.meeting_status !== 'ended',
  );
  const nextSchedule = schedules.find((s) => s.meeting_status !== 'ended') ?? null;
  const isPro = Boolean(subscription?.is_pro);
  const isUnlimited = Boolean(subscription?.is_unlimited);

  return (
    <>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brandHeaderRow}>
          <View style={styles.brandLeftCluster}>
            <BrandLogo size="sm" />
            {isPro && (
              <View style={styles.brandProChip}>
                <Text style={styles.brandProChipText}>✦ PRO</Text>
              </View>
            )}
          </View>
          <View style={styles.brandRightCluster}>
            <Pressable
              style={[
                styles.navUpgradePill,
                isPro ? styles.navProStatusPill : styles.navBasicUpgradePill,
              ]}
              onPress={() => {
                setUpgradeForMcq(false);
                setUpgradeOpen(true);
              }}
            >
              <Text style={isPro ? styles.navProStatusText : styles.navBasicUpgradeText}>
                {isPro
                  ? isUnlimited
                    ? '✦ PRO · Unlimited'
                    : `✦ PRO · ${subscription?.credits_remaining ?? 0} left`
                  : '✦ Upgrade'}
              </Text>
            </Pressable>
            <ThemeToggle />
          </View>
        </View>

        <View style={styles.topBar}>
          <Pressable style={styles.brandRow} onPress={onOpenProfile}>
            <View
              style={[
                styles.avatar,
                {
                  backgroundColor: isPro ? '#7C3AED' : colors.accent,
                  borderWidth: isPro ? 2.5 : 0,
                  borderColor: isPro ? '#F59E0B' : 'transparent',
                  overflow: 'hidden',
                },
              ]}
            >
              {profile?.avatar_url ? (
                <Image
                  source={{ uri: profile.avatar_url }}
                  style={{ width: '100%', height: '100%' }}
                />
              ) : (
                <Text style={styles.avatarText}>{getInitials(firstName)}</Text>
              )}
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.greetingSmall, { color: isPro ? '#F59E0B' : colors.textMuted }]}>
                {isPro
                  ? `MYMEET PRO · ${subscription?.plan_name}`
                  : `${getGreeting()} · ${clockText}`}
              </Text>
              <View style={styles.nameStatusRow}>
                <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                  {firstName}
                </Text>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor: healthLoading
                        ? '#f59e0b'
                        : healthData
                          ? '#22c55e'
                          : '#ef4444',
                    },
                  ]}
                />
              </View>
            </View>
          </Pressable>
        </View>

        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: colors.surface,
              borderColor: isPro ? 'rgba(245, 158, 11, 0.5)' : colors.border,
              borderWidth: isPro ? 1.5 : 1,
              shadowColor: colors.shadowColor,
            },
          ]}
        >
          <Text style={[styles.heroTitle, { color: colors.text }]}>
            {isPro ? 'Your Pro Studio is Ready.' : 'Connect. Collaborate. Together.'}
          </Text>
          <Text style={[styles.heroSub, { color: colors.textMuted }]}>
            {isPro
              ? isUnlimited
                ? 'Host HD meetings with automatic Pro Master Notes & 20-MCQ Session Tests unlocked.'
                : `Host HD meetings and unlock deep Master Notes (${subscription?.credits_remaining ?? 0} credits active).`
              : 'Start an instant MyMeet room, plan ahead with your team, or enter a meeting code.'}
          </Text>

          <View style={styles.primaryActionsRow}>
            <Pressable
              style={[styles.primaryButton, { backgroundColor: colors.accent }]}
              onPress={() => setShowCreateForm((prev) => !prev)}
              disabled={creating}
            >
              <Text style={styles.primaryButtonText}>
                {showCreateForm ? 'Close' : '+ New Meeting'}
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.secondaryActionBtn,
                { backgroundColor: colors.surfaceElevated, borderColor: colors.borderStrong },
              ]}
              onPress={onOpenSchedule}
            >
              <Text style={[styles.secondaryActionText, { color: colors.text }]}>Schedule</Text>
            </Pressable>
          </View>

          {showCreateForm && (
            <View
              style={[
                styles.createBox,
                { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
              ]}
            >
              <TextInput
                style={[
                  styles.codeInput,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.borderStrong,
                    color: colors.text,
                  },
                ]}
                value={newTitle}
                onChangeText={setNewTitle}
                placeholder={`${firstName}'s Meeting`}
                placeholderTextColor={colors.placeholder}
              />

              <View style={styles.switchRow}>
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: colors.text }]}>Waiting Room</Text>
                  <Text style={[styles.rowDesc, { color: colors.textMuted }]}>
                    Approve guests before they enter
                  </Text>
                </View>
                <Switch value={waitingRoom} onValueChange={setWaitingRoom} />
              </View>

              <Pressable
                style={[
                  styles.primaryButton,
                  { backgroundColor: colors.accent },
                  creating && styles.buttonDisabled,
                ]}
                onPress={() => void handleCreateMeeting()}
                disabled={creating}
              >
                <Text style={styles.primaryButtonText}>
                  {creating ? 'Creating room...' : 'Create & Open Lobby'}
                </Text>
              </Pressable>
            </View>
          )}

          <View
            style={[
              styles.joinCapsule,
              { backgroundColor: colors.surfaceElevated, borderColor: colors.borderStrong },
            ]}
          >
            <TextInput
              style={[styles.joinCapsuleInput, { color: colors.text }]}
              value={meetingCode}
              onChangeText={setMeetingCode}
              placeholder="Enter meeting code or link"
              placeholderTextColor={colors.placeholder}
              autoCapitalize="none"
            />
            <Pressable
              style={[
                styles.joinButton,
                { backgroundColor: colors.accentSoft },
                !meetingCode.trim() && styles.buttonDisabled,
              ]}
              disabled={!meetingCode.trim()}
              onPress={handleJoinByCode}
            >
              <Text style={[styles.joinButtonText, { color: colors.accentText }]}>Join</Text>
            </Pressable>
          </View>

          {actionError && (
            <View
              style={[
                styles.noticeBox,
                { backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder },
              ]}
            >
              <Text style={[styles.noticeText, { color: colors.dangerText }]}>{actionError}</Text>
            </View>
          )}
        </View>

        {/* Horizontal Feature Showcase Carousel (Includes Subscription Pro Features!) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.spotlightScroll}
        >
          {FEATURE_SPOTLIGHTS.map((item) => (
            <Pressable
              key={item.id}
              style={[
                styles.spotlightTile,
                {
                  backgroundColor: item.accent,
                  borderColor: item.pro ? 'rgba(251, 191, 36, 0.55)' : 'rgba(255,255,255,0.16)',
                },
              ]}
              onPress={() => {
                if (item.id === 'pro-mcqs') {
                  setUpgradeForMcq(true);
                  setUpgradeOpen(true);
                } else if (item.pro) {
                  setUpgradeForMcq(false);
                  setUpgradeOpen(true);
                } else if (item.id === 'free-notes') {
                  onOpenHistory();
                }
              }}
            >
              <View style={styles.spotlightTagPill}>
                <Text style={styles.spotlightTagText}>{item.tag}</Text>
              </View>
              <Text style={styles.spotlightTileTitle}>{item.title}</Text>
              <Text style={styles.spotlightTileCopy}>{item.copy}</Text>
              {item.pro && (
                <Text style={styles.spotlightTileCta}>Tap to compare plans →</Text>
              )}
            </Pressable>
          ))}
        </ScrollView>

        {/* Transparent Home Upgrade Card for Basic / Credit-pack Users */}
        {!isUnlimited && (
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: 'rgba(245, 158, 11, 0.45)',
                shadowColor: colors.shadowColor,
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <View style={styles.brandProChip}>
                <Text style={styles.brandProChipText}>✦ MYMEET PRO PLANS</Text>
              </View>
              <Text style={{ color: '#F59E0B', fontSize: 11.5, fontWeight: '800' }}>
                From ₹9 Only
              </Text>
            </View>

            <View style={styles.miniPlanRow}>
              <Text style={[styles.miniPlanLine, { color: colors.text }]}>
                <Text style={{ color: '#16a34a', fontWeight: '900' }}>✓ </Text>
                <Text style={{ fontWeight: '800' }}>₹9 Pack:</Text> 1 class Pro Master Notes only
              </Text>
              <Text style={[styles.miniPlanLine, { color: colors.textMuted }]}>
                <Text style={{ color: '#ef4444', fontWeight: '900' }}>✕ </Text>
                No Quick 20-MCQ revision test in ₹9 / ₹49
              </Text>
              <Text style={[styles.miniPlanLine, { color: colors.text }]}>
                <Text style={{ color: '#16a34a', fontWeight: '900' }}>✓ </Text>
                <Text style={{ fontWeight: '800' }}>₹349/mo · ₹899/yr:</Text> Unlimited Pro Notes +
                20-MCQ Tests
              </Text>
            </View>

            <Pressable
              style={styles.upgradeFullBtn}
              onPress={() => {
                setUpgradeForMcq(false);
                setUpgradeOpen(true);
              }}
            >
              <Text style={styles.upgradeFullBtnText}>
                Compare All 4 Plans (✓ / ✕) &amp; Upgrade
              </Text>
            </Pressable>
          </View>
        )}

        {pendingInvites.length > 0 && (
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: colors.accentBorder,
                shadowColor: colors.shadowColor,
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Meeting Invitations</Text>
              <StatusBadge label={`${pendingInvites.length} Pending`} tone="warning" />
            </View>
            {pendingInvites.map((inv) => (
              <View
                key={inv.id}
                style={[
                  styles.inviteCardRow,
                  { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                ]}
              >
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: colors.text }]}>{inv.meeting_title}</Text>
                  <Text style={[styles.rowDesc, { color: colors.textMuted }]}>
                    From {inv.inviter_name || inv.inviter_email || 'Host'} · {inv.meeting_code}
                  </Text>
                </View>
                <View style={styles.inviteBtnRow}>
                  <Pressable
                    style={[styles.acceptBtn, { backgroundColor: colors.accent }]}
                    disabled={inviteBusyId === inv.id}
                    onPress={() => void handleRespondInvite(inv, 'accepted')}
                  >
                    <Text style={styles.acceptBtnText}>Accept &amp; Join</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.declineBtn,
                      { backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder },
                    ]}
                    disabled={inviteBusyId === inv.id}
                    onPress={() => void handleRespondInvite(inv, 'declined')}
                  >
                    <Text style={[styles.declineBtnText, { color: colors.dangerText }]}>
                      Decline
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        {nextSchedule && (
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                shadowColor: colors.shadowColor,
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Up Next</Text>
              <Pressable onPress={onOpenSchedule}>
                <Text style={[styles.linkText, { color: colors.accentText }]}>See all</Text>
              </Pressable>
            </View>
            <View
              style={[
                styles.inviteCardRow,
                { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
              ]}
            >
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: colors.text }]}>{nextSchedule.title}</Text>
                <Text style={[styles.rowDesc, { color: colors.textMuted }]}>
                  {new Date(nextSchedule.scheduled_start).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  · {nextSchedule.meeting_code}
                </Text>
              </View>
              <Pressable
                style={[styles.acceptBtn, { backgroundColor: colors.accent }]}
                onPress={() =>
                  nextSchedule.is_host
                    ? void handleStartScheduled(nextSchedule)
                    : nextSchedule.meeting_code
                      ? onOpenLobby(nextSchedule.meeting_code)
                      : undefined
                }
              >
                <Text style={styles.acceptBtnText}>
                  {nextSchedule.is_host ? 'Start Meeting' : 'Open Lobby'}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              shadowColor: colors.shadowColor,
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Recent Meetings</Text>
            <View style={styles.headerActions}>
              <Pressable onPress={() => onOpenHistory()}>
                <Text style={[styles.linkText, { color: colors.accentText }]}>History</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.smallButton,
                  { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                  meetingsLoading && styles.buttonDisabled,
                ]}
                onPress={() => void loadDashboard()}
                disabled={meetingsLoading}
              >
                <Text style={[styles.smallButtonText, { color: colors.text }]}>
                  {meetingsLoading ? '...' : '↻'}
                </Text>
              </Pressable>
            </View>
          </View>

          {meetings.length === 0 ? (
            <Text style={[styles.rowDesc, { color: colors.textMuted }]}>
              {meetingsLoading
                ? 'Loading your meetings...'
                : 'No meetings yet. Tap + New Meeting to start your first call.'}
            </Text>
          ) : (
            meetings.slice(0, 5).map((m) => (
              <Pressable
                key={m.id}
                style={[
                  styles.row,
                  { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                ]}
                onPress={() =>
                  m.status === 'ended' ? onOpenHistory(m.code) : onOpenLobby(m.code)
                }
              >
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                    {m.title}
                  </Text>
                  <Text style={[styles.rowDesc, { color: colors.textMuted }]}>
                    {m.status === 'ended'
                      ? `${m.code}${m.my_role === 'host' ? ' · Host' : ''} · ${new Date(m.created_at).toLocaleDateString()}`
                      : `${m.code} · ${m.joined_count} in call${m.my_role === 'host' ? ' · Host' : ''}`}
                  </Text>
                </View>
                <StatusBadge
                  label={m.status === 'ended' ? 'Ended' : m.status === 'active' ? 'Active' : m.status}
                  tone={m.status === 'active' ? 'success' : 'warning'}
                />
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>

      <UpgradePlansModal
        visible={upgradeOpen}
        accessToken={session?.access_token ?? null}
        highlightMcq={upgradeForMcq}
        onClose={() => setUpgradeOpen(false)}
        onActivated={(nextSub) => {
          setSubscription(nextSub);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 18,
    paddingBottom: 28,
    gap: 16,
  },
  brandHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 2,
  },
  brandLeftCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandRightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandProChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#7C3AED',
  },
  brandProChipText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  navUpgradePill: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
  },
  navBasicUpgradePill: {
    backgroundColor: '#F59E0B',
  },
  navBasicUpgradeText: {
    color: '#090D16',
    fontSize: 11.5,
    fontWeight: '800',
  },
  navProStatusPill: {
    backgroundColor: 'rgba(124, 58, 237, 0.16)',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  navProStatusText: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '800',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 4,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerText: {
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  greetingSmall: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  nameStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  heroCard: {
    borderRadius: 20,
    padding: 20,
    gap: 14,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  heroSub: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: -6,
  },
  primaryActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryButton: {
    flex: 1.35,
    paddingVertical: 13,
    borderRadius: 13,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryActionBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  createBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 13,
    gap: 12,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  joinCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingLeft: 14,
    paddingRight: 5,
    paddingVertical: 4,
    gap: 8,
  },
  joinCapsuleInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 8,
  },
  codeInput: {
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 13,
    paddingVertical: 10,
    fontSize: 14,
  },
  joinButton: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 9,
    alignItems: 'center',
  },
  joinButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  noticeBox: {
    borderRadius: 11,
    borderWidth: 1,
    padding: 11,
  },
  noticeText: {
    fontSize: 12,
    lineHeight: 17,
  },
  spotlightScroll: {
    gap: 12,
    paddingRight: 6,
  },
  spotlightTile: {
    width: 256,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    gap: 7,
    justifyContent: 'space-between',
  },
  spotlightTagPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  spotlightTagText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  spotlightTileTitle: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '800',
    lineHeight: 20,
    marginTop: 4,
  },
  spotlightTileCopy: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    lineHeight: 17,
  },
  spotlightTileCta: {
    color: '#FEF3C7',
    fontSize: 11.5,
    fontWeight: '800',
    marginTop: 4,
  },
  miniPlanRow: {
    gap: 6,
  },
  miniPlanLine: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  upgradeFullBtn: {
    marginTop: 4,
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  upgradeFullBtnText: {
    color: '#090D16',
    fontSize: 13.5,
    fontWeight: '800',
  },
  card: {
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    gap: 11,
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  linkText: {
    fontSize: 13,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  smallButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  smallButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 13,
    borderRadius: 13,
    borderWidth: 1,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  rowDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  inviteCardRow: {
    padding: 13,
    borderRadius: 13,
    borderWidth: 1,
    gap: 10,
  },
  inviteBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  acceptBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  declineBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  declineBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
