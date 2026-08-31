import { LocalDate, OffsetDateTime } from '@js-joda/core';
import { SessionBlueprint, WeightedExerciseBlueprint } from '@/models/blueprint-models';
import {
  PotentialSet,
  RecordedWeightedExercise,
  Session,
} from '@/models/session-models';
import { Weight } from '@/models/weight';
import {
  applyWorkoutEngineCommand,
  WorkoutEngineCommand,
} from '../../modules/workout-worker';
import { describe, expect, it, vi } from 'vitest';
import {
  executeWorkoutEngineCommandDryRun,
  validateWorkoutEngineRoundTrip,
} from './workout-engine-bridge';

function sessionFixture(): Session {
  const blueprint = WeightedExerciseBlueprint.empty().with({
    name: 'Bench',
    sets: 2,
    repsPerSet: 8,
  });
  return new Session(
    'bridge-session',
    new SessionBlueprint('Bridge', [blueprint], ''),
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

describe('workout engine dry-run bridge', () => {
  it('round trips a real session through the engine snapshot without persistence', () => {
    const session = sessionFixture();
    const result = validateWorkoutEngineRoundTrip(session, 3, (snapshot) => snapshot);

    expect(result.revision).toBe(3);
    expect(result.shouldFinish).toBe(false);
    expect(result.session.equals(session)).toBe(true);
  });

  it('executes exactly one engine command and returns a reconciled session', () => {
    const session = sessionFixture();
    const executor = vi.fn(applyWorkoutEngineCommand);
    const command: WorkoutEngineCommand = {
      schemaVersion: 2,
      sessionId: session.id,
      revision: 1,
      type: 'toggle-set',
      exerciseIndex: 0,
      setIndex: 0,
      completionDateTime: '2026-08-31T15:00:00-03:00',
    };

    const result = executeWorkoutEngineCommandDryRun(
      session,
      0,
      command,
      executor,
    );

    expect(executor).toHaveBeenCalledTimes(1);
    const weighted = result.session.recordedExercises[0];
    expect(weighted?.type).toBe('RecordedWeightedExercise');
    if (weighted?.type !== 'RecordedWeightedExercise') return;
    expect(weighted.potentialSets[0]?.set?.repsCompleted).toBe(8);
    expect(
      weighted.potentialSets[0]?.set?.completionDateTime.equals(
        OffsetDateTime.parse('2026-08-31T15:00:00-03:00'),
      ),
    ).toBe(true);
    expect(result.revision).toBe(1);
  });

  it('rejects commands that do not represent the next revision for this session', () => {
    const session = sessionFixture();

    expect(() =>
      executeWorkoutEngineCommandDryRun(session, 4, {
        schemaVersion: 2,
        sessionId: session.id,
        revision: 4,
        type: 'finish',
      }),
    ).toThrow('next revision');

    expect(() =>
      executeWorkoutEngineCommandDryRun(session, 4, {
        schemaVersion: 2,
        sessionId: 'other',
        revision: 5,
        type: 'finish',
      }),
    ).toThrow('session mismatch');
  });

  it('returns finish intent without calling persistence or navigation', () => {
    const session = sessionFixture();
    const result = executeWorkoutEngineCommandDryRun(
      session,
      0,
      {
        schemaVersion: 2,
        sessionId: session.id,
        revision: 1,
        type: 'finish',
      },
      applyWorkoutEngineCommand,
    );

    expect(result.shouldFinish).toBe(true);
    expect(result.revision).toBe(1);
  });
});
