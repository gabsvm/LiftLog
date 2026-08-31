import { OffsetDateTime } from '@js-joda/core';
import { RecordedWeightedExercise } from '@/models/session-models';

export type NativeWeightedSetCycle = (
  setIndex: number,
  time: OffsetDateTime,
) => void;

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
 * Session will come back through the parent callback. With no native writer,
 * the proven low-latency RN path remains byte-for-byte equivalent in behavior.
 */
export function routeWeightedSetTap({
  index,
  exercise,
  time,
  nativeCycle,
  commitExerciseUpdate,
}: RouteWeightedSetTapParams): void {
  if (nativeCycle) {
    nativeCycle(index, time);
    return;
  }

  const previousSet = exercise.getSet(index).set;
  const newExercise = exercise.withCycledRepCount(index, time);
  const newSet = newExercise.getSet(index).set;
  commitExerciseUpdate(newExercise, {
    resetTimer: !previousSet || !newSet,
  });
}
