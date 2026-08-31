import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  applyWorkoutEngineCommand,
  parseWorkoutEngineCommand,
  parseWorkoutEngineSnapshot,
  serializeWorkoutEngineSnapshot,
  WorkoutEngineCommand,
  WorkoutEngineSnapshot,
  WORKOUT_ENGINE_SCHEMA_VERSION,
} from './WorkoutEngineModule';

type ParityFixture = {
  initial: WorkoutEngineSnapshot;
  commands: WorkoutEngineCommand[];
  expected: WorkoutEngineSnapshot;
};

function loadParityFixture(): ParityFixture {
  return JSON.parse(
    readFileSync('modules/workout-worker/fixtures/workout-engine-parity-v2.json', 'utf8'),
  ) as ParityFixture;
}

const baseSnapshot: WorkoutEngineSnapshot = {
  schemaVersion: 2,
  sessionId: 'session-1',
  revision: 0,
  status: 'active',
  exercises: [
    {
      exerciseIndex: 0,
      type: 'weighted',
      repsPerSet: 8,
      supersetWithNext: true,
      sets: [
        {
          setIndex: 0,
          completed: false,
          reps: null,
          completionDateTime: null,
          weight: 80,
          weightUnit: 'kilograms',
          durationSeconds: null,
          distanceValue: null,
          distanceUnit: null,
          resistance: null,
          incline: null,
          steps: null,
          currentBlockStartTime: null,
        },
        {
          setIndex: 1,
          completed: false,
          reps: null,
          completionDateTime: null,
          weight: 80,
          weightUnit: 'kilograms',
          durationSeconds: null,
          distanceValue: null,
          distanceUnit: null,
          resistance: null,
          incline: null,
          steps: null,
          currentBlockStartTime: null,
        },
        {
          setIndex: 2,
          completed: true,
          reps: 7,
          completionDateTime: '2026-08-31T14:59:00-03:00',
          weight: 80,
          weightUnit: 'kilograms',
          durationSeconds: null,
          distanceValue: null,
          distanceUnit: null,
          resistance: null,
          incline: null,
          steps: null,
          currentBlockStartTime: null,
        },
      ],
    },
  ],
  restTimerStartTime: null,
  restTimerEndTime: null,
  error: null,
};

type WorkoutEngineCommandPayload =
  WorkoutEngineCommand extends infer Command
    ? Command extends WorkoutEngineCommand
      ? Omit<Command, 'schemaVersion' | 'sessionId' | 'revision'>
      : never
    : never;

function command(
  payload: WorkoutEngineCommandPayload,
  revision = 1,
): WorkoutEngineCommand {
  return {
    schemaVersion: WORKOUT_ENGINE_SCHEMA_VERSION,
    sessionId: 'session-1',
    revision,
    ...payload,
  };
}

describe('WorkoutEngine contract v2', () => {
  it('applies the shared parity fixture exactly', () => {
    const fixture = loadParityFixture();
    const result = fixture.commands.reduce(
      (snapshot, nextCommand) =>
        applyWorkoutEngineCommand(snapshot, parseWorkoutEngineCommand(nextCommand)),
      parseWorkoutEngineSnapshot(fixture.initial),
    );

    expect(result).toEqual(parseWorkoutEngineSnapshot(fixture.expected));
  });

  it('round trips weighted timestamps and cardio fields without changing shape', () => {
    const fixture = loadParityFixture();
    const parsed = parseWorkoutEngineSnapshot(
      JSON.parse(serializeWorkoutEngineSnapshot(fixture.initial)),
    );

    expect(parsed).toEqual(fixture.initial);
    expect(parsed.exercises[1]?.sets[0]).toMatchObject({
      durationSeconds: 300,
      distanceValue: 1.25,
      distanceUnit: 'kilometre',
      resistance: 5,
      incline: 3,
      steps: 600,
      completionDateTime: '2026-08-31T14:55:00-03:00',
    });
  });

  it('records completion time only when a weighted set becomes completed', () => {
    const completed = applyWorkoutEngineCommand(
      baseSnapshot,
      command({
        type: 'toggle-set',
        exerciseIndex: 0,
        setIndex: 0,
        completionDateTime: '2026-08-31T15:00:00-03:00',
      }),
    );
    const decremented = applyWorkoutEngineCommand(
      completed,
      command(
        {
          type: 'toggle-set',
          exerciseIndex: 0,
          setIndex: 0,
          completionDateTime: '2026-08-31T15:01:00-03:00',
        },
        2,
      ),
    );

    expect(completed.exercises[0]?.sets[0]).toMatchObject({
      completed: true,
      reps: 8,
      completionDateTime: '2026-08-31T15:00:00-03:00',
    });
    expect(decremented.exercises[0]?.sets[0]).toMatchObject({
      completed: true,
      reps: 7,
      completionDateTime: '2026-08-31T15:00:00-03:00',
    });
  });

  it('clears reps and completion time together', () => {
    const cleared = applyWorkoutEngineCommand(
      baseSnapshot,
      command({
        type: 'update-reps',
        exerciseIndex: 0,
        setIndex: 2,
        reps: null,
        completionDateTime: null,
      }),
    );

    expect(cleared.exercises[0]?.sets[2]).toMatchObject({
      completed: false,
      reps: null,
      completionDateTime: null,
    });
  });

  it('matches WeightAppliesTo semantics for thisSet, uncompletedSets and allSets', () => {
    const thisSet = applyWorkoutEngineCommand(
      baseSnapshot,
      command({
        type: 'update-weight',
        exerciseIndex: 0,
        setIndex: 0,
        weight: 81,
        weightUnit: 'kilograms',
        applyTo: 'thisSet',
      }),
    );
    expect(thisSet.exercises[0]?.sets.map((set) => set.weight)).toEqual([
      81,
      80,
      80,
    ]);

    const uncompleted = applyWorkoutEngineCommand(
      baseSnapshot,
      command({
        type: 'update-weight',
        exerciseIndex: 0,
        setIndex: 0,
        weight: 82,
        weightUnit: 'kilograms',
        applyTo: 'uncompletedSets',
      }),
    );
    expect(uncompleted.exercises[0]?.sets.map((set) => set.weight)).toEqual([
      82,
      82,
      80,
    ]);

    const all = applyWorkoutEngineCommand(
      baseSnapshot,
      command({
        type: 'update-weight',
        exerciseIndex: 0,
        setIndex: 0,
        weight: 83,
        weightUnit: 'kilograms',
        applyTo: 'allSets',
      }),
    );
    expect(all.exercises[0]?.sets.map((set) => set.weight)).toEqual([
      83,
      83,
      83,
    ]);
  });

  it('treats an already-applied revision as an idempotent retry', () => {
    const firstCommand = command({
      type: 'toggle-set',
      exerciseIndex: 0,
      setIndex: 0,
      completionDateTime: '2026-08-31T15:00:00-03:00',
    });
    const applied = applyWorkoutEngineCommand(baseSnapshot, firstCommand);

    expect(applyWorkoutEngineCommand(applied, firstCommand)).toEqual(applied);
  });

  it('rejects revision gaps, session mismatches and weighted commands targeting cardio', () => {
    expect(() =>
      applyWorkoutEngineCommand(baseSnapshot, command({ type: 'finish' }, 2)),
    ).toThrow('revision_gap');

    expect(() =>
      applyWorkoutEngineCommand(baseSnapshot, {
        ...command({ type: 'finish' }),
        sessionId: 'other-session',
      }),
    ).toThrow('session_mismatch');

    const fixture = loadParityFixture();
    expect(() =>
      applyWorkoutEngineCommand(
        fixture.initial,
        {
          schemaVersion: 2,
          sessionId: fixture.initial.sessionId,
          revision: 1,
          type: 'toggle-set',
          exerciseIndex: 1,
          setIndex: 0,
          completionDateTime: '2026-08-31T15:00:00-03:00',
        },
      ),
    ).toThrow('invalid_target');
  });
});
