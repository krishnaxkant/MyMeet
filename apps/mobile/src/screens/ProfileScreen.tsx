import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';

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
  const { user, profile, profileLoading, saveProfile, refreshProfile, signOut } = useAuth();
  const { theme, colors, setTheme } = useTheme();
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

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
      setSavedNotice('Profile saved via Meet Backend (/api/me).');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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

      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
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
            <Text style={[styles.themeDesc, { color: colors.textMuted }]}>Clean & bright</Text>
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
            <Text style={[styles.themeDesc, { color: colors.textMuted }]}>Low-glare mode</Text>
          </Pressable>
        </View>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
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
          <Text style={[styles.label, { color: colors.textMuted }]}>Email</Text>
          <TextInput
            style={[
              styles.input,
              styles.inputDisabled,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.border,
                color: colors.textMuted,
              },
            ]}
            value={profile?.email ?? user?.email ?? ''}
            editable={false}
          />
        </View>

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 18,
    gap: 16,
  },
  flex1: {
    flex: 1,
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
  card: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    gap: 14,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  themeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  themeOption: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    gap: 4,
  },
  swatch: {
    height: 36,
    borderRadius: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
  },
  swatchLight: {
    backgroundColor: '#f8fafc',
  },
  swatchDark: {
    backgroundColor: '#0f172a',
  },
  themeLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  themeDesc: {
    fontSize: 11,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarLg: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLgText: {
    color: '#ffffff',
    fontSize: 19,
    fontWeight: '800',
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
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
    borderRadius: 11,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
  },
  inputDisabled: {
    opacity: 0.75,
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
  alert: {
    padding: 12,
    borderRadius: 11,
    borderWidth: 1,
  },
  alertText: {
    fontSize: 13,
  },
});
