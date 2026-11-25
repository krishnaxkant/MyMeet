import { useCallback, useEffect, useRef, useState } from 'react';
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
import { getMeeting, joinMeeting, type MeetingDetail } from '../services/api';

interface MeetingLobbyScreenProps {
  code: string;
  onBack: () => void;
  onEnterRoom: (params: { code: string; micEnabled: boolean; camEnabled: boolean }) => void;
}

export function MeetingLobbyScreen({ code, onBack, onEnterRoom }: MeetingLobbyScreenProps) {
  const { session } = useAuth();
  const { colors } = useTheme();

  const [meeting, setMeeting] = useState<MeetingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(false);

  const loadMeeting = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const detail = await getMeeting(session.access_token, code);
      setMeeting(detail);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load meeting.');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, code]);

  useEffect(() => {
    setLoading(true);
    void loadMeeting();
  }, [loadMeeting]);

  useEffect(() => {
    if (meeting?.my_status !== 'waiting' || meeting.status !== 'active') return;
    const interval = setInterval(() => {
      void loadMeeting();
    }, 3000);
    return () => clearInterval(interval);
  }, [meeting?.my_status, meeting?.status, loadMeeting]);

  const wasWaitingRef = useRef(false);
  useEffect(() => {
    if (meeting?.my_status === 'waiting') {
      wasWaitingRef.current = true;
    } else if (wasWaitingRef.current && meeting?.my_status === 'joined') {
      wasWaitingRef.current = false;
      onEnterRoom({ code: meeting.code, micEnabled, camEnabled });
    }
  }, [meeting?.my_status, meeting?.code, onEnterRoom, micEnabled, camEnabled]);

  const handleShare = async () => {
    if (!meeting) return;
    await Share.share({
      message: `Join my Meet call "${meeting.title}" using code: ${meeting.code}`,
    }).catch(() => {});
  };

  const handleJoin = async () => {
    if (!session?.access_token || !meeting) return;
    setError(null);
    setJoining(true);
    try {
      const updated = await joinMeeting(session.access_token, meeting.code);
      setMeeting(updated);
      if (updated.my_status === 'joined') {
        onEnterRoom({ code: updated.code, micEnabled, camEnabled });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to join meeting.');
    } finally {
      setJoining(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.topBar}>
        <Pressable
          style={[
            styles.secondaryButton,
            { backgroundColor: colors.surface, borderColor: colors.borderStrong },
          ]}
          onPress={onBack}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.text }]}>← Dashboard</Text>
        </Pressable>
        {meeting && (
          <Pressable
            style={[
              styles.secondaryButton,
              { backgroundColor: colors.surface, borderColor: colors.borderStrong },
            ]}
            onPress={() => void handleShare()}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Share Code</Text>
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.centerText, { color: colors.textMuted }]}>
            Loading meeting lobby...
          </Text>
        </View>
      ) : !meeting ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>Meeting unavailable</Text>
          <Text style={[styles.alertText, { color: colors.dangerText }]}>
            {error ?? 'Meeting not found.'}
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.previewBox}>
            <Text style={styles.previewBadge}>
              {camEnabled ? 'Camera Ready (Phase 4 LiveKit)' : 'Camera Off'}
            </Text>
            <View style={styles.mediaRow}>
              <Pressable
                style={[styles.mediaToggle, micEnabled ? styles.mediaOn : styles.mediaOff]}
                onPress={() => setMicEnabled((prev) => !prev)}
              >
                <Text style={styles.mediaText}>{micEnabled ? 'Mic On' : 'Mic Off'}</Text>
              </Pressable>
              <Pressable
                style={[styles.mediaToggle, camEnabled ? styles.mediaOn : styles.mediaOff]}
                onPress={() => setCamEnabled((prev) => !prev)}
              >
                <Text style={styles.mediaText}>{camEnabled ? 'Cam On' : 'Cam Off'}</Text>
              </Pressable>
            </View>
          </View>

          <View
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <View style={styles.headerRow}>
              <StatusBadge
                label={
                  meeting.status === 'ended'
                    ? 'Ended'
                    : meeting.is_host
                      ? 'Host'
                      : 'Lobby'
                }
                tone={
                  meeting.status === 'ended'
                    ? 'danger'
                    : meeting.is_host
                      ? 'success'
                      : 'warning'
                }
              />
              <Text style={[styles.metaText, { color: colors.textMuted }]}>
                {meeting.joined_count} in call
              </Text>
            </View>

            <Text style={[styles.title, { color: colors.text }]}>{meeting.title}</Text>
            <Text style={[styles.metaText, { color: colors.textMuted }]}>
              Hosted by {meeting.host_name || meeting.host_email || 'Meet Host'}
            </Text>

            <View
              style={[
                styles.codeBox,
                { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.codeLabel, { color: colors.textSubtle }]}>MEETING CODE</Text>
              <Text style={[styles.codeValue, { color: colors.text }]}>{meeting.code}</Text>
            </View>

            {error && (
              <View
                style={[
                  styles.alert,
                  { backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder },
                ]}
              >
                <Text style={[styles.alertText, { color: colors.dangerText }]}>{error}</Text>
              </View>
            )}

            {meeting.status === 'ended' && (
              <View
                style={[
                  styles.alert,
                  { backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder },
                ]}
              >
                <Text style={[styles.alertText, { color: colors.dangerText }]}>
                  This meeting has ended.
                </Text>
              </View>
            )}

            {meeting.my_status === 'removed' && !meeting.is_host && (
              <View
                style={[
                  styles.alert,
                  { backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder },
                ]}
              >
                <Text style={[styles.alertText, { color: colors.dangerText }]}>
                  You were removed from this meeting by the host.
                </Text>
              </View>
            )}

            {meeting.is_locked && !meeting.is_host && meeting.my_status !== 'joined' && (
              <View
                style={[
                  styles.alert,
                  { backgroundColor: colors.warningBg, borderColor: colors.warningBorder },
                ]}
              >
                <Text style={[styles.alertText, { color: colors.warningText }]}>
                  This meeting is locked by the host.
                </Text>
              </View>
            )}

            {meeting.my_status === 'waiting' && meeting.status === 'active' && (
              <View
                style={[
                  styles.alert,
                  { backgroundColor: colors.warningBg, borderColor: colors.warningBorder },
                ]}
              >
                <Text style={[styles.alertText, { color: colors.warningText }]}>
                  Waiting for the host to admit you... You&apos;ll enter automatically when
                  approved.
                </Text>
              </View>
            )}

            <Pressable
              style={[
                styles.primaryButton,
                { backgroundColor: colors.accent },
                (joining ||
                  meeting.status === 'ended' ||
                  (meeting.my_status === 'removed' && !meeting.is_host) ||
                  (meeting.is_locked && !meeting.is_host && meeting.my_status !== 'joined') ||
                  meeting.my_status === 'waiting') &&
                  styles.buttonDisabled,
              ]}
              disabled={
                joining ||
                meeting.status === 'ended' ||
                (meeting.my_status === 'removed' && !meeting.is_host) ||
                (meeting.is_locked && !meeting.is_host && meeting.my_status !== 'joined') ||
                meeting.my_status === 'waiting'
              }
              onPress={() => void handleJoin()}
            >
              <Text style={styles.primaryButtonText}>
                {joining
                  ? 'Joining...'
                  : meeting.my_status === 'waiting'
                    ? 'Waiting for Host...'
                    : meeting.is_host
                      ? 'Enter Meeting as Host'
                      : meeting.waiting_room_enabled && meeting.my_status !== 'joined'
                        ? 'Ask to Join'
                        : 'Join Now'}
              </Text>
            </Pressable>
          </View>
        </>
      )}
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
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  secondaryButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  previewBox: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    height: 190,
    padding: 16,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewBadge: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 42,
  },
  mediaRow: {
    flexDirection: 'row',
    gap: 12,
  },
  mediaToggle: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 999,
  },
  mediaOn: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  mediaOff: {
    backgroundColor: '#dc2626',
  },
  mediaText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  card: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  metaText: {
    fontSize: 13,
  },
  centerText: {
    textAlign: 'center',
    fontSize: 14,
  },
  codeBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  codeLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  codeValue: {
    fontSize: 17,
    fontWeight: '800',
    marginTop: 2,
  },
  alert: {
    padding: 12,
    borderRadius: 11,
    borderWidth: 1,
  },
  alertText: {
    fontSize: 13,
  },
  primaryButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
