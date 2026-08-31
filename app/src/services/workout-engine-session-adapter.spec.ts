import BigNumber from 'bignumber.js';
import { Duration, LocalDate, OffsetDateTime } from '@js-joda/core';
import {
  CardioExerciseBlueprint,
  CardioExerciseSetBlueprint,
  SessionBlueprint,
  WeightedExerciseBlueprint,
} from '@/models/blueprint-models';
import {
  PotentialSet,
  RecordedCardioExercise,
  RecordedCardioExerciseSet,
  RecordedSet,
  RecordedWeightedExercise,
  Session,
} from '@/models/session-models';
import { Weight } from '@/models/weight';
import { describe, expect, it } from 'vitest';
import {
  applyWorkoutEngineSnapshotToSession,
  sessionToWorkoutEngineSnapshot,
} from './workout-engine-session-adapter';

function sessionFixture(): Session {
  const weightedBlueprint = WeightedExerciseBlueprint.empty().with({
    name: 'Bench Press',
    sets: 2,
    repsPerSet: 8,
    supersetWithNext: true,
  });
  const cardioSetBlueprint = new CardioExerciseSetBlueprint(
    { type: 'time', value: Duration.ofMinutes(5) },
    true,
    true,
    true,
    true,
    true,
    true,
  );
  const cardioBlueprint = new CardioExerciseBlueprint(
    'Bike',
    [cardioSetBlueprint],
    '',
    '',
  );
  const weighted = new RecordedWeightedExercise(
    weightedBlueprint,
    [
      new PotentialSet(
        new RecordedSet(8, OffsetDateTime.parse('2026-08-31T15:00:00-03:00')),
        new Weight(80, 'kilograms'),
      ),
      new PotentialSet(undefined, new Weight(80, 'kilograms')),
    ],
    undefined,
  );
  const cardio = new RecordedCardioExercise(
    cardioBlueprint,
    [
      new RecordedCardioExerciseSet(
        cardioSetBlueprint,
        OffsetDateTime.parse('2026-08-31T15:10:00-03:00'),
        Duration.ofMinutes(5),
        { value: new BigNumber(1.25), unit: 'kilometre' },
        new BigNumber(5),
        new BigNumber(3),
        new Weight(20, 'kilograms'),
        600,
        undefined,
      ),
    ],
    undefined,
  );

  return new Session(
    'session-adapter',
    new SessionBlueprint('Parity', [weightedBlueprint, cardioBlueprint], ''),
    [weighted, cardio],
    LocalDate.parse('2026-08-31'),
    undefined,
    OffsetDateTime.parse('2026-08-31T15:00:00-03:00'),
  );
}

describe('workout engine session adapter', () => {
  it('projects all weighted and cardio fields needed by the native engine', () => {
    const snapshot = sessionToWorkoutEngineSnapshot(sessionFixture(), 4);

    expect(snapshot).toMatchObject({
      schemaVersion: 2,
      sessionId: 'session-adapter',
      revision: 4,
      status: 'active',
    });
    expect(snapshot.exercises[0]?.sets[0]).toMatchObject({
      completed: true,
      reps: 8,
      completionDateTime: '2026-08-31T15:00:00-03:00',
      weight: 80,
      weightUnit: 'kilograms',
    });
    expect(snapshot.exercises[1]?.sets[0]).toMatchObject({
      completed: true,
      completionDateTime: '2026-08-31T15:10:00-03:00',
      durationSeconds: 300,
      distanceValue: 1.25,
      distanceUnit: 'kilometre',
      resistance: 5,
      incline: 3,
      weight: 20,
      weightUnit: 'kilograms',
      steps: 600,
    });
    expect(snapshot.restTimerEndTime).toBe(
      sessionFixture().restTimerEndTime?.toEpochSecond() ?? null,
    );
  });

  it('reconciles a native weighted result without changing blueprints or notes', () => {
    const original = sessionFixture();
    const snapshot = sessionToWorkoutEngineSnapshot(original, 0);
    const updated = {
      ...snapshot,
      revision: 1,
      exercises: snapshot.exercises.map((exercise, exerciseIndex) =>
        exerciseIndex !== 0
          ? exercise
          : {
              ...exercise,
              sets: exercise.sets.map((set, setIndex) =>
                setIndex !== 1
                  ? set
                  : {
                      ...set,
                      completed: true,
                      reps: 6,
                      completionDateTime: '2026-08-31T15:12:00-03:00',
                      weight: 82.5,
                    },
              ),
            },
      ),
    };

    const result = applyWorkoutEngineSnapshotToSession(original, updated);
    const weighted = result.session.recordedExercises[0];
    expect(weighted?.type).toBe('RecordedWeightedExercise');
    if (weighted?.type !== 'RecordedWeightedExercise') return;
    expect(weighted.blueprint).toBe(original.recordedExercises[0]?.blueprint);
    expect(weighted.potentialSets[1]?.set?.repsCompleted).toBe(6);
    expect(
      weighted.potentialSets[1]?.set?.completionDateTime.equals(
        OffsetDateTime.parse('2026-08-31T15:12:00-03:00'),
      ),
    ).toBe(true);
    expect(weighted.potentialSets[1]?.weight.value.toNumber()).toBe(82.5);
    expect(result.shouldFinish).toBe(false);
  });

  it('returns finish as a bridge result instead of finishing or persisting twice', () => {
    const original = sessionFixture();
    const snapshot = {
      ...sessionToWorkoutEngineSnapshot(original, 0),
      revision: 1,
      status: 'finished' as const,
    };

    const result = applyWorkoutEngineSnapshotToSession(original, snapshot);

    expect(result.shouldFinish).toBe(true);
    expect(result.session.restTimerStartTime).toBe(original.restTimerStartTime);
  });

  it('rejects snapshots from another session or a different exercise shape', () => {
    const original = sessionFixture();
    const snapshot = sessionToWorkoutEngineSnapshot(original, 0);

    expect(() =>
      applyWorkoutEngineSnapshotToSession(original, {
        ...snapshot,
        sessionId: 'other',
      }),
    ).toThrow('session mismatch');
    expect(() =>
      applyWorkoutEngineSnapshotToSession(original, {
        ...snapshot,
        exercises: snapshot.exercises.slice(0, 1),
      }),
    ).toThrow('exercise shape mismatch');
  });
});
