import FullHeightScrollView from '@/components/layout/full-height-scroll-view';
import { gainsLabRadii } from '@/components/presentation/foundation/gainslab-ui';
import { Remote } from '@/components/presentation/foundation/remote';
import { RepsBarChart } from '@/components/presentation/stats/reps-bar-chart';
import { TimePeriodSelector } from '@/components/presentation/stats/time-period-selector';
import { TitledSection } from '@/components/presentation/stats/titled-section';
import { WeightBarChart } from '@/components/presentation/stats/weight-bar-chart';
import { WeightLineChart } from '@/components/presentation/stats/weight-line-chart';
import { spacing, useAppTheme } from '@/hooks/useAppTheme';
import { useAppSelector, useAppSelectorWithArg } from '@/store';
import {
  fetchOverallStats,
  selectExerciseView,
  setOverallViewTime,
  WeightedExerciseStatistics,
} from '@/store/stats';
import { T, useTranslate } from '@tolgee/react';
import { Stack, useFocusEffect } from 'expo-router';
import { useLocalSearchParams, useRouter } from 'expo-router/build/hooks';
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { InteractionManager, View } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { useDispatch } from 'react-redux';

export default function ExpandedExercisePage() {
  const dispatch = useDispatch();
  const timePeriod = useAppSelector((x) => x.stats.overallViewTime);
  const { exerciseName } = useLocalSearchParams<{ exerciseName: string }>();
  const { dismissTo } = useRouter();
  useFocusEffect(
    useCallback(() => {
      dispatch(fetchOverallStats());
    }, [dispatch]),
  );
  useEffect(() => {
    if (!exerciseName) {
      dismissTo('/stats');
    }
  }, [exerciseName, dismissTo]);
  const stats = useAppSelectorWithArg(selectExerciseView, exerciseName);
  return (
    <FullHeightScrollView
      scrollStyle={{ paddingHorizontal: spacing.pageHorizontalMargin }}
      contentContainerStyle={{ gap: spacing[3], paddingBottom: spacing[8] }}
    >
      <Stack.Screen
        options={{
          title: exerciseName,
        }}
      />
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-start',
          paddingTop: spacing[2],
        }}
      >
        <TimePeriodSelector
          timePeriod={timePeriod}
          setTimePeriod={(value) => dispatch(setOverallViewTime(value))}
        />
      </View>
      <Remote
        value={stats}
        success={(stats) => <LoadedStats stats={stats} />}
      />
    </FullHeightScrollView>
  );
}

function LoadedStats({
  stats,
}: {
  stats: WeightedExerciseStatistics | undefined;
}) {
  return stats ? (
    <LoadedStatsFilled stats={stats} />
  ) : (
    <Text>
      <T keyName="stats.no_data.message" />
    </Text>
  );
}

function LoadedStatsFilled({ stats }: { stats: WeightedExerciseStatistics }) {
  const { t } = useTranslate();
  const [showCharts, setShowCharts] = useState(false);

  useEffect(() => {
    setShowCharts(false);
    const task = InteractionManager.runAfterInteractions(() => {
      setShowCharts(true);
    });
    return () => task.cancel();
  }, [stats]);

  return (
    <View style={{ gap: spacing[6] }}>
      <ExerciseOverview stats={stats} />
      {showCharts ? (
        <>
          <StatCardWithTitle title={t('stats.exercise.max_weight.title')} hero>
            <WeightLineChart statistics={stats.maxLiftedPerSessionStatistics} />
          </StatCardWithTitle>
          <StatCardWithTitle title={t('stats.exercise.1rm_progress.title')}>
            <WeightLineChart statistics={stats.max1RMPerSessionStatistics} />
          </StatCardWithTitle>
          <StatCardWithTitle title={t('stats.exercise.volume_per_workout.title')}>
            <WeightBarChart statistics={stats.totalVolumeStatistics} />
          </StatCardWithTitle>
          <StatCardWithTitle title={t('stats.exercise.reps_breakdown.title')}>
            <RepsBarChart statistics={stats.repsStatistics} />
            <Text style={{ textAlign: 'center' }}>
              {t('stats.exercise.reps_breakdown_sets_x_axis.label')}
            </Text>
          </StatCardWithTitle>
        </>
      ) : null}
    </View>
  );
}

function ExerciseOverview({ stats }: { stats: WeightedExerciseStatistics }) {
  const { colors } = useAppTheme();
  const { t } = useTranslate();
  const usualRepRange = getUsualRepRange(stats);

  return (
    <TitledSection title={t('stats.exercise.overview.title')}>
      <View
        style={{
          borderRadius: gainsLabRadii.card,
          overflow: 'hidden',
          backgroundColor: colors.surfaceContainerLow,
        }}
      >
        <View style={{ padding: spacing[5] }}>
          <Text
            style={{
              fontSize: 38,
              lineHeight: 44,
              fontWeight: '800',
              letterSpacing: -1.2,
              fontVariant: ['tabular-nums'],
            }}
          >
            {stats.maxLiftedPerSessionStatistics.currentValue.shortLocaleFormat()}
          </Text>
          <Text
            variant="labelMedium"
            style={{
              marginTop: spacing[1],
              color: colors.onSurfaceVariant,
              fontWeight: '700',
            }}
          >
            {t('stats.exercise.current_weight.label')}
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
            label={t('stats.exercise.sets_per_week.label')}
            value={formatWeeklyRate(stats.setsPerWeek)}
          />
          <MetricDivider />
          <CompactMetric
            label={t('stats.exercise.estimated_1rm.label')}
            value={stats.max1RMPerSessionStatistics.currentValue.shortLocaleFormat(
              0,
            )}
          />
          <MetricDivider />
          <CompactMetric
            label={t('stats.exercise.usual_rep_range.label')}
            value={usualRepRange}
          />
        </View>

        <View
          style={{
            flexDirection: 'row',
            borderTopWidth: 1,
            borderTopColor: colors.outlineVariant,
          }}
        >
          <InlineMetric
            label={t('stats.exercise.max_weight.label')}
            value={stats.maxLiftedPerSessionStatistics.maxValue.shortLocaleFormat()}
          />
          <InlineMetric
            label={t('stats.exercise.total_lifted.label')}
            value={stats.totalVolumeStatistics.totalValue.shortLocaleFormat(0)}
          />
        </View>
      </View>
    </TitledSection>
  );
}

function CompactMetric({ label, value }: { label: string; value: string }) {
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

function InlineMetric({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: spacing[2],
        padding: spacing[3],
      }}
    >
      <Text
        variant="labelSmall"
        numberOfLines={1}
        style={{ color: colors.onSurfaceVariant, flex: 1 }}
      >
        {label}
      </Text>
      <Text
        variant="labelMedium"
        numberOfLines={1}
        style={{ fontWeight: '800', fontVariant: ['tabular-nums'] }}
      >
        {value}
      </Text>
    </View>
  );
}

function MetricDivider() {
  const { colors } = useAppTheme();
  return <View style={{ width: 1, backgroundColor: colors.outlineVariant }} />;
}

function StatCardWithTitle(props: {
  title: string;
  children: ReactNode;
  hero?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <TitledSection title={props.title}>
      <Card
        mode="contained"
        style={{
          borderRadius: gainsLabRadii.card,
          backgroundColor: props.hero
            ? colors.surfaceContainerHigh
            : colors.surfaceContainerLow,
        }}
      >
        <Card.Content style={{ paddingVertical: spacing[5] }}>
          {props.children}
        </Card.Content>
      </Card>
    </TitledSection>
  );
}

function formatWeeklyRate(value: number) {
  return Math.abs(value - Math.round(value)) < 0.05
    ? Math.round(value).toString()
    : value.toFixed(1);
}

function getUsualRepRange(stats: WeightedExerciseStatistics) {
  const breakdown = Object.entries(stats.repsStatistics.breakdown)
    .map(([reps, { numberOfSets }]) => ({
      reps: Number(reps),
      numberOfSets,
    }))
    .sort((a, b) => a.reps - b.reps);

  const totalSets = breakdown.reduce(
    (sum, entry) => sum + entry.numberOfSets,
    0,
  );
  if (!totalSets) {
    return '-';
  }

  const lowerBound = getPercentileRepCount(breakdown, totalSets, 0.1);
  const upperBound = getPercentileRepCount(breakdown, totalSets, 0.9);
  return `${lowerBound}-${upperBound}`;
}

function getPercentileRepCount(
  breakdown: { reps: number; numberOfSets: number }[],
  totalSets: number,
  percentile: number,
) {
  const target = Math.ceil(totalSets * percentile);
  let cumulativeSets = 0;

  for (const entry of breakdown) {
    cumulativeSets += entry.numberOfSets;
    if (cumulativeSets >= target) {
      return entry.reps.toString();
    }
  }

  return breakdown.at(-1)?.reps.toString() ?? '-';
}
