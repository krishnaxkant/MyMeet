import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import {
  admitParticipant,
  endMeeting,
  getMeeting,
  leaveMeeting,
  removeParticipant,
  updateMeetingSettings,
  type MeetingDetail,
} from '../services/api';

interface MeetingRoomScreenProps {
  code: string;
  initialMicEnabled: boolean;
  initialCamEnabled: boolean;
  onExit: () => void;
  onBackToLobby: (code: string) => void;
}

export function MeetingRoomScreen({
  code,
  initialMicEnabled,
  initialCamEnabled,
  onExit,
  onBackToLobby,
}: MeetingRoomScreenProps) {
  const { session, user } = useAuth();
  const { colors } = useTheme();

  const [meeting, setMeeting] = useState<MeetingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [micEnabled, setMicEnabled] = useState(initialMicEnabled);
  const [camEnabled, setCamEnabled] = useState(initialCamEnabled);

  const loadRoom = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const detail = await getMeeting(session.access_token, code);
      setMeeting(detail);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sync meeting.');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, code]);

  useEffect(() => {
    void loadRoom();
    const timer = setInterval(() => {
      void loadRoom();
    }, 3000);
    return () => clearInterval(timer);
  }, [loadRoom]);

  useEffect(() => {
    if (!meeting || meeting.status === 'ended') return;
    if (!meeting.is_host && meeting.my_status !== 'joined') {
      onBackToLobby(meeting.code);
    }
  }, [meeting, onBackToLobby]);

  const handleShare = async () => {
    if (!meeting) return;
    await Share.share({
      message: `Join my Meet call "${meeting.title}" using code: ${meeting.code}`,
    }).catch(() => {});
  };

  const handleLeave = async () => {
    if (session?.access_token && meeting) {
      setBusy(true);
      await leaveMeeting(session.access_token, meeting.code).catch(() => {});
    }
    onExit();
  };

  const handleToggleLock = async () => {
    if (!session?.access_token || !meeting) return;
    setBusy(true);
    try {
      const updated = await updateMeetingSettings(session.access_token, meeting.code, {
        is_locked: !meeting.is_locked,
      });
      setMeeting(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update lock.');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleWaitingRoom = async () => {
    if (!session?.access_token || !meeting) return;
    setBusy(true);
    try {
      const updated = await updateMeetingSettings(session.access_token, meeting.code, {
        waiting_room_enabled: !meeting.waiting_room_enabled,
      });
      setMeeting(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update waiting room.');
    } finally {
      setBusy(false);
    }
  };

  const handleAdmit = async (userId: string) => {
    if (!session?.access_token || !meeting) return;
    setBusy(true);
    try {
      const updated = await admitParticipant(session.access_token, meeting.code, userId);
      setMeeting(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to admit participant.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (userId: string) => {
    if (!session?.access_token || !meeting) return;
    setBusy(true);
    try {
      const updated = await removeParticipant(session.access_token, meeting.code, userId);
      setMeeting(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove participant.');
    } finally {
      setBusy(false);
    }
  };

  const handleEndForAll = async () => {
    if (!session?.access_token || !meeting) return;
    setBusy(true);
    try {
      const updated = await endMeeting(session.access_token, meeting.code);
      setMeeting(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to end meeting.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.subText, { color: colors.textMuted }]}>Joining room...</Text>
      </View>
    );
  }

  if (!meeting || meeting.status === 'ended') {
    return (
      <View style={styles.center}>
        <Text style={[styles.title, { color: colors.text }]}>
          {meeting ? 'Meeting Ended' : 'Meeting Unavailable'}
        </Text>
        <Text style={[styles.subText, { color: colors.textMuted }]}>
          {meeting
            ? `${meeting.title} has been ended by the host.`
            : error ?? 'Unable to load meeting.'}
        </Text>
        <Pressable style={[styles.primaryButton, { backgroundColor: colors.accent }]} onPress={onExit}>
          <Text style={styles.primaryButtonText}>Back to Dashboard</Text>
        </Pressable>
      </View>
    );
  }

  const joined = meeting.participants.filter((p) => p.status === 'joined');
  const waiting = meeting.participants.filter((p) => p.status === 'waiting');

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.headerRow}>
          <View style={styles.flex1}>
            <Text style={[styles.title, { color: colors.text }]}>{meeting.title}</Text>
            <Text style={[styles.subText, { color: colors.textMuted }]}>
              {meeting.code} · {joined.length} in call
            </Text>
          </View>
          <Pressable
            style={[
              styles.smallBtn,
              { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
            ]}
            onPress={() => void handleShare()}
          >
            <Text style={[styles.smallBtnText, { color: colors.text }]}>Share</Text>
          </Pressable>
        </View>

        <View style={styles.mediaRow}>
          <Pressable
            style={[styles.mediaBtn, micEnabled ? styles.mediaOn : styles.mediaOff]}
            onPress={() => setMicEnabled((p) => !p)}
          >
            <Text style={styles.mediaText}>{micEnabled ? 'Mic On' : 'Muted'}</Text>
          </Pressable>
          <Pressable
            style={[styles.mediaBtn, camEnabled ? styles.mediaOn : styles.mediaOff]}
            onPress={() => setCamEnabled((p) => !p)}
          >
            <Text style={styles.mediaText}>{camEnabled ? 'Cam On' : 'Cam Off'}</Text>
          </Pressable>
        </View>
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

      {meeting.is_host && (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Host Controls</Text>
          <View style={styles.hostRow}>
            <Pressable
              style={[
                styles.hostBtn,
                { backgroundColor: colors.surfaceElevated, borderColor: colors.borderStrong },
              ]}
              disabled={busy}
              onPress={() => void handleToggleLock()}
            >
              <Text style={[styles.hostBtnText, { color: colors.text }]}>
                {meeting.is_locked ? 'Unlock Room' : 'Lock Room'}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.hostBtn,
                { backgroundColor: colors.surfaceElevated, borderColor: colors.borderStrong },
              ]}
              disabled={busy}
              onPress={() => void handleToggleWaitingRoom()}
            >
              <Text style={[styles.hostBtnText, { color: colors.text }]}>
                {meeting.waiting_room_enabled ? 'Waiting: ON' : 'Waiting: OFF'}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {meeting.is_host && waiting.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Waiting Room ({waiting.length})
          </Text>
          {waiting.map((p) => (
            <View
              key={p.id}
              style={[
                styles.rosterRow,
                { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
              ]}
            >
              <View style={styles.flex1}>
                <Text style={[styles.rosterName, { color: colors.text }]}>
                  {p.full_name || p.email}
                </Text>
                <Text style={[styles.subText, { color: colors.textMuted }]}>Waiting to join</Text>
              </View>
              <Pressable
                style={[styles.admitBtn, { backgroundColor: colors.accent }]}
                disabled={busy}
                onPress={() => void handleAdmit(p.user_id)}
              >
                <Text style={styles.admitText}>Admit</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.denyBtn,
                  { backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder },
                ]}
                disabled={busy}
                onPress={() => void handleRemove(p.user_id)}
              >
                <Text style={[styles.denyText, { color: colors.dangerText }]}>Deny</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Participants ({joined.length})
        </Text>
        {joined.map((p) => {
          const isMe = p.user_id === user?.id;
          return (
            <View
              key={p.id}
              style={[
                styles.rosterRow,
                { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
              ]}
            >
              <View style={styles.flex1}>
                <Text style={[styles.rosterName, { color: colors.text }]}>
                  {p.full_name || p.email} {isMe ? '(You)' : ''}
                </Text>
                <Text style={[styles.subText, { color: colors.textMuted }]}>
                  {p.role === 'host' ? 'Host' : 'Participant'}
                </Text>
              </View>
              {p.role === 'host' ? (
                <StatusBadge label="Host" tone="success" />
              ) : meeting.is_host && !isMe ? (
                <Pressable
                  style={[
                    styles.denyBtn,
                    { backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder },
                  ]}
                  disabled={busy}
                  onPress={() => void handleRemove(p.user_id)}
                >
                  <Text style={[styles.denyText, { color: colors.dangerText }]}>Remove</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>

      <View style={styles.exitRow}>
        <Pressable
          style={[
            styles.leaveBtn,
            { backgroundColor: colors.surface, borderColor: colors.borderStrong },
          ]}
          disabled={busy}
          onPress={() => void handleLeave()}
        >
          <Text style={[styles.leaveText, { color: colors.text }]}>Leave Meeting</Text>
        </Pressable>

        {meeting.is_host && (
          <Pressable
            style={styles.endAllBtn}
            disabled={busy}
            onPress={() => void handleEndForAll()}
          >
            <Text style={styles.endAllText}>End for All</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 18,
    gap: 14,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  flex1: {
    flex: 1,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  subText: {
    fontSize: 12,
    marginTop: 2,
  },
  smallBtn: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 9,
    borderWidth: 1,
  },
  smallBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  mediaRow: {
    flexDirection: 'row',
    gap: 10,
  },
  mediaBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 11,
    alignItems: 'center',
  },
  mediaOn: {
    backgroundColor: '#1e293b',
  },
  mediaOff: {
    backgroundColor: '#dc2626',
  },
  mediaText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  hostRow: {
    flexDirection: 'row',
    gap: 10,
  },
  hostBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  hostBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  rosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 11,
    borderWidth: 1,
  },
  rosterName: {
    fontSize: 14,
    fontWeight: '600',
  },
  admitBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  admitText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  denyBtn: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  denyText: {
    fontSize: 12,
    fontWeight: '700',
  },
  exitRow: {
    flexDirection: 'row',
    gap: 10,
  },
  leaveBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  leaveText: {
    fontSize: 14,
    fontWeight: '700',
  },
  endAllBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#dc2626',
    alignItems: 'center',
  },
  endAllText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  primaryButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  alert: {
    padding: 12,
    borderRadius: 11,
    borderWidth: 1,
  },
});
