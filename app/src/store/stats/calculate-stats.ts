import { NormalizedName } from '@/models/blueprint-models';
import {
  RecordedWeightedExercise,
  Session,
} from '@/models/session-models';
import { LocalDateRange } from '@/models/time-models';
import { Weight, WeightUnit } from '@/models/weight';
import {
  GranularStatisticView,
  HeaviestLift,
  OptionalStatisticOverTime,
  RepsBreakdownStatistics,
  TimeTrackedStatistic,
  WeightedExerciseStatistics,
  WeightedStatisticOverTime,
} from '@/store/stats';
import { Duration, OffsetDateTime, ZoneId } from '@js-joda/core';
import BigNumber from 'bignumber.js';

export function calculateStats(
  sessions: Session[],
  preferredUnit: WeightUnit,
  timeRange: LocalDateRange,
): GranularStatisticView {
  if (!sessions.length)
    return {
      workoutsPerWeek: 0,
      setsPerWeek: 0,
      averageSessionLength: Duration.ZERO,
      maxWeightLiftedInAWorkout: undefined,
      bodyweightStats: {
        statistics: [],
        currentValue: Weight.NIL,
        totalValue: Weight.NIL,
        minValue: Weight.NIL,
        maxValue: Weight.NIL,
      },
      weightedExerciseStats: [],
      heaviestLift: undefined,
      sessionStats: [],
    };

  const sessionsWithExercises = sessions.filter(
    (session) => session.recordedExercises.length > 0,
  );

  const uniqueDays = new Map<string, Session['date']>();
  let totalSets = 0;
  for (const session of sessionsWithExercises) {
    uniqueDays.set(session.date.toString(), session.date);
    for (const exercise of session.recordedExercises) {
      if (exercise instanceof RecordedWeightedExercise) {
        for (const set of exercise.potentialSets) {
          if (set.set !== undefined) totalSets += 1;
        }
      } else {
        for (const set of exercise.sets) {
          if (set.completionDateTime !== undefined) totalSets += 1;
        }
      }
    }
  }
  const daysBetween = [...uniqueDays.values()];
  const workoutCount = sessionsWithExercises.length;
  const totalDays = timeRange.to.toEpochDay() - timeRange.from.toEpochDay() + 1;
  const totalWeeks = Math.max(totalDays / 7, 1);
  const workoutsPerWeek = workoutCount / totalWeeks;
  const setsPerWeek = totalSets / totalWeeks;

  const bodyWeightStatistics: TimeTrackedStatistic<Weight>[] = [];
  for (const session of sessions) {
    if (!session.bodyweight) continue;
    bodyWeightStatistics.push({
      dateTime: session.date
        .atTime(12, 0)
        .atZone(ZoneId.systemDefault())
        .toOffsetDateTime(),
      value: session.bodyweight,
    });
  }
  const bodyweightStats =
    unsortedStatsToWeightedStatisticOverTime(bodyWeightStatistics);

  // Group by plan-session name and index each group by date once. The previous
  // implementation called Array.find for every date in every group.
  const sessionsByBlueprint = new Map<string, Map<string, Session>>();
  for (const session of sessionsWithExercises) {
    let byDate = sessionsByBlueprint.get(session.blueprint.name);
    if (!byDate) {
      byDate = new Map();
      sessionsByBlueprint.set(session.blueprint.name, byDate);
    }
    const dateKey = session.date.toString();
    if (!byDate.has(dateKey)) {
      // Preserve the previous first-match behavior when two workouts with the
      // same name were completed on the same day.
      byDate.set(dateKey, session);
    }
  }

  const sessionStats: OptionalStatisticOverTime<Weight>[] = [];
  for (const [name, groupByDate] of sessionsByBlueprint) {
    const statistics: TimeTrackedStatistic<Weight | undefined>[] = [];
    let min = Weight.NIL;
    let max = Weight.NIL;
    let hasValue = false;

    for (const date of daysBetween) {
      const session = groupByDate.get(date.toString());
      const value = session?.totalWeightLifted;
      statistics.push({
        dateTime: date
          .atTime(12, 0)
          .atZone(ZoneId.systemDefault())
          .toOffsetDateTime(),
        value,
      });
      if (value) {
        if (!hasValue || value.isGreaterThan(max)) max = value;
        if (!hasValue || min.isGreaterThan(value)) min = value;
        hasValue = true;
      }
    }
    statistics.sort((a, b) => a.dateTime.compareTo(b.dateTime));
    sessionStats.push({
      title: name,
      statistics,
      minValue: hasValue ? min : Weight.NIL,
      maxValue: hasValue ? max : Weight.NIL,
    });
  }

  interface ExerciseStatAcc {
    exerciseName: string;
    maxWeightStatistics: TimeTrackedStatistic<Weight>[];
    max1RMStatistics: TimeTrackedStatistic<Weight>[];
    totalVolumeStatistics: TimeTrackedStatistic<Weight>[];
    repsStatistics: RepsBreakdownStatistics;
    latestTime: OffsetDateTime;
  }
  const exerciseStatsMap = new Map<string, ExerciseStatAcc>();
  let heaviestLift: HeaviestLift | undefined;

  function calculateOneRepMax(weight: Weight, reps: number): Weight {
    return weight.multipliedBy(
      new BigNumber(1).plus(new BigNumber(reps).div(30)),
    );
  }

  for (const session of sessionsWithExercises) {
    for (const ex of session.recordedExercises) {
      if (!ex.isStarted) continue;

      const blueprint = ex.blueprint;
      const key = NormalizedName.fromExerciseBlueprint(blueprint).toString();
      let exerciseStats = exerciseStatsMap.get(key);
      if (!exerciseStats) {
        exerciseStats = {
          exerciseName: blueprint.name,
          maxWeightStatistics: [],
          max1RMStatistics: [],
          repsStatistics: { breakdown: {} },
          totalVolumeStatistics: [],
          latestTime: OffsetDateTime.MIN,
        };
        exerciseStatsMap.set(key, exerciseStats);
      }

      if (!(ex instanceof RecordedWeightedExercise)) {
        continue;
      }

      let maxWeight: Weight | undefined;
      let max1RM: Weight | undefined;
      let totalVolume = Weight.NIL;
      let latestSetTime: OffsetDateTime | undefined;
      const repsInExercise = new Map<number, number>();

      for (const potentialSet of ex.potentialSets) {
        const recordedSet = potentialSet.set;
        if (!recordedSet) continue;

        if (!maxWeight || potentialSet.weight.isGreaterThan(maxWeight)) {
          maxWeight = potentialSet.weight;
        }

        if (recordedSet.repsCompleted !== 0) {
          const oneRepMax = calculateOneRepMax(
            potentialSet.weight,
            recordedSet.repsCompleted,
          );
          if (!max1RM || oneRepMax.isGreaterThan(max1RM)) {
            max1RM = oneRepMax;
          }
        }

        totalVolume = totalVolume.plus(
          potentialSet.weight.multipliedBy(recordedSet.repsCompleted),
        );
        repsInExercise.set(
          recordedSet.repsCompleted,
          (repsInExercise.get(recordedSet.repsCompleted) ?? 0) + 1,
        );
        if (
          !latestSetTime ||
          recordedSet.completionDateTime.isAfter(latestSetTime)
        ) {
          latestSetTime = recordedSet.completionDateTime;
        }
      }

      if (maxWeight) {
        if (!heaviestLift || maxWeight.isGreaterThan(heaviestLift.weight)) {
          heaviestLift = {
            exerciseName: ex.blueprint.name,
            weight: maxWeight,
          };
        }
      } else {
        continue;
      }

      // Keep the previous semantics: a weighted exercise only contributes its
      // detailed series when at least one completed set has non-zero reps.
      if (!max1RM || !latestSetTime) {
        continue;
      }

      for (const [reps, count] of repsInExercise) {
        exerciseStats.repsStatistics.breakdown[reps] ??= { numberOfSets: 0 };
        exerciseStats.repsStatistics.breakdown[reps].numberOfSets += count;
      }

      if (exerciseStats.latestTime.isBefore(latestSetTime)) {
        exerciseStats.latestTime = latestSetTime;
      }
      exerciseStats.maxWeightStatistics.push({
        dateTime: latestSetTime,
        value: maxWeight,
      });
      exerciseStats.max1RMStatistics.push({
        dateTime: latestSetTime,
        value: max1RM,
      });
      exerciseStats.totalVolumeStatistics.push({
        dateTime: latestSetTime,
        value: totalVolume,
      });
    }
  }

  const exerciseStats: WeightedExerciseStatistics[] = [];
  for (const ex of exerciseStatsMap.values()) {
    let completedSetCount = 0;
    for (const entry of Object.values(ex.repsStatistics.breakdown)) {
      completedSetCount += entry.numberOfSets;
    }
    exerciseStats.push({
      exerciseName: ex.exerciseName,
      setsPerWeek: completedSetCount / totalWeeks,
      maxLiftedPerSessionStatistics: unsortedStatsToWeightedStatisticOverTime(
        ex.maxWeightStatistics,
      ),
      max1RMPerSessionStatistics: unsortedStatsToWeightedStatisticOverTime(
        ex.max1RMStatistics,
      ),
      totalVolumeStatistics: unsortedStatsToWeightedStatisticOverTime(
        ex.totalVolumeStatistics,
      ),
      repsStatistics: ex.repsStatistics,
    });
  }

  let totalSessionDuration = Duration.ZERO;
  let durationCount = 0;
  for (const session of sessionsWithExercises) {
    const duration = session.duration;
    if (duration) {
      totalSessionDuration = totalSessionDuration.plus(duration);
      durationCount += 1;
    }
  }
  const averageSessionLength = durationCount
    ? totalSessionDuration.dividedBy(durationCount)
    : Duration.ZERO;

  let maxWeightLiftedInAWorkout = Weight.NIL;
  for (const stat of sessionStats) {
    if (stat.maxValue.isGreaterThan(maxWeightLiftedInAWorkout)) {
      maxWeightLiftedInAWorkout = stat.maxValue;
    }
  }

  return {
    workoutsPerWeek,
    setsPerWeek,
    maxWeightLiftedInAWorkout:
      maxWeightLiftedInAWorkout.convertTo(preferredUnit),
    averageSessionLength,
    heaviestLift,
    weightedExerciseStats: exerciseStats,
    sessionStats,
    bodyweightStats,
  };
}

function unsortedStatsToWeightedStatisticOverTime(
  unsortedStats: TimeTrackedStatistic<Weight>[],
): WeightedStatisticOverTime {
  const statistics = [...unsortedStats].sort((a, b) =>
    a.dateTime.compareTo(b.dateTime),
  );
  let max = Weight.NIL;
  let min = Weight.NIL;
  let total = Weight.NIL;

  for (const stat of statistics) {
    if (stat.value.isGreaterThan(max) || max.equals(Weight.NIL))
      max = stat.value;
    if (min.isGreaterThan(stat.value) || min.equals(Weight.NIL))
      min = stat.value;
    total = total.plus(stat.value);
  }
  return {
    statistics,
    currentValue: statistics.at(-1)?.value ?? Weight.NIL,
    totalValue: total,
    maxValue: max,
    minValue: min,
  };
}
