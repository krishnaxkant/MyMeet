import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BackButton } from '../components/BackButton';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import {
  buildMeetingInviteUrl,
  createSchedule,
  deleteSchedule,
  listSchedules,
  startSchedule,
  type ScheduledMeeting,
} from '../services/api';

interface ScheduleScreenProps {
  onBack: () => void;
  onOpenLobby: (code: string) => void;
}

const START_PRESETS = [
  { label: '+30 min', offsetMinutes: 30 },
  { label: '+1 hr', offsetMinutes: 60 },
  { label: '+3 hrs', offsetMinutes: 180 },
  { label: 'Tomorrow', offsetMinutes: 24 * 60 },
];

const DURATIONS = [30, 45, 60];

export function ScheduleScreen({ onBack, onOpenLobby }: ScheduleScreenProps) {
  const { session } = useAuth();
  const { colors } = useTheme();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [offsetMinutes, setOffsetMinutes] = useState(30);
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [waitingRoom, setWaitingRoom] = useState(false);
  const [inviteEmailsText, setInviteEmailsText] = useState('');

  const [schedules, setSchedules] = useState<ScheduledMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadSchedules = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const list = await listSchedules(session.access_token);
      setSchedules(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load scheduled meetings.');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    void loadSchedules();
  }, [loadSchedules]);

  const handleCreate = async () => {
    if (!session?.access_token) return;
    if (!title.trim()) {
      setError('Please enter a meeting title.');
      return;
    }

    setError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      const start = new Date(Date.now() + offsetMinutes * 60 * 1000);
      const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
      const inviteEmails = inviteEmailsText
        .split(/[\s,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await createSchedule(session.access_token, {
        title: title.trim(),
        description: description.trim() || undefined,
        scheduled_start: start.toISOString(),
        scheduled_end: end.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        waiting_room_enabled: waitingRoom,
        invite_emails: inviteEmails,
      });

      setSchedules((prev) =>
        [...prev, res.schedule].sort(
          (a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime(),
        ),
      );
      setTitle('');
      setDescription('');
      setInviteEmailsText('');
      setNotice(`Scheduled "${res.schedule.title}" (${res.schedule.meeting_code}).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to schedule meeting.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStart = async (item: ScheduledMeeting) => {
    if (!session?.access_token) return;
    setBusyId(item.id);
    try {
      const updated = await startSchedule(session.access_token, item.id);
      if (updated.meeting_code) {
        onOpenLobby(updated.meeting_code);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start meeting.');
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async (id: string) => {
    if (!session?.access_token) return;
    setBusyId(id);
    try {
      await deleteSchedule(session.access_token, id);
      setSchedules((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to cancel meeting.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.topBar}>
        <BackButton label="Back" onPress={onBack} />
        <Pressable
          style={[
            styles.secondaryButton,
            { backgroundColor: colors.surface, borderColor: colors.borderStrong },
          ]}
          onPress={() => void loadSchedules()}
          disabled={loading}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
            {loading ? 'Loading...' : 'Refresh'}
          </Text>
        </Pressable>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Schedule a Meeting</Text>

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
        {notice && (
          <View
            style={[
              styles.alert,
              { backgroundColor: colors.successBg, borderColor: colors.successBorder },
            ]}
          >
            <Text style={{ color: colors.successText, fontSize: 13 }}>{notice}</Text>
          </View>
        )}

        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.borderStrong,
              color: colors.text,
            },
          ]}
          value={title}
          onChangeText={setTitle}
          placeholder="Meeting title (e.g. Sprint Review)"
          placeholderTextColor={colors.placeholder}
        />

        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.borderStrong,
              color: colors.text,
            },
          ]}
          value={description}
          onChangeText={setDescription}
          placeholder="Agenda (optional)"
          placeholderTextColor={colors.placeholder}
        />

        <Text style={[styles.label, { color: colors.textMuted }]}>Start Time</Text>
        <View style={styles.chipRow}>
          {START_PRESETS.map((p) => (
            <Pressable
              key={p.label}
              style={[
                styles.chip,
                {
                  backgroundColor:
                    offsetMinutes === p.offsetMinutes ? colors.accent : colors.surfaceElevated,
                  borderColor:
                    offsetMinutes === p.offsetMinutes ? colors.accent : colors.borderStrong,
                },
              ]}
              onPress={() => setOffsetMinutes(p.offsetMinutes)}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: offsetMinutes === p.offsetMinutes ? '#ffffff' : colors.text },
                ]}
              >
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.textMuted }]}>Duration</Text>
        <View style={styles.chipRow}>
          {DURATIONS.map((mins) => (
            <Pressable
              key={mins}
              style={[
                styles.chip,
                {
                  backgroundColor:
                    durationMinutes === mins ? colors.accent : colors.surfaceElevated,
                  borderColor: durationMinutes === mins ? colors.accent : colors.borderStrong,
                },
              ]}
              onPress={() => setDurationMinutes(mins)}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: durationMinutes === mins ? '#ffffff' : colors.text },
                ]}
              >
                {mins} min
              </Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.borderStrong,
              color: colors.text,
            },
          ]}
          value={inviteEmailsText}
          onChangeText={setInviteEmailsText}
          placeholder="Invite emails (comma-separated, optional)"
          placeholderTextColor={colors.placeholder}
          autoCapitalize="none"
        />

        <View style={styles.switchRow}>
          <Text style={[styles.label, { color: colors.text }]}>Enable Waiting Room</Text>
          <Switch value={waitingRoom} onValueChange={setWaitingRoom} />
        </View>

        <Pressable
          style={[
            styles.primaryButton,
            { backgroundColor: colors.accent },
            submitting && styles.disabledBtn,
          ]}
          onPress={() => void handleCreate()}
          disabled={submitting}
        >
          <Text style={styles.primaryButtonText}>
            {submitting ? 'Scheduling...' : 'Schedule Meeting'}
          </Text>
        </Pressable>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>
          Upcoming Meetings ({schedules.length})
        </Text>

        {schedules.length === 0 ? (
          <Text style={[styles.subText, { color: colors.textMuted }]}>
            {loading ? 'Loading...' : 'No upcoming meetings scheduled.'}
          </Text>
        ) : (
          schedules.map((item) => (
            <View
              key={item.id}
              style={[
                styles.itemBox,
                { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
              ]}
            >
              <View style={styles.itemHeader}>
                <Text style={[styles.itemTitle, { color: colors.text }]}>{item.title}</Text>
                <StatusBadge
                  label={item.is_host ? 'Host' : 'Invited'}
                  tone={item.is_host ? 'success' : 'warning'}
                />
              </View>
              <Text style={[styles.subText, { color: colors.textMuted }]}>
                {new Date(item.scheduled_start).toLocaleString()} · Code: {item.meeting_code}
              </Text>
              <View style={styles.btnRow}>
                {item.meeting_code && (
                  <Pressable
                    style={[
                      styles.smallBtn,
                      { backgroundColor: colors.surface, borderColor: colors.borderStrong },
                    ]}
                    onPress={() =>
                      void Share.share({
                        title: `MyMeet: ${item.title}`,
                        message: `Scheduled MyMeet: "${item.title}"\nTime: ${new Date(
                          item.scheduled_start,
                        ).toLocaleString()}\n\nJoin Link: ${buildMeetingInviteUrl(
                          item.meeting_code!,
                        )}\nMeeting Code: ${item.meeting_code}`,
                        url: buildMeetingInviteUrl(item.meeting_code!),
                      })
                    }
                  >
                    <Text style={[styles.smallBtnText, { color: colors.text }]}>Share</Text>
                  </Pressable>
                )}

                {item.is_host ? (
                  <>
                    <Pressable
                      style={[styles.startBtn, { backgroundColor: colors.accent }]}
                      disabled={busyId === item.id}
                      onPress={() => void handleStart(item)}
                    >
                      <Text style={styles.startBtnText}>Start</Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.cancelBtn,
                        { backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder },
                      ]}
                      disabled={busyId === item.id}
                      onPress={() => void handleCancel(item.id)}
                    >
                      <Text style={[styles.smallBtnText, { color: colors.dangerText }]}>Cancel</Text>
                    </Pressable>
                  </>
                ) : item.meeting_code ? (
                  <Pressable
                    style={[styles.startBtn, { backgroundColor: colors.accent }]}
                    onPress={() => onOpenLobby(item.meeting_code!)}
                  >
                    <Text style={styles.startBtnText}>Open Lobby</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, gap: 16 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  secondaryButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  secondaryButtonText: { fontSize: 13, fontWeight: '600' },
  card: { borderRadius: 16, padding: 18, borderWidth: 1, gap: 12 },
  cardTitle: { fontSize: 17, fontWeight: '800' },
  label: { fontSize: 13, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 11, paddingHorizontal: 13, paddingVertical: 10, fontSize: 14 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9, borderWidth: 1 },
  chipText: { fontSize: 12, fontWeight: '700' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  primaryButton: { paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  primaryButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  disabledBtn: { opacity: 0.55 },
  alert: { padding: 12, borderRadius: 11, borderWidth: 1 },
  itemBox: { padding: 13, borderRadius: 12, borderWidth: 1, gap: 8 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  itemTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
  subText: { fontSize: 12 },
  btnRow: { flexDirection: 'row', gap: 8 },
  smallBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9, borderWidth: 1 },
  smallBtnText: { fontSize: 12, fontWeight: '700' },
  startBtn: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  startBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  cancelBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9, borderWidth: 1 },
});
