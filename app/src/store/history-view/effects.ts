import { sessionsSchema } from '@/db/schema';
import { Session } from '@/models/session-models';
import { toLocalDateJSON } from '@/models/storage/versions/latest';
import { AddEffectFn } from '@/store/store';
import {
  addStoredSession,
  deleteStoredSession,
  upsertStoredSessions,
} from '@/store/stored-sessions';
import { sql } from 'drizzle-orm';
import {
  applyHistorySessionChanges,
  beginHistoryRangeLoad,
  historyRangeKey,
  removeHistorySession,
  requestHistoryRange,
  setHistoryRangeSessions,
} from './index';

export function applyHistoryViewEffects(addEffect: AddEffectFn) {
  addEffect(
    requestHistoryRange,
    async (action, { dispatch, extra: { db, logger } }) => {
      const rangeKey = historyRangeKey(action.payload);
      dispatch(
        beginHistoryRangeLoad({
          rangeKey,
          from: action.payload.from.toString(),
          to: action.payload.to.toString(),
        }),
      );

      await logger.time('loadHistoryRange', async () => {
        const rows = await db
          .select()
          .from(sessionsSchema)
          .where(
            sql`json_extract(${sessionsSchema.payload}, '$.date') >= ${toLocalDateJSON(action.payload.from)} AND json_extract(${sessionsSchema.payload}, '$.date') <= ${toLocalDateJSON(action.payload.to)}`,
          );
        dispatch(
          setHistoryRangeSessions({
            rangeKey,
            sessions: rows.map((row) => Session.fromJSON(row.payload)),
          }),
        );
      });
    },
  );

  // Keep an already-open History view coherent without re-querying SQLite.
  addEffect(addStoredSession, (action, { dispatch }) => {
    dispatch(applyHistorySessionChanges([action.payload]));
  });
  addEffect(upsertStoredSessions, (action, { dispatch }) => {
    dispatch(applyHistorySessionChanges(action.payload));
  });
  addEffect(deleteStoredSession, (action, { dispatch }) => {
    dispatch(removeHistorySession(action.payload));
  });
}
