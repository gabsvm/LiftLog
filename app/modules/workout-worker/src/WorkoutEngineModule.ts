import { NativeModule, requireNativeModule } from 'expo';
import { Platform } from 'react-native';

export const WORKOUT_ENGINE_SCHEMA_VERSION = 1 as const;

export type WorkoutEngineExerciseType = 'weighted' | 'cardio';

export type WorkoutEngineSetSnapshot = {
  setIndex: number;
  completed: boolean;
  reps: number | null;
  weight: number | null;
  weightUnit: string | null;
};

export type WorkoutEngineExerciseSnapshot = {
  exerciseIndex: number;
  type: WorkoutEngineExerciseType;
  repsPerSet: number | null;
  supersetWithNext: boolean;
  sets: WorkoutEngineSetSnapshot[];
};

export type WorkoutEngineError = {
  code: string;
  message: string;
};

export type WorkoutEngineSnapshot = {
  schemaVersion: typeof WORKOUT_ENGINE_SCHEMA_VERSION;
  sessionId: string;
  revision: number;
  status: 'active' | 'finished';
  exercises: WorkoutEngineExerciseSnapshot[];
  restTimerEndTime: number | null;
  error: WorkoutEngineError | null;
};

type WorkoutEngineCommandBase = {
  schemaVersion: typeof WORKOUT_ENGINE_SCHEMA_VERSION;
  sessionId: string;
  revision: number;
};

export type WorkoutEngineCommand =
  | (WorkoutEngineCommandBase & {
      type: 'toggle-set';
      exerciseIndex: number;
      setIndex: number;
    })
  | (WorkoutEngineCommandBase & {
      type: 'update-reps';
      exerciseIndex: number;
      setIndex: number;
      reps: number;
    })
  | (WorkoutEngineCommandBase & {
      type: 'update-weight';
      exerciseIndex: number;
      setIndex: number;
      weight: number;
      weightUnit: string;
    })
  | (WorkoutEngineCommandBase & {
      type: 'start-rest';
      endTime: number;
    })
  | (WorkoutEngineCommandBase & { type: 'reset-rest' })
  | (WorkoutEngineCommandBase & { type: 'finish' });

export class WorkoutEngineCommandError extends Error {
  constructor(
    readonly code:
      | 'invalid_snapshot'
      | 'invalid_command'
      | 'session_mismatch'
      | 'revision_gap'
      | 'stale_revision'
      | 'invalid_target'
      | 'invalid_status',
    message: string,
  ) {
    super(`${code}: ${message}`);
    this.name = 'WorkoutEngineCommandError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new WorkoutEngineCommandError(
      'invalid_snapshot',
      `${field} must be a non-empty string`,
    );
  }
  return value;
}

function requireFiniteNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new WorkoutEngineCommandError(
      'invalid_snapshot',
      `${field} must be a finite number`,
    );
  }
  return value;
}

function requireNonNegativeInteger(value: unknown, field: string): number {
  const number = requireFiniteNumber(value, field);
  if (!Number.isInteger(number) || number < 0) {
    throw new WorkoutEngineCommandError(
      'invalid_snapshot',
      `${field} must be a non-negative integer`,
    );
  }
  return number;
}

function parseError(value: unknown): WorkoutEngineError | null {
  if (value === null) return null;
  if (!isRecord(value)) {
    throw new WorkoutEngineCommandError(
      'invalid_snapshot',
      'error must be null or an object',
    );
  }
  return {
    code: requireString(value.code, 'error.code'),
    message: requireString(value.message, 'error.message'),
  };
}

function parseSet(value: unknown, index: number): WorkoutEngineSetSnapshot {
  if (!isRecord(value)) {
    throw new WorkoutEngineCommandError(
      'invalid_snapshot',
      `exercises[*].sets[${index}] must be an object`,
    );
  }
  const setIndex = requireNonNegativeInteger(value.setIndex, 'setIndex');
  if (typeof value.completed !== 'boolean') {
    throw new WorkoutEngineCommandError(
      'invalid_snapshot',
      'set.completed must be a boolean',
    );
  }
  const reps = value.reps === null ? null : requireNonNegativeInteger(value.reps, 'reps');
  const weight =
    value.weight === null ? null : requireFiniteNumber(value.weight, 'weight');
  const weightUnit =
    value.weightUnit === null
      ? null
      : requireString(value.weightUnit, 'weightUnit');
  return { setIndex, completed: value.completed, reps, weight, weightUnit };
}

function parseExercise(
  value: unknown,
  index: number,
): WorkoutEngineExerciseSnapshot {
  if (!isRecord(value)) {
    throw new WorkoutEngineCommandError(
      'invalid_snapshot',
      `exercises[${index}] must be an object`,
    );
  }
  const exerciseIndex = requireNonNegativeInteger(
    value.exerciseIndex,
    'exerciseIndex',
  );
  if (value.type !== 'weighted' && value.type !== 'cardio') {
    throw new WorkoutEngineCommandError(
      'invalid_snapshot',
      'exercise.type must be weighted or cardio',
    );
  }
  const repsPerSet =
    value.repsPerSet === null
      ? null
      : requireNonNegativeInteger(value.repsPerSet, 'repsPerSet');
  if (typeof value.supersetWithNext !== 'boolean') {
    throw new WorkoutEngineCommandError(
      'invalid_snapshot',
      'exercise.supersetWithNext must be a boolean',
    );
  }
  if (!Array.isArray(value.sets)) {
    throw new WorkoutEngineCommandError(
      'invalid_snapshot',
      'exercise.sets must be an array',
    );
  }
  return {
    exerciseIndex,
    type: value.type,
    repsPerSet,
    supersetWithNext: value.supersetWithNext,
    sets: value.sets.map(parseSet),
  };
}

export function parseWorkoutEngineSnapshot(
  value: unknown,
): WorkoutEngineSnapshot {
  if (!isRecord(value)) {
    throw new WorkoutEngineCommandError(
      'invalid_snapshot',
      'snapshot must be an object',
    );
  }
  if (value.schemaVersion !== WORKOUT_ENGINE_SCHEMA_VERSION) {
    throw new WorkoutEngineCommandError(
      'invalid_snapshot',
      `unsupported schemaVersion: ${String(value.schemaVersion)}`,
    );
  }
  const revision = requireNonNegativeInteger(value.revision, 'revision');
  if (value.status !== 'active' && value.status !== 'finished') {
    throw new WorkoutEngineCommandError(
      'invalid_snapshot',
      'status must be active or finished',
    );
  }
  if (!Array.isArray(value.exercises)) {
    throw new WorkoutEngineCommandError(
      'invalid_snapshot',
      'exercises must be an array',
    );
  }
  const restTimerEndTime =
    value.restTimerEndTime === null
      ? null
      : requireFiniteNumber(value.restTimerEndTime, 'restTimerEndTime');
  return {
    schemaVersion: WORKOUT_ENGINE_SCHEMA_VERSION,
    sessionId: requireString(value.sessionId, 'sessionId'),
    revision,
    status: value.status,
    exercises: value.exercises.map(parseExercise),
    restTimerEndTime,
    error: parseError(value.error),
  };
}

export function serializeWorkoutEngineSnapshot(
  snapshot: WorkoutEngineSnapshot,
): string {
  return JSON.stringify(parseWorkoutEngineSnapshot(snapshot));
}

function parseCommandIndex(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new WorkoutEngineCommandError(
      'invalid_command',
      `${field} must be a non-negative integer`,
    );
  }
  return value;
}

function getSet(
  snapshot: WorkoutEngineSnapshot,
  exerciseIndex: number,
  setIndex: number,
): WorkoutEngineSetSnapshot {
  const exercise = snapshot.exercises[exerciseIndex];
  const set = exercise?.sets[setIndex];
  if (!exercise || !set) {
    throw new WorkoutEngineCommandError(
      'invalid_target',
      `set ${exerciseIndex}:${setIndex} does not exist`,
    );
  }
  return set;
}

function withUpdatedSet(
  snapshot: WorkoutEngineSnapshot,
  exerciseIndex: number,
  setIndex: number,
  update: (set: WorkoutEngineSetSnapshot) => WorkoutEngineSetSnapshot,
): WorkoutEngineSnapshot {
  getSet(snapshot, exerciseIndex, setIndex);
  return {
    ...snapshot,
    error: null,
    exercises: snapshot.exercises.map((exercise, currentExerciseIndex) =>
      currentExerciseIndex !== exerciseIndex
        ? exercise
        : {
            ...exercise,
            sets: exercise.sets.map((set, currentSetIndex) =>
              currentSetIndex === setIndex ? update(set) : set,
            ),
          },
    ),
  };
}

export function applyWorkoutEngineCommand(
  snapshot: WorkoutEngineSnapshot,
  command: WorkoutEngineCommand,
): WorkoutEngineSnapshot {
  const current = parseWorkoutEngineSnapshot(snapshot);
  if (command.schemaVersion !== WORKOUT_ENGINE_SCHEMA_VERSION) {
    throw new WorkoutEngineCommandError(
      'invalid_command',
      `unsupported schemaVersion: ${String(command.schemaVersion)}`,
    );
  }
  if (command.sessionId !== current.sessionId) {
    throw new WorkoutEngineCommandError(
      'session_mismatch',
      'command sessionId does not match the snapshot',
    );
  }
  if (command.revision < current.revision) {
    throw new WorkoutEngineCommandError(
      'stale_revision',
      `command revision ${command.revision} is older than ${current.revision}`,
    );
  }
  if (command.revision === current.revision) {
    return current;
  }
  if (command.revision !== current.revision + 1) {
    throw new WorkoutEngineCommandError(
      'revision_gap',
      `expected revision ${current.revision + 1}, received ${command.revision}`,
    );
  }
  if (current.status === 'finished') {
    throw new WorkoutEngineCommandError(
      'invalid_status',
      'finished sessions cannot receive new commands',
    );
  }

  const next: WorkoutEngineSnapshot = (() => {
    switch (command.type) {
      case 'toggle-set': {
        const exerciseIndex = parseCommandIndex(
          command.exerciseIndex,
          'exerciseIndex',
        );
        const setIndex = parseCommandIndex(command.setIndex, 'setIndex');
        const exercise = current.exercises[exerciseIndex];
        const set = getSet(current, exerciseIndex, setIndex);
        if (exercise?.type === 'weighted' && exercise.repsPerSet !== null) {
          const nextSet = !set.completed
            ? { ...set, completed: true, reps: exercise.repsPerSet }
            : set.reps === 0
              ? { ...set, completed: false, reps: null }
              : {
                  ...set,
                  completed: true,
                  reps: Math.max(0, (set.reps ?? exercise.repsPerSet) - 1),
                };
          return withUpdatedSet(current, exerciseIndex, setIndex, () => nextSet);
        }
        return withUpdatedSet(current, exerciseIndex, setIndex, (currentSet) => ({
          ...currentSet,
          completed: !currentSet.completed,
        }));
      }
      case 'update-reps': {
        const exerciseIndex = parseCommandIndex(
          command.exerciseIndex,
          'exerciseIndex',
        );
        const setIndex = parseCommandIndex(command.setIndex, 'setIndex');
        if (!Number.isInteger(command.reps) || command.reps < 0) {
          throw new WorkoutEngineCommandError(
            'invalid_command',
            'reps must be a non-negative integer',
          );
        }
        return withUpdatedSet(current, exerciseIndex, setIndex, (set) => ({
          ...set,
          completed: true,
          reps: command.reps,
        }));
      }
      case 'update-weight': {
        const exerciseIndex = parseCommandIndex(
          command.exerciseIndex,
          'exerciseIndex',
        );
        const setIndex = parseCommandIndex(command.setIndex, 'setIndex');
        if (!Number.isFinite(command.weight) || command.weight < 0) {
          throw new WorkoutEngineCommandError(
            'invalid_command',
            'weight must be a non-negative finite number',
          );
        }
        if (!command.weightUnit) {
          throw new WorkoutEngineCommandError(
            'invalid_command',
            'weightUnit must be a non-empty string',
          );
        }
        return withUpdatedSet(current, exerciseIndex, setIndex, (set) => ({
          ...set,
          weight: command.weight,
          weightUnit: command.weightUnit,
        }));
      }
      case 'start-rest':
        if (!Number.isFinite(command.endTime) || command.endTime <= 0) {
          throw new WorkoutEngineCommandError(
            'invalid_command',
            'endTime must be a positive finite number',
          );
        }
        return { ...current, restTimerEndTime: command.endTime, error: null };
      case 'reset-rest':
        return { ...current, restTimerEndTime: null, error: null };
      case 'finish':
        return {
          ...current,
          status: 'finished',
          restTimerEndTime: null,
          error: null,
        };
    }
  })();

  return { ...next, revision: command.revision };
}

export function parseWorkoutEngineCommand(value: unknown): WorkoutEngineCommand {
  if (!isRecord(value)) {
    throw new WorkoutEngineCommandError('invalid_command', 'command must be an object');
  }
  if (value.schemaVersion !== WORKOUT_ENGINE_SCHEMA_VERSION) {
    throw new WorkoutEngineCommandError(
      'invalid_command',
      `unsupported schemaVersion: ${String(value.schemaVersion)}`,
    );
  }
  const sessionId = requireString(value.sessionId, 'sessionId');
  const revision = requireNonNegativeInteger(value.revision, 'revision');
  if (typeof value.type !== 'string') {
    throw new WorkoutEngineCommandError('invalid_command', 'type is required');
  }
  switch (value.type) {
    case 'toggle-set':
    case 'update-reps':
    case 'update-weight': {
      const exerciseIndex = requireNonNegativeInteger(
        value.exerciseIndex,
        'exerciseIndex',
      );
      const setIndex = requireNonNegativeInteger(value.setIndex, 'setIndex');
      if (value.type === 'toggle-set') {
        return { schemaVersion: 1, sessionId, revision, type: value.type, exerciseIndex, setIndex };
      }
      if (value.type === 'update-reps') {
        return {
          schemaVersion: 1,
          sessionId,
          revision,
          type: value.type,
          exerciseIndex,
          setIndex,
          reps: requireNonNegativeInteger(value.reps, 'reps'),
        };
      }
      return {
        schemaVersion: 1,
        sessionId,
        revision,
        type: value.type,
        exerciseIndex,
        setIndex,
        weight: requireFiniteNumber(value.weight, 'weight'),
        weightUnit: requireString(value.weightUnit, 'weightUnit'),
      };
    }
    case 'start-rest':
      return {
        schemaVersion: 1,
        sessionId,
        revision,
        type: value.type,
        endTime: requireFiniteNumber(value.endTime, 'endTime'),
      };
    case 'reset-rest':
    case 'finish':
      return { schemaVersion: 1, sessionId, revision, type: value.type };
    default:
      throw new WorkoutEngineCommandError(
        'invalid_command',
        `unsupported command type: ${value.type}`,
      );
  }
}

export type WorkoutEngineModuleEvents = {
  onSnapshot: (event: { snapshotJson: string }) => void;
};

declare class WorkoutEngineNativeModule extends NativeModule<WorkoutEngineModuleEvents> {
  getSnapshot(snapshotJson: string): string;
  applyCommand(snapshotJson: string, commandJson: string): string;
  writeSnapshot(key: string, snapshotJson: string): Promise<void>;
  readSnapshot(key: string): Promise<string | null>;
  removeSnapshot(key: string): Promise<void>;
}

let nativeModule: WorkoutEngineNativeModule | undefined;

function getNativeModule(): WorkoutEngineNativeModule | undefined {
  if (Platform.OS !== 'android') return undefined;
  return (nativeModule ??= requireNativeModule<WorkoutEngineNativeModule>(
    'WorkoutEngine',
  ));
}

export function getNativeWorkoutEngineSnapshot(
  snapshot: WorkoutEngineSnapshot,
): WorkoutEngineSnapshot {
  const module = getNativeModule();
  if (!module) return parseWorkoutEngineSnapshot(snapshot);
  return parseWorkoutEngineSnapshot(
    JSON.parse(module.getSnapshot(serializeWorkoutEngineSnapshot(snapshot))) as unknown,
  );
}

export function applyNativeWorkoutEngineCommand(
  snapshot: WorkoutEngineSnapshot,
  command: WorkoutEngineCommand,
): WorkoutEngineSnapshot {
  const module = getNativeModule();
  if (!module) return applyWorkoutEngineCommand(snapshot, command);
  return parseWorkoutEngineSnapshot(
    JSON.parse(
      module.applyCommand(
        serializeWorkoutEngineSnapshot(snapshot),
        JSON.stringify(command),
      ),
    ) as unknown,
  );
}

export async function writeNativeWorkoutEngineSnapshot(
  key: string,
  snapshot: WorkoutEngineSnapshot,
): Promise<boolean> {
  const module = getNativeModule();
  if (!module) return false;
  await module.writeSnapshot(key, serializeWorkoutEngineSnapshot(snapshot));
  return true;
}

export async function readNativeWorkoutEngineSnapshot(
  key: string,
): Promise<WorkoutEngineSnapshot | undefined> {
  const module = getNativeModule();
  if (!module) return undefined;
  const snapshotJson = await module.readSnapshot(key);
  if (snapshotJson === null) return undefined;
  return parseWorkoutEngineSnapshot(JSON.parse(snapshotJson) as unknown);
}

export async function removeNativeWorkoutEngineSnapshot(
  key: string,
): Promise<boolean> {
  const module = getNativeModule();
  if (!module) return false;
  await module.removeSnapshot(key);
  return true;
}
