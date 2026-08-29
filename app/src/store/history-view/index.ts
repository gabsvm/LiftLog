import { Session } from '@/models/session-models';
import { LocalDate, YearMonth } from '@js-joda/core';
import { createAction, createSlice, PayloadAction } from '@reduxjs/toolkit';

interface HistoryViewState {
  requestedRangeKey?: string;
  loadedRangeKey?: string;
  from?: string;
  to?: string;
  isLoading: boolean;
  sessions: Session[];
}

const initialState: HistoryViewState = {
  isLoading: false,
  sessions: [],
};

export interface HistoryRange {
  from: LocalDate;
  to: LocalDate;
}

export const requestHistoryRange = createAction<HistoryRange>(
  'historyView/requestHistoryRange',
);

const historyViewSlice = createSlice({
  name: 'historyView',
  initialState,
  reducers: {
    beginHistoryRangeLoad(
      state,
      action: PayloadAction<{ rangeKey: string; from: string; to: string }>,
    ) {
      state.requestedRangeKey = action.payload.rangeKey;
      state.from = action.payload.from;
      state.to = action.payload.to;
      state.isLoading = true;
    },
    setHistoryRangeSessions(
      state,
      action: PayloadAction<{ rangeKey: string; sessions: Session[] }>,
    ) {
      // Ignore a slow query for a month the user has already navigated away from.
      if (state.requestedRangeKey !== action.payload.rangeKey) return;
      state.sessions = action.payload.sessions;
      state.loadedRangeKey = action.payload.rangeKey;
      state.isLoading = false;
    },
    applyHistorySessionChanges(state, action: PayloadAction<Session[]>) {
      if (!state.from || !state.to) return;
      const byId = new Map(state.sessions.map((session) => [session.id, session]));
      for (const session of action.payload) {
        byId.delete(session.id);
        const date = session.date.toString();
        if (date >= state.from && date <= state.to) {
          byId.set(session.id, session);
        }
      }
      state.sessions = [...byId.values()];
    },
    removeHistorySession(state, action: PayloadAction<string>) {
      state.sessions = state.sessions.filter(
        (session) => session.id !== action.payload,
      );
    },
  },
  selectors: {
    selectHistoryViewSessions: (state) => state.sessions,
    selectHistoryViewLoading: (state) => state.isLoading,
  },
});

export const {
  beginHistoryRangeLoad,
  setHistoryRangeSessions,
  applyHistorySessionChanges,
  removeHistorySession,
} = historyViewSlice.actions;

export const { selectHistoryViewSessions, selectHistoryViewLoading } =
  historyViewSlice.selectors;

export const historyViewReducer = historyViewSlice.reducer;

export function historyRangeKey(range: HistoryRange): string {
  return `${range.from.toString()}:${range.to.toString()}`;
}

export function getHistoryCalendarRange(month: YearMonth): HistoryRange {
  // Calendar spillover is never more than six days on either side. Seven gives
  // a small safety margin while keeping the query tiny even after years of use.
  return {
    from: month.atDay(1).minusDays(7),
    to: month.atEndOfMonth().plusDays(7),
  };
}
