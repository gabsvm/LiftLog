import { OffsetDateTime } from '@js-joda/core';
import { RecordedWeightedExercise } from '@/models/session-models';

export type NativeWeightedSetCycle = (
  setIndex: number,
  time: OffsetDateTime,
) => RecordedWeightedExercise | undefined;

type CommitExerciseUpdate = (
  exercise: RecordedWeightedExercise,
  options?: { resetTimer?: boolean },
) => void;

type RouteWeightedSetTapParams = {
  index: number;
  exercise: RecordedWeightedExercise;
  time: OffsetDateTime;
  nativeCycle?: NativeWeightedSetCycle;
  commitExerciseUpdate: CommitExerciseUpdate;
};

/**
 * Keeps the hot tap path single-writer. When the native experiment is wired,
 * React Native does not also mutate the exercise locally; the reconciled
 * Session comes back through the parent callback and is returned only so the
 * component can keep its interaction ref ahead of React rendering.
 */
export function routeWeightedSetTap({
  index,
  exercise,
  time,
  nativeCycle,
  commitExerciseUpdate,
}: RouteWeightedSetTapParams): RecordedWeightedExercise | undefined {
  if (nativeCycle) {
    return nativeCycle(index, time);
  }

  const previousSet = exercise.getSet(index).set;
  const newExercise = exercise.withCycledRepCount(index, time);
  const newSet = newExercise.getSet(index).set;
  commitExerciseUpdate(newExercise, {
    resetTimer: !previousSet || !newSet,
  });
  return newExercise;
}
