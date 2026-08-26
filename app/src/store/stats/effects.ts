import { setOverallViewTime, setStatsIsDirty } from './index';
import { fetchOverallStats, setOverallStats } from './index';
import { AddEffectFn } from '@/store/store';
import {
  addStoredSession,
  deleteStoredSession,
  upsertStoredSessions,
} from '@/store/stored-sessions';
import { RemoteData } from '@/models/remote';
import { selectPreferredWeightUnit } from '../settings';
import { calculateStats } from '@/store/stats/calculate-stats';
import { sessionsSchema } from '@/db/schema';
import { sql } from 'drizzle-orm';
import { Session } from '@/models/session-models';
import { toLocalDateJSON } from '@/models/storage/versions/latest';

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

    dispatch(setOverallStats(RemoteData.loading()));
    try {
      const timeframe = state.stats.overallViewTime;
      const rows =
        timeframe === 'all-time'
          ? await db.select().from(sessionsSchema)
          : await db
              .select()
              .from(sessionsSchema)
              .where(
                sql`json_extract(${sessionsSchema.payload}, '$.date') >= ${toLocalDateJSON(timeframe.from)} AND json_extract(${sessionsSchema.payload}, '$.date') <= ${toLocalDateJSON(timeframe.to)}`,
              );

      if (!rows.length) {
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

      const stats = calculateStats(
        sessions,
        selectPreferredWeightUnit(state),
        effectiveTimeframe,
      );
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

  // Completing/editing/deleting a workout invalidates cached statistics, but
  // recalculation remains lazy until Progress is actually opened.
  addEffect(
    [addStoredSession, deleteStoredSession, upsertStoredSessions],
    async (_, { dispatch }) => {
      dispatch(setStatsIsDirty(true));
    },
  );
}
