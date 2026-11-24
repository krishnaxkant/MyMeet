import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBadge, type BadgeTone } from '../components/StatusBadge';
import { ThemeToggle } from '../components/ThemeToggle';
import { useAuth } from '../hooks/useAuth';
import { useBackendHealth } from '../hooks/useBackendHealth';
import { useTheme } from '../hooks/useTheme';
import { API_BASE_URL } from '../services/api';

interface HomeScreenProps {
  onOpenProfile: () => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'M';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function HomeScreen({ onOpenProfile }: HomeScreenProps) {
  const { user, profile, signOut } = useAuth();
  const { colors } = useTheme();
  const { data, loading, error, refresh } = useBackendHealth();
  const [meetingCode, setMeetingCode] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const displayName =
    profile?.full_name ||
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split('@')[0] ||
    'User';

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
        <Text style={[styles.heroTitle, { color: colors.text }]}>
          Start or join a meeting
        </Text>
        <Text style={[styles.heroSub, { color: colors.textMuted }]}>
          Secure audio & video calls synced across Meet Web and Android.
        </Text>

        <Pressable
          style={[styles.primaryButton, { backgroundColor: colors.accent }]}
          onPress={() => setNotice('Creating a new meeting unlocks in Phase 3.')}
        >
          <Text style={styles.primaryButtonText}>+ New Meeting</Text>
        </Pressable>

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
            placeholder="Enter meeting code"
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
            onPress={() => setNotice(`Joining "${meetingCode.trim()}" unlocks in Phase 3.`)}
          >
            <Text style={[styles.joinButtonText, { color: colors.accentText }]}>Join</Text>
          </Pressable>
        </View>

        {notice && (
          <View
            style={[
              styles.noticeBox,
              { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.noticeText, { color: colors.textMuted }]}>{notice}</Text>
          </View>
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
            <Text style={[styles.rowTitle, { color: colors.text }]}>Session & Profile</Text>
            <Text style={[styles.rowDesc, { color: colors.textMuted }]}>
              {profile ? `Synced as ${profile.email}` : user?.email ?? 'Signed in'}
            </Text>
          </View>
          <StatusBadge label={profile ? 'Synced' : 'Active'} tone="success" />
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
    alignItems: 'flex-start',
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
