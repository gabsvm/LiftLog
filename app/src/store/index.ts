// eslint-disable-next-line no-restricted-imports
import { useSelector as untypedUseSelector } from 'react-redux';

import { type RootState, createStore } from '@/store/store';
import { applyProgramEffects } from '@/store/program/effects';
import { applyCurrentSessionEffects } from '@/store/current-session/effects';
import { applyAppEffects } from '@/store/app/effects';
import { initializeAppStateSlice } from '@/store/app';
import { useCallback, useMemo, useRef } from 'react';
import { applySettingsEffects } from '@/store/settings/effects';
import { applyStoredSessionsEffects } from '@/store/stored-sessions/effects';
import { applyHistoryViewEffects } from '@/store/history-view/effects';
import { applyFeedEffects } from '@/store/feed/effects';
import { applyStatsEffects } from '@/store/stats/effects';
import { applyAiPlannerEffects } from '@/store/ai-planner/effects';
import { clearAllListeners } from '@reduxjs/toolkit';
import { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { useIsFocused } from 'expo-router';
import { SQLiteDatabase } from 'expo-sqlite';

export { RootState };

export function resolveStore(db: ExpoSQLiteDatabase, expoDb: SQLiteDatabase) {
  const { store, addEffect } = createStore(db, expoDb);
  store.dispatch(clearAllListeners());
  applyProgramEffects(addEffect);
  applyCurrentSessionEffects(addEffect);
  applyAppEffects(addEffect);
  applySettingsEffects(addEffect);
  applyStoredSessionsEffects(addEffect);
  applyHistoryViewEffects(addEffect);
  applyFeedEffects(addEffect);
  applyStatsEffects(addEffect);
  applyAiPlannerEffects(addEffect);

  store.dispatch(initializeAppStateSlice());
  return store;
}

export const useAppSelector = untypedUseSelector.withTypes<RootState>();

export function useAppSelectorWithArg<TArg, TRes>(
  selector: (s: RootState, arg: TArg) => TRes,
  arg: TArg,
) {
  const memod = useMemo(
    () => (s: RootState) => selector(s, arg),
    [selector, arg],
  );
  return useAppSelector(memod);
}

/**
 * Keep off-screen routes subscribed without letting their expensive selectors
 * recalculate or trigger renders. The previous implementation still executed
 * the selector on every store update and then mirrored it through local state.
 */
function useAppSelectorWhenFocused<TRes>(
  selector: (s: RootState) => TRes,
): TRes {
  const isFocused = useIsFocused();
  const cachedValue = useRef<TRes | undefined>(undefined);
  const hasCachedValue = useRef(false);

  const focusAwareSelector = useCallback(
    (state: RootState) => {
      if (!isFocused && hasCachedValue.current) {
        return cachedValue.current as TRes;
      }

      const nextValue = selector(state);
      cachedValue.current = nextValue;
      hasCachedValue.current = true;
      return nextValue;
    },
    [isFocused, selector],
  );

  return useAppSelector(focusAwareSelector);
}

export function useAppSelectorWhenFocusedWithArg<TArg, TRes>(
  selector: (s: RootState, arg: TArg) => TRes,
  arg: TArg,
): TRes {
  const memod = useMemo(
    () => (s: RootState) => selector(s, arg),
    [selector, arg],
  );
  return useAppSelectorWhenFocused(memod);
}