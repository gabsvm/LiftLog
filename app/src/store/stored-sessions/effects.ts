import { AddEffectFn, RootState } from '@/store/store';
import {
  addStoredSession,
  checkIfWeightMigrationRequired,
  deleteExercise,
  deleteStoredSession,
  ensureHistoryHydrated,
  initializeStoredSessionsStateSlice,
  migrateExerciseWeights,
  selectLatestExercises,
  selectRecentExercises,
  selectSessions,
  setExercises,
  setExercisesRequiringWeightMigration,
  setIsHydrated,
  setLatestExercises,
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
import { toRecord } from '@/utils/reduce';
import {
  ExerciseDescriptor,
  fromExerciseDescriptorJSON,
  toExerciseDescriptorJSON,
} from '@/models/exercise-models';
import { RecordedExerciseJSON } from '@/models/storage/versions/latest';
import { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';

// We keep track of added builtin exerciseIds (which are the exercise name for builtins)
// Then we make sure builtins don't get re-added if they are deleted
const addedBuiltInExerciseIdsStorageKey = 'AddedBuiltInExerciseIdList';
const latestExercisesCacheStorageKey = 'LatestExercisesCacheV1';
const POST_STARTUP_MIGRATION_SCAN_DELAY_MS = 350;

interface LatestExercisesCache {
  version: 1;
  sessionCount: number;
  exercises: Record<string, RecordedExerciseJSON>;
  recentExercises: Record<string, RecordedExerciseJSON[]>;
}

export function applyStoredSessionsEffects(addEffect: AddEffectFn) {
  // Dispatched AFTER settings, so we can safely access settings
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
            const latestExercises = Object.fromEntries(
              Object.entries(cache.exercises).map(([key, exercise]) => [
                key,
                fromRecordedExerciseJSON(exercise),
              ]),
            );
            const recentExercises = Object.fromEntries(
              Object.entries(cache.recentExercises).map(([key, exercises]) => [
                key,
                exercises.map(fromRecordedExerciseJSON),
              ]),
            );
            dispatch(setLatestExercises(latestExercises));
            dispatch(setRecentExercises(recentExercises));
            progressionCacheLoaded = true;
          }
        } catch (e) {
          logger.error('Failed to restore latest exercise cache', e);
        }
      }

      if (!progressionCacheLoaded) {
        // One-time fallback for existing installs. Once this cache has been
        // written, normal startups no longer deserialize the full history just
        // to calculate the next workout or show recent exercise context.
        await logger.time('initializeStoredSessionsFallback', async () => {
          const completedSessions = (
            await db.select().from(sessionsSchema)
          ).reduce(
            toRecord(
              (x) => x.id,
              (row) => Session.fromJSON(row.payload),
            ),
            {},
          );
          dispatch(setStoredSessions(completedSessions));
        });
        await persistProgressionCache(getState(), db, keyValueStore);
      }

      const { exercises: builtInExerciseList } =
        await import('../../../assets/exercises.json');
      const builtinExercisesAddedInThePast = JSON.parse(
        (await keyValueStore.getItem(addedBuiltInExerciseIdsStorageKey)) ??
          '[]',
      ) as string[];
      const savedExercises = (await db.select().from(exercisesSchema)).reduce(
        toRecord(
          (x) => x.id,
          (x) => fromExerciseDescriptorJSON(x.payload),
        ),
        {},
      );
      const previouslyAddedIds = new Set(builtinExercisesAddedInThePast);
      const builtInExercisesNotAlreadyAdded = builtInExerciseList
        .filter((x) => !previouslyAddedIds.has(x.name))
        .reduce(
          (a, b) => {
            a[b.name] = {
              name: b.name,
              force: b.force,
              level: b.level,
              mechanic: b.mechanic,
              equipment: b.equipment,
              category: b.category,
              instructions: b.instructions.join('\n'),
              muscles: b.primaryMuscles.concat(b.secondaryMuscles),
            };
            return a;
          },
          {} as Record<string, ExerciseDescriptor>,
        );

      const newBuiltInEntries = Object.entries(builtInExercisesNotAlreadyAdded);
      if (newBuiltInEntries.length > 0) {
        // The old path dispatched one updateExercise per builtin. On a fresh
        // install that means hundreds of Redux listener runs and SQLite writes.
        // Seed all missing builtins with one SQLite statement instead.
        await db
          .insert(exercisesSchema)
          .values(
            newBuiltInEntries.map(([id, exercise]) => ({
              id,
              payload: toExerciseDescriptorJSON(exercise),
            })),
          )
          .onConflictDoNothing();
      }

      const currentExercises = Object.entries({
        ...builtInExercisesNotAlreadyAdded,
        ...savedExercises,
      }).sort((a, b) => a[1].name.localeCompare(b[1].name));
      dispatch(setExercises(Object.fromEntries(currentExercises)));

      if (newBuiltInEntries.length > 0) {
        const newBuiltIns = builtinExercisesAddedInThePast.concat(
          newBuiltInEntries.map(([id]) => id),
        );
        await keyValueStore.setItem(
          addedBuiltInExerciseIdsStorageKey,
          JSON.stringify(newBuiltIns),
        );
      }

      dispatch(setIsHydrated(true));
      dispatch(fetchUpcomingSessions());

      // The nil-weight compatibility scan walks historical data. Keep it out of
      // the first usable frame; it can scan SQLite independently of Redux.
      setTimeout(
        () => dispatch(checkIfWeightMigrationRequired()),
        POST_STARTUP_MIGRATION_SCAN_DELAY_MS,
      );
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
        const sessions = (await db.select().from(sessionsSchema)).reduce(
          toRecord(
            (x) => x.id,
            (row) => Session.fromJSON(row.payload),
          ),
          {},
        );
        dispatch(setStoredSessions(sessions));
      });
    },
  );

  addEffect(
    checkIfWeightMigrationRequired,
    async (_, { dispatch, getState, extra: { db } }) => {
      const state = getState();
      const completedSessionsList = state.storedSessions.isHistoryHydrated
        ? selectSessions(state)
        : (await db.select().from(sessionsSchema)).map((row) =>
            Session.fromJSON(row.payload),
          );
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
    },
  );

  addEffect(
    migrateExerciseWeights,
    async (_, { dispatch, getState, extra: { db } }) => {
      const state = getState();
      const historyWasHydrated = state.storedSessions.isHistoryHydrated;
      const sessions = historyWasHydrated
        ? selectSessions(state)
        : (await db.select().from(sessionsSchema)).map((row) =>
            Session.fromJSON(row.payload),
          );
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
      if (!historyWasHydrated) {
        dispatch(
          setStoredSessions(Object.fromEntries(newSessions.map((x) => [x.id, x]))),
        );
      }
      dispatch(fetchUpcomingSessions());
      dispatch(setExercisesRequiringWeightMigration([]));
    },
  );

  addEffect(
    addStoredSession,
    async (a, { getState, extra: { healthExportService, logger } }) => {
      const workout = a.payload;
      if (
        !getState().settings.exportToHealthAggregator ||
        !healthExportService.canExport()
      ) {
        return;
      }
      try {
        await healthExportService.exportWorkout(workout);
      } catch (e) {
        logger.error('Failed to sync to health aggregator', e);
      }
    },
  );

  addEffect(
    deleteStoredSession,
    async (
      action,
      { stateAfterReduce, extra: { logger, db, keyValueStore } },
    ) => {
      await logger.time('deleteStoredSession', async () => {
        await db
          .delete(sessionsSchema)
          .where(eq(sessionsSchema.id, action.payload));
      });
      await persistProgressionCache(stateAfterReduce, db, keyValueStore);
    },
  );
  addEffect(
    deleteStoredSession,
    async (
      action,
      { stateAfterReduce, extra: { healthExportService, logger } },
    ) => {
      const workoutId = action.payload;
      if (
        !stateAfterReduce.settings.exportToHealthAggregator ||
        !healthExportService.canExport()
      ) {
        return;
      }
      try {
        await healthExportService.deleteWorkout(workoutId);
      } catch (e) {
        logger.error('Failed to delete workout from HealthConnect', e);
      }
    },
  );

  addEffect(
    addStoredSession,
    async (
      action,
      {
        cancelActiveListeners,
        stateAfterReduce,
        extra: { db, logger, keyValueStore },
      },
    ) => {
      cancelActiveListeners();
      await logger.time('addStoredSession', async () => {
        const payload = action.payload.toJSON();
        await db
          .insert(sessionsSchema)
          .values({
            id: action.payload.id,
            payload,
          })
          .onConflictDoUpdate({
            target: sessionsSchema.id,
            set: {
              payload: sql.raw(`excluded.${sessionsSchema.payload.name}`),
            },
          });
      });
      await persistProgressionCache(stateAfterReduce, db, keyValueStore);
    },
  );

  addEffect(
    upsertStoredSessions,
    async (
      action,
      {
        cancelActiveListeners,
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
            set: {
              payload: sql.raw(`excluded.${sessionsSchema.payload.name}`),
            },
          });
      });
      await persistProgressionCache(stateAfterReduce, db, keyValueStore);
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
        set: {
          payload: sql.raw(`excluded.${exercisesSchema.payload.name}`),
        },
      });
  });

  addEffect(
    setExercises,
    async (action, { stateAfterReduce, extra: { db } }) => {
      if (!stateAfterReduce.storedSessions.isHydrated) {
        return;
      }
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

async function getSessionCount(db: ExpoSQLiteDatabase): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(sessionsSchema);
  return Number(rows[0]?.count ?? 0);
}

async function persistProgressionCache(
  state: RootState,
  db: ExpoSQLiteDatabase,
  keyValueStore: {
    setItem(key: string, value: string): Promise<void>;
  },
) {
  const latestExercises = selectLatestExercises(state);
  const recentExercises = selectRecentExercises(state);
  const exercises: Record<string, RecordedExerciseJSON> = {};
  const recent: Record<string, RecordedExerciseJSON[]> = {};

  for (const [key, exercise] of Object.entries(latestExercises)) {
    if (exercise) {
      exercises[key] = (exercise as RecordedExercise).toJSON();
    }
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
