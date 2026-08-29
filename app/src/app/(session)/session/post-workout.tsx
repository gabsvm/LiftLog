import FullHeightScrollView from '@/components/layout/full-height-scroll-view';
import FloatingBottomContainer from '@/components/presentation/foundation/floating-bottom-container';
import WeightFormat from '@/components/presentation/foundation/weight-format';
import { gainsLabRadii } from '@/components/presentation/foundation/gainslab-ui';
import Icon from '@/components/presentation/foundation/gesture-wrappers/icon';
import { SessionComparisonTable } from '@/components/presentation/workout/session-comparison-table';
import { spacing, useAppTheme } from '@/hooks/useAppTheme';
import { useHideTabBarWhileFocused } from '@/hooks/useTabBarVisibility';
import { useAppSelectorWithArg } from '@/store';
import {
  finishCurrentWorkout,
  selectCurrentSession,
} from '@/store/current-session';
import {
  selectPreviousComparableSession,
  selectSession,
} from '@/store/stored-sessions';
import { formatDuration } from '@/utils/format-date';
import { useTranslate } from '@tolgee/react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { FAB, Text } from 'react-native-paper';
import { useDispatch } from 'react-redux';

export default function PostWorkoutPage() {
  useHideTabBarWhileFocused();
  const { sessionId, source } = useLocalSearchParams<{
    sessionId?: string;
    source?: 'finished' | 'live' | 'history';
  }>();
  const storedSession = useAppSelectorWithArg(selectSession, sessionId ?? '');
  const currentWorkoutSession = useAppSelectorWithArg(
    selectCurrentSession,
    'workoutSession',
  );
  const session =
    storedSession ??
    (currentWorkoutSession?.id === sessionId
      ? currentWorkoutSession
      : undefined);
  const openedAfterFinishingWorkout = source === 'finished';
  const showFinishButton = openedAfterFinishingWorkout;
  const showBackButton = !openedAfterFinishingWorkout;
  const previousComparableSession = useAppSelectorWithArg(
    selectPreviousComparableSession,
    session,
  );
  const { dismissTo } = useRouter();
  const dispatch = useDispatch();
  const { t } = useTranslate();
  const { colors } = useAppTheme();

  useEffect(() => {
    if (!sessionId || !session) {
      dismissTo('/session');
    }
  }, [dismissTo, session, sessionId]);

  if (!sessionId || !session) {
    return null;
  }

  const floatingBottomContainer = showFinishButton ? (
    <FloatingBottomContainer
      fab={
        <FAB
          onPress={() => {
            dispatch(finishCurrentWorkout('workoutSession'));
            dismissTo('/');
          }}
          icon={'check'}
          label={t('generic.finish.button')}
        />
      }
    />
  ) : undefined;
  const durationText = session.duration
    ? formatDuration(session.duration, 'hours-mins')
    : '-';

  return (
    <FullHeightScrollView
      floatingChildren={floatingBottomContainer}
      scrollStyle={{ paddingHorizontal: spacing.pageHorizontalMargin }}
      contentContainerStyle={{ paddingBottom: spacing[8] }}
    >
      <Stack.Screen
        options={{
          presentation: 'modal',
          title: t('workout.post_workout.title'),
          gestureEnabled: showBackButton,
          headerBackVisible: showBackButton,
          headerLeft: showFinishButton ? () => null : undefined!,
        }}
      />

      <View style={{ paddingTop: spacing[5], paddingBottom: spacing[6] }}>
        {openedAfterFinishingWorkout ? (
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: gainsLabRadii.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.primary,
              marginBottom: spacing[4],
            }}
          >
            <Icon source="check" size={24} color={colors.onPrimary} />
          </View>
        ) : null}
        <Text
          variant="labelMedium"
          style={{
            color: colors.primary,
            fontWeight: '800',
            letterSpacing: 1.2,
            textTransform: 'uppercase',
          }}
        >
          {t('workout.post_workout.title')}
        </Text>
        <Text
          variant="headlineLarge"
          style={{
            marginTop: spacing[1],
            fontWeight: '800',
            letterSpacing: -1,
          }}
        >
          {session.blueprint.name}
        </Text>

        <View
          style={{
            flexDirection: 'row',
            marginTop: spacing[6],
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: colors.outlineVariant,
          }}
        >
          <View
            style={{
              flex: 1,
              paddingVertical: spacing[4],
              paddingRight: spacing[4],
            }}
          >
            <Text
              variant="headlineSmall"
              style={{
                color: colors.onSurface,
                fontWeight: '800',
                fontVariant: ['tabular-nums'],
              }}
            >
              {durationText}
            </Text>
            <Text
              variant="labelSmall"
              style={{
                marginTop: spacing[1],
                color: colors.onSurfaceVariant,
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: 0.8,
              }}
            >
              {t('workout.total_time.label')}
            </Text>
          </View>
          <View
            style={{
              width: 1,
              backgroundColor: colors.outlineVariant,
            }}
          />
          <View
            style={{
              flex: 1,
              paddingVertical: spacing[4],
              paddingLeft: spacing[4],
            }}
          >
            <WeightFormat
              weight={session.totalWeightLifted}
              decimalPlaces={0}
              fontSize="text-2xl"
              fontWeight="800"
            />
            <Text
              variant="labelSmall"
              style={{
                marginTop: spacing[1],
                color: colors.onSurfaceVariant,
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: 0.8,
              }}
            >
              {t('stats.exercise.total_lifted.label')}
            </Text>
          </View>
        </View>
      </View>

      <View
        style={{
          borderRadius: gainsLabRadii.card,
          overflow: 'hidden',
          backgroundColor: colors.surfaceContainer,
        }}
      >
        <SessionComparisonTable
          mode="full"
          previousSession={previousComparableSession}
          session={session}
        />
      </View>
    </FullHeightScrollView>
  );
}
