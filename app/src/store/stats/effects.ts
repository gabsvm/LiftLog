import {
  GranularStatisticView,
  setOverallViewTime,
  setStatsIsDirty,
} from './index';
import { fetchOverallStats, setOverallStats } from './index';
import { AddEffectFn } from '@/store/store';
import {
  addStoredSession,
  deleteStoredSession,
  upsertStoredSessions,
} from '@/store/stored-sessions';
import { RemoteData } from '@/models/remote';
import { selectPreferredWeightUnit, setUseImperialUnits } from '../settings';
import { calculateStats } from '@/store/stats/calculate-stats';
import { sessionsSchema } from '@/db/schema';
import { sql } from 'drizzle-orm';
import { Session } from '@/models/session-models';
import { toLocalDateJSON } from '@/models/storage/versions/latest';
import { LocalDateRange } from '@/models/time-models';
import { WeightUnit } from '@/models/weight';

const statsCache = new Map<string, GranularStatisticView>();

function cacheKey(
  timeframe: LocalDateRange | 'all-time',
  unit: WeightUnit,
): string {
  return timeframe === 'all-time'
    ? `${unit}:all-time`
    : `${unit}:${timeframe.from.toString()}:${timeframe.to.toString()}`;
}

export function applyStatsEffects(addEffect: AddEffectFn) {
  addEffect(fetchOverallStats, async (_, { getState, dispatch, extra: { db } }) => {
    const state = getState();

    if (
      state.stats.overallView.isLoading() ||
      !state.stats.isDirty ||
      !state.storedSessions.isHydrated
    ) {
      return;
    }

    const timeframe = state.stats.overallViewTime;
    const preferredUnit = selectPreferredWeightUnit(state);
    const key = cacheKey(timeframe, preferredUnit);
    const cached = statsCache.get(key);
    if (cached) {
      dispatch(setOverallStats(RemoteData.success(cached)));
      dispatch(setStatsIsDirty(false));
      return;
    }

    dispatch(setOverallStats(RemoteData.loading()));
    try {
      const rows =
        timeframe === 'all-time'
          ? await db.select().from(sessionsSchema)
          : await db
              .select()
              .from(sessionsSchema)
              .where(
                sql`json_extract(${sessionsSchema.payload}, '$.date') >= ${toLocalDateJSON(timeframe.from)} AND json_extract(${sessionsSchema.payload}, '$.date') <= ${toLocalDateJSON(timeframe.to)}`,
              );

      if (timeframe === 'all-time' && !rows.length) {
        dispatch(setOverallStats(RemoteData.error('No sessions')));
        dispatch(setStatsIsDirty(false));
        return;
      }

      const sessions = rows.map((row) => Session.fromJSON(row.payload));
      const effectiveTimeframe =
        timeframe === 'all-time'
          ? {
              from: sessions.reduce(
                (earliest, session) =>
                  session.date.isBefore(earliest) ? session.date : earliest,
                sessions[0]!.date,
              ),
              to: sessions.reduce(
                (latest, session) =>
                  session.date.isAfter(latest) ? session.date : latest,
                sessions[0]!.date,
              ),
            }
          : timeframe;

      const stats = calculateStats(sessions, preferredUnit, effectiveTimeframe);
      statsCache.set(key, stats);
      dispatch(setOverallStats(RemoteData.success(stats)));
      dispatch(setStatsIsDirty(false));
    } catch (e) {
      dispatch(setOverallStats(RemoteData.error(e)));
    }
  });

  addEffect(setOverallViewTime, async (_, { dispatch }) => {
    dispatch(setStatsIsDirty(true));
    dispatch(fetchOverallStats());
  });

  addEffect(setUseImperialUnits, async (_, { dispatch }) => {
    dispatch(setStatsIsDirty(true));
    dispatch(fetchOverallStats());
  });

  // Completing/editing/deleting a workout invalidates every cached range.
  addEffect(
    [addStoredSession, deleteStoredSession, upsertStoredSessions],
    async (_, { dispatch }) => {
      statsCache.clear();
      dispatch(setStatsIsDirty(true));
    },
  );
}
