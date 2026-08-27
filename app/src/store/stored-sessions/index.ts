import { RecordedExercise, Session } from '@/models/session-models';
import {
  NormalizedName,
  NormalizedNameKey,
  ExerciseBlueprint,
  KeyedExerciseBlueprint,
} from '@/models/blueprint-models';
import { LocalDate, OffsetDateTime, YearMonth, ZoneId } from '@js-joda/core';
import {
  createAction,
  createSelector,
  createSlice,
  PayloadAction,
  WritableDraft,
} from '@reduxjs/toolkit';
import { WeightUnit } from '@/models/weight';
import { ExerciseDescriptor } from '@/models/exercise-models';

export interface WeightMigrateableExercise {
  name: string;
  unit: WeightUnit;
}

const RECENT_EXERCISES_PER_NAME = 10;

interface StoredSessionState {
  isHydrated: boolean;
  isHistoryHydrated: boolean;
  isExercisesHydrated: boolean;
  sessions: Record<string, Session>;
  latestExercises: Record<string, RecordedExercise | undefined>;
  recentExercises: Record<NormalizedNameKey, RecordedExercise[]>;
  latestNonFreeformSession: Session | undefined;
  savedExercises: Record<string, ExerciseDescriptor>;
  filteredExerciseIds: string[];
  exercisesRequiringWeightMigration: WeightMigrateableExercise[];
  earliestSession: Session | undefined;
}

const initialState: StoredSessionState = {
  isHydrated: false,
  isHistoryHydrated: false,
  isExercisesHydrated: false,
  sessions: {},
  latestExercises: {},
  recentExercises: {},
  latestNonFreeformSession: undefined,
  savedExercises: {},
  filteredExerciseIds: [],
  exercisesRequiringWeightMigration: [],
  earliestSession: undefined,
};

const storedSessionsSlice = createSlice({
  name: 'storedSessions',
  initialState,
  reducers: {
    setIsHydrated(state, action: PayloadAction<boolean>) {
      state.isHydrated = action.payload;
    },
    setLatestExercises(
      state,
      action: PayloadAction<Record<string, RecordedExercise | undefined>>,
    ) {
      state.latestExercises = action.payload;
    },
    setRecentExercises(
      state,
      action: PayloadAction<Record<NormalizedNameKey, RecordedExercise[]>>,
    ) {
      state.recentExercises = action.payload;
    },
    setLatestNonFreeformSession(
      state,
      action: PayloadAction<Session | undefined>,
    ) {
      state.latestNonFreeformSession = action.payload;
    },
    setProgressionSessions(state, action: PayloadAction<Session[]>) {
      resetDerivatives(state);
      for (const session of action.payload) {
        updateDerivatives(state, session);
      }
    },
    setStoredSessions(state, action: PayloadAction<Record<string, Session>>) {
      state.sessions = action.payload;
      state.isHistoryHydrated = true;
      rebuildDerivatives(state);
    },
    upsertStoredSessions(state, action: PayloadAction<Session[]>) {
      let replacesExistingSession = false;
      action.payload.forEach((session) => {
        replacesExistingSession ||= state.sessions[session.id] !== undefined;
        state.sessions[session.id] = session;
      });

      if (replacesExistingSession && state.isHistoryHydrated) {
        rebuildDerivatives(state);
      } else {
        action.payload.forEach((session) => updateDerivatives(state, session));
      }
    },
    addStoredSession(state, action: PayloadAction<Session>) {
      const replacesExistingSession =
        state.sessions[action.payload.id] !== undefined;
      state.sessions[action.payload.id] = action.payload;
      if (replacesExistingSession && state.isHistoryHydrated) {
        rebuildDerivatives(state);
      } else {
        updateDerivatives(state, action.payload);
      }
    },
    deleteStoredSession(state, action: PayloadAction<string>) {
      const deletedSession = state.sessions[action.payload];
      delete state.sessions[action.payload];
      if (!deletedSession) return;
      if (state.isHistoryHydrated) rebuildDerivatives(state);
    },
    hydrateExercises(
      state,
      action: PayloadAction<Record<string, ExerciseDescriptor>>,
    ) {
      state.savedExercises = action.payload;
      state.isExercisesHydrated = true;
    },
    updateExercise(
      state,
      action: PayloadAction<{ id: string; exercise: ExerciseDescriptor }>,
    ) {
      state.savedExercises[action.payload.id] = action.payload.exercise;
    },
    deleteExercise(state, action: PayloadAction<string>) {
      delete state.savedExercises[action.payload];
    },
    setExercises(
      state,
      action: PayloadAction<Record<string, ExerciseDescriptor>>,
    ) {
      state.savedExercises = action.payload;
      state.isExercisesHydrated = true;
    },
    setFilteredExerciseIds(state, action: PayloadAction<string[]>) {
      state.filteredExerciseIds = action.payload;
    },
    setExercisesRequiringWeightMigration(
      state,
      action: PayloadAction<WeightMigrateableExercise[]>,
    ) {
      state.exercisesRequiringWeightMigration = action.payload;
    },
    updateExerciseRequiringWeightMigration(
      state,
      action: PayloadAction<WeightMigrateableExercise>,
    ) {
      const val = state.exercisesRequiringWeightMigration.find(
        (x) => x.name === action.payload.name,
      );
      if (val) val.unit = action.payload.unit;
    },
  },
  selectors: {
    selectLatestExercises: (state: StoredSessionState) => state.latestExercises,
    selectRecentExercises: (state: StoredSessionState) => state.recentExercises,
    selectLatestNonFreeformSession: (state: StoredSessionState) =>
      state.latestNonFreeformSession,
    selectIsHistoryHydrated: (state: StoredSessionState) =>
      state.isHistoryHydrated,
    selectIsExercisesHydrated: (state: StoredSessionState) =>
      state.isExercisesHydrated,
    selectSessions: createSelector(
      [(state: StoredSessionState) => state.sessions],
      (sessions) => Object.values(sessions),
    ),
    selectSession: createSelector(
      [(state: StoredSessionState) => state.sessions, (_, id: string) => id],
      (sessions, id) => sessions[id],
    ),
    selectCompletedDistinctSessionNames: createSelector(
      [
        (state: StoredSessionState) => state.sessions,
        (_, since: LocalDate) => since,
      ],
      (sessions, since) => {
        const names = new Set<string>();
        for (const session of Object.values(sessions)) {
          if (session.date.isAfter(since) || session.date.isEqual(since)) {
            names.add(session.blueprint.name);
          }
        }
        return [...names];
      },
    ),
    selectExercises: (state: StoredSessionState) => state.savedExercises,
    selectExerciseById: createSelector(
      [
        (state: StoredSessionState) => state.savedExercises,
        (_, id: string) => id,
      ],
      (exercises, id) => exercises[id],
    ),
    selectExerciseIds: (state: StoredSessionState) =>
      Object.keys(state.savedExercises),
  },
});

function resetDerivatives(state: WritableDraft<StoredSessionState>) {
  state.latestExercises = {};
  state.recentExercises = {};
  state.latestNonFreeformSession = undefined;
  state.earliestSession = undefined;
}

function rebuildDerivatives(state: WritableDraft<StoredSessionState>) {
  resetDerivatives(state);
  for (const session of Object.values(state.sessions)) {
    updateDerivatives(state, session as Session);
  }
}

function updateDerivatives(
  state: WritableDraft<StoredSessionState>,
  session: Session,
) {
  if (
    !state.earliestSession ||
    state.earliestSession.date.isAfter(session.date)
  ) {
    state.earliestSession = session;
  }

  if (!session.isFreeform) {
    const latest = state.latestNonFreeformSession as Session | undefined;
    if (
      !latest ||
      getSessionReferenceTime(latest).isBefore(getSessionReferenceTime(session))
    ) {
      state.latestNonFreeformSession = session;
    }
  }

  for (const exercise of session.recordedExercises) {
    const key = KeyedExerciseBlueprint.fromExerciseBlueprint(
      exercise.blueprint,
    ).toString();
    const latestExercise = state.latestExercises[key];
    if (
      !latestExercise ||
      latestExercise.latestTime?.isBefore(
        exercise.latestTime ?? OffsetDateTime.MIN,
      )
    ) {
      state.latestExercises[key] = exercise;
    }

    if (!exercise.isStarted) continue;
    const normalizedKey = NormalizedName.fromExerciseBlueprint(
      exercise.blueprint,
    ).toString();
    const recent = state.recentExercises[normalizedKey] ?? [];
    recent.push(exercise);
    recent.sort((a, b) =>
      (b.latestTime ?? OffsetDateTime.MIN).compareTo(
        a.latestTime ?? OffsetDateTime.MIN,
      ),
    );
    if (recent.length > RECENT_EXERCISES_PER_NAME) {
      recent.length = RECENT_EXERCISES_PER_NAME;
    }
    state.recentExercises[normalizedKey] = recent;
  }
}

export const selectSessionsBy = createSelector(
  [
    storedSessionsSlice.selectors.selectSessions,
    (_, minDate: LocalDate) => minDate,
    (_, __, maxDate: LocalDate) => maxDate,
  ],
  (sessions, minDate, maxDate) =>
    sessions.filter(
      (x) =>
        (x.date.isAfter(minDate) || x.date.isEqual(minDate)) &&
        (x.date.isBefore(maxDate) || x.date.isEqual(maxDate)),
    ),
);

export const initializeStoredSessionsStateSlice = createAction(
  'initializeStoredSessionsStateSlice',
);
export const ensureHistoryHydrated = createAction('ensureHistoryHydrated');
export const ensureExercisesHydrated = createAction('ensureExercisesHydrated');
export const migrateExerciseWeights = createAction('migrateExerciseWeights');
export const checkIfWeightMigrationRequired = createAction(
  'checkIfWeightMigrationRequired',
);

export const {
  setIsHydrated,
  setLatestExercises,
  setRecentExercises,
  setLatestNonFreeformSession,
  setProgressionSessions,
  setStoredSessions,
  hydrateExercises,
  upsertStoredSessions,
  addStoredSession,
  deleteStoredSession,
  updateExercise,
  deleteExercise,
  setExercises,
  setFilteredExerciseIds,
  setExercisesRequiringWeightMigration,
  updateExerciseRequiringWeightMigration,
} = storedSessionsSlice.actions;

export const {
  selectSessions,
  selectSession,
  selectExercises,
  selectLatestExercises,
  selectRecentExercises,
  selectLatestNonFreeformSession,
  selectIsHistoryHydrated,
  selectIsExercisesHydrated,
  selectExerciseById,
} = storedSessionsSlice.selectors;

export const selectRecentlyCompletedExercises = createSelector(
  [
    selectRecentExercises,
    (_, maxRecordsPerExercise: number) => maxRecordsPerExercise,
  ],
  (recentExercises, maxRecordsPerExercise) =>
    (blueprint: ExerciseBlueprint): RecordedExercise[] =>
      (recentExercises[
        NormalizedName.fromExerciseBlueprint(blueprint).toString()
      ] ?? []).slice(0, maxRecordsPerExercise),
);

export const selectPreviousComparableSession = createSelector(
  [selectSessions, (_, session: Session | undefined) => session],
  (sessions, session) => {
    if (!session) return undefined;

    const referenceEpochSecond = getSessionReferenceTime(session).toEpochSecond();
    let bestSession: Session | undefined;
    let bestEpochSecond = Number.NEGATIVE_INFINITY;
    for (const storedSession of sessions) {
      if (
        storedSession.id === session.id ||
        storedSession.blueprint.name !== session.blueprint.name
      ) {
        continue;
      }
      const candidateEpochSecond =
        getSessionReferenceTime(storedSession).toEpochSecond();
      if (
        candidateEpochSecond < referenceEpochSecond &&
        candidateEpochSecond > bestEpochSecond
      ) {
        bestSession = storedSession;
        bestEpochSecond = candidateEpochSecond;
      }
    }
    return bestSession;
  },
);

export const selectSessionsInMonth = createSelector(
  [selectSessions, (_, ym: YearMonth) => ym],
  (sessions, ym) =>
    sessions
      .filter(
        (x) => x.date.year() === ym.year() && x.date.month().equals(ym.month()),
      )
      .sort((a, b) =>
        getSessionReferenceTime(b).compareTo(getSessionReferenceTime(a)),
      ),
);

export const selectMuscles = createSelector([selectExercises], (exercises) => {
  const muscles = new Set<string>();
  for (const exercise of Object.values(exercises)) {
    for (const muscle of exercise.muscles) muscles.add(muscle);
  }
  return [...muscles].sort();
});

export const selectExerciseIds = createSelector(
  [selectExercises],
  (exercises) => Object.keys(exercises),
);

export const storedSessionsReducer = storedSessionsSlice.reducer;

export function getSessionReferenceTime(session: Session): OffsetDateTime {
  return (
    session.lastExercise?.latestTime ??
    session.date
      .atStartOfDay()
      .atZone(ZoneId.systemDefault())
      .toOffsetDateTime()
  );
}
