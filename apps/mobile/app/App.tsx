import { useCallback, useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  ToastAndroid,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { BottomTabBar, type MainTab } from '../src/components/BottomTabBar';
import { useAutoUpdates } from '../src/hooks/useAutoUpdates';
import { AuthProvider, useAuth } from '../src/hooks/useAuth';
import { ThemeProvider, useTheme } from '../src/hooks/useTheme';
import { AuthScreen } from '../src/screens/AuthScreen';
import { HistoryScreen } from '../src/screens/HistoryScreen';
import { HomeScreen } from '../src/screens/HomeScreen';
import { MeetingLobbyScreen } from '../src/screens/MeetingLobbyScreen';
import { MeetingRoomScreen } from '../src/screens/MeetingRoomScreen';
import { ProfileScreen } from '../src/screens/ProfileScreen';
import { ScheduleScreen } from '../src/screens/ScheduleScreen';

type ScreenState =
  | { name: 'home' }
  | { name: 'schedule' }
  | { name: 'history'; initialCode?: string; autoOpenMcq?: boolean }
  | { name: 'profile' }
  | { name: 'lobby'; code: string }
  | { name: 'room'; code: string; micEnabled: boolean; camEnabled: boolean };

function isSameScreen(a: ScreenState, b: ScreenState): boolean {
  if (a.name !== b.name) return false;
  if (a.name === 'lobby' && b.name === 'lobby') return a.code === b.code;
  if (a.name === 'room' && b.name === 'room') return a.code === b.code;
  if (a.name === 'history' && b.name === 'history') return a.initialCode === b.initialCode;
  return true;
}

function RootNavigator() {
  const { user, loading } = useAuth();
  const { theme, colors } = useTheme();
  const { updateReady, reloading, applyUpdateNow } = useAutoUpdates();
  const [stack, setStack] = useState<ScreenState[]>([{ name: 'home' }]);
  const lastExitBackAtRef = useRef(0);

  const screen = stack[stack.length - 1] ?? { name: 'home' };

  const pushScreen = useCallback((next: ScreenState) => {
    setStack((prev) => {
      const top = prev[prev.length - 1];
      if (top && isSameScreen(top, next)) return prev;
      return [...prev.slice(-19), next];
    });
  }, []);

  const replaceScreen = useCallback((next: ScreenState) => {
    setStack((prev) => [...prev.slice(0, -1), next]);
  }, []);

  const resetToHome = useCallback(() => {
    setStack([{ name: 'home' }]);
  }, []);

  const goBack = useCallback((): boolean => {
    let handled = false;
    setStack((prev) => {
      if (prev.length > 1) {
        handled = true;
        return prev.slice(0, -1);
      }
      if (prev[0]?.name !== 'home') {
        handled = true;
        return [{ name: 'home' }];
      }
      return prev;
    });
    return handled;
  }, []);

  // Reset navigation stack when user logs out
  useEffect(() => {
    if (!user) {
      setStack([{ name: 'home' }]);
    }
  }, [user]);

  // Global Android hardware / swipe-back gesture handler (step-by-step stack pop + double-back exit on Home)
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      // MeetingRoomScreen registers its own inner handler (closes sheets / confirms Leave)
      if (screen.name === 'room') {
        return false;
      }
      if (stack.length > 1 || screen.name !== 'home') {
        goBack();
        return true;
      }
      // On Home root: double-press back within 2s to exit cleanly
      const now = Date.now();
      if (now - lastExitBackAtRef.current < 2000) {
        return false;
      }
      lastExitBackAtRef.current = now;
      ToastAndroid.show('Press back again to exit MyMeet', ToastAndroid.SHORT);
      return true;
    });
    return () => sub.remove();
  }, [goBack, screen.name, stack.length]);

  const isMainTab =
    screen.name === 'home' ||
    screen.name === 'schedule' ||
    screen.name === 'history' ||
    screen.name === 'profile';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      {updateReady && screen.name !== 'room' && (
        <Pressable
          style={styles.updateBar}
          onPress={() => void applyUpdateNow()}
          disabled={reloading}
        >
          <Text style={styles.updateBarText}>
            {reloading ? 'Applying MyMeet update...' : 'New MyMeet update ready · Tap to refresh'}
          </Text>
        </Pressable>
      )}
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loaderText, { color: colors.textMuted }]}>Restoring session...</Text>
        </View>
      ) : !user ? (
        <AuthScreen />
      ) : (
        <View style={styles.flex1}>
          <View style={styles.flex1}>
            {screen.name === 'profile' ? (
              <ProfileScreen onBack={() => void goBack()} />
            ) : screen.name === 'schedule' ? (
              <ScheduleScreen
                onBack={() => void goBack()}
                onOpenLobby={(code) => pushScreen({ name: 'lobby', code })}
              />
            ) : screen.name === 'history' ? (
              <HistoryScreen
                initialCode={screen.initialCode}
                autoOpenMcq={screen.autoOpenMcq}
                onBack={() => void goBack()}
                onOpenLobby={(code) => pushScreen({ name: 'lobby', code })}
              />
            ) : screen.name === 'lobby' ? (
              <MeetingLobbyScreen
                code={screen.code}
                onBack={() => void goBack()}
                onEnterRoom={({ code, micEnabled, camEnabled }) =>
                  replaceScreen({ name: 'room', code, micEnabled, camEnabled })
                }
              />
            ) : screen.name === 'room' ? (
              <MeetingRoomScreen
                code={screen.code}
                initialMicEnabled={screen.micEnabled}
                initialCamEnabled={screen.camEnabled}
                onExit={resetToHome}
                onBackToLobby={(code) => replaceScreen({ name: 'lobby', code })}
                onOpenHistory={(code, openMcq) =>
                  replaceScreen({ name: 'history', initialCode: code, autoOpenMcq: Boolean(openMcq) })
                }
              />
            ) : (
              <HomeScreen
                onOpenProfile={() => pushScreen({ name: 'profile' })}
                onOpenLobby={(code) => pushScreen({ name: 'lobby', code })}
                onOpenSchedule={() => pushScreen({ name: 'schedule' })}
                onOpenHistory={(code) => pushScreen({ name: 'history', initialCode: code })}
              />
            )}
          </View>

          {isMainTab && (
            <BottomTabBar
              activeTab={screen.name as MainTab}
              onSelect={(tab) => {
                if (tab === 'home') {
                  resetToHome();
                } else {
                  pushScreen({ name: tab } as ScreenState);
                }
              }}
            />
          )}
        </View>
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
  flex1: {
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
  updateBar: {
    backgroundColor: '#2563EB',
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateBarText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
});
