import { NativeModule, requireNativeModule } from 'expo';
import { Platform } from 'react-native';

export const WORKOUT_ENGINE_SCHEMA_VERSION = 2 as const;

export type WorkoutEngineExerciseType = 'weighted' | 'cardio';
export type WorkoutEngineWeightAppliesTo =
  | 'thisSet'
  | 'uncompletedSets'
  | 'allSets';

/**
 * Version 2 intentionally carries every set field needed to round-trip the
 * current React Native session model without inventing programming semantics
 * inside Kotlin. Weighted commands mutate only weighted fields; cardio fields
 * are preserved until a later parity gate adds native cardio commands.
 */
export type WorkoutEngineSetSnapshot = {
  setIndex: number;
  completed: boolean;
  reps: number | null;
  completionDateTime: string | null;
  weight: number | null;
  weightUnit: string | null;
  durationSeconds: number | null;
  distanceValue: number | null;
  distanceUnit: string | null;
  resistance: number | null;
  incline: number | null;
  steps: number | null;
  currentBlockStartTime: string | null;
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
  /** Epoch seconds, matching the existing worker/event contract. */
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
      completionDateTime: string;
    })
  | (WorkoutEngineCommandBase & {
      type: 'update-reps';
      exerciseIndex: number;
      setIndex: number;
      reps: number | null;
      completionDateTime: string | null;
    })
  | (WorkoutEngineCommandBase & {
      type: 'update-weight';
      exerciseIndex: number;
      setIndex: number;
      weight: number;
      weightUnit: string;
      applyTo: WorkoutEngineWeightAppliesTo;
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

function snapshotError(message: string): never {
  throw new WorkoutEngineCommandError('invalid_snapshot', message);
}

function commandError(message: string): never {
  throw new WorkoutEngineCommandError('invalid_command', message);
}

function requireString(
  value: unknown,
  field: string,
  code: 'invalid_snapshot' | 'invalid_command' = 'invalid_snapshot',
): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new WorkoutEngineCommandError(code, `${field} must be a non-empty string`);
  }
  return value;
}

function requireNullableString(value: unknown, field: string): string | null {
  return value === null ? null : requireString(value, field);
}

function requireFiniteNumber(
  value: unknown,
  field: string,
  code: 'invalid_snapshot' | 'invalid_command' = 'invalid_snapshot',
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new WorkoutEngineCommandError(code, `${field} must be a finite number`);
  }
  return value;
}

function requireNullableFiniteNumber(
  value: unknown,
  field: string,
): number | null {
  return value === null ? null : requireFiniteNumber(value, field);
}

function requireNonNegativeInteger(
  value: unknown,
  field: string,
  code: 'invalid_snapshot' | 'invalid_command' = 'invalid_snapshot',
): number {
  const number = requireFiniteNumber(value, field, code);
  if (!Number.isInteger(number) || number < 0) {
    throw new WorkoutEngineCommandError(
      code,
      `${field} must be a non-negative integer`,
    );
  }
  return number;
}

function requireNullableNonNegativeInteger(
  value: unknown,
  field: string,
): number | null {
  return value === null ? null : requireNonNegativeInteger(value, field);
}

function parseError(value: unknown): WorkoutEngineError | null {
  if (value === null) return null;
  if (!isRecord(value)) snapshotError('error must be null or an object');
  return {
    code: requireString(value.code, 'error.code'),
    message: requireString(value.message, 'error.message'),
  };
}

function parseSet(value: unknown, index: number): WorkoutEngineSetSnapshot {
  if (!isRecord(value)) {
    snapshotError(`exercises[*].sets[${index}] must be an object`);
  }
  const setIndex = requireNonNegativeInteger(value.setIndex, 'setIndex');
  if (setIndex !== index) snapshotError('setIndex must match its position');
  if (typeof value.completed !== 'boolean') {
    snapshotError('set.completed must be a boolean');
  }
  return {
    setIndex,
    completed: value.completed,
    reps: requireNullableNonNegativeInteger(value.reps, 'reps'),
    completionDateTime: requireNullableString(
      value.completionDateTime,
      'completionDateTime',
    ),
    weight: requireNullableFiniteNumber(value.weight, 'weight'),
    weightUnit: requireNullableString(value.weightUnit, 'weightUnit'),
    durationSeconds: requireNullableFiniteNumber(
      value.durationSeconds,
      'durationSeconds',
    ),
    distanceValue: requireNullableFiniteNumber(value.distanceValue, 'distanceValue'),
    distanceUnit: requireNullableString(value.distanceUnit, 'distanceUnit'),
    resistance: requireNullableFiniteNumber(value.resistance, 'resistance'),
    incline: requireNullableFiniteNumber(value.incline, 'incline'),
    steps: requireNullableNonNegativeInteger(value.steps, 'steps'),
    currentBlockStartTime: requireNullableString(
      value.currentBlockStartTime,
      'currentBlockStartTime',
    ),
  };
}

function parseExercise(
  value: unknown,
  index: number,
): WorkoutEngineExerciseSnapshot {
  if (!isRecord(value)) snapshotError(`exercises[${index}] must be an object`);
  const exerciseIndex = requireNonNegativeInteger(
    value.exerciseIndex,
    'exerciseIndex',
  );
  if (exerciseIndex !== index) snapshotError('exerciseIndex must match its position');
  if (value.type !== 'weighted' && value.type !== 'cardio') {
    snapshotError('exercise.type must be weighted or cardio');
  }
  const repsPerSet =
    value.repsPerSet === null
      ? null
      : requireNonNegativeInteger(value.repsPerSet, 'repsPerSet');
  if (typeof value.supersetWithNext !== 'boolean') {
    snapshotError('exercise.supersetWithNext must be a boolean');
  }
  if (!Array.isArray(value.sets)) snapshotError('exercise.sets must be an array');
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
  if (!isRecord(value)) snapshotError('snapshot must be an object');
  if (value.schemaVersion !== WORKOUT_ENGINE_SCHEMA_VERSION) {
    snapshotError(`unsupported schemaVersion: ${String(value.schemaVersion)}`);
  }
  const revision = requireNonNegativeInteger(value.revision, 'revision');
  if (value.status !== 'active' && value.status !== 'finished') {
    snapshotError('status must be active or finished');
  }
  if (!Array.isArray(value.exercises)) snapshotError('exercises must be an array');
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
  if (!Number.isInteger(value) || value < 0) commandError(`${field} must be a non-negative integer`);
  return value;
}

function getWeightedExercise(
  snapshot: WorkoutEngineSnapshot,
  exerciseIndex: number,
): WorkoutEngineExerciseSnapshot {
  const exercise = snapshot.exercises[exerciseIndex];
  if (!exercise || exercise.type !== 'weighted' || exercise.repsPerSet === null) {
    throw new WorkoutEngineCommandError(
      'invalid_target',
      `weighted exercise ${exerciseIndex} does not exist`,
    );
  }
  return exercise;
}

function getWeightedSet(
  snapshot: WorkoutEngineSnapshot,
  exerciseIndex: number,
  setIndex: number,
): WorkoutEngineSetSnapshot {
  const exercise = getWeightedExercise(snapshot, exerciseIndex);
  const set = exercise.sets[setIndex];
  if (!set) {
    throw new WorkoutEngineCommandError(
      'invalid_target',
      `set ${exerciseIndex}:${setIndex} does not exist`,
    );
  }
  return set;
}

function withUpdatedWeightedExercise(
  snapshot: WorkoutEngineSnapshot,
  exerciseIndex: number,
  update: (exercise: WorkoutEngineExerciseSnapshot) => WorkoutEngineExerciseSnapshot,
): WorkoutEngineSnapshot {
  const target = getWeightedExercise(snapshot, exerciseIndex);
  return {
    ...snapshot,
    error: null,
    exercises: snapshot.exercises.map((exercise, index) =>
      index === exerciseIndex ? update(target) : exercise,
    ),
  };
}

function withUpdatedWeightedSet(
  snapshot: WorkoutEngineSnapshot,
  exerciseIndex: number,
  setIndex: number,
  update: (set: WorkoutEngineSetSnapshot) => WorkoutEngineSetSnapshot,
): WorkoutEngineSnapshot {
  getWeightedSet(snapshot, exerciseIndex, setIndex);
  return withUpdatedWeightedExercise(snapshot, exerciseIndex, (exercise) => ({
    ...exercise,
    sets: exercise.sets.map((set, index) =>
      index === setIndex ? update(set) : set,
    ),
  }));
}

export function applyWorkoutEngineCommand(
  snapshot: WorkoutEngineSnapshot,
  command: WorkoutEngineCommand,
): WorkoutEngineSnapshot {
  const current = parseWorkoutEngineSnapshot(snapshot);
  const parsedCommand = parseWorkoutEngineCommand(command);
  if (parsedCommand.sessionId !== current.sessionId) {
    throw new WorkoutEngineCommandError(
      'session_mismatch',
      'command sessionId does not match the snapshot',
    );
  }
  if (parsedCommand.revision < current.revision) {
    throw new WorkoutEngineCommandError(
      'stale_revision',
      `command revision ${parsedCommand.revision} is older than ${current.revision}`,
    );
  }
  if (parsedCommand.revision === current.revision) return current;
  if (parsedCommand.revision !== current.revision + 1) {
    throw new WorkoutEngineCommandError(
      'revision_gap',
      `expected revision ${current.revision + 1}, received ${parsedCommand.revision}`,
    );
  }
  if (current.status === 'finished') {
    throw new WorkoutEngineCommandError(
      'invalid_status',
      'finished sessions cannot receive new commands',
    );
  }

  const next: WorkoutEngineSnapshot = (() => {
    switch (parsedCommand.type) {
      case 'toggle-set': {
        const exerciseIndex = parseCommandIndex(
          parsedCommand.exerciseIndex,
          'exerciseIndex',
        );
        const setIndex = parseCommandIndex(parsedCommand.setIndex, 'setIndex');
        const exercise = getWeightedExercise(current, exerciseIndex);
        const set = getWeightedSet(current, exerciseIndex, setIndex);
        return withUpdatedWeightedSet(current, exerciseIndex, setIndex, () => {
          if (!set.completed) {
            return {
              ...set,
              completed: true,
              reps: exercise.repsPerSet,
              completionDateTime: parsedCommand.completionDateTime,
            };
          }
          if (set.reps === 0) {
            return {
              ...set,
              completed: false,
              reps: null,
              completionDateTime: null,
            };
          }
          return {
            ...set,
            completed: true,
            reps: Math.max(0, (set.reps ?? exercise.repsPerSet) - 1),
          };
        });
      }
      case 'update-reps': {
        const exerciseIndex = parseCommandIndex(
          parsedCommand.exerciseIndex,
          'exerciseIndex',
        );
        const setIndex = parseCommandIndex(parsedCommand.setIndex, 'setIndex');
        return withUpdatedWeightedSet(current, exerciseIndex, setIndex, (set) =>
          parsedCommand.reps === null
            ? {
                ...set,
                completed: false,
                reps: null,
                completionDateTime: null,
              }
            : {
                ...set,
                completed: true,
                reps: parsedCommand.reps,
                completionDateTime: parsedCommand.completionDateTime,
              },
        );
      }
      case 'update-weight': {
        const exerciseIndex = parseCommandIndex(
          parsedCommand.exerciseIndex,
          'exerciseIndex',
        );
        parseCommandIndex(parsedCommand.setIndex, 'setIndex');
        getWeightedSet(current, exerciseIndex, parsedCommand.setIndex);
        return withUpdatedWeightedExercise(current, exerciseIndex, (exercise) => ({
          ...exercise,
          sets: exercise.sets.map((set, index) => {
            const applies =
              parsedCommand.applyTo === 'allSets' ||
              (parsedCommand.applyTo === 'thisSet' && index === parsedCommand.setIndex) ||
              (parsedCommand.applyTo === 'uncompletedSets' && !set.completed);
            return applies
              ? {
                  ...set,
                  weight: parsedCommand.weight,
                  weightUnit: parsedCommand.weightUnit,
                }
              : set;
          }),
        }));
      }
      case 'start-rest':
        return {
          ...current,
          restTimerEndTime: parsedCommand.endTime,
          error: null,
        };
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

  return { ...next, revision: parsedCommand.revision };
}

function parseNullableCommandReps(value: unknown): number | null {
  return value === null
    ? null
    : requireNonNegativeInteger(value, 'reps', 'invalid_command');
}

function parseWeightAppliesTo(value: unknown): WorkoutEngineWeightAppliesTo {
  if (
    value !== 'thisSet' &&
    value !== 'uncompletedSets' &&
    value !== 'allSets'
  ) {
    commandError('applyTo must be thisSet, uncompletedSets or allSets');
  }
  return value;
}

export function parseWorkoutEngineCommand(value: unknown): WorkoutEngineCommand {
  if (!isRecord(value)) commandError('command must be an object');
  if (value.schemaVersion !== WORKOUT_ENGINE_SCHEMA_VERSION) {
    commandError(`unsupported schemaVersion: ${String(value.schemaVersion)}`);
  }
  const sessionId = requireString(
    value.sessionId,
    'sessionId',
    'invalid_command',
  );
  const revision = requireNonNegativeInteger(
    value.revision,
    'revision',
    'invalid_command',
  );
  if (typeof value.type !== 'string') commandError('type is required');
  const common = {
    schemaVersion: WORKOUT_ENGINE_SCHEMA_VERSION,
    sessionId,
    revision,
  } as const;

  switch (value.type) {
    case 'toggle-set':
      return {
        ...common,
        type: value.type,
        exerciseIndex: requireNonNegativeInteger(
          value.exerciseIndex,
          'exerciseIndex',
          'invalid_command',
        ),
        setIndex: requireNonNegativeInteger(
          value.setIndex,
          'setIndex',
          'invalid_command',
        ),
        completionDateTime: requireString(
          value.completionDateTime,
          'completionDateTime',
          'invalid_command',
        ),
      };
    case 'update-reps': {
      const reps = parseNullableCommandReps(value.reps);
      const completionDateTime =
        value.completionDateTime === null
          ? null
          : requireString(
              value.completionDateTime,
              'completionDateTime',
              'invalid_command',
            );
      if (reps !== null && completionDateTime === null) {
        commandError('completionDateTime is required when reps is recorded');
      }
      if (reps === null && completionDateTime !== null) {
        commandError('completionDateTime must be null when reps is cleared');
      }
      return {
        ...common,
        type: value.type,
        exerciseIndex: requireNonNegativeInteger(
          value.exerciseIndex,
          'exerciseIndex',
          'invalid_command',
        ),
        setIndex: requireNonNegativeInteger(
          value.setIndex,
          'setIndex',
          'invalid_command',
        ),
        reps,
        completionDateTime,
      };
    }
    case 'update-weight': {
      const weight = requireFiniteNumber(value.weight, 'weight', 'invalid_command');
      if (weight < 0) commandError('weight must be non-negative');
      return {
        ...common,
        type: value.type,
        exerciseIndex: requireNonNegativeInteger(
          value.exerciseIndex,
          'exerciseIndex',
          'invalid_command',
        ),
        setIndex: requireNonNegativeInteger(
          value.setIndex,
          'setIndex',
          'invalid_command',
        ),
        weight,
        weightUnit: requireString(
          value.weightUnit,
          'weightUnit',
          'invalid_command',
        ),
        applyTo: parseWeightAppliesTo(value.applyTo),
      };
    }
    case 'start-rest': {
      const endTime = requireFiniteNumber(value.endTime, 'endTime', 'invalid_command');
      if (endTime <= 0) commandError('endTime must be positive');
      return { ...common, type: value.type, endTime };
    }
    case 'reset-rest':
    case 'finish':
      return { ...common, type: value.type };
    default:
      commandError(`unsupported command type: ${value.type}`);
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
  const parsedCommand = parseWorkoutEngineCommand(command);
  const module = getNativeModule();
  if (!module) return applyWorkoutEngineCommand(snapshot, parsedCommand);
  return parseWorkoutEngineSnapshot(
    JSON.parse(
      module.applyCommand(
        serializeWorkoutEngineSnapshot(snapshot),
        JSON.stringify(parsedCommand),
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
