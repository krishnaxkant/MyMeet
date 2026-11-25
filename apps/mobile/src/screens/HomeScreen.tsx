import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { StatusBadge, type BadgeTone } from '../components/StatusBadge';
import { ThemeToggle } from '../components/ThemeToggle';
import { useAuth } from '../hooks/useAuth';
import { useBackendHealth } from '../hooks/useBackendHealth';
import { useTheme } from '../hooks/useTheme';
import {
  API_BASE_URL,
  createMeeting,
  extractMeetingCode,
  listMeetings,
  type MeetingSummary,
} from '../services/api';

interface HomeScreenProps {
  onOpenProfile: () => void;
  onOpenLobby: (code: string) => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'M';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function HomeScreen({ onOpenProfile, onOpenLobby }: HomeScreenProps) {
  const { session, user, profile, signOut } = useAuth();
  const { colors } = useTheme();
  const { data, loading, error, refresh } = useBackendHealth();

  const [meetingCode, setMeetingCode] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [waitingRoom, setWaitingRoom] = useState(false);
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [meetings, setMeetings] = useState<MeetingSummary[]>([]);
  const [meetingsLoading, setMeetingsLoading] = useState(true);

  const displayName =
    profile?.full_name ||
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split('@')[0] ||
    'User';

  const loadMeetings = useCallback(async () => {
    if (!session?.access_token) return;
    setMeetingsLoading(true);
    try {
      const list = await listMeetings(session.access_token);
      setMeetings(list);
    } catch (err) {
      console.warn('[mobile meetings] Failed to load recent meetings:', err);
    } finally {
      setMeetingsLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    void loadMeetings();
  }, [loadMeetings]);

  const handleCreateMeeting = async () => {
    if (!session?.access_token) return;
    setActionError(null);
    setCreating(true);
    try {
      const created = await createMeeting(session.access_token, {
        title: newTitle.trim() || `${displayName}'s Meeting`,
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

  const backendTone: BadgeTone = loading ? 'warning' : data ? 'success' : 'danger';
  const backendLabel = loading ? 'Checking' : data ? 'Online' : 'Offline';

  const supabaseTone: BadgeTone = loading
    ? 'warning'
    : !data
      ? 'warning'
      : data.supabase.status === 'connected'
        ? 'success'
        : data.supabase.status === 'not_configured'
          ? 'warning'
          : 'danger';

  const supabaseLabel = loading
    ? 'Checking'
    : !data
      ? 'Waiting'
      : data.supabase.status === 'connected'
        ? 'Connected'
        : data.supabase.status === 'not_configured'
          ? 'Needs Keys'
          : 'Error';

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <Pressable
            style={[styles.avatar, { backgroundColor: colors.accent }]}
            onPress={onOpenProfile}
          >
            <Text style={styles.avatarText}>{getInitials(displayName)}</Text>
          </Pressable>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
              Hi, {displayName}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>Meet Android</Text>
          </View>
        </View>
        <ThemeToggle />
      </View>

      <View
        style={[
          styles.heroCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.heroTitle, { color: colors.text }]}>Start or join a meeting</Text>
        <Text style={[styles.heroSub, { color: colors.textMuted }]}>
          Create an instant room with a secure code or enter a code from Meet Web.
        </Text>

        <Pressable
          style={[styles.primaryButton, { backgroundColor: colors.accent }]}
          onPress={() => setShowCreateForm((prev) => !prev)}
          disabled={creating}
        >
          <Text style={styles.primaryButtonText}>
            {showCreateForm ? 'Close New Meeting' : '+ New Meeting'}
          </Text>
        </Pressable>

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
              placeholder={`${displayName}'s Meeting`}
              placeholderTextColor={colors.placeholder}
            />

            <View style={styles.switchRow}>
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: colors.text }]}>Waiting Room</Text>
                <Text style={[styles.rowDesc, { color: colors.textMuted }]}>
                  Host approves guests before entry
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

        <View style={styles.joinRow}>
          <TextInput
            style={[
              styles.codeInput,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.borderStrong,
                color: colors.text,
              },
            ]}
            value={meetingCode}
            onChangeText={setMeetingCode}
            placeholder="Enter meeting code or link"
            placeholderTextColor={colors.placeholder}
            autoCapitalize="none"
          />
          <Pressable
            style={[
              styles.joinButton,
              {
                backgroundColor: colors.accentSoft,
                borderColor: colors.accentBorder,
              },
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

      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Recent Meetings</Text>
          <Pressable
            style={[
              styles.smallButton,
              { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
              meetingsLoading && styles.buttonDisabled,
            ]}
            onPress={() => void loadMeetings()}
            disabled={meetingsLoading}
          >
            <Text style={[styles.smallButtonText, { color: colors.text }]}>
              {meetingsLoading ? 'Loading...' : 'Refresh'}
            </Text>
          </Pressable>
        </View>

        {meetings.length === 0 ? (
          <Text style={[styles.rowDesc, { color: colors.textMuted }]}>
            {meetingsLoading
              ? 'Loading your meetings...'
              : 'No meetings yet. Tap + New Meeting to start your first room.'}
          </Text>
        ) : (
          meetings.slice(0, 5).map((m) => (
            <Pressable
              key={m.id}
              style={[
                styles.row,
                { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
              ]}
              onPress={() => onOpenLobby(m.code)}
            >
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                  {m.title}
                </Text>
                <Text style={[styles.rowDesc, { color: colors.textMuted }]}>
                  {m.code} · {m.joined_count} in call{m.my_role === 'host' ? ' · Host' : ''}
                </Text>
              </View>
              <StatusBadge
                label={m.status}
                tone={
                  m.status === 'active'
                    ? 'success'
                    : m.status === 'ended'
                      ? 'danger'
                      : 'warning'
                }
              />
            </Pressable>
          ))
        )}
      </View>

      <View style={styles.quickRow}>
        <Pressable
          style={[
            styles.secondaryButton,
            { backgroundColor: colors.surface, borderColor: colors.borderStrong },
          ]}
          onPress={onOpenProfile}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
            Profile & Theme
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.signOutPill,
            { backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder },
          ]}
          onPress={() => void signOut()}
        >
          <Text style={[styles.signOutPillText, { color: colors.dangerText }]}>Sign Out</Text>
        </Pressable>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>System Health</Text>
          <Pressable
            style={[
              styles.smallButton,
              { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
              loading && styles.buttonDisabled,
            ]}
            onPress={() => void refresh()}
            disabled={loading}
          >
            <Text style={[styles.smallButtonText, { color: colors.text }]}>
              {loading ? 'Checking...' : 'Refresh'}
            </Text>
          </Pressable>
        </View>

        <View
          style={[
            styles.row,
            { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
          ]}
        >
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>Meet Backend API</Text>
            <Text style={[styles.rowDesc, { color: colors.textMuted }]}>
              {error ? `${API_BASE_URL} — ${error}` : `${API_BASE_URL}/api/health`}
            </Text>
          </View>
          <StatusBadge label={backendLabel} tone={backendTone} />
        </View>

        <View
          style={[
            styles.row,
            { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
          ]}
        >
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>Supabase</Text>
            <Text style={[styles.rowDesc, { color: colors.textMuted }]}>
              {data
                ? data.supabase.message
                : 'Start the Node.js backend to inspect Supabase status.'}
            </Text>
          </View>
          <StatusBadge label={supabaseLabel} tone={supabaseTone} />
        </View>

        <View
          style={[
            styles.row,
            { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
          ]}
        >
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>LiveKit SFU</Text>
            <Text style={[styles.rowDesc, { color: colors.textMuted }]}>
              {!data
                ? 'Start/connect the backend to inspect LiveKit status.'
                : data.livekit
                  ? data.livekit.message
                  : 'Add LiveKit keys to .env for live video streaming.'}
            </Text>
          </View>
          <StatusBadge
            label={!data ? 'Waiting' : data.livekit?.status === 'configured' ? 'Ready' : 'Needs Keys'}
            tone={data?.livekit?.status === 'configured' ? 'success' : 'warning'}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 18,
    gap: 16,
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
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  heroCard: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    gap: 12,
  },
  heroTitle: {
    fontSize: 19,
    fontWeight: '800',
  },
  heroSub: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: -4,
  },
  createBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 12,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  primaryButton: {
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  joinRow: {
    flexDirection: 'row',
    gap: 10,
  },
  codeInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
  },
  joinButton: {
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  joinButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  noticeBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 11,
  },
  noticeText: {
    fontSize: 12,
    lineHeight: 17,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  signOutPill: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  signOutPillText: {
    fontSize: 14,
    fontWeight: '700',
  },
  card: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  smallButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
    borderWidth: 1,
  },
  smallButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 13,
    borderRadius: 12,
    borderWidth: 1,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  rowDesc: {
    fontSize: 12,
    marginTop: 2,
  },
});
