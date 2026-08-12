import { useAppTheme } from '@/hooks/useAppTheme';
import { useAppSelector } from '@/store';
import { setIsHydrated as setCurrentSessionHydrated } from '@/store/current-session';
import { setIsHydrated as setSettingsHydrated } from '@/store/settings';
import { setIsHydrated as setProgramHydrated } from '@/store/program';
import { setIsHydrated as setStoredSessionsHydrated } from '@/store/stored-sessions';
import { setIsHydrated as setAiPlannerHydrated } from '@/store/ai-planner';
import { T } from '@tolgee/react';
import { ReactNode, useEffect } from 'react';
import { ActivityIndicator, Image, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch } from 'react-redux';
import * as SplashScreen from 'expo-splash-screen';

export function AppStateProvider({ children }: { children: ReactNode }) {
  const dispatch = useDispatch();
  const isWaiting = useAppSelector(
    (state) =>
      !state.app.isHydrated ||
      !state.currentSession.isHydrated ||
      !state.program.isHydrated ||
      !state.settings.isHydrated ||
      !state.storedSessions.isHydrated ||
      !state.aiPlanner.isHydrated,
  );
  useEffect(() => {
    if (!isWaiting) return;
    const timeout = setTimeout(() => {
      dispatch(setCurrentSessionHydrated(true));
      dispatch(setSettingsHydrated(true));
      dispatch(setProgramHydrated(true));
      dispatch(setStoredSessionsHydrated(true));
      dispatch(setAiPlannerHydrated(true));
    }, 8_000);
    return () => clearTimeout(timeout);
  }, [dispatch, isWaiting]);

  useEffect(() => {
    let secondFrame: number | undefined;
    const hideNativeSplash = () => {
      void SplashScreen.hideAsync();
    };

    if (isWaiting) {
      const timeout = setTimeout(hideNativeSplash, 1_500);
      return () => clearTimeout(timeout);
    }

    // The state is ready. Wait for the navigation tree to commit and paint
    // before revealing it, avoiding a blank frame between splash and tabs.
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(hideNativeSplash);
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame !== undefined) cancelAnimationFrame(secondFrame);
    };
  }, [isWaiting]);

  if (isWaiting) {
    return <GainsLabStartup />;
  }

  return children;
}

function GainsLabStartup() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
        backgroundColor: colors.surface,
      }}
    >
      <Image
        // Metro resolves static image requires to a native asset reference.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        source={require('../../../assets/gainslab-splash.png')}
        resizeMode="contain"
        style={{
          position: 'absolute',
          top: '50%',
          width: 136,
          height: 136,
          marginTop: -68,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: '50%',
          alignItems: 'center',
          gap: 16,
          marginTop: 94,
        }}
      >
        <View style={{ alignItems: 'center', gap: 2 }}>
          <Text
            variant="headlineSmall"
            style={{
              color: colors.onSurface,
              fontWeight: '800',
              letterSpacing: -0.5,
            }}
          >
            Gains<Text style={{ color: colors.primary }}>Lab</Text>
          </Text>
          <Text
            variant="labelSmall"
            style={{
              color: colors.primary,
              fontWeight: '800',
              letterSpacing: 1.2,
            }}
          >
            <T keyName="gainslab.tagline" />
          </Text>
        </View>
        <View style={{ alignItems: 'center', gap: 10 }}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text
            variant="labelLarge"
            style={{ color: colors.onSurfaceVariant, textAlign: 'center' }}
          >
            <T keyName="startup.preparing" />
          </Text>
        </View>
      </View>
    </View>
  );
}
