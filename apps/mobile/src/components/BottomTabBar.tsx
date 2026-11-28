import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';

export type MainTab = 'home' | 'schedule' | 'history' | 'profile';

interface BottomTabBarProps {
  activeTab: MainTab;
  onSelect: (tab: MainTab) => void;
}

function HomeTabIcon({ color, active }: { color: string; active: boolean }) {
  return (
    <View style={iconStyles.box}>
      {/* Pitched roof */}
      <View
        style={[
          iconStyles.roof,
          { borderTopColor: color, borderLeftColor: color },
        ]}
      />
      {/* House body */}
      <View
        style={[
          iconStyles.houseBody,
          {
            borderColor: color,
            backgroundColor: active ? `${color}22` : 'transparent',
          },
        ]}
      >
        <View style={[iconStyles.houseDoor, { backgroundColor: color }]} />
      </View>
    </View>
  );
}

function ScheduleTabIcon({ color, active }: { color: string; active: boolean }) {
  return (
    <View style={iconStyles.box}>
      {/* Top calendar pins */}
      <View style={iconStyles.calPins}>
        <View style={[iconStyles.calPin, { backgroundColor: color }]} />
        <View style={[iconStyles.calPin, { backgroundColor: color }]} />
      </View>
      {/* Calendar frame */}
      <View
        style={[
          iconStyles.calFrame,
          {
            borderColor: color,
            backgroundColor: active ? `${color}22` : 'transparent',
          },
        ]}
      >
        <View style={[iconStyles.calBar, { backgroundColor: color }]} />
        <View style={iconStyles.calDotsRow}>
          <View style={[iconStyles.calDot, { backgroundColor: color }]} />
          <View style={[iconStyles.calDot, { backgroundColor: color }]} />
          <View style={[iconStyles.calDot, { backgroundColor: color }]} />
        </View>
      </View>
    </View>
  );
}

function HistoryTabIcon({ color, active }: { color: string; active: boolean }) {
  return (
    <View style={iconStyles.box}>
      <View
        style={[
          iconStyles.clockRing,
          {
            borderColor: color,
            backgroundColor: active ? `${color}22` : 'transparent',
          },
        ]}
      >
        <View style={[iconStyles.clockHandV, { backgroundColor: color }]} />
        <View style={[iconStyles.clockHandH, { backgroundColor: color }]} />
      </View>
    </View>
  );
}

function ProfileTabIcon({ color, active }: { color: string; active: boolean }) {
  return (
    <View style={iconStyles.box}>
      <View
        style={[
          iconStyles.personHead,
          {
            borderColor: color,
            backgroundColor: active ? color : 'transparent',
          },
        ]}
      />
      <View
        style={[
          iconStyles.personArc,
          {
            borderColor: color,
            backgroundColor: active ? `${color}22` : 'transparent',
          },
        ]}
      />
    </View>
  );
}

const TABS: Array<{ key: MainTab; label: string }> = [
  { key: 'home', label: 'Home' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'history', label: 'History' },
  { key: 'profile', label: 'Profile' },
];

function renderTabIcon(key: MainTab, color: string, active: boolean) {
  switch (key) {
    case 'home':
      return <HomeTabIcon color={color} active={active} />;
    case 'schedule':
      return <ScheduleTabIcon color={color} active={active} />;
    case 'history':
      return <HistoryTabIcon color={color} active={active} />;
    case 'profile':
      return <ProfileTabIcon color={color} active={active} />;
  }
}

export function BottomTabBar({ activeTab, onSelect }: BottomTabBarProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.outerWrap, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.dock,
          {
            backgroundColor: colors.surface,
            borderColor: colors.borderStrong,
            shadowColor: colors.shadowColor,
          },
        ]}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const tintColor = isActive ? colors.accent : colors.textMuted;
          return (
            <Pressable
              key={tab.key}
              style={[
                styles.item,
                isActive && [
                  styles.itemActive,
                  { backgroundColor: colors.accentSoft },
                ],
              ]}
              onPress={() => onSelect(tab.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
            >
              {renderTabIcon(tab.key, tintColor, isActive)}
              <Text
                style={[
                  styles.label,
                  {
                    color: isActive ? colors.accentText : colors.textMuted,
                    fontWeight: isActive ? '700' : '600',
                  },
                ]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerWrap: {
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 10,
  },
  dock: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    padding: 5,
    gap: 4,
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 16,
    gap: 4,
  },
  itemActive: {
    borderRadius: 16,
  },
  label: {
    fontSize: 11,
    letterSpacing: 0.1,
  },
});

const iconStyles = StyleSheet.create({
  box: {
    width: 22,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Home
  roof: {
    width: 11,
    height: 11,
    borderTopWidth: 1.9,
    borderLeftWidth: 1.9,
    borderTopLeftRadius: 2,
    transform: [{ rotate: '45deg' }],
    marginBottom: -7,
    marginTop: 2,
  },
  houseBody: {
    width: 13,
    height: 9.5,
    borderWidth: 1.8,
    borderTopWidth: 0,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  houseDoor: {
    width: 3.5,
    height: 4.5,
    borderTopLeftRadius: 1.5,
    borderTopRightRadius: 1.5,
  },
  // Schedule
  calPins: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: -1.5,
    zIndex: 1,
  },
  calPin: {
    width: 1.8,
    height: 3.5,
    borderRadius: 1,
  },
  calFrame: {
    width: 16,
    height: 14,
    borderWidth: 1.8,
    borderRadius: 3.5,
    overflow: 'hidden',
  },
  calBar: {
    height: 1.6,
    width: '100%',
    marginTop: 3.2,
  },
  calDotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 1,
  },
  calDot: {
    width: 2.2,
    height: 2.2,
    borderRadius: 1.1,
  },
  // History (Clock)
  clockRing: {
    width: 17,
    height: 17,
    borderRadius: 8.5,
    borderWidth: 1.8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clockHandV: {
    position: 'absolute',
    width: 1.7,
    height: 5,
    borderRadius: 1,
    top: 2.8,
    left: 5.8,
  },
  clockHandH: {
    position: 'absolute',
    width: 4.2,
    height: 1.7,
    borderRadius: 1,
    top: 6.3,
    left: 6,
  },
  // Profile
  personHead: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    borderWidth: 1.8,
    marginBottom: 2,
  },
  personArc: {
    width: 14.5,
    height: 7.5,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 1.8,
    borderBottomWidth: 0,
  },
});
