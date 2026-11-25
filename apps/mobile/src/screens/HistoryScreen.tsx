import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import {
  getHistoryDetail,
  listHistory,
  type MeetingHistoryDetail,
  type MeetingHistoryItem,
} from '../services/api';

interface HistoryScreenProps {
  onBack: () => void;
  onOpenLobby: (code: string) => void;
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}

export function HistoryScreen({ onBack, onOpenLobby }: HistoryScreenProps) {
  const { session } = useAuth();
  const { colors } = useTheme();

  const [items, setItems] = useState<MeetingHistoryItem[]>([]);
  const [selected, setSelected] = useState<MeetingHistoryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
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

  const handleInspect = async (code: string) => {
    if (!session?.access_token) return;
    setDetailLoading(true);
    try {
      const detail = await getHistoryDetail(session.access_token, code);
      setSelected(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load meeting summary.');
    } finally {
      setDetailLoading(false);
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
          onPress={selected ? () => setSelected(null) : onBack}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
            {selected ? '← History List' : '← Dashboard'}
          </Text>
        </Pressable>
        {!selected && (
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
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{selected.title}</Text>
          <Text style={[styles.subText, { color: colors.textMuted }]}>
            {selected.code} · Duration {formatDuration(selected.duration_seconds)} ·{' '}
            {new Date(selected.created_at).toLocaleString()}
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Participants ({selected.participants.length})
          </Text>
          {selected.participants.map((p) => (
            <View
              key={p.id}
              style={[
                styles.itemRow,
                { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
              ]}
            >
              <View style={styles.flex1}>
                <Text style={[styles.itemTitle, { color: colors.text }]}>
                  {p.full_name || p.email}
                </Text>
                <Text style={[styles.subText, { color: colors.textMuted }]}>
                  Joined {new Date(p.joined_at).toLocaleTimeString()}
                </Text>
              </View>
              <StatusBadge label={p.role} tone={p.role === 'host' ? 'success' : 'warning'} />
            </View>
          ))}

          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Saved Chat ({selected.messages.length})
          </Text>
          {selected.messages.length === 0 ? (
            <Text style={[styles.subText, { color: colors.textMuted }]}>
              No chat messages in this meeting.
            </Text>
          ) : (
            selected.messages.map((m) => (
              <View
                key={m.id}
                style={[
                  styles.chatRow,
                  { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.subText, { color: colors.textSubtle }]}>
                  {m.sender_name || m.sender_email} · {new Date(m.created_at).toLocaleTimeString()}
                </Text>
                <Text style={{ color: colors.text, fontSize: 13 }}>{m.content}</Text>
              </View>
            ))
          )}
        </View>
      ) : (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Meeting History ({items.length})
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
                  {item.code} · {formatDuration(item.duration_seconds)} · {item.participant_count}{' '}
                  people · {item.message_count} msgs
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
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, gap: 16 },
  flex1: { flex: 1 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  secondaryButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  secondaryButtonText: { fontSize: 13, fontWeight: '600' },
  card: { borderRadius: 16, padding: 18, borderWidth: 1, gap: 12 },
  cardTitle: { fontSize: 18, fontWeight: '800' },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginTop: 6 },
  itemBox: { padding: 13, borderRadius: 12, borderWidth: 1, gap: 6 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 11,
    borderRadius: 10,
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
  subText: { fontSize: 12 },
  chatRow: { padding: 10, borderRadius: 10, borderWidth: 1, gap: 4 },
  rejoinBtn: { marginTop: 4, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  rejoinText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  alert: { padding: 12, borderRadius: 11, borderWidth: 1 },
});
