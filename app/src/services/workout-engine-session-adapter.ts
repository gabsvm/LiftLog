import BigNumber from 'bignumber.js';
import { Duration, OffsetDateTime } from '@js-joda/core';
import { DistanceUnit, DistanceUnits } from '@/models/blueprint-models';
import {
  PotentialSet,
  RecordedCardioExercise,
  RecordedCardioExerciseSet,
  RecordedSet,
  RecordedWeightedExercise,
  Session,
} from '@/models/session-models';
import { Weight, WeightUnit } from '@/models/weight';
import {
  parseWorkoutEngineSnapshot,
  WorkoutEngineExerciseSnapshot,
  WorkoutEngineSetSnapshot,
  WorkoutEngineSnapshot,
  WORKOUT_ENGINE_SCHEMA_VERSION,
} from '../../modules/workout-worker';

export type WorkoutEngineSessionResult = {
  session: Session;
  /**
   * Finishing remains a React Native/navigation concern until native
   * persistence becomes the single writer. This flag lets the bridge request
   * the existing finish flow without duplicating it in Kotlin.
   */
  shouldFinish: boolean;
  revision: number;
};

function nullableNumber(value: BigNumber | undefined): number | null {
  return value?.toNumber() ?? null;
}

function weightedSetToSnapshot(
  setIndex: number,
  potentialSet: PotentialSet,
): WorkoutEngineSetSnapshot {
  return {
    setIndex,
    completed: potentialSet.set !== undefined,
    reps: potentialSet.set?.repsCompleted ?? null,
    completionDateTime: potentialSet.set?.completionDateTime.toString() ?? null,
    weight: potentialSet.weight.value.toNumber(),
    weightUnit: potentialSet.weight.unit,
    durationSeconds: null,
    distanceValue: null,
    distanceUnit: null,
    resistance: null,
    incline: null,
    steps: null,
    currentBlockStartTime: null,
  };
}

function cardioSetToSnapshot(
  setIndex: number,
  set: RecordedCardioExerciseSet,
): WorkoutEngineSetSnapshot {
  return {
    setIndex,
    completed: set.isCompletelyFilled,
    reps: null,
    completionDateTime: set.completionDateTime?.toString() ?? null,
    weight: set.weight?.value.toNumber() ?? null,
    weightUnit: set.weight?.unit ?? null,
    durationSeconds: set.duration ? set.duration.toMillis() / 1000 : null,
    distanceValue: set.distance?.value.toNumber() ?? null,
    distanceUnit: set.distance?.unit ?? null,
    resistance: nullableNumber(set.resistance),
    incline: nullableNumber(set.incline),
    steps: set.steps ?? null,
    currentBlockStartTime: set.currentBlockStartTime?.toString() ?? null,
  };
}

export function sessionToWorkoutEngineSnapshot(
  session: Session,
  revision: number,
): WorkoutEngineSnapshot {
  if (!Number.isInteger(revision) || revision < 0) {
    throw new Error('workout engine revision must be a non-negative integer');
  }

  const exercises: WorkoutEngineExerciseSnapshot[] =
    session.recordedExercises.map((exercise, exerciseIndex) => {
      if (exercise.type === 'RecordedWeightedExercise') {
        return {
          exerciseIndex,
          type: 'weighted',
          repsPerSet: exercise.blueprint.repsPerSet,
          supersetWithNext: exercise.blueprint.supersetWithNext,
          sets: exercise.potentialSets.map((set, setIndex) =>
            weightedSetToSnapshot(setIndex, set),
          ),
        };
      }

      return {
        exerciseIndex,
        type: 'cardio',
        repsPerSet: null,
        supersetWithNext: false,
        sets: exercise.sets.map((set, setIndex) =>
          cardioSetToSnapshot(setIndex, set),
        ),
      };
    });

  return parseWorkoutEngineSnapshot({
    schemaVersion: WORKOUT_ENGINE_SCHEMA_VERSION,
    sessionId: session.id,
    revision,
    // A completed Session is not automatically "finished". The existing RN
    // finish flow remains authoritative until the native path owns persistence.
    status: 'active',
    exercises,
    restTimerStartTime: session.restTimerStartTime?.toString() ?? null,
    restTimerEndTime: session.restTimerEndTime?.toEpochSecond() ?? null,
    error: null,
  });
}

function requireWeightUnit(unit: string | null, context: string): WeightUnit {
  if (unit === 'kilograms' || unit === 'pounds' || unit === 'nil') return unit;
  throw new Error(`${context}: invalid weight unit`);
}

function requireDistanceUnit(
  unit: string | null,
  context: string,
): DistanceUnit {
  if (unit && DistanceUnits.includes(unit as DistanceUnit)) {
    return unit as DistanceUnit;
  }
  throw new Error(`${context}: invalid distance unit`);
}

function parseDateTime(value: string | null, context: string): OffsetDateTime {
  if (!value) throw new Error(`${context}: completion timestamp is required`);
  return OffsetDateTime.parse(value);
}

function reconcileWeightedExercise(
  current: RecordedWeightedExercise,
  snapshot: WorkoutEngineExerciseSnapshot,
): RecordedWeightedExercise {
  if (snapshot.type !== 'weighted') {
    throw new Error('exercise shape mismatch: expected weighted exercise');
  }
  if (snapshot.sets.length !== current.potentialSets.length) {
    throw new Error('exercise shape mismatch: weighted set count changed');
  }

  return current.with({
    potentialSets: snapshot.sets.map((set, setIndex) => {
      if (set.weight === null) {
        throw new Error(`weighted set ${setIndex}: weight is required`);
      }
      const weight = new Weight(
        set.weight,
        requireWeightUnit(set.weightUnit, `weighted set ${setIndex}`),
      );
      if (!set.completed) {
        if (set.reps !== null || set.completionDateTime !== null) {
          throw new Error(
            `weighted set ${setIndex}: incomplete set cannot carry reps/timestamp`,
          );
        }
        return new PotentialSet(undefined, weight);
      }
      if (set.reps === null) {
        throw new Error(`weighted set ${setIndex}: completed set requires reps`);
      }
      return new PotentialSet(
        new RecordedSet(
          set.reps,
          parseDateTime(
            set.completionDateTime,
            `weighted set ${setIndex}`,
          ),
        ),
        weight,
      );
    }),
  });
}

function reconcileCardioExercise(
  current: RecordedCardioExercise,
  snapshot: WorkoutEngineExerciseSnapshot,
): RecordedCardioExercise {
  if (snapshot.type !== 'cardio') {
    throw new Error('exercise shape mismatch: expected cardio exercise');
  }
  if (snapshot.sets.length !== current.sets.length) {
    throw new Error('exercise shape mismatch: cardio set count changed');
  }

  return current.with({
    sets: snapshot.sets.map((set, setIndex) => {
      const currentSet = current.sets[setIndex];
      if (!currentSet) {
        throw new Error(`exercise shape mismatch: cardio set ${setIndex} missing`);
      }
      if ((set.weight === null) !== (set.weightUnit === null)) {
        throw new Error(`cardio set ${setIndex}: weight and unit must travel together`);
      }
      if ((set.distanceValue === null) !== (set.distanceUnit === null)) {
        throw new Error(
          `cardio set ${setIndex}: distance and unit must travel together`,
        );
      }

      const reconciled = new RecordedCardioExerciseSet(
        currentSet.blueprint,
        set.completionDateTime
          ? OffsetDateTime.parse(set.completionDateTime)
          : undefined,
        set.durationSeconds === null
          ? undefined
          : Duration.ofMillis(Math.round(set.durationSeconds * 1000)),
        set.distanceValue === null
          ? undefined
          : {
              value: new BigNumber(set.distanceValue),
              unit: requireDistanceUnit(
                set.distanceUnit,
                `cardio set ${setIndex}`,
              ),
            },
        set.resistance === null ? undefined : new BigNumber(set.resistance),
        set.incline === null ? undefined : new BigNumber(set.incline),
        set.weight === null
          ? undefined
          : new Weight(
              set.weight,
              requireWeightUnit(set.weightUnit, `cardio set ${setIndex}`),
            ),
        set.steps ?? undefined,
        set.currentBlockStartTime
          ? OffsetDateTime.parse(set.currentBlockStartTime)
          : undefined,
      );

      if (reconciled.isCompletelyFilled !== set.completed) {
        throw new Error(
          `cardio set ${setIndex}: completed flag does not match cardio data`,
        );
      }
      return reconciled;
    }),
  });
}

export function applyWorkoutEngineSnapshotToSession(
  session: Session,
  rawSnapshot: WorkoutEngineSnapshot,
): WorkoutEngineSessionResult {
  const snapshot = parseWorkoutEngineSnapshot(rawSnapshot);
  if (snapshot.sessionId !== session.id) {
    throw new Error('session mismatch: native snapshot belongs to another session');
  }
  if (snapshot.exercises.length !== session.recordedExercises.length) {
    throw new Error('exercise shape mismatch: exercise count changed');
  }

  const recordedExercises = session.recordedExercises.map(
    (exercise, exerciseIndex) => {
      const nativeExercise = snapshot.exercises[exerciseIndex];
      if (!nativeExercise) {
        throw new Error(`exercise shape mismatch: exercise ${exerciseIndex} missing`);
      }
      return exercise.type === 'RecordedWeightedExercise'
        ? reconcileWeightedExercise(exercise, nativeExercise)
        : reconcileCardioExercise(exercise, nativeExercise);
    },
  );

  return {
    session: session.with({
      recordedExercises,
      restTimerStartTime: snapshot.restTimerStartTime
        ? parseDateTime(snapshot.restTimerStartTime, 'restTimerStartTime')
        : undefined,
    }),
    shouldFinish: snapshot.status === 'finished',
    revision: snapshot.revision,
  };
}
