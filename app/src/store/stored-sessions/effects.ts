import { AddEffectFn, RootState } from '@/store/store';
import {
  addStoredSession,
  checkIfWeightMigrationRequired,
  deleteExercise,
  deleteStoredSession,
  ensureExercisesHydrated,
  ensureHistoryHydrated,
  hydrateExercises,
  initializeStoredSessionsStateSlice,
  migrateExerciseWeights,
  selectLatestExercises,
  selectRecentExercises,
  selectSessions,
  setExercises,
  setExercisesRequiringWeightMigration,
  setIsHydrated,
  setLatestExercises,
  setProgressionSessions,
  setRecentExercises,
  setStoredSessions,
  updateExercise,
  upsertStoredSessions,
  WeightMigrateableExercise,
} from './index';
import { fetchUpcomingSessions } from '@/store/program';
import {
  fromRecordedExerciseJSON,
  RecordedExercise,
  RecordedWeightedExercise,
  Session,
} from '@/models/session-models';
import { setCurrentSession } from '@/store/current-session';
import { exercisesSchema, sessionsSchema } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import {
  ExerciseDescriptor,
  fromExerciseDescriptorJSON,
  toExerciseDescriptorJSON,
} from '@/models/exercise-models';
import { RecordedExerciseJSON } from '@/models/storage/versions/latest';
import { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { KeyValueStore } from '@/services/key-value-store';

const addedBuiltInExerciseIdsStorageKey = 'AddedBuiltInExerciseIdList';
const builtInExerciseCatalogVersionStorageKey = 'BuiltInExerciseCatalogVersionV1';
const BUILT_IN_EXERCISE_CATALOG_VERSION = '1';
const latestExercisesCacheStorageKey = 'LatestExercisesCacheV1';
const weightMigrationScanStorageKey = 'WeightMigrationScanV1';
const POST_STARTUP_MIGRATION_SCAN_DELAY_MS = 1500;

interface LatestExercisesCache {
  version: 1;
  sessionCount: number;
  exercises: Record<string, RecordedExerciseJSON>;
  recentExercises: Record<string, RecordedExerciseJSON[]>;
}

interface WeightMigrationScanCache {
  version: 1;
  sessionCount: number;
}

export function applyStoredSessionsEffects(addEffect: AddEffectFn) {
  addEffect(
    initializeStoredSessionsStateSlice,
    async (
      _,
      {
        cancelActiveListeners,
        getState,
        dispatch,
        extra: { keyValueStore, db, logger },
      },
    ) => {
      cancelActiveListeners();
      if (!getState().settings.isHydrated) {
        throw new Error('Settings must be hydrated before stored sessions');
      }

      const sessionCount = await getSessionCount(db);
      let progressionCacheLoaded = false;
      const cachedProgression = await keyValueStore.getItem(
        latestExercisesCacheStorageKey,
      );

      if (cachedProgression) {
        try {
          const cache = JSON.parse(cachedProgression) as LatestExercisesCache;
          if (
            cache.version === 1 &&
            cache.sessionCount === sessionCount &&
            cache.recentExercises
          ) {
            dispatch(
              setLatestExercises(
                Object.fromEntries(
                  Object.entries(cache.exercises).map(([key, exercise]) => [
                    key,
                    fromRecordedExerciseJSON(exercise),
                  ]),
                ),
              ),
            );
            dispatch(
              setRecentExercises(
                Object.fromEntries(
                  Object.entries(cache.recentExercises).map(
                    ([key, exercises]) => [
                      key,
                      exercises.map(fromRecordedExerciseJSON),
                    ],
                  ),
                ),
              ),
            );
            progressionCacheLoaded = true;
          }
        } catch (e) {
          logger.error('Failed to restore latest exercise cache', e);
        }
      }

      if (!progressionCacheLoaded) {
        await logger.time('initializeStoredSessionsFallback', async () => {
          dispatch(setProgressionSessions(await loadAllSessions(db)));
        });
        await persistProgressionCache(getState(), db, keyValueStore);
      }

      // The exercise library is not needed to show Home or start an existing
      // program. It is hydrated only when the user opens an exercise picker or
      // exercise manager, keeping the ~923 KB built-in catalog out of cold start.
      dispatch(setIsHydrated(true));
      dispatch(fetchUpcomingSessions());

      if (!(await isWeightMigrationScanCurrent(keyValueStore, sessionCount))) {
        setTimeout(
          () => dispatch(checkIfWeightMigrationRequired()),
          POST_STARTUP_MIGRATION_SCAN_DELAY_MS,
        );
      }
    },
  );

  addEffect(
    ensureExercisesHydrated,
    async (
      _,
      {
        cancelActiveListeners,
        getState,
        dispatch,
        extra: { keyValueStore, db, logger },
      },
    ) => {
      cancelActiveListeners();
      if (getState().storedSessions.isExercisesHydrated) return;

      await logger.time('hydrateExerciseCatalog', async () => {
        const catalogVersion = await keyValueStore.getItem(
          builtInExerciseCatalogVersionStorageKey,
        );

        if (catalogVersion !== BUILT_IN_EXERCISE_CATALOG_VERSION) {
          await seedBuiltInExercises(db, keyValueStore);
          await keyValueStore.setItem(
            builtInExerciseCatalogVersionStorageKey,
            BUILT_IN_EXERCISE_CATALOG_VERSION,
          );
        }

        const rows = await db.select().from(exercisesSchema);
        const sorted = rows
          .map(
            (row) =>
              [row.id, fromExerciseDescriptorJSON(row.payload)] as const,
          )
          .sort((a, b) => a[1].name.localeCompare(b[1].name));
        dispatch(hydrateExercises(Object.fromEntries(sorted)));
      });
    },
  );

  addEffect(
    ensureHistoryHydrated,
    async (
      _,
      { cancelActiveListeners, getState, dispatch, extra: { db, logger } },
    ) => {
      cancelActiveListeners();
      if (getState().storedSessions.isHistoryHydrated) return;

      await logger.time('hydrateFullHistory', async () => {
        const sessions = await loadAllSessions(db);
        dispatch(
          setStoredSessions(
            Object.fromEntries(sessions.map((session) => [session.id, session])),
          ),
        );
      });
    },
  );

  addEffect(
    checkIfWeightMigrationRequired,
    async (_, { dispatch, getState, extra: { db, keyValueStore } }) => {
      const state = getState();
      const completedSessionsList = state.storedSessions.isHistoryHydrated
        ? selectSessions(state)
        : await loadAllSessions(db);
      const migrationsByName = new Map<string, WeightMigrateableExercise>();

      for (const session of completedSessionsList) {
        for (const exercise of session.recordedExercises) {
          if (!(exercise instanceof RecordedWeightedExercise)) continue;
          if (migrationsByName.has(exercise.blueprint.name)) continue;
          if (exercise.potentialSets.some((set) => set.weight.unit === 'nil')) {
            migrationsByName.set(exercise.blueprint.name, {
              name: exercise.blueprint.name,
              unit: 'nil',
            });
          }
        }
      }

      dispatch(
        setExercisesRequiringWeightMigration(
          Array.from(migrationsByName.values()).sort((a, b) =>
            a.name.localeCompare(b.name),
          ),
        ),
      );

      // Once the database is known to contain no legacy nil weights, do not
      // deserialize years of history on every launch. A session-count change
      // invalidates this marker automatically.
      if (migrationsByName.size === 0) {
        await persistWeightMigrationScan(
          keyValueStore,
          await getSessionCount(db),
        );
      }
    },
  );

  addEffect(
    migrateExerciseWeights,
    async (_, { dispatch, getState, extra: { db, keyValueStore } }) => {
      const state = getState();
      const historyWasHydrated = state.storedSessions.isHistoryHydrated;
      const sessions = historyWasHydrated
        ? selectSessions(state)
        : await loadAllSessions(db);
      const migrations = state.storedSessions.exercisesRequiringWeightMigration;
      const migrationUnits = new Map(migrations.map((x) => [x.name, x.unit]));
      const applyWeightToSession = (session: Session) =>
        session.with({
          recordedExercises: session.recordedExercises.map((re) =>
            re instanceof RecordedWeightedExercise
              ? re.with({
                  potentialSets: re.potentialSets.map((ps) =>
                    ps.with({
                      weight: ps.weight.with({
                        unit:
                          ps.weight.unit === 'nil'
                            ? (migrationUnits.get(re.blueprint.name) ?? 'nil')
                            : ps.weight.unit,
                      }),
                    }),
                  }),
                })
              : re,
          ),
        });
      const newSessions = sessions.map(applyWeightToSession);
      const currentSession = state.currentSession.workoutSession;
      if (currentSession) {
        dispatch(
          setCurrentSession({
            target: 'workoutSession',
            session: applyWeightToSession(currentSession),
          }),
        );
      }
      dispatch(upsertStoredSessions(newSessions));
      if (!historyWasHydrated) dispatch(setProgressionSessions(newSessions));
      dispatch(fetchUpcomingSessions());
      dispatch(setExercisesRequiringWeightMigration([]));
      await persistWeightMigrationScan(
        keyValueStore,
        await getSessionCount(db),
      );
    },
  );

  addEffect(
    addStoredSession,
    async (a, { getState, extra }) => {
      if (!getState().settings.exportToHealthAggregator) return;
      const healthExportService = extra.healthExportService;
      if (!healthExportService.canExport()) return;
      try {
        await healthExportService.exportWorkout(a.payload);
      } catch (e) {
        extra.logger.error('Failed to sync to health aggregator', e);
      }
    },
  );

  addEffect(
    deleteStoredSession,
    async (
      action,
      { dispatch, getState, extra: { logger, db, keyValueStore } },
    ) => {
      await logger.time('deleteStoredSession', async () => {
        await db
          .delete(sessionsSchema)
          .where(eq(sessionsSchema.id, action.payload));
      });

      if (!getState().storedSessions.isHistoryHydrated) {
        await rebuildProgressionFromDatabase(dispatch, db);
      }
      await persistProgressionCache(getState(), db, keyValueStore);
    },
  );

  addEffect(
    deleteStoredSession,
    async (action, { stateAfterReduce, extra }) => {
      if (!stateAfterReduce.settings.exportToHealthAggregator) return;
      const healthExportService = extra.healthExportService;
      if (!healthExportService.canExport()) return;
      try {
        await healthExportService.deleteWorkout(action.payload);
      } catch (e) {
        extra.logger.error('Failed to delete workout from HealthConnect', e);
      }
    },
  );

  addEffect(
    addStoredSession,
    async (
      action,
      {
        cancelActiveListeners,
        dispatch,
        getState,
        stateAfterReduce,
        extra: { db, logger, keyValueStore },
      },
    ) => {
      cancelActiveListeners();
      const lazyHistory = !stateAfterReduce.storedSessions.isHistoryHydrated;
      const replacingPersistedSession =
        lazyHistory && (await sessionExists(db, action.payload.id));

      await logger.time('addStoredSession', async () => {
        const payload = action.payload.toJSON();
        await db
          .insert(sessionsSchema)
          .values({ id: action.payload.id, payload })
          .onConflictDoUpdate({
            target: sessionsSchema.id,
            set: { payload: sql.raw(`excluded.${sessionsSchema.payload.name}`) },
          });
      });

      if (replacingPersistedSession) {
        await rebuildProgressionFromDatabase(dispatch, db);
      }
      await persistProgressionCache(getState(), db, keyValueStore);
    },
  );

  addEffect(
    upsertStoredSessions,
    async (
      action,
      {
        cancelActiveListeners,
        dispatch,
        getState,
        stateAfterReduce,
        extra: { db, logger, keyValueStore },
      },
    ) => {
      cancelActiveListeners();
      await logger.time('upsertStoredSessions', async () => {
        const toUpsert = action.payload.map((x) => ({
          id: x.id,
          payload: x.toJSON(),
        }));
        if (!toUpsert.length) return;
        await db
          .insert(sessionsSchema)
          .values(toUpsert)
          .onConflictDoUpdate({
            target: sessionsSchema.id,
            set: { payload: sql.raw(`excluded.${sessionsSchema.payload.name}`) },
          });
      });

      if (!stateAfterReduce.storedSessions.isHistoryHydrated) {
        await rebuildProgressionFromDatabase(dispatch, db);
      }
      await persistProgressionCache(getState(), db, keyValueStore);
      // Imports/restores may introduce legacy records even if the row count
      // happens to remain unchanged. Force the one-shot scan next launch.
      await keyValueStore.removeItem(weightMigrationScanStorageKey);
    },
  );

  addEffect(deleteExercise, async (action, { extra: { db } }) => {
    await db
      .delete(exercisesSchema)
      .where(eq(exercisesSchema.id, action.payload));
  });

  addEffect(updateExercise, async (action, { extra: { db } }) => {
    await db
      .insert(exercisesSchema)
      .values({
        id: action.payload.id,
        payload: toExerciseDescriptorJSON(action.payload.exercise),
      })
      .onConflictDoUpdate({
        target: exercisesSchema.id,
        set: { payload: sql.raw(`excluded.${exercisesSchema.payload.name}`) },
      });
  });

  addEffect(
    setExercises,
    async (action, { stateAfterReduce, extra: { db } }) => {
      if (!stateAfterReduce.storedSessions.isHydrated) return;
      await db.transaction(async (tx) => {
        await tx.delete(exercisesSchema);
        const exerciseRows = Object.entries(action.payload).map(
          ([id, exercise]) => ({
            id,
            payload: toExerciseDescriptorJSON(exercise),
          }),
        );
        if (exerciseRows.length) {
          await tx.insert(exercisesSchema).values(exerciseRows);
        }
      });
    },
  );
}

async function seedBuiltInExercises(
  db: ExpoSQLiteDatabase,
  keyValueStore: KeyValueStore,
) {
  const { exercises: builtInExerciseList } =
    await import('../../../assets/exercises.json');
  const addedInThePast = JSON.parse(
    (await keyValueStore.getItem(addedBuiltInExerciseIdsStorageKey)) ?? '[]',
  ) as string[];
  const previouslyAddedIds = new Set(addedInThePast);
  const newEntries: Array<{ id: string; exercise: ExerciseDescriptor }> = [];

  for (const builtIn of builtInExerciseList) {
    if (previouslyAddedIds.has(builtIn.name)) continue;
    newEntries.push({
      id: builtIn.name,
      exercise: {
        name: builtIn.name,
        force: builtIn.force,
        level: builtIn.level,
        mechanic: builtIn.mechanic,
        equipment: builtIn.equipment,
        category: builtIn.category,
        instructions: builtIn.instructions.join('\n'),
        muscles: builtIn.primaryMuscles.concat(builtIn.secondaryMuscles),
      },
    });
  }

  if (!newEntries.length) return;

  await db
    .insert(exercisesSchema)
    .values(
      newEntries.map(({ id, exercise }) => ({
        id,
        payload: toExerciseDescriptorJSON(exercise),
      })),
    )
    .onConflictDoNothing();
  await keyValueStore.setItem(
    addedBuiltInExerciseIdsStorageKey,
    JSON.stringify(addedInThePast.concat(newEntries.map(({ id }) => id))),
  );
}

async function loadAllSessions(db: ExpoSQLiteDatabase): Promise<Session[]> {
  return (await db.select().from(sessionsSchema)).map((row) =>
    Session.fromJSON(row.payload),
  );
}

async function rebuildProgressionFromDatabase(
  dispatch: (action: ReturnType<typeof setProgressionSessions>) => void,
  db: ExpoSQLiteDatabase,
) {
  dispatch(setProgressionSessions(await loadAllSessions(db)));
}

async function sessionExists(
  db: ExpoSQLiteDatabase,
  sessionId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: sessionsSchema.id })
    .from(sessionsSchema)
    .where(eq(sessionsSchema.id, sessionId))
    .limit(1);
  return rows.length > 0;
}

async function getSessionCount(db: ExpoSQLiteDatabase): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(sessionsSchema);
  return Number(rows[0]?.count ?? 0);
}

async function persistProgressionCache(
  state: RootState,
  db: ExpoSQLiteDatabase,
  keyValueStore: Pick<KeyValueStore, 'setItem'>,
) {
  const latestExercises = selectLatestExercises(state);
  const recentExercises = selectRecentExercises(state);
  const exercises: Record<string, RecordedExerciseJSON> = {};
  const recent: Record<string, RecordedExerciseJSON[]> = {};

  for (const [key, exercise] of Object.entries(latestExercises)) {
    if (exercise) exercises[key] = (exercise as RecordedExercise).toJSON();
  }
  for (const [key, recordedExercises] of Object.entries(recentExercises)) {
    recent[key] = recordedExercises.map((exercise) =>
      (exercise as RecordedExercise).toJSON(),
    );
  }

  const cache: LatestExercisesCache = {
    version: 1,
    sessionCount: await getSessionCount(db),
    exercises,
    recentExercises: recent,
  };
  await keyValueStore.setItem(
    latestExercisesCacheStorageKey,
    JSON.stringify(cache),
  );
}

async function isWeightMigrationScanCurrent(
  keyValueStore: KeyValueStore,
  sessionCount: number,
): Promise<boolean> {
  const stored = await keyValueStore.getItem(weightMigrationScanStorageKey);
  if (!stored) return false;
  try {
    const cache = JSON.parse(stored) as WeightMigrationScanCache;
    return cache.version === 1 && cache.sessionCount === sessionCount;
  } catch {
    return false;
  }
}

async function persistWeightMigrationScan(
  keyValueStore: KeyValueStore,
  sessionCount: number,
) {
  const cache: WeightMigrationScanCache = { version: 1, sessionCount };
  await keyValueStore.setItem(
    weightMigrationScanStorageKey,
    JSON.stringify(cache),
  );
}
