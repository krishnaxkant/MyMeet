import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';

export type MainTab = 'home' | 'schedule' | 'history' | 'profile';

interface BottomTabBarProps {
  activeTab: MainTab;
  onSelect: (tab: MainTab) => void;
}

const TABS: Array<{ key: MainTab; label: string; glyph: string }> = [
  { key: 'home', label: 'Home', glyph: '⌂' },
  { key: 'schedule', label: 'Schedule', glyph: '◷' },
  { key: 'history', label: 'History', glyph: '↺' },
  { key: 'profile', label: 'Profile', glyph: '◉' },
];

export function BottomTabBar({ activeTab, onSelect }: BottomTabBarProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.navBackground,
          borderTopColor: colors.border,
        },
      ]}
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <Pressable
            key={tab.key}
            style={styles.item}
            onPress={() => onSelect(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
          >
            <View
              style={[
                styles.pill,
                isActive && { backgroundColor: colors.accentSoft },
              ]}
            >
              <Text
                style={[
                  styles.glyph,
                  { color: isActive ? colors.accent : colors.textMuted },
                ]}
              >
                {tab.glyph}
              </Text>
            </View>
            <Text
              style={[
                styles.label,
                {
                  color: isActive ? colors.accentText : colors.textMuted,
                  fontWeight: isActive ? '700' : '500',
                },
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: 8,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 999,
  },
  glyph: {
    fontSize: 17,
    lineHeight: 20,
  },
  label: {
    fontSize: 11,
  },
});
