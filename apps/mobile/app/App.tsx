import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
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
  | { name: 'history'; initialCode?: string }
  | { name: 'profile' }
  | { name: 'lobby'; code: string }
  | { name: 'room'; code: string; micEnabled: boolean; camEnabled: boolean };

function RootNavigator() {
  const { user, loading } = useAuth();
  const { theme, colors } = useTheme();
  const { updateReady, reloading, applyUpdateNow } = useAutoUpdates();
  const [screen, setScreen] = useState<ScreenState>({ name: 'home' });

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
              <ProfileScreen onBack={() => setScreen({ name: 'home' })} />
            ) : screen.name === 'schedule' ? (
              <ScheduleScreen
                onBack={() => setScreen({ name: 'home' })}
                onOpenLobby={(code) => setScreen({ name: 'lobby', code })}
              />
            ) : screen.name === 'history' ? (
              <HistoryScreen
                initialCode={screen.initialCode}
                onBack={() => setScreen({ name: 'home' })}
                onOpenLobby={(code) => setScreen({ name: 'lobby', code })}
              />
            ) : screen.name === 'lobby' ? (
              <MeetingLobbyScreen
                code={screen.code}
                onBack={() => setScreen({ name: 'home' })}
                onEnterRoom={({ code, micEnabled, camEnabled }) =>
                  setScreen({ name: 'room', code, micEnabled, camEnabled })
                }
              />
            ) : screen.name === 'room' ? (
              <MeetingRoomScreen
                code={screen.code}
                initialMicEnabled={screen.micEnabled}
                initialCamEnabled={screen.camEnabled}
                onExit={() => setScreen({ name: 'home' })}
                onBackToLobby={(code) => setScreen({ name: 'lobby', code })}
                onOpenHistory={(code) => setScreen({ name: 'history', initialCode: code })}
              />
            ) : (
              <HomeScreen
                onOpenProfile={() => setScreen({ name: 'profile' })}
                onOpenLobby={(code) => setScreen({ name: 'lobby', code })}
                onOpenSchedule={() => setScreen({ name: 'schedule' })}
                onOpenHistory={(code) => setScreen({ name: 'history', initialCode: code })}
              />
            )}
          </View>

          {isMainTab && (
            <BottomTabBar
              activeTab={screen.name as MainTab}
              onSelect={(tab) => setScreen({ name: tab } as ScreenState)}
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
