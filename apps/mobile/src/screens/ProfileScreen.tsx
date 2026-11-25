import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBadge, type BadgeTone } from '../components/StatusBadge';
import { useAuth } from '../hooks/useAuth';
import { useBackendHealth } from '../hooks/useBackendHealth';
import { useTheme } from '../hooks/useTheme';
import {
  API_BASE_URL,
  deleteDevice,
  listDevices,
  registerDevice,
  type UserDevice,
} from '../services/api';

interface ProfileScreenProps {
  onBack: () => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'M';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function ProfileScreen({ onBack }: ProfileScreenProps) {
  const { session, user, profile, profileLoading, saveProfile, refreshProfile, signOut } = useAuth();
  const { theme, colors, setTheme } = useTheme();
  const { data: health, loading: healthLoading, error: healthError, refresh: refreshHealth } =
    useBackendHealth();

  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [devices, setDevices] = useState<UserDevice[]>([]);
  const [deviceBusy, setDeviceBusy] = useState(false);

  const loadDevices = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const list = await listDevices(session.access_token);
      setDevices(list);
    } catch {
      // Ignore transient errors
    }
  }, [session?.access_token]);

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  useEffect(() => {
    setFullName(profile?.full_name ?? (user?.user_metadata?.full_name as string | undefined) ?? '');
    setAvatarUrl(profile?.avatar_url ?? '');
  }, [profile, user]);

  const displayName = fullName.trim() || user?.email || 'Meet User';

  const handleSave = async () => {
    setError(null);
    setSavedNotice(null);
    setSaving(true);
    try {
      await saveProfile({
        full_name: fullName.trim() || null,
        avatar_url: avatarUrl.trim() || null,
      });
      setSavedNotice('Profile saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleRegisterMobileDevice = async () => {
    if (!session?.access_token) return;
    setDeviceBusy(true);
    setError(null);
    try {
      const platform = Platform.OS === 'ios' ? 'ios' : 'android';
      const tokenId = `mobile-${platform}-${user?.id?.slice(0, 8) ?? 'device'}`;
      await registerDevice(session.access_token, {
        platform,
        push_token: tokenId,
        device_name: `Meet ${platform.toUpperCase()} Phone`,
      });
      await loadDevices();
      setSavedNotice('Device registered for meeting notifications.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to register device.');
    } finally {
      setDeviceBusy(false);
    }
  };

  const handleRemoveDevice = async (id: string) => {
    if (!session?.access_token) return;
    setDeviceBusy(true);
    try {
      await deleteDevice(session.access_token, id);
      setDevices((prev) => prev.filter((d) => d.id !== id));
    } finally {
      setDeviceBusy(false);
    }
  };

  const backendTone: BadgeTone = healthLoading ? 'warning' : health ? 'success' : 'danger';
  const backendLabel = healthLoading ? 'Checking' : health ? 'Online' : 'Offline';
  const supabaseTone: BadgeTone = healthLoading
    ? 'warning'
    : !health
      ? 'warning'
      : health.supabase.status === 'connected'
        ? 'success'
        : health.supabase.status === 'not_configured'
          ? 'warning'
          : 'danger';
  const supabaseLabel = healthLoading
    ? 'Checking'
    : !health
      ? 'Waiting'
      : health.supabase.status === 'connected'
        ? 'Connected'
        : health.supabase.status === 'not_configured'
          ? 'Needs Keys'
          : 'Error';

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.topBar}>
        <Text style={[styles.screenTitle, { color: colors.text }]}>Profile & Settings</Text>
        <Pressable
          style={[
            styles.secondaryButton,
            { backgroundColor: colors.surface, borderColor: colors.borderStrong },
          ]}
          onPress={() => void refreshProfile()}
          disabled={profileLoading}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
            {profileLoading ? 'Syncing...' : 'Sync'}
          </Text>
        </Pressable>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.profileHeader}>
          <View style={[styles.avatarLg, { backgroundColor: colors.accent }]}>
            <Text style={styles.avatarLgText}>{getInitials(displayName)}</Text>
          </View>
          <View style={styles.flex1}>
            <Text style={[styles.profileName, { color: colors.text }]}>{displayName}</Text>
            <Text style={[styles.profileEmail, { color: colors.textMuted }]}>
              {profile?.email ?? user?.email ?? ''}
            </Text>
          </View>
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

        {savedNotice && (
          <View
            style={[
              styles.alert,
              { backgroundColor: colors.successBg, borderColor: colors.successBorder },
            ]}
          >
            <Text style={[styles.alertText, { color: colors.successText }]}>{savedNotice}</Text>
          </View>
        )}

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textMuted }]}>Display name</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.borderStrong,
                color: colors.text,
              },
            ]}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Your display name"
            placeholderTextColor={colors.placeholder}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textMuted }]}>Avatar URL (optional)</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.borderStrong,
                color: colors.text,
              },
            ]}
            value={avatarUrl}
            onChangeText={setAvatarUrl}
            placeholder="https://example.com/avatar.png"
            placeholderTextColor={colors.placeholder}
            autoCapitalize="none"
          />
        </View>

        <Pressable
          style={[
            styles.primaryButton,
            { backgroundColor: colors.accent },
            saving && styles.buttonDisabled,
          ]}
          onPress={() => void handleSave()}
          disabled={saving}
        >
          <Text style={styles.primaryButtonText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
        </Pressable>

        <Pressable
          style={[
            styles.signOutButton,
            { backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder },
          ]}
          onPress={() => void signOut()}
        >
          <Text style={[styles.signOutText, { color: colors.dangerText }]}>Sign Out</Text>
        </Pressable>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Appearance</Text>
        <View style={styles.themeRow}>
          <Pressable
            style={[
              styles.themeOption,
              {
                backgroundColor: theme === 'light' ? colors.accentSoft : colors.surfaceElevated,
                borderColor: theme === 'light' ? colors.accent : colors.border,
              },
            ]}
            onPress={() => setTheme('light')}
          >
            <View style={[styles.swatch, styles.swatchLight]} />
            <Text style={[styles.themeLabel, { color: colors.text }]}>☀ Light Theme</Text>
            <Text style={[styles.themeDesc, { color: colors.textMuted }]}>Daylight studio</Text>
          </Pressable>

          <Pressable
            style={[
              styles.themeOption,
              {
                backgroundColor: theme === 'dark' ? colors.accentSoft : colors.surfaceElevated,
                borderColor: theme === 'dark' ? colors.accent : colors.border,
              },
            ]}
            onPress={() => setTheme('dark')}
          >
            <View style={[styles.swatch, styles.swatchDark]} />
            <Text style={[styles.themeLabel, { color: colors.text }]}>☾ Dark Theme</Text>
            <Text style={[styles.themeDesc, { color: colors.textMuted }]}>Midnight studio</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.topBar}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Notification Devices</Text>
          <Pressable
            style={[
              styles.secondaryButton,
              { backgroundColor: colors.surfaceElevated, borderColor: colors.borderStrong },
            ]}
            disabled={deviceBusy}
            onPress={() => void handleRegisterMobileDevice()}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Register Phone</Text>
          </Pressable>
        </View>
        {devices.length === 0 ? (
          <Text style={[styles.profileEmail, { color: colors.textMuted }]}>
            Tap Register Phone to receive meeting invite alerts on this device.
          </Text>
        ) : (
          devices.map((d) => (
            <View
              key={d.id}
              style={[
                styles.statusRow,
                { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
              ]}
            >
              <View style={styles.flex1}>
                <Text style={[styles.themeLabel, { color: colors.text }]}>
                  {d.device_name || d.platform.toUpperCase()}
                </Text>
                <Text style={[styles.themeDesc, { color: colors.textMuted }]}>
                  {d.platform.toUpperCase()} · Active{' '}
                  {new Date(d.last_active_at).toLocaleDateString()}
                </Text>
              </View>
              <Pressable
                style={[
                  styles.secondaryButton,
                  { backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder },
                ]}
                disabled={deviceBusy}
                onPress={() => void handleRemoveDevice(d.id)}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.dangerText }]}>
                  Remove
                </Text>
              </Pressable>
            </View>
          ))
        )}
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.topBar}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>System Status</Text>
          <Pressable
            style={[
              styles.secondaryButton,
              { backgroundColor: colors.surfaceElevated, borderColor: colors.borderStrong },
            ]}
            onPress={() => void refreshHealth()}
            disabled={healthLoading}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
              {healthLoading ? 'Checking...' : 'Refresh'}
            </Text>
          </Pressable>
        </View>

        <View
          style={[
            styles.statusRow,
            { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
          ]}
        >
          <View style={styles.flex1}>
            <Text style={[styles.themeLabel, { color: colors.text }]}>Meet Backend API</Text>
            <Text style={[styles.themeDesc, { color: colors.textMuted }]}>
              {healthError ? `${API_BASE_URL} — ${healthError}` : API_BASE_URL}
            </Text>
          </View>
          <StatusBadge label={backendLabel} tone={backendTone} />
        </View>

        <View
          style={[
            styles.statusRow,
            { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
          ]}
        >
          <View style={styles.flex1}>
            <Text style={[styles.themeLabel, { color: colors.text }]}>Supabase</Text>
            <Text style={[styles.themeDesc, { color: colors.textMuted }]}>
              {health ? health.supabase.message : 'Waiting for backend'}
            </Text>
          </View>
          <StatusBadge label={supabaseLabel} tone={supabaseTone} />
        </View>

        <View
          style={[
            styles.statusRow,
            { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
          ]}
        >
          <View style={styles.flex1}>
            <Text style={[styles.themeLabel, { color: colors.text }]}>LiveKit SFU</Text>
            <Text style={[styles.themeDesc, { color: colors.textMuted }]}>
              {!health
                ? 'Waiting for backend'
                : health.livekit?.message ?? 'Live video engine'}
            </Text>
          </View>
          <StatusBadge
            label={
              !health
                ? 'Waiting'
                : health.livekit?.status === 'configured'
                  ? 'Ready'
                  : 'Needs Keys'
            }
            tone={health?.livekit?.status === 'configured' ? 'success' : 'warning'}
          />
        </View>
      </View>

      <Pressable onPress={onBack} style={{ alignItems: 'center', paddingVertical: 6 }}>
        <Text style={[styles.themeDesc, { color: colors.accentText, fontWeight: '700' }]}>
          Back to Home
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 18,
    paddingBottom: 28,
    gap: 16,
  },
  flex1: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  secondaryButton: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    gap: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  themeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  themeOption: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    borderWidth: 2,
    gap: 4,
  },
  swatch: {
    height: 38,
    borderRadius: 9,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
  },
  swatchLight: {
    backgroundColor: '#f8fafc',
  },
  swatchDark: {
    backgroundColor: '#0b1120',
  },
  themeLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  themeDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarLg: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLgText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
  },
  profileName: {
    fontSize: 18,
    fontWeight: '800',
  },
  profileEmail: {
    fontSize: 13,
    marginTop: 2,
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
  },
  primaryButton: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  signOutButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  signOutText: {
    fontSize: 14,
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  alert: {
    padding: 12,
    borderRadius: 11,
    borderWidth: 1,
  },
  alertText: {
    fontSize: 13,
  },
});
