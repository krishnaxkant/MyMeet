import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';

export function ThemeToggle() {
  const { theme, colors, setTheme } = useTheme();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
      ]}
    >
      <Pressable
        style={[
          styles.button,
          theme === 'light' && [styles.buttonActive, { backgroundColor: colors.surface }],
        ]}
        onPress={() => setTheme('light')}
      >
        <Text
          style={[
            styles.label,
            { color: theme === 'light' ? colors.text : colors.textMuted },
          ]}
        >
          ☀ Light
        </Text>
      </Pressable>

      <Pressable
        style={[
          styles.button,
          theme === 'dark' && [styles.buttonActive, { backgroundColor: colors.surface }],
        ]}
        onPress={() => setTheme('dark')}
      >
        <Text
          style={[
            styles.label,
            { color: theme === 'dark' ? colors.text : colors.textMuted },
          ]}
        >
          ☾ Dark
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 999,
    borderWidth: 1,
    gap: 2,
  },
  button: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  buttonActive: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
});
