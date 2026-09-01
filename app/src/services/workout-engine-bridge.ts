import { Session } from '@/models/session-models';
import {
  applyNativeWorkoutEngineCommand,
  getNativeWorkoutEngineSnapshot,
  WorkoutEngineCommand,
  WorkoutEngineSnapshot,
} from '../../modules/workout-worker';
import {
  applyWorkoutEngineSnapshotToSession,
  sessionToWorkoutEngineSnapshot,
  WorkoutEngineSessionResult,
} from './workout-engine-session-adapter';

export type WorkoutEngineCommandExecutor = (
  snapshot: WorkoutEngineSnapshot,
  command: WorkoutEngineCommand,
) => WorkoutEngineSnapshot;

export type WorkoutEngineSnapshotExecutor = (
  snapshot: WorkoutEngineSnapshot,
) => WorkoutEngineSnapshot;

/**
 * Hardware/parity diagnostic only. This sends a real Session snapshot through
 * the native module (or an injected executor) and reconciles the returned state
 * without writing Redux, KeyValueStore or SQLite.
 */
export function validateWorkoutEngineRoundTrip(
  session: Session,
  revision: number,
  executor: WorkoutEngineSnapshotExecutor = getNativeWorkoutEngineSnapshot,
): WorkoutEngineSessionResult {
  const snapshot = sessionToWorkoutEngineSnapshot(session, revision);
  const nativeSnapshot = executor(snapshot);
  if (nativeSnapshot.revision !== revision) {
    throw new Error(
      `revision mismatch: round trip returned ${nativeSnapshot.revision}, expected ${revision}`,
    );
  }
  return applyWorkoutEngineSnapshotToSession(session, nativeSnapshot);
}

/**
 * Executes exactly one command against a real Session through the engine and
 * returns the reconciled result. It deliberately has no persistence/navigation
 * side effects: React Native remains the only writer until the device parity
 * gate explicitly enables a native session owner.
 *
 * Rest commands carry the persistible start timestamp and the derived end
 * projection. This keeps the bridge reversible without copying prescription
 * logic into the engine or creating a second timer authority.
 */
export function executeWorkoutEngineCommandDryRun(
  session: Session,
  revision: number,
  command: WorkoutEngineCommand,
  executor: WorkoutEngineCommandExecutor = applyNativeWorkoutEngineCommand,
): WorkoutEngineSessionResult {
  if (command.sessionId !== session.id) {
    throw new Error('session mismatch: command belongs to another session');
  }
  if (command.revision !== revision + 1) {
    throw new Error(
      `next revision must be ${revision + 1}, received ${command.revision}`,
    );
  }
  const snapshot = sessionToWorkoutEngineSnapshot(session, revision);
  const nativeSnapshot = executor(snapshot, command);
  if (nativeSnapshot.revision !== command.revision) {
    throw new Error(
      `revision mismatch: engine returned ${nativeSnapshot.revision}, expected ${command.revision}`,
    );
  }
  return applyWorkoutEngineSnapshotToSession(session, nativeSnapshot);
}
