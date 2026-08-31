import { OffsetDateTime } from '@js-joda/core';
import {
  RecordedWeightedExercise,
  Session,
} from '@/models/session-models';
import {
  WORKOUT_ENGINE_SCHEMA_VERSION,
} from '../../modules/workout-worker';
import {
  executeWorkoutEngineCommandDryRun,
  WorkoutEngineCommandExecutor,
} from './workout-engine-bridge';

export type NativeWeightedSetWriterCursor = {
  sessionId: string;
  revision: number;
  /**
   * A native failure disables the experiment for the rest of this Session so
   * every following tap stays on the proven RN path instead of paying for a
   * repeated bridge exception.
   */
  disabled: boolean;
};

export type NativeWeightedSetWriterResult = {
  session: Session;
  cursor: NativeWeightedSetWriterCursor;
  usedNative: boolean;
  nativeError?: unknown;
};

type CycleWeightedSetParams = {
  session: Session;
  exerciseIndex: number;
  setIndex: number;
  time: OffsetDateTime;
  cursor: NativeWeightedSetWriterCursor;
  executor?: WorkoutEngineCommandExecutor;
};

function getWeightedExercise(
  session: Session,
  exerciseIndex: number,
): RecordedWeightedExercise {
  const exercise = session.recordedExercises[exerciseIndex];
  if (!exercise || exercise.type !== 'RecordedWeightedExercise') {
    throw new Error(`weighted exercise ${exerciseIndex} does not exist`);
  }
  return exercise;
}

function normalizeCursor(
  sessionId: string,
  cursor: NativeWeightedSetWriterCursor,
): NativeWeightedSetWriterCursor {
  return cursor.sessionId === sessionId
    ? cursor
    : { sessionId, revision: 0, disabled: false };
}

function applyExistingRestTimerSemantics(
  before: Session,
  after: Session,
  exerciseIndex: number,
  setIndex: number,
): Session {
  const previousExercise = getWeightedExercise(before, exerciseIndex);
  const nextExercise = getWeightedExercise(after, exerciseIndex);
  const previousSet = previousExercise.getSet(setIndex).set;
  const nextSet = nextExercise.getSet(setIndex).set;

  // Preserve the current production behavior exactly: starting a set or
  // clearing it resets the timer as part of the same Session commit, while a
  // simple rep decrement does not restart rest.
  return !previousSet || !nextSet
    ? after.with({ restTimerStartTime: after.lastExercise?.latestTime })
    : after;
}

function cycleWeightedSetWithReactNative(
  session: Session,
  exerciseIndex: number,
  setIndex: number,
  time: OffsetDateTime,
): Session {
  const exercise = getWeightedExercise(session, exerciseIndex);
  const updatedExercise = exercise.withCycledRepCount(setIndex, time);
  const updatedSession = session.withExercise(exerciseIndex, updatedExercise);
  return applyExistingRestTimerSemantics(
    session,
    updatedSession,
    exerciseIndex,
    setIndex,
  );
}

/**
 * Executes the weighted-set mutation through Kotlin but deliberately leaves
 * Redux/persistence ownership in React Native. The caller commits the returned
 * Session exactly once with setCurrentSession.
 *
 * If the native bridge throws or reconciliation fails, this function performs
 * the existing RN mutation synchronously and disables native attempts for the
 * current Session. A new Session id resets the experiment cursor.
 */
export function cycleWeightedSetWithNativeWriter({
  session,
  exerciseIndex,
  setIndex,
  time,
  cursor,
  executor,
}: CycleWeightedSetParams): NativeWeightedSetWriterResult {
  // Validate before entering the fallback boundary. Calling this writer for a
  // cardio/missing exercise is a programming error, not a native bridge fault.
  getWeightedExercise(session, exerciseIndex).getSet(setIndex);

  const activeCursor = normalizeCursor(session.id, cursor);
  if (activeCursor.disabled) {
    return {
      session: cycleWeightedSetWithReactNative(
        session,
        exerciseIndex,
        setIndex,
        time,
      ),
      cursor: activeCursor,
      usedNative: false,
    };
  }

  try {
    const revision = activeCursor.revision + 1;
    const nativeResult = executeWorkoutEngineCommandDryRun(
      session,
      activeCursor.revision,
      {
        schemaVersion: WORKOUT_ENGINE_SCHEMA_VERSION,
        sessionId: session.id,
        revision,
        type: 'toggle-set',
        exerciseIndex,
        setIndex,
        completionDateTime: time.toString(),
      },
      executor,
    );
    return {
      session: applyExistingRestTimerSemantics(
        session,
        nativeResult.session,
        exerciseIndex,
        setIndex,
      ),
      cursor: {
        sessionId: session.id,
        revision: nativeResult.revision,
        disabled: false,
      },
      usedNative: true,
    };
  } catch (nativeError) {
    return {
      session: cycleWeightedSetWithReactNative(
        session,
        exerciseIndex,
        setIndex,
        time,
      ),
      cursor: {
        sessionId: session.id,
        revision: activeCursor.revision,
        disabled: true,
      },
      usedNative: false,
      nativeError,
    };
  }
}
