import FullHeightScrollView from '@/components/layout/full-height-scroll-view';
import { ScreenHeading } from '@/components/presentation/foundation/screen-heading';
import Icon from '@/components/presentation/foundation/gesture-wrappers/icon';
import { Remote } from '@/components/presentation/foundation/remote';
import { ExerciseListSummary } from '@/components/presentation/stats/exercise-list-summary';
import { TimePeriodSelector } from '@/components/presentation/stats/time-period-selector';
import { TitledSection } from '@/components/presentation/stats/titled-section';
import { gainsLabRadii } from '@/components/presentation/foundation/gainslab-ui';
import { spacing, useAppTheme } from '@/hooks/useAppTheme';
import { useAppSelector } from '@/store';
import {
  fetchOverallStats,
  GranularStatisticView,
  selectOverallView,
  setOverallViewTime,
} from '@/store/stats';
import { formatDuration } from '@/utils/format-date';
import { useTranslate } from '@tolgee/react';
import { Stack, useFocusEffect } from 'expo-router';
import { ReactNode, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useDispatch } from 'react-redux';
import { match } from 'ts-pattern';

export default function StatsPage() {
  const { t } = useTranslate();
  const timePeriod = useAppSelector((x) => x.stats.overallViewTime);
  const dispatch = useDispatch();

  useFocusEffect(
    useCallback(() => {
      dispatch(fetchOverallStats());
    }, [dispatch]),
  );

  const stats = useAppSelector(selectOverallView);
  return (
    <FullHeightScrollView
      scrollStyle={{ paddingHorizontal: spacing.pageHorizontalMargin }}
      contentContainerStyle={styles.content}
    >
      <Stack.Screen
        options={{
          title: t('navigation.progress'),
          headerShown: false,
        }}
      />
      <ScreenHeading
        title={t('stats.statistics.title')}
        subtitle={t('screen.stats.subtitle')}
      />
      <View style={styles.period}>
        <TimePeriodSelector
          timePeriod={timePeriod}
          setTimePeriod={(value) => dispatch(setOverallViewTime(value))}
        />
      </View>
      <Remote
        value={stats}
        success={(loadedStats) => <LoadedStats stats={loadedStats} />}
      />
    </FullHeightScrollView>
  );
}

function LoadedStats({ stats }: { stats: GranularStatisticView }) {
  return (
    <View style={styles.loaded}>
      <TrainingOverview stats={stats} />
      <ExerciseListSummary stats={stats} />
    </View>
  );
}

function TrainingOverview({ stats }: { stats: GranularStatisticView }) {
  const { t } = useTranslate();
  const { colors } = useAppTheme();

  return (
    <TitledSection title={t('stats.overview.title')}>
      <View
        style={{
          borderRadius: gainsLabRadii.card,
          backgroundColor: colors.surfaceContainerLow,
          overflow: 'hidden',
        }}
      >
        <View style={{ padding: spacing[5] }}>
          <Text
            style={{
              fontSize: 40,
              lineHeight: 46,
              fontWeight: '800',
              letterSpacing: -1.4,
              fontVariant: ['tabular-nums'],
            }}
          >
            {formatWeeklyRate(stats.workoutsPerWeek)}
          </Text>
          <Text
            variant="labelMedium"
            style={{
              marginTop: spacing[1],
              color: colors.onSurfaceVariant,
              fontWeight: '700',
            }}
          >
            {t('stats.workouts_per_week.label')}
          </Text>
        </View>

        <View
          style={{
            flexDirection: 'row',
            borderTopWidth: 1,
            borderTopColor: colors.outlineVariant,
          }}
        >
          <CompactMetric
            label={t('stats.sets_per_week.label')}
            value={formatWeeklyRate(stats.setsPerWeek)}
          />
          <MetricDivider />
          <CompactMetric
            label={t('workout.average_length.label')}
            value={formatDuration(stats.averageSessionLength, 'mins')}
          />
          <MetricDivider />
          <CompactMetric
            label={t('stats.bodyweight_change.label')}
            value={<BodyweightStatValue stats={stats} />}
          />
        </View>
      </View>
    </TitledSection>
  );
}

function CompactMetric({ label, value }: { label: string; value: ReactNode }) {
  const { colors } = useAppTheme();
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[4],
      }}
    >
      <Text
        variant="titleMedium"
        numberOfLines={1}
        style={{ fontWeight: '800', fontVariant: ['tabular-nums'] }}
      >
        {value}
      </Text>
      <Text
        variant="labelSmall"
        numberOfLines={2}
        style={{
          marginTop: spacing[1],
          color: colors.onSurfaceVariant,
          lineHeight: 15,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function MetricDivider() {
  const { colors } = useAppTheme();
  return <View style={{ width: 1, backgroundColor: colors.outlineVariant }} />;
}

const styles = StyleSheet.create({
  content: {
    gap: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[8],
  },
  period: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  loaded: {
    gap: spacing[6],
  },
});

function formatWeeklyRate(value: number) {
  return Math.abs(value - Math.round(value)) < 0.05
    ? Math.round(value).toString()
    : value.toFixed(1);
}

function BodyweightStatValue({
  stats: { bodyweightStats },
}: {
  stats: GranularStatisticView;
}) {
  const showBodyweight = useAppSelector((x) => x.settings.showBodyweight);
  if (!showBodyweight || bodyweightStats.statistics.length === 0) {
    return <Text>—</Text>;
  }

  const currentValue = bodyweightStats.currentValue;
  const earliestValue = bodyweightStats.statistics[0]!.value;
  const change = currentValue.minus(earliestValue);
  const changeDirection = match({
    zero: change.value.isZero(),
    positive: change.value.isPositive(),
  })
    .with({ zero: true }, () => <Icon source={'plusMinus'} size={12} />)
    .with({ positive: true }, () => <Icon source={'plus'} size={12} />)
    .with({ positive: false }, () => <Icon source={'minus'} size={12} />)
    .exhaustive();

  return (
    <Text style={{ fontVariant: ['tabular-nums'] }}>
      {currentValue.shortLocaleFormat(0)} ({changeDirection}
      {change.abs().shortLocaleFormat(2)})
    </Text>
  );
}
