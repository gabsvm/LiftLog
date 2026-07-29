import { gainsLab, spacing, useAppTheme } from '@/hooks/useAppTheme';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import Icon from '@/components/presentation/foundation/gesture-wrappers/icon';

export function GainsLabMark({ size = 44 }: { size?: number }) {
  const radius = size * 0.3;
  return (
    <View
      accessibilityLabel="GainsLab"
      style={[
        styles.mark,
        {
          width: size,
          height: size,
          borderRadius: radius,
        },
      ]}
    >
      <Icon source="analytics" size={size * 0.58} color={gainsLab.ink} />
      <View
        style={[
          styles.growthDot,
          {
            width: size * 0.14,
            height: size * 0.14,
            borderRadius: size,
            top: size * 0.16,
            right: size * 0.16,
          },
        ]}
      />
    </View>
  );
}

export function GainsLabWordmark({ compact = false }: { compact?: boolean }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.wordmark}>
      <GainsLabMark size={compact ? 32 : 44} />
      <View>
        <Text
          style={[
            styles.name,
            { color: colors.onSurface, fontSize: compact ? 19 : 25 },
          ]}
        >
          Gains<Text style={{ color: colors.primary }}>Lab</Text>
        </Text>
        {!compact && (
          <Text style={[styles.tagline, { color: colors.primary }]}>
            TRACK · TEST · GROW
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: gainsLab.acid,
    overflow: 'hidden',
  },
  growthDot: {
    position: 'absolute',
    backgroundColor: gainsLab.ink,
  },
  wordmark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  name: {
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 28,
  },
  tagline: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.8,
    lineHeight: 13,
  },
});
