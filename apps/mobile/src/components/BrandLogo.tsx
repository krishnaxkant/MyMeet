import { Image, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const MYMEET_MARK = require('../../assets/mymeet-mark.png');

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
}

const METRICS = {
  sm: { icon: 28, font: 18, tagline: 10 },
  md: { icon: 36, font: 22, tagline: 11 },
  lg: { icon: 44, font: 26, tagline: 12 },
};

export function BrandLogo({ size = 'md', showTagline = false }: BrandLogoProps) {
  const { theme, colors } = useTheme();
  const m = METRICS[size];

  return (
    <View style={styles.row}>
      <Image
        source={MYMEET_MARK}
        style={{ width: m.icon, height: m.icon, resizeMode: 'contain', flexShrink: 0 }}
        accessibilityLabel="MyMeet logo"
      />
      <View style={styles.textWrap}>
        <View style={styles.wordmarkRow}>
          <Text
            style={[
              styles.wordmark,
              {
                fontSize: m.font,
                color: theme === 'dark' ? '#F8FAFC' : '#0B132B',
              },
            ]}
          >
            My
          </Text>
          <Text
            style={[
              styles.wordmark,
              {
                fontSize: m.font,
                color: '#2563EB',
              },
            ]}
          >
            Meet
          </Text>
        </View>
        {showTagline && (
          <Text
            style={[styles.tagline, { fontSize: m.tagline, color: colors.textMuted }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            Connect. Collaborate. Together.
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
    minWidth: 0,
  },
  textWrap: {
    flexShrink: 1,
    minWidth: 0,
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  wordmark: {
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  tagline: {
    marginTop: 1,
    fontWeight: '600',
  },
});
