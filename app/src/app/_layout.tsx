import { AppThemeProvider } from '@/hooks/useAppTheme';
import { I18nManager, LogBox, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppStateProvider } from '@/components/smart/app-state-provider';
import SnackbarProvider from '@/components/smart/snackbar-provider';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import '@/utils/date-locale';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import ServicesProvider from '@/components/smart/services-provider';
import { PreventNavigateProvider } from '@/hooks/usePreventNavigate';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslate } from '@tolgee/react';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import {
  TabBarVisibilityProvider,
  useTabBarHidden,
} from '@/hooks/useTabBarVisibility';

void SplashScreen.preventAutoHideAsync().catch((error: unknown) => {
  console.warn('Could not keep the native splash screen visible.', error);
});

LogBox.ignoreLogs([
  /.*is not a valid icon name.*/,
  /Open debugger to view warnings./,
  /.*useInsertionEffect.*/,
  /.*Failed to fetch inbox.*/,
  /.*Failed to create user*/,
  /.*Failed to update profile*/,
  /.*NO_APPLICABLE_SUB_RESPONSE_CODE.*/, // Revenuecat on emulator without billing
]);

if (Platform.OS !== 'web') {
  I18nManager.swapLeftAndRightInRTL?.(true);
}

export default function RootLayout() {
  useEffect(() => {
    // If native service creation fails before AppStateProvider mounts, never
    // leave the user trapped behind the operating-system splash indefinitely.
    const fallback = setTimeout(() => {
      void SplashScreen.hideAsync();
    }, 3_500);
    return () => clearTimeout(fallback);
  }, []);

  return (
    <GestureHandlerRootView>
      <PreventNavigateProvider>
        <KeyboardProvider>
          <SafeAreaProvider>
            <ServicesProvider>
              <AppThemeProvider>
                <AppStateProvider>
                  <SnackbarProvider>
                    {Platform.OS === 'android' && <StatusBar style="auto" />}
                    <Layout />
                  </SnackbarProvider>
                </AppStateProvider>
              </AppThemeProvider>
            </ServicesProvider>
          </SafeAreaProvider>
        </KeyboardProvider>
      </PreventNavigateProvider>
    </GestureHandlerRootView>
  );
}

function Layout() {
  return (
    <TabBarVisibilityProvider>
      <NativeTabLayout />
    </TabBarVisibilityProvider>
  );
}

function NativeTabLayout() {
  const { t } = useTranslate();
  const { colors } = useAppTheme();
  const tabBarHidden = useTabBarHidden();

  return (
    <NativeTabs
      hidden={tabBarHidden}
      indicatorColor={colors.primaryContainer}
      rippleColor={colors.primary}
      backgroundColor={colors.surfaceContainerLow}
      labelVisibilityMode="labeled"
      iconColor={colors.onSurfaceVariant}
    >
      <NativeTabs.Trigger name="(session)">
        <NativeTabs.Trigger.Label>
          {t('navigation.training')}
        </NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'dumbbell', selected: 'dumbbell.fill' }}
          md={{ default: 'fitness_center', selected: 'fitness_center' }}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="feed" hidden>
        <NativeTabs.Trigger.Icon
          sf={{
            default: 'bubble.left.and.bubble.right',
            selected: 'bubble.left.and.bubble.right.fill',
          }}
          md={{ default: 'forum', selected: 'forum' }}
        />
        <NativeTabs.Trigger.Label>
          {t('feed.feed.title')}
        </NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="stats">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'chart.bar', selected: 'chart.bar.fill' }}
          md={{ default: 'bar_chart', selected: 'bar_chart' }}
        />
        <NativeTabs.Trigger.Label>
          {t('navigation.progress')}
        </NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="history">
        <NativeTabs.Trigger.Icon
          sf="calendar"
          md={{ default: 'calendar_month', selected: 'calendar_month' }}
        />
        <NativeTabs.Trigger.Label>
          {t('generic.history.title')}
        </NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'ellipsis.circle', selected: 'ellipsis.circle.fill' }}
          md={{ default: 'more_horiz', selected: 'more_horiz' }}
        />
        <NativeTabs.Trigger.Label>
          {t('navigation.more')}
        </NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
