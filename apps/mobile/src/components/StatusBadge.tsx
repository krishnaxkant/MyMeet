import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';

export type BadgeTone = 'success' | 'warning' | 'danger';

interface StatusBadgeProps {
  label: string;
  tone: BadgeTone;
}

export function StatusBadge({ label, tone }: StatusBadgeProps) {
  const { colors } = useTheme();

  const palette =
    tone === 'success'
      ? { bg: colors.successBg, text: colors.successText, border: colors.successBorder }
      : tone === 'warning'
        ? { bg: colors.warningBg, text: colors.warningText, border: colors.warningBorder }
        : { bg: colors.dangerBg, text: colors.dangerText, border: colors.dangerBorder };

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: palette.bg, borderColor: palette.border },
      ]}
    >
      <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
