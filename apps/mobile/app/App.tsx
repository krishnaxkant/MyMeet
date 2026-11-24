import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../src/hooks/useAuth';
import { ThemeProvider, useTheme } from '../src/hooks/useTheme';
import { AuthScreen } from '../src/screens/AuthScreen';
import { HomeScreen } from '../src/screens/HomeScreen';
import { ProfileScreen } from '../src/screens/ProfileScreen';

function RootNavigator() {
  const { user, loading } = useAuth();
  const { theme, colors } = useTheme();
  const [screen, setScreen] = useState<'home' | 'profile'>('home');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loaderText, { color: colors.textMuted }]}>Restoring session...</Text>
        </View>
      ) : !user ? (
        <AuthScreen />
      ) : screen === 'profile' ? (
        <ProfileScreen onBack={() => setScreen('home')} />
      ) : (
        <HomeScreen onOpenProfile={() => setScreen('profile')} />
      )}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loaderText: {
    fontSize: 14,
  },
});
