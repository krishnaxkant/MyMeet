import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BrandLogo } from '../components/BrandLogo';
import { ThemeToggle } from '../components/ThemeToggle';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';

type AuthMode = 'login' | 'signup' | 'forgot';

export function AuthScreen() {
  const { isConfigured, signIn, signUp, resendVerification, sendPasswordReset } = useAuth();
  const { colors } = useTheme();
  const [mode, setMode] = useState<AuthMode>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [pendingVerifyEmail, setPendingVerifyEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError(null);
    setNotice(null);
  };

  const handleSubmit = async () => {
    setError(null);
    setNotice(null);

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    if (mode !== 'forgot' && password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (mode === 'signup' && !fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        await signIn(email, password);
      } else if (mode === 'signup') {
        const result = await signUp(email, password, fullName);
        if (result.needsEmailConfirmation) {
          setPendingVerifyEmail(email.trim());
          setNotice(
            result.message || 'Account created! Verify your email from your inbox, then sign in.',
          );
          setMode('login');
        }
      } else {
        await sendPasswordReset(email);
        setNotice('Password recovery email sent! Check your inbox.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Authentication failed.';
      setError(msg);
      if (/confirm|verif/i.test(msg) && email.trim()) {
        setPendingVerifyEmail(email.trim());
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    const target = pendingVerifyEmail || email.trim();
    if (!target) return;
    setResending(true);
    setError(null);
    try {
      const msg = await resendVerification(target);
      setNotice(msg);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to resend verification email.');
    } finally {
      setResending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.themeBar}>
          <ThemeToggle />
        </View>

        <View style={styles.brandHero}>
          <BrandLogo size="lg" showTagline />
        </View>

        <View
          style={[
            styles.tabs,
            { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
          ]}
        >
          <Pressable
            style={[
              styles.tab,
              mode === 'login' && [styles.tabActive, { backgroundColor: colors.surface }],
            ]}
            onPress={() => switchMode('login')}
          >
            <Text
              style={[
                styles.tabText,
                { color: mode === 'login' ? colors.text : colors.textMuted },
              ]}
            >
              Sign In
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.tab,
              mode === 'signup' && [styles.tabActive, { backgroundColor: colors.surface }],
            ]}
            onPress={() => switchMode('signup')}
          >
            <Text
              style={[
                styles.tabText,
                { color: mode === 'signup' ? colors.text : colors.textMuted },
              ]}
            >
              Create Account
            </Text>
          </Pressable>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            {mode === 'login'
              ? 'Welcome back'
              : mode === 'signup'
                ? 'Create your Meet account'
                : 'Reset password'}
          </Text>
          <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>
            {mode === 'login'
              ? 'Sign in to start or join meetings.'
              : mode === 'signup'
                ? 'Use one account across Meet Web and Android.'
                : 'We will email you a password recovery link.'}
          </Text>

          {!isConfigured && (
            <View
              style={[
                styles.alert,
                { backgroundColor: colors.warningBg, borderColor: colors.warningBorder },
              ]}
            >
              <Text style={[styles.alertText, { color: colors.warningText }]}>
                Supabase keys missing. Ensure root .env has SUPABASE_URL & SUPABASE_ANON_KEY, then
                restart Expo.
              </Text>
            </View>
          )}

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

          {notice && (
            <View
              style={[
                styles.alert,
                { backgroundColor: colors.successBg, borderColor: colors.successBorder },
              ]}
            >
              <Text style={[styles.alertText, { color: colors.successText }]}>{notice}</Text>
            </View>
          )}

          {pendingVerifyEmail && (
            <Pressable
              style={[styles.linkButton, { marginTop: -6 }]}
              disabled={resending}
              onPress={() => void handleResendVerification()}
            >
              <Text style={[styles.linkText, { color: colors.accentText }]}>
                {resending ? 'Sending verification email...' : 'Resend Verification Email'}
              </Text>
            </Pressable>
          )}

          {mode === 'signup' && (
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.textMuted }]}>Full name</Text>
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
                placeholder="Alex Rivera"
                placeholderTextColor={colors.placeholder}
                autoCapitalize="words"
              />
            </View>
          )}

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textMuted }]}>Email</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.borderStrong,
                  color: colors.text,
                },
              ]}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.placeholder}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          {mode !== 'forgot' && (
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.textMuted }]}>Password</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.borderStrong,
                    color: colors.text,
                  },
                ]}
                value={password}
                onChangeText={setPassword}
                placeholder="At least 6 characters"
                placeholderTextColor={colors.placeholder}
                secureTextEntry
              />
            </View>
          )}

          <Pressable
            style={[
              styles.primaryButton,
              { backgroundColor: colors.accent },
              submitting && styles.buttonDisabled,
            ]}
            onPress={() => void handleSubmit()}
            disabled={submitting}
          >
            <Text style={styles.primaryButtonText}>
              {submitting
                ? 'Please wait...'
                : mode === 'login'
                  ? 'Sign In'
                  : mode === 'signup'
                    ? 'Create Account'
                    : 'Send Recovery Email'}
            </Text>
          </Pressable>

          {mode === 'login' ? (
            <Pressable style={styles.linkButton} onPress={() => switchMode('forgot')}>
              <Text style={[styles.linkText, { color: colors.accentText }]}>Forgot password?</Text>
            </Pressable>
          ) : mode === 'forgot' ? (
            <Pressable style={styles.linkButton} onPress={() => switchMode('login')}>
              <Text style={[styles.linkText, { color: colors.accentText }]}>Back to Sign In</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    padding: 20,
    gap: 16,
    flexGrow: 1,
    justifyContent: 'center',
  },
  themeBar: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  brandHero: {
    width: '100%',
    alignItems: 'flex-start',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: '#ffffff',
    fontSize: 19,
    fontWeight: '800',
  },
  title: {
    fontSize: 21,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
  },
  tabs: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 9,
  },
  tabActive: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  tabText: {
    fontWeight: '700',
    fontSize: 13,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    gap: 14,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  cardSubtitle: {
    fontSize: 13,
    marginTop: -8,
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
  primaryButton: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  linkButton: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  linkText: {
    fontSize: 13,
    fontWeight: '600',
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
