import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { UpgradePlansModal } from '../components/UpgradePlansModal';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { getBillingStatus, type UserSubscriptionStatus } from '../services/api';

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
  const { theme, colors, toggleTheme } = useTheme();

  const [fullName, setFullName] = useState('');
  const [avatarData, setAvatarData] = useState<string | null>(null);
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);
  const [photoAction, setPhotoAction] = useState<'uploading' | 'removing' | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<UserSubscriptionStatus | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [savedNotice, setSavedNotice] = useState<{
    id: number;
    text: string;
    tone: 'success' | 'danger';
  } | null>(null);

  useEffect(() => {
    if (!session?.access_token) return;
    void getBillingStatus(session.access_token)
      .then((res) => setSubscription(res.subscription))
      .catch(() => {});
  }, [session?.access_token]);

  useEffect(() => {
    setFullName(profile?.full_name ?? (user?.user_metadata?.full_name as string | undefined) ?? '');
    setAvatarData(profile?.avatar_url ?? null);
  }, [profile, user]);

  // Auto-dismiss success banner after 3 seconds
  useEffect(() => {
    if (!savedNotice) return;
    const timer = setTimeout(() => setSavedNotice(null), 3000);
    return () => clearTimeout(timer);
  }, [savedNotice]);

  const displayName = fullName.trim() || user?.email || 'Meet User';
  const emailAddress = profile?.email ?? user?.email ?? '';
  const joinedLabel = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, {
        month: 'short',
        year: 'numeric',
      })
    : null;

  const currentSavedName =
    profile?.full_name ?? (user?.user_metadata?.full_name as string | undefined) ?? '';
  const currentSavedAvatar = profile?.avatar_url ?? null;
  const hasChanges =
    fullName.trim() !== currentSavedName.trim() || (avatarData || null) !== currentSavedAvatar;

  const handlePickPhoto = async () => {
    setPhotoMenuOpen(false);
    setError(null);
    setSavedNotice(null);
    setPhotoAction('uploading');
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError('Please allow photo library access to upload a profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.35,
        base64: true,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const asset = result.assets[0];
      if (!asset.base64) {
        setError('Could not read the selected photo. Please try another image.');
        return;
      }

      const mime = asset.mimeType && /^image\/(jpeg|jpg|png|webp)$/i.test(asset.mimeType)
        ? asset.mimeType
        : 'image/jpeg';
      const dataUrl = `data:${mime};base64,${asset.base64}`;

      if (dataUrl.length > 475_000) {
        setError('Selected photo is too large. Please pick a smaller image or crop tighter.');
        return;
      }

      setAvatarData(dataUrl);
      await saveProfile({ avatar_url: dataUrl });
      setSavedNotice({ id: Date.now(), text: 'Profile photo uploaded.', tone: 'success' });
    } catch (err) {
      setAvatarData(profile?.avatar_url ?? null);
      setError(err instanceof Error ? err.message : 'Unable to save profile photo.');
    } finally {
      setPhotoAction(null);
    }
  };

  const handleRemovePhoto = async () => {
    setPhotoMenuOpen(false);
    setError(null);
    setSavedNotice(null);
    setPhotoAction('removing');
    try {
      setAvatarData(null);
      await saveProfile({ avatar_url: null });
      setSavedNotice({ id: Date.now(), text: 'Profile photo removed.', tone: 'danger' });
    } catch (err) {
      setAvatarData(profile?.avatar_url ?? null);
      setError(err instanceof Error ? err.message : 'Unable to remove profile photo.');
    } finally {
      setPhotoAction(null);
    }
  };

  const handleSave = async () => {
    setError(null);
    setSavedNotice(null);
    setSaving(true);
    try {
      await saveProfile({
        full_name: fullName.trim() || null,
        avatar_url: avatarData || null,
      });
      setSavedNotice({ id: Date.now(), text: 'Your profile has been updated.', tone: 'success' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.topBar}>
          <View style={styles.flex1}>
            <Text style={[styles.screenTitle, { color: colors.text }]}>Your Profile</Text>
            <Text style={[styles.screenSub, { color: colors.textMuted }]}>
              Customize your Meet identity
            </Text>
          </View>
          <View style={styles.topBarActions}>
            <Pressable
              style={[
                styles.iconPillBtn,
                { backgroundColor: colors.surface, borderColor: colors.borderStrong },
              ]}
              onPress={toggleTheme}
              accessibilityLabel="Toggle theme"
            >
              <Text style={{ fontSize: 15 }}>{theme === 'light' ? '☾' : '☀'}</Text>
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
        </View>

        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: colors.surface,
              borderColor: subscription?.is_pro ? '#F59E0B' : colors.border,
              borderWidth: subscription?.is_pro ? 1.5 : 1,
            },
          ]}
        >
          {/* Studio Cover Banner */}
          <View
            style={[
              styles.coverBanner,
              subscription?.is_pro && { backgroundColor: '#3B0764' },
            ]}
          >
            <View
              style={[
                styles.verifiedCoverPill,
                subscription?.is_pro && {
                  backgroundColor: 'rgba(245, 158, 11, 0.24)',
                  borderColor: 'rgba(245, 158, 11, 0.7)',
                },
              ]}
            >
              <Text style={styles.verifiedCoverText}>
                {subscription?.is_pro
                  ? `✦ MYMEET PRO · ${subscription.plan_name}`
                  : '✓ Verified Account'}
              </Text>
            </View>
          </View>

          <View style={styles.heroBody}>
            {/* Avatar overlaps banner cleanly; Meta badge sits below banner on right */}
            <View style={styles.avatarRow}>
              <View style={styles.avatarWrap}>
                <View
                  style={[
                    styles.avatarXl,
                    {
                      backgroundColor: colors.accent,
                      borderColor: subscription?.is_pro ? '#F59E0B' : colors.surface,
                    },
                  ]}
                >
                  {avatarData ? (
                    <Image source={{ uri: avatarData }} style={styles.avatarXlImg} />
                  ) : (
                    <Text style={styles.avatarXlText}>{getInitials(displayName)}</Text>
                  )}
                </View>

                <Pressable
                  style={[
                    styles.cameraBtn,
                    { backgroundColor: colors.accent, borderColor: colors.surface },
                  ]}
                  onPress={() => setPhotoMenuOpen(true)}
                  disabled={Boolean(photoAction)}
                  accessibilityLabel="Profile photo options"
                >
                  <Text style={styles.cameraIconText}>📷</Text>
                </Pressable>
              </View>

              {joinedLabel && (
                <View
                  style={[
                    styles.joinedChip,
                    { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.joinedChipText, { color: colors.textSubtle }]}>
                    Member since {joinedLabel}
                  </Text>
                </View>
              )}
            </View>

            {/* Name & Email cleanly below banner (zero overlap) */}
            <View style={[styles.nameBlock, { borderBottomColor: colors.border }]}>
              <Text style={[styles.profileName, { color: colors.text }]}>{displayName}</Text>
              {subscription?.is_pro && (
                <View style={styles.proNameBadge}>
                  <Text style={styles.proNameBadgeText}>
                    ✦ PRO · {subscription.plan_name}
                  </Text>
                </View>
              )}
              <Text style={[styles.profileEmail, { color: colors.textMuted }]}>
                {photoAction === 'removing'
                  ? 'Removing photo...'
                  : photoAction === 'uploading'
                    ? 'Uploading photo...'
                    : emailAddress}
              </Text>
            </View>

            {/* Subscription & Credits Summary Card */}
            <View
              style={[
                styles.subPanel,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: subscription?.is_pro ? '#F59E0B' : colors.border,
                },
              ]}
            >
              <View style={styles.subTopRow}>
                <View style={styles.flex1}>
                  <Text style={[styles.subLabel, { color: colors.textMuted }]}>
                    SUBSCRIPTION PLAN
                  </Text>
                  <Text style={[styles.subPlanName, { color: colors.text }]}>
                    {subscription?.plan_name || 'Basic (Free)'}
                  </Text>
                </View>
                <Pressable
                  style={[
                    styles.subUpgradeBtn,
                    { backgroundColor: subscription?.is_pro ? '#7C3AED' : '#F59E0B' },
                  ]}
                  onPress={() => setUpgradeOpen(true)}
                >
                  <Text
                    style={{
                      color: subscription?.is_pro ? '#FFFFFF' : '#090D16',
                      fontSize: 12,
                      fontWeight: '800',
                    }}
                  >
                    {subscription?.is_pro ? 'Manage / Add' : 'Upgrade Pro'}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.subMetricsRow}>
                <View
                  style={[
                    styles.subMetricCell,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.subMetricLabel, { color: colors.textMuted }]}>Credits</Text>
                  <Text style={[styles.subMetricVal, { color: colors.text }]}>
                    {subscription?.is_unlimited
                      ? '∞ Unlimited'
                      : subscription?.is_pro
                        ? `${subscription.credits_remaining} / ${Math.max(
                            subscription.credits_remaining,
                            subscription.credits_total,
                          )}`
                        : '0 left'}
                  </Text>
                </View>

                <View
                  style={[
                    styles.subMetricCell,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.subMetricLabel, { color: colors.textMuted }]}>
                    MCQ Tests
                  </Text>
                  <Text style={[styles.subMetricVal, { color: colors.text }]}>
                    {subscription?.mcq_enabled ? '✓ Unlocked' : 'Locked'}
                  </Text>
                </View>

                <View
                  style={[
                    styles.subMetricCell,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.subMetricLabel, { color: colors.textMuted }]}>Valid Till</Text>
                  <Text style={[styles.subMetricVal, { color: colors.text }]} numberOfLines={1}>
                    {subscription?.is_pro && subscription.expires_at
                      ? new Date(subscription.expires_at).toLocaleDateString(undefined, {
                          day: 'numeric',
                          month: 'short',
                        })
                      : 'Free'}
                  </Text>
                </View>
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
                  savedNotice.tone === 'danger'
                    ? { backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder }
                    : { backgroundColor: colors.successBg, borderColor: colors.successBorder },
                ]}
              >
                <Text
                  style={[
                    styles.alertText,
                    { color: savedNotice.tone === 'danger' ? colors.dangerText : colors.successText },
                  ]}
                >
                  {savedNotice.text}
                </Text>
              </View>
            )}

            {/* Account Form */}
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
                onChangeText={(txt) => {
                  setFullName(txt);
                  setSavedNotice(null);
                }}
                placeholder="Enter your name"
                placeholderTextColor={colors.placeholder}
                maxLength={100}
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.textMuted }]}>Email address</Text>
              <View
                style={[
                  styles.emailReadonlyBox,
                  { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.emailReadonlyText, { color: colors.textMuted }]} numberOfLines={1}>
                  {emailAddress}
                </Text>
                <View
                  style={[
                    styles.verifiedPill,
                    { backgroundColor: colors.successBg, borderColor: colors.successBorder },
                  ]}
                >
                  <Text style={[styles.verifiedPillText, { color: colors.successText }]}>
                    Verified
                  </Text>
                </View>
              </View>
            </View>

            <View style={[styles.footerActions, { borderTopColor: colors.border }]}>
              <Pressable
                style={[
                  styles.primaryButton,
                  { backgroundColor: colors.accent },
                  (saving || Boolean(photoAction) || !hasChanges) && styles.buttonDisabled,
                ]}
                onPress={() => void handleSave()}
                disabled={saving || Boolean(photoAction) || !hasChanges}
              >
                <Text style={styles.primaryButtonText}>
                  {saving ? 'Saving...' : hasChanges ? 'Save Changes' : 'All Changes Saved'}
                </Text>
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
          </View>
        </View>

        <Pressable onPress={onBack} style={{ alignItems: 'center', paddingVertical: 6 }}>
          <Text style={[styles.backLink, { color: colors.accentText }]}>Back to Home</Text>
        </Pressable>
      </ScrollView>

      {/* Contextual Photo Action Sheet (Camera Button Menu) */}
      <Modal
        visible={photoMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoMenuOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setPhotoMenuOpen(false)}>
          <Pressable
            style={[
              styles.actionSheet,
              { backgroundColor: colors.surface, borderColor: colors.borderStrong },
            ]}
            onPress={() => {}}
          >
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Profile Photo</Text>

            <Pressable
              style={[
                styles.sheetItem,
                { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
              ]}
              onPress={() => void handlePickPhoto()}
            >
              <Text style={[styles.sheetItemText, { color: colors.text }]}>⬆ Upload Photo</Text>
            </Pressable>

            {avatarData && (
              <Pressable
                style={[
                  styles.sheetItem,
                  { backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder },
                ]}
                onPress={() => void handleRemovePhoto()}
              >
                <Text style={[styles.sheetItemText, { color: colors.dangerText }]}>
                  🗑 Remove Photo
                </Text>
              </Pressable>
            )}

            <Pressable
              style={styles.sheetCancelBtn}
              onPress={() => setPhotoMenuOpen(false)}
            >
              <Text style={[styles.sheetCancelText, { color: colors.textMuted }]}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <UpgradePlansModal
        visible={upgradeOpen}
        accessToken={session?.access_token ?? null}
        onClose={() => setUpgradeOpen(false)}
        onActivated={(nextSub) => {
          setSubscription(nextSub);
          setSavedNotice({
            id: Date.now(),
            text: `✦ ${nextSub.plan_name} activated! Your Pro credits are ready.`,
            tone: 'success',
          });
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 18,
    paddingBottom: 32,
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
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  screenSub: {
    fontSize: 12,
    marginTop: 2,
  },
  iconPillBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  coverBanner: {
    height: 108,
    backgroundColor: '#2563eb',
    padding: 14,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  verifiedCoverPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  verifiedCoverText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  heroBody: {
    paddingHorizontal: 18,
    paddingBottom: 20,
    gap: 14,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
  },
  avatarWrap: {
    marginTop: -48,
    position: 'relative',
  },
  avatarXl: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarXlImg: {
    width: 96,
    height: 96,
  },
  avatarXlText: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '800',
  },
  cameraBtn: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraIconText: {
    fontSize: 14,
  },
  joinedChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  joinedChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  nameBlock: {
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 3,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  profileEmail: {
    fontSize: 13,
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
  emailReadonlyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
  },
  emailReadonlyText: {
    fontSize: 14,
    flex: 1,
  },
  verifiedPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  verifiedPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  footerActions: {
    marginTop: 4,
    paddingTop: 14,
    borderTopWidth: 1,
    gap: 10,
  },
  primaryButton: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
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
  backLink: {
    fontSize: 13,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.58)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  actionSheet: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  sheetItem: {
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  sheetItemText: {
    fontSize: 14,
    fontWeight: '700',
  },
  sheetCancelBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  sheetCancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  proNameBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#7C3AED',
    borderWidth: 1,
    borderColor: '#F59E0B',
    marginTop: 4,
    marginBottom: 4,
  },
  proNameBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  subPanel: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
    gap: 10,
  },
  subTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  subLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  subPlanName: {
    fontSize: 15.5,
    fontWeight: '800',
    marginTop: 2,
  },
  subUpgradeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  subMetricsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  subMetricCell: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    gap: 2,
  },
  subMetricLabel: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  subMetricVal: {
    fontSize: 12.5,
    fontWeight: '800',
  },
});
