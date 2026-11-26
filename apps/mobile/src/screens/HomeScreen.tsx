import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { BrandLogo } from '../components/BrandLogo';
import { StatusBadge } from '../components/StatusBadge';
import { ThemeToggle } from '../components/ThemeToggle';
import { useAuth } from '../hooks/useAuth';
import { useBackendHealth } from '../hooks/useBackendHealth';
import { useTheme } from '../hooks/useTheme';
import {
  createMeeting,
  extractMeetingCode,
  listMeetings,
  listMyInvitations,
  listSchedules,
  respondToInvitation,
  startSchedule,
  type MeetingInvitation,
  type MeetingSummary,
  type ScheduledMeeting,
} from '../services/api';

interface HomeScreenProps {
  onOpenProfile: () => void;
  onOpenLobby: (code: string) => void;
  onOpenSchedule: () => void;
  onOpenHistory: (code?: string) => void;
}

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
      const [list, invites, upcoming] = await Promise.all([
        listMeetings(session.access_token),
        listMyInvitations(session.access_token).catch(() => []),
        listSchedules(session.access_token).catch(() => []),
      ]);
      setMeetings(list);
      setInvitations(invites);
      setSchedules(upcoming);
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

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.brandHeaderRow}>
        <BrandLogo size="sm" />
        <ThemeToggle />
      </View>

      <View style={styles.topBar}>
        <Pressable style={styles.brandRow} onPress={onOpenProfile}>
          <View style={[styles.avatar, { backgroundColor: colors.accent, overflow: 'hidden' }]}>
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
            <Text style={[styles.greetingSmall, { color: colors.textMuted }]}>
              {getGreeting()} · {clockText}
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
            borderColor: colors.border,
            shadowColor: colors.shadowColor,
          },
        ]}
      >
        <Text style={[styles.heroTitle, { color: colors.text }]}>
          Connect. Collaborate. Together.
        </Text>
        <Text style={[styles.heroSub, { color: colors.textMuted }]}>
          Start an instant MyMeet room, plan ahead with your team, or enter a meeting code.
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
                  <Text style={styles.acceptBtnText}>Accept & Join</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.declineBtn,
                    { backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder },
                  ]}
                  disabled={inviteBusyId === inv.id}
                  onPress={() => void handleRespondInvite(inv, 'declined')}
                >
                  <Text style={[styles.declineBtnText, { color: colors.dangerText }]}>Decline</Text>
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
    gap: 10,
    marginTop: 2,
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
    fontSize: 12,
    fontWeight: '500',
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
    borderWidth: 1,
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
