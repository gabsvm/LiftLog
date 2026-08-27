import {
  createAction,
  createSlice,
  PayloadAction,
  UnknownAction,
} from '@reduxjs/toolkit';

const initialState: AppState = {
  isHydrated: false,
  initializationError: undefined,
  currentSnackbar: undefined,
};

type AppState = {
  isHydrated: boolean;
  initializationError: string | undefined;
  currentSnackbar: SnackbarDescriptor | undefined;
};

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setIsHydrated(state, action: PayloadAction<boolean>) {
      state.isHydrated = action.payload;
    },

    setInitializationError(state, action: PayloadAction<string | undefined>) {
      state.initializationError = action.payload;
    },

    setCurrentSnackbar(
      state,
      action: PayloadAction<SnackbarDescriptor | undefined>,
    ) {
      state.currentSnackbar = action.payload;
    },
  },
});

export const initializeAppStateSlice = createAction('initializeAppStateSlice');

export const shareString = createAction<{ title: string; value: string }>(
  'shareString',
);
export const copyLogs = createAction('copyLogs');

export type SnackbarDescriptor =
  | {
      text: string;
      action?: undefined;
      dispatchAction?: undefined;
    }
  | {
      text: string;
      action: string;
      dispatchAction: UnknownAction | UnknownAction[];
    };
export const showSnackbar = createAction<
  SnackbarDescriptor & { duration?: number }
>('snackBarWithAction');

export const {
  setIsHydrated,
  setInitializationError,
  setCurrentSnackbar,
} = appSlice.actions;

export default appSlice.reducer;
