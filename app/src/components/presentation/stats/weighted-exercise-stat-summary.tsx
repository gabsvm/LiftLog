import Icon from '@/components/presentation/foundation/gesture-wrappers/icon';
import TouchableRipple from '@/components/presentation/foundation/gesture-wrappers/touchable-ripple';
import { spacing, useAppTheme } from '@/hooks/useAppTheme';
import { WeightedExerciseStatistics } from '@/store/stats';
import { useTranslate } from '@tolgee/react';
import { View } from 'react-native';
import { Text } from 'react-native-paper';

export function WeightedExerciseStatSummary({
  exerciseStats,
  onPress,
}: {
  exerciseStats: WeightedExerciseStatistics;
  onPress: (item: WeightedExerciseStatistics) => void;
}) {
  const { colors } = useAppTheme();
  const { t } = useTranslate();

  return (
    <TouchableRipple onPress={() => onPress(exerciseStats)}>
      <View
        style={{
          minHeight: 72,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[3],
          gap: spacing[3],
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            variant="titleMedium"
            numberOfLines={1}
            style={{ fontWeight: '700' }}
          >
            {exerciseStats.exerciseName}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: spacing[3],
              marginTop: spacing[1],
            }}
          >
            <Text
              variant="bodySmall"
              numberOfLines={1}
              style={{ color: colors.onSurfaceVariant }}
            >
              {t('stats.exercise.current_weight.label')} ·{' '}
              <Text style={{ fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                {exerciseStats.maxLiftedPerSessionStatistics.currentValue.shortLocaleFormat()}
              </Text>
            </Text>
            <Text
              variant="bodySmall"
              numberOfLines={1}
              style={{ color: colors.onSurfaceVariant }}
            >
              {t('stats.exercise.estimated_1rm.label')} ·{' '}
              <Text style={{ fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                {exerciseStats.max1RMPerSessionStatistics.currentValue.shortLocaleFormat(
                  0,
                )}
              </Text>
            </Text>
          </View>
        </View>
        <Icon source="chevronRight" size={22} color={colors.onSurfaceVariant} />
      </View>
    </TouchableRipple>
  );
}
