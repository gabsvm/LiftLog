import { LocalDate, OffsetDateTime } from '@js-joda/core';
import {
  SessionBlueprint,
  WeightedExerciseBlueprint,
} from '@/models/blueprint-models';
import {
  PotentialSet,
  RecordedSet,
  RecordedWeightedExercise,
  Session,
} from '@/models/session-models';
import { Weight } from '@/models/weight';
import { applyWorkoutEngineCommand } from '../../modules/workout-worker';
import { describe, expect, it, vi } from 'vitest';
import {
  cycleWeightedSetWithNativeWriter,
  NativeWeightedSetWriterCursor,
} from './native-weighted-set-writer';

const T0 = OffsetDateTime.parse('2026-08-31T15:00:00-03:00');
const T1 = OffsetDateTime.parse('2026-08-31T15:01:00-03:00');
const T2 = OffsetDateTime.parse('2026-08-31T15:02:00-03:00');

function sessionFixture(id = 'native-writer-session'): Session {
  const blueprint = WeightedExerciseBlueprint.empty().with({
    name: 'Bench',
    sets: 2,
    repsPerSet: 8,
  });
  return new Session(
    id,
    new SessionBlueprint('Native writer', [blueprint], ''),
    [
      new RecordedWeightedExercise(
        blueprint,
        [
          new PotentialSet(undefined, new Weight(80, 'kilograms')),
          new PotentialSet(undefined, new Weight(80, 'kilograms')),
        ],
        undefined,
      ),
    ],
    LocalDate.parse('2026-08-31'),
    undefined,
    undefined,
  );
}

function cursor(
  sessionId = 'native-writer-session',
  revision = 0,
  disabled = false,
): NativeWeightedSetWriterCursor {
  return { sessionId, revision, disabled };
}

describe('native weighted set writer experiment', () => {
  it('uses exactly one native command then returns the reconciled Session for the RN commit', () => {
    const session = sessionFixture();
    const executor = vi.fn(applyWorkoutEngineCommand);

    const result = cycleWeightedSetWithNativeWriter({
      session,
      exerciseIndex: 0,
      setIndex: 0,
      time: T1,
      cursor: cursor(),
      executor,
    });

    expect(executor).toHaveBeenCalledTimes(1);
    expect(result.usedNative).toBe(true);
    expect(result.cursor).toEqual({
      sessionId: session.id,
      revision: 1,
      disabled: false,
    });
    const exercise = result.session.recordedExercises[0];
    expect(exercise?.type).toBe('RecordedWeightedExercise');
    if (exercise?.type !== 'RecordedWeightedExercise') return;
    expect(exercise.potentialSets[0]?.set?.repsCompleted).toBe(8);
    expect(exercise.potentialSets[0]?.set?.completionDateTime.equals(T1)).toBe(
      true,
    );
    expect(result.session.restTimerStartTime?.equals(T1)).toBe(true);
  });

  it('falls back to the existing RN cycle once and disables native retries for that session', () => {
    const session = sessionFixture();
    const executor = vi.fn(() => {
      throw new Error('native bridge unavailable');
    });

    const first = cycleWeightedSetWithNativeWriter({
      session,
      exerciseIndex: 0,
      setIndex: 0,
      time: T1,
      cursor: cursor(),
      executor,
    });
    const second = cycleWeightedSetWithNativeWriter({
      session: first.session,
      exerciseIndex: 0,
      setIndex: 1,
      time: T2,
      cursor: first.cursor,
      executor,
    });

    expect(executor).toHaveBeenCalledTimes(1);
    expect(first.usedNative).toBe(false);
    expect(first.nativeError).toBeInstanceOf(Error);
    expect(first.cursor).toEqual({
      sessionId: session.id,
      revision: 0,
      disabled: true,
    });
    expect(second.usedNative).toBe(false);
    expect(second.cursor.disabled).toBe(true);
    const exercise = second.session.recordedExercises[0];
    expect(exercise?.type).toBe('RecordedWeightedExercise');
    if (exercise?.type !== 'RecordedWeightedExercise') return;
    expect(exercise.potentialSets[0]?.set?.repsCompleted).toBe(8);
    expect(exercise.potentialSets[1]?.set?.repsCompleted).toBe(8);
  });

  it('resets a disabled cursor when a different workout session becomes active', () => {
    const session = sessionFixture('next-session');
    const executor = vi.fn(applyWorkoutEngineCommand);

    const result = cycleWeightedSetWithNativeWriter({
      session,
      exerciseIndex: 0,
      setIndex: 0,
      time: T1,
      cursor: cursor('previous-session', 9, true),
      executor,
    });

    expect(executor).toHaveBeenCalledTimes(1);
    expect(result.usedNative).toBe(true);
    expect(result.cursor).toEqual({
      sessionId: 'next-session',
      revision: 1,
      disabled: false,
    });
  });

  it('does not restart rest when a completed set is only decremented', () => {
    const base = sessionFixture();
    const exercise = base.recordedExercises[0];
    if (exercise?.type !== 'RecordedWeightedExercise') {
      throw new Error('fixture must be weighted');
    }
    const session = base.with({
      recordedExercises: [
        exercise.with({
          potentialSets: [
            new PotentialSet(
              new RecordedSet(8, T0),
              new Weight(80, 'kilograms'),
            ),
            exercise.potentialSets[1]!,
          ],
        }),
      ],
      restTimerStartTime: T0,
    });

    const result = cycleWeightedSetWithNativeWriter({
      session,
      exerciseIndex: 0,
      setIndex: 0,
      time: T2,
      cursor: cursor(session.id),
      executor: applyWorkoutEngineCommand,
    });

    const updated = result.session.recordedExercises[0];
    expect(updated?.type).toBe('RecordedWeightedExercise');
    if (updated?.type !== 'RecordedWeightedExercise') return;
    expect(updated.potentialSets[0]?.set?.repsCompleted).toBe(7);
    expect(updated.potentialSets[0]?.set?.completionDateTime.equals(T0)).toBe(
      true,
    );
    expect(result.session.restTimerStartTime?.equals(T0)).toBe(true);
  });
});
