import {
  copyLogs,
  initializeAppStateSlice,
  setCurrentSnackbar,
  setInitializationError,
  setIsHydrated,
  shareString,
  showSnackbar,
} from '@/store/app';
import { AddEffectFn } from '@/store/store';
import { sleep } from '@/utils/sleep';
import { initializeSettingsStateSlice } from '../settings';
import { initializeProgramStateSlice } from '../program';
import { initializeAiPlannerStateSlice } from '../ai-planner';
import { setStringAsync } from 'expo-clipboard';

const startupMigrationTimeoutMs = 30_000;

export function applyAppEffects(addEffect: AddEffectFn) {
  addEffect(
    initializeAppStateSlice,
    async (
      _,
      {
        cancelActiveListeners,
        dispatch,
        extra: { databaseMigrationService },
        onFail,
      },
    ) => {
      cancelActiveListeners();
      dispatch(setIsHydrated(false));
      dispatch(setInitializationError(undefined));

      // The listener middleware intentionally catches effect errors. Register a
      // failure handler so a migration error cannot leave app.isHydrated=false
      // forever with an infinite startup spinner.
      onFail(() => {
        dispatch(
          setInitializationError(
            'GainsLab could not finish preparing your training data.',
          ),
        );
      });

      await withTimeout(
        databaseMigrationService.migrate(),
        startupMigrationTimeoutMs,
        'Database preparation timed out',
      );

      dispatch(initializeSettingsStateSlice());
      dispatch(initializeProgramStateSlice());
      dispatch(initializeAiPlannerStateSlice());

      // Feed is an advanced/hidden destination in GainsLab. Its hydration can
      // read several tables, generate cryptographic keys and touch the network.
      // It is initialized by the Feed route (or identity-on-demand for sharing)
      // instead of competing with the critical startup path.
      dispatch(setIsHydrated(true));
    },
  );

  addEffect(showSnackbar, async (action, { dispatch, getState }) => {
    dispatch(setCurrentSnackbar(action.payload));
    await sleep(action.payload.duration ?? 5000);
    if (getState().app.currentSnackbar === action.payload) {
      dispatch(setCurrentSnackbar(undefined));
    }
  });

  addEffect(shareString, async (action, { extra: { stringSharer } }) => {
    await stringSharer.share(action.payload.value, action.payload.title);
  });

  addEffect(copyLogs, async (_, { extra: { logger } }) => {
    const logs = logger.getLogsAsString();
    await setStringAsync(logs);
  });
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}
