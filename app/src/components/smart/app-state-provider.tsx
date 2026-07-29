import { Loader } from '@/components/presentation/foundation/loader';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useAppSelector } from '@/store';
import { setIsHydrated as setCurrentSessionHydrated } from '@/store/current-session';
import { setIsHydrated as setSettingsHydrated } from '@/store/settings';
import { setIsHydrated as setProgramHydrated } from '@/store/program';
import { setIsHydrated as setStoredSessionsHydrated } from '@/store/stored-sessions';
import { setIsHydrated as setAiPlannerHydrated } from '@/store/ai-planner';
import { ReactNode, useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { useDispatch } from 'react-redux';

export function AppStateProvider({ children }: { children: ReactNode }) {
  const dispatch = useDispatch();
  const waitingOn = useAppSelector(
    (s) =>
      getLoadMessage(s.app, 'app settings') ||
      getLoadMessage(s.currentSession, 'current session') ||
      getLoadMessage(s.program, 'program') ||
      getLoadMessage(s.settings, 'settings') ||
      getLoadMessage(s.storedSessions, 'stored sessions') ||
      getLoadMessage(s.aiPlanner, 'ai planner'),
  );
  useEffect(() => {
    if (!waitingOn) return;
    const timeout = setTimeout(() => {
      dispatch(setCurrentSessionHydrated(true));
      dispatch(setSettingsHydrated(true));
      dispatch(setProgramHydrated(true));
      dispatch(setStoredSessionsHydrated(true));
      dispatch(setAiPlannerHydrated(true));
    }, 4_000);
    return () => clearTimeout(timeout);
  }, [dispatch, waitingOn]);
  const { colors } = useAppTheme();
  const isWaiting = !!waitingOn;
  const anim = useRef(new Animated.Value(1)).current;

  if (isWaiting) {
    return (
      <Animated.View
        style={{
          flex: 1,
          backgroundColor: colors.surface,
          alignItems: 'center',
          opacity: anim,
        }}
      >
        <Loader loadingText={waitingOn ?? ''} />
      </Animated.View>
    );
  }

  return children;
}

function getLoadMessage(state: { isHydrated: boolean }, type: string) {
  if (state.isHydrated) return undefined;
  return 'Loading ' + type;
}
