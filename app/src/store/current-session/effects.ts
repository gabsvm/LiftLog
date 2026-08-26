import { LiftLog } from '@/gen/proto';
import { EmptySession, Session } from '@/models/session-models';
import {
  broadcastWorkoutEvent,
  clearSetTimerNotification,
  currentWorkoutSessionUpdated,
  finishCurrentWorkout,
  initializeCurrentSessionStateSlice,
  notifySetTimer,
  persistCurrentSession,
  selectCurrentSession,
  setCurrentPlanDiff,
  setCurrentSession,
  setCurrentSessionFromBlueprint,
  setIsHydrated,
} from '@/store/current-session';
import { AddEffectFn, RootState } from '@/store/store';
import { fetchUpcomingSessions, selectActiveProgram } from '@/store/program';
import {
  addStoredSession,
  selectLatestExercises,
} from '@/store/stored-sessions';
import { selectPreferredWeightUnit } from '@/store/settings';
import { diffSessionBlueprints } from '@/models/blueprint-diff';
import { addUnpublishedSessionId } from '@/store/feed';
import { setStatsIsDirty } from '@/store/stats';
import {
  getCardioTimerInfo,
  getCurrentExerciseDetails,
  getTimerInfo,
} from '@/store/current-session/helpers';
import { ProtobufToJsonV1Migrator } from '@/models/storage/versions/v1/protobuf-migrator';
import {
  fromJsonString,
  JsonString,
  toDurationJSON,
  toJsonString,
} from '@/models/storage/versions/latest';
import { Duration, OffsetDateTime } from '@js-joda/core';
import { Dispatch } from '@reduxjs/toolkit';
import { Platform } from 'react-native';
import { KeyValueStore } from '@/services/key-value-store';
import { AnyVersionSessionJSON } from '@/models/storage/versions/any';
import { copyLogs, showSnackbar } from '@/store/app';
import { sessionMigrations } from '@/models/storage/versions/migrations/session';

const storageKey = 'CurrentSessionStateV1';
const storageVersionKey = `${storageKey}-Version`;
const CURRENT_SESSION_PERSIST_DELAY_MS = 225;
const ANDROID_SESSION_RESTORE_DELAY_MS = 350;
const WORKOUT_WORKER_BROADCAST_DELAY_MS = 60;

let pendingPersistTimer: ReturnType<typeof setTimeout> | undefined;
let persistenceQueue: Promise<void> = Promise.resolve();
let storageVersionWrittenThisRun = false;
let pendingWorkoutBroadcastTimer: ReturnType<typeof setTimeout> | undefined;

type PersistenceLogger = {
  error: (message: string, error?: unknown) => void;
};

export function applyCurrentSessionEffects(addEffect: AddEffectFn) {
  addEffect(
    initializeCurrentSessionStateSlice,
    async (_, { dispatch, getState, extra: { keyValueStore, logger } }) => {
      if (!getState().settings.isHydrated) {
        throw new Error('Settings must be hydrated before stored sessions');
      }

      // Android used to skip restoring the active workout entirely to protect
      // startup latency. Keep startup non-blocking, but restore shortly after
      // the shell is allowed to render so an interrupted workout is not lost.
      if (Platform.OS === 'android') {
        dispatch(setIsHydrated(true));
        setTimeout(() => {
          void restorePersistedSessions(dispatch, keyValueStore, getState).catch(
            (error) => {
              logger.error('Failed to restore current session in background', error);
            },
          );
        }, ANDROID_SESSION_RESTORE_DELAY_MS);
        return;
      }

      try {
        await withTimeout(
          () => restorePersistedSessions(dispatch, keyValueStore, getState),
          8_000,
          'Timed out while restoring the current session',
        );

        dispatch(setIsHydrated(true));
      } catch (e) {
        logger.error('Failed to initialize current session state', e);
        dispatch(setIsHydrated(true));
        dispatch(
          showSnackbar({
            text: 'Failed to load current session. Please submit a bug report with your logs in settings!',
            action: 'Copy logs',
            dispatchAction: copyLogs(),
          }),
        );
      }
    },
  );

  addEffect(
    setCurrentSession,
    (
      _,
      {
        stateBeforeReduce,
        stateAfterReduce,
        dispatch,
        extra: { keyValueStore, logger },
      },
    ) => {
      const previousWorkoutSession =
        stateBeforeReduce.currentSession.workoutSession;
      const currentWorkoutSession = stateAfterReduce.currentSession.workoutSession;
      const currentWorkoutSessionChanged =
        previousWorkoutSession !== currentWorkoutSession;

      if (currentWorkoutSessionChanged) {
        dispatch(
          currentWorkoutSessionUpdated({
            before: previousWorkoutSession,
            after: currentWorkoutSession,
          }),
        );
      }

      // V3 storage only contains the active workout. History/feed/editor session
      // changes used to rewrite this file too, despite not changing its payload.
      if (
        stateAfterReduce.currentSession.isHydrated &&
        currentWorkoutSessionChanged
      ) {
        scheduleWorkoutSessionPersistence(
          currentWorkoutSession,
          keyValueStore,
          logger,
          // Clearing a finished workout should win over any queued snapshot and
          // should not wait for the debounce window.
          currentWorkoutSession === undefined,
        );
      }
    },
  );

  addEffect(finishCurrentWorkout, (a, { dispatch, getState }) => {
    const session = selectCurrentSession(getState(), a.payload);
    if (session) {
      dispatch(addUnpublishedSessionId(session.id));
    }

    dispatch(persistCurrentSession(a.payload));
    dispatch(setStatsIsDirty(true));
  });

  addEffect(persistCurrentSession, async (a, { dispatch, getState }) => {
    dispatch(clearSetTimerNotification());
    const session = selectCurrentSession(getState(), a.payload);
    const program = selectActiveProgram(getState());
    if (session) {
      dispatch(addStoredSession(session));
      const sessionInPlan = program.sessions.some((x) =>
        x.equals(session.blueprint),
      );
      if (!sessionInPlan) {
        const sessionWithSameNameInPlan = program.sessions.find(
          (x) => x.name === session.blueprint.name,
        );
        dispatch(
          setCurrentPlanDiff(
            sessionWithSameNameInPlan
              ? {
                  type: 'diff',
                  diff: diffSessionBlueprints(
                    sessionWithSameNameInPlan,
                    session.blueprint,
                  ),
                  sessionIndex: program.sessions.indexOf(
                    sessionWithSameNameInPlan,
                  ),
                }
              : {
                  type: 'add',
                  diff: diffSessionBlueprints(
                    EmptySession.blueprint,
                    session.blueprint,
                  ),
                },
          ),
        );
      }
    }
    dispatch(setCurrentSession({ target: a.payload, session: undefined }));
    dispatch(fetchUpcomingSessions());
  });

  addEffect(currentWorkoutSessionUpdated, (action, { dispatch }) => {
    const previousValue = action.payload.before;
    const currentValue = action.payload.after;
    if (!previousValue && currentValue) {
      dispatch(broadcastWorkoutEvent({ type: 'WorkoutStartedEvent' }));
    }

    const currentRestTimerEndTime = currentValue?.restTimerEndTime;
    const previousRestTimerEndTime = previousValue?.restTimerEndTime;
    if (
      currentRestTimerEndTime &&
      !currentRestTimerEndTime.isEqual(
        previousRestTimerEndTime ?? OffsetDateTime.MAX,
      )
    ) {
      dispatch(notifySetTimer());
    }

    if (currentValue) {
      scheduleWorkoutWorkerBroadcast(currentValue, dispatch);
    }
    if (previousValue && !currentValue) {
      cancelPendingWorkoutWorkerBroadcast();
      dispatch(broadcastWorkoutEvent({ type: 'WorkoutEndedEvent' }));
    }
  });

  addEffect(
    broadcastWorkoutEvent,
    (action, { extra: { workoutWorkerService } }) => {
      workoutWorkerService.broadcast(action.payload);
    },
  );

  addEffect(
    clearSetTimerNotification,
    async (_, { extra: { notificationService } }) => {
      await notificationService.clearSetTimerNotification();
    },
  );

  addEffect(
    notifySetTimer,
    async (_, { extra: { notificationService }, getState }) => {
      await notificationService.clearSetTimerNotification();
      const {
        settings: { restNotifications },
        currentSession: { workoutSession },
      } = getState();
      if (!restNotifications) {
        return;
      }
      const restTimerEndTime = workoutSession?.restTimerEndTime;
      if (restTimerEndTime && restTimerEndTime.isAfter(OffsetDateTime.now())) {
        await notificationService.scheduleNextSetNotification(restTimerEndTime);
      }
    },
  );

  addEffect(
    setCurrentSessionFromBlueprint,
    async (
      action,
      { stateAfterReduce, dispatch, extra: { sessionService } },
    ) => {
      const session = sessionService.hydrateSessionFromBlueprint(
        action.payload.blueprint,
        selectLatestExercises(stateAfterReduce),
      );
      dispatch(setCurrentSession({ session, target: action.payload.target }));
    },
  );
}

function scheduleWorkoutWorkerBroadcast(session: Session, dispatch: Dispatch) {
  cancelPendingWorkoutWorkerBroadcast();
  pendingWorkoutBroadcastTimer = setTimeout(() => {
    pendingWorkoutBroadcastTimer = undefined;
    // Build/serialize the comparatively large worker payload after the tap has
    // had a chance to commit its UI update. Rapid edits coalesce to the latest.
    dispatch(
      broadcastWorkoutEvent({
        type: 'WorkoutUpdatedEvent',
        workout: session.toJSON(),
        restTimerInfo: getTimerInfo(session),
        cardioTimerInfo: getCardioTimerInfo(session),
        currentExerciseDetails: getCurrentExerciseDetails(session),
        totalWeightLifted: session.totalWeightLifted.toJSON(),
        workoutDuration: toDurationJSON(session.duration ?? Duration.ZERO),
      }),
    );
  }, WORKOUT_WORKER_BROADCAST_DELAY_MS);
}

function cancelPendingWorkoutWorkerBroadcast() {
  if (pendingWorkoutBroadcastTimer !== undefined) {
    clearTimeout(pendingWorkoutBroadcastTimer);
    pendingWorkoutBroadcastTimer = undefined;
  }
}

function scheduleWorkoutSessionPersistence(
  session: Session | undefined,
  keyValueStore: KeyValueStore,
  logger: PersistenceLogger,
  immediate: boolean,
) {
  if (pendingPersistTimer !== undefined) {
    clearTimeout(pendingPersistTimer);
    pendingPersistTimer = undefined;
  }

  const enqueue = () => {
    pendingPersistTimer = undefined;
    persistenceQueue = persistenceQueue
      .then(() => persistWorkoutSessionSnapshot(session, keyValueStore))
      .catch((error) => {
        logger.error('Failed to persist current session state', error);
      });
  };

  if (immediate) {
    enqueue();
    return;
  }

  pendingPersistTimer = setTimeout(enqueue, CURRENT_SESSION_PERSIST_DELAY_MS);
}

async function persistWorkoutSessionSnapshot(
  session: Session | undefined,
  keyValueStore: KeyValueStore,
) {
  if (session) {
    if (!storageVersionWrittenThisRun) {
      await keyValueStore.setItem(storageVersionKey, '3');
      storageVersionWrittenThisRun = true;
    }
    await keyValueStore.setItem(storageKey, toJsonString(session.toJSON()));
    return;
  }

  await keyValueStore.removeItem(storageKey);
}

async function restorePersistedSessions(
  dispatch: Dispatch,
  keyValueStore: KeyValueStore,
  getState: () => RootState,
) {
  const currentSessionVersion =
    (await keyValueStore.getItem(storageVersionKey)) ?? '2';

  switch (currentSessionVersion) {
    case '2':
      await handleV2ProtoStorage(dispatch, keyValueStore, getState);
      break;
    case '3':
      await handleV3JsonStorage(dispatch, keyValueStore, getState);
      break;
  }
}

async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(),
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

function fromCurrentSessionDao(
  dao: LiftLog.Ui.Models.CurrentSessionStateDao.ICurrentSessionStateDaoV2,
) {
  return {
    workoutSession:
      dao.workoutSession &&
      Session.fromJSON(
        sessionMigrations.migrate(
          ProtobufToJsonV1Migrator.migrateSession(dao.workoutSession),
        ),
      ),
    historySession:
      dao.historySession &&
      Session.fromJSON(
        sessionMigrations.migrate(
          ProtobufToJsonV1Migrator.migrateSession(dao.historySession),
        ),
      ),
  };
}

async function handleV2ProtoStorage(
  dispatch: Dispatch,
  keyValueStore: KeyValueStore,
  getState: () => RootState,
) {
  const bytes =
    (await keyValueStore.getItemBytes(storageKey)) ?? Uint8Array.from([]);
  const currentSessionStateDao =
    LiftLog.Ui.Models.CurrentSessionStateDao.CurrentSessionStateDaoV2.decode(
      bytes,
    );

  if (currentSessionStateDao) {
    const currentSessionState = fromCurrentSessionDao(currentSessionStateDao);
    if (
      currentSessionState.workoutSession &&
      !selectCurrentSession(getState(), 'workoutSession')
    ) {
      dispatch(
        setCurrentSession({
          target: 'workoutSession',
          session: currentSessionState.workoutSession.withNoNilWeights(
            selectPreferredWeightUnit(getState()),
          ),
        }),
      );
    }
    if (
      currentSessionState.historySession &&
      !selectCurrentSession(getState(), 'historySession')
    ) {
      dispatch(
        setCurrentSession({
          target: 'historySession',
          session: currentSessionState.historySession.withNoNilWeights(
            selectPreferredWeightUnit(getState()),
          ),
        }),
      );
    }
  }
}

async function handleV3JsonStorage(
  dispatch: Dispatch,
  keyValueStore: KeyValueStore,
  getState: () => RootState,
) {
  const bytes = (await keyValueStore.getItem(storageKey)) ?? 'null';
  const currentSessionState = fromJsonString(
    bytes as JsonString<AnyVersionSessionJSON | null>,
  );
  if (
    !currentSessionState ||
    selectCurrentSession(getState(), 'workoutSession')
  ) {
    return;
  }

  dispatch(
    setCurrentSession({
      target: 'workoutSession',
      session: Session.fromJSON(sessionMigrations.migrate(currentSessionState)),
    }),
  );
}
