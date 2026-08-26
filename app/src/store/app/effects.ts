import {
  copyLogs,
  initializeAppStateSlice,
  setCurrentSnackbar,
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

export function applyAppEffects(addEffect: AddEffectFn) {
  addEffect(
    initializeAppStateSlice,
    async (
      _,
      { cancelActiveListeners, dispatch, extra: { databaseMigrationService } },
    ) => {
      cancelActiveListeners();
      await databaseMigrationService.migrate();
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
