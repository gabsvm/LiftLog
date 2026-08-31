import { describe, expect, it } from 'vitest';
import {
  applyWorkoutEngineCommand,
  parseWorkoutEngineSnapshot,
  serializeWorkoutEngineSnapshot,
  WorkoutEngineCommand,
  WorkoutEngineSnapshot,
} from './WorkoutEngineModule';

const initialSnapshot: WorkoutEngineSnapshot = {
  schemaVersion: 1,
  sessionId: 'session-1',
  revision: 0,
  status: 'active',
  exercises: [
    {
      exerciseIndex: 0,
      type: 'weighted',
      supersetWithNext: true,
      sets: [
        {
          setIndex: 0,
          completed: false,
          reps: null,
          weight: 80,
          weightUnit: 'kilograms',
        },
        {
          setIndex: 1,
          completed: false,
          reps: null,
          weight: 80,
          weightUnit: 'kilograms',
        },
      ],
    },
    {
      exerciseIndex: 1,
      type: 'cardio',
      supersetWithNext: false,
      sets: [{ setIndex: 0, completed: false, reps: null, weight: null, weightUnit: null }],
    },
  ],
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
  const common = { schemaVersion: 1 as const, sessionId: 'session-1', revision };
  switch (payload.type) {
    case 'toggle-set':
      return { ...common, ...payload };
    case 'update-reps':
      return { ...common, ...payload };
    case 'update-weight':
      return { ...common, ...payload };
    case 'start-rest':
      return { ...common, ...payload };
    case 'reset-rest':
      return { ...common, ...payload };
    case 'finish':
      return { ...common, ...payload };
  }
}

describe('WorkoutEngine contract', () => {
  it('round trips a versioned snapshot without changing its shape', () => {
    const parsed = parseWorkoutEngineSnapshot(
      JSON.parse(serializeWorkoutEngineSnapshot(initialSnapshot)),
    );

    expect(parsed).toEqual(initialSnapshot);
  });

  it('toggles one weighted set and advances exactly one revision', () => {
    const next = applyWorkoutEngineCommand(
      initialSnapshot,
      command({ type: 'toggle-set', exerciseIndex: 0, setIndex: 0 }),
    );

    expect(next.revision).toBe(1);
    expect(next.exercises[0]?.sets[0]?.completed).toBe(true);
    expect(next.exercises[0]?.sets[1]?.completed).toBe(false);
  });

  it('treats an already-applied revision as an idempotent retry', () => {
    const applied = applyWorkoutEngineCommand(
      initialSnapshot,
      command({ type: 'toggle-set', exerciseIndex: 0, setIndex: 0 }),
    );

    const retried = applyWorkoutEngineCommand(
      applied,
      command({ type: 'toggle-set', exerciseIndex: 0, setIndex: 0 }),
    );

    expect(retried).toEqual(applied);
  });

  it('rejects a revision gap and a command for another session', () => {
    expect(() =>
      applyWorkoutEngineCommand(
        initialSnapshot,
        command({ type: 'finish' }, 2),
      ),
    ).toThrow('revision_gap');

    expect(() =>
      applyWorkoutEngineCommand(initialSnapshot, {
        ...command({ type: 'finish' }),
        sessionId: 'other-session',
      }),
    ).toThrow('session_mismatch');
  });

  it('updates reps and weight without changing superset or cardio metadata', () => {
    const withReps = applyWorkoutEngineCommand(
      initialSnapshot,
      command({ type: 'update-reps', exerciseIndex: 0, setIndex: 0, reps: 9 }),
    );
    const withWeight = applyWorkoutEngineCommand(
      withReps,
      command(
        {
          type: 'update-weight',
          exerciseIndex: 0,
          setIndex: 0,
          weight: 82.5,
          weightUnit: 'kilograms',
        },
        2,
      ),
    );

    expect(withWeight.exercises[0]?.sets[0]).toMatchObject({
      reps: 9,
      weight: 82.5,
    });
    expect(withWeight.exercises[0]?.supersetWithNext).toBe(true);
    expect(withWeight.exercises[1]?.type).toBe('cardio');
  });

  it('starts and resets the supplied rest timer, then finishes the session', () => {
    const started = applyWorkoutEngineCommand(
      initialSnapshot,
      command({ type: 'start-rest', endTime: 123456 }),
    );
    const reset = applyWorkoutEngineCommand(
      started,
      command({ type: 'reset-rest' }, 2),
    );
    const finished = applyWorkoutEngineCommand(
      reset,
      command({ type: 'finish' }, 3),
    );

    expect(started.restTimerEndTime).toBe(123456);
    expect(reset.restTimerEndTime).toBeNull();
    expect(finished.status).toBe('finished');
  });
});
