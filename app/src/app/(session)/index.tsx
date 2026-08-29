import CardActions from '@/components/presentation/foundation/card-actions';
import ConfirmationDialog from '@/components/presentation/foundation/confirmation-dialog';
import FullHeightScrollView from '@/components/layout/full-height-scroll-view';
import IconButton from '@/components/presentation/foundation/gesture-wrappers/icon-button';
import Icon from '@/components/presentation/foundation/gesture-wrappers/icon';
import { GainsLabWordmark } from '@/components/presentation/foundation/gainslab-brand';
import { Loader } from '@/components/presentation/foundation/loader';
import {
  ScreenHeading,
  SectionHeading,
} from '@/components/presentation/foundation/screen-heading';
import { Remote } from '@/components/presentation/foundation/remote';
import { spacing, useAppTheme } from '@/hooks/useAppTheme';
import { Session } from '@/models/session-models';
import {
  useAppSelector,
  useAppSelectorWhenFocusedWithArg,
} from '@/store';
import {
  selectCurrentSession,
  setCurrentSession,
} from '@/store/current-session';
import { publishUnpublishedSessions } from '@/store/feed';
import { fetchUpcomingSessions, selectActiveProgram } from '@/store/program';
import { executeRemoteBackup } from '@/store/settings';
import { LocalDate } from '@js-joda/core';
import { useTranslate } from '@tolgee/react';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { ImpactFeedbackStyle, impactAsync } from 'expo-haptics';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';
import Button from '@/components/presentation/foundation/gesture-wrappers/button';
import { useDispatch } from 'react-redux';
import { MigrateToWeightUnitsWizard } from '@/components/smart/migrate-to-weight-units';
import { WelcomeWizard } from '@/components/smart/welcome-wizard';
import { SessionDiffSaveDialog } from '@/components/smart/session-diff-save-dialog';
import { CurrentWorkoutReplacer } from '@/components/smart/current-workout-replacer';

const HOME_MAINTENANCE_DELAY_MS = 450;

function PlanSummary() {
  const { push } = useRouter();
  const { colors } = useAppTheme();
  const { t } = useTranslate();
  const plan = useAppSelector(selectActiveProgram);

  return (
    <Card
      mode="contained"
      onPress={() => push('/settings/program-list', { withAnchor: true })}
      style={[styles.planSummary, { backgroundColor: colors.surfaceContainer }]}
    >
      <Card.Content style={styles.planSummaryContent}>
        <View style={{ flex: 1 }}>
          <Text variant="labelMedium" style={{ color: colors.onSurfaceVariant }}>
            {t('home.plan.section')}
          </Text>
          <Text variant="titleMedium" numberOfLines={1} style={styles.strong}>
            {plan.name}
          </Text>
        </View>
        <Icon source="chevronRight" size={26} color={colors.primary} />
      </Card.Content>
    </Card>
  );
}

function ListUpcomingWorkouts({
  upcoming,
  selectSession,
  createFreeformSession,
}: {
  upcoming: readonly Session[];
  selectSession: (s: Session) => void;
  createFreeformSession: () => void;
}) {
  const { t } = useTranslate();
  const currentSession = useAppSelectorWhenFocusedWithArg(
    selectCurrentSession,
    'workoutSession',
  );
  const dispatch = useDispatch();
  const [confirmDeleteSessionOpen, setConfirmDeleteSessionOpen] =
    useState(false);

  const clearCurrentSession = () => {
    dispatch(
      setCurrentSession({ session: undefined, target: 'workoutSession' }),
    );
    dispatch(fetchUpcomingSessions());
  };

  return (
    <View style={styles.screen}>
      <SessionDiffSaveDialog />
      <WelcomeWizard />
      <GainsLabWordmark compact />
      <ScreenHeading title={t('home.title')} subtitle={t('home.subtitle')} />
      <PlanSummary />

      {currentSession && (
        <>
          <SectionHeading
            title={t('workout.current.title')}
            detail={currentSession.blueprint.name}
          />
          <WorkoutCard
            session={currentSession}
            actionLabel={t('workout.resume.button')}
            testID="resume-workout-button"
            highlighted
            onAction={() => selectSession(currentSession)}
            onDelete={() => setConfirmDeleteSessionOpen(true)}
          />
        </>
      )}

      {!!upcoming.length && (
        <SectionHeading
          title={t('home.up_next')}
          detail={t('home.up_next_hint')}
        />
      )}
      <View style={styles.workoutList}>
        {upcoming.map((session) => (
          <WorkoutCard
            key={session.id}
            session={session}
            actionLabel={
              session.isStarted
                ? t('workout.resume.button')
                : t('workout.start.button')
            }
            testID="start-resume-workout-button"
            onAction={() => selectSession(session)}
          />
        ))}
      </View>

      <Button
        mode="outlined"
        icon="fitnessCenter"
        style={styles.freeformButton}
        contentStyle={{ minHeight: 48 }}
        onPress={createFreeformSession}
      >
        {t('workout.freeform.title')}
      </Button>

      {confirmDeleteSessionOpen ? (
        <ConfirmationDialog
          headline={t('workout.clear_current.confirm.title')}
          textContent={t('workout.clear_current.confirm.body')}
          okText={t('generic.clear.button')}
          onOk={() => {
            clearCurrentSession();
            setConfirmDeleteSessionOpen(false);
          }}
          open
          onCancel={() => setConfirmDeleteSessionOpen(false)}
        />
      ) : null}
    </View>
  );
}

function WorkoutCard({
  session,
  actionLabel,
  testID,
  onAction,
  onDelete,
  highlighted = false,
}: {
  session: Session;
  actionLabel: string;
  testID: string;
  onAction: () => void;
  onDelete?: () => void;
  highlighted?: boolean;
}) {
  const { colors } = useAppTheme();
  const { t } = useTranslate();
  const visibleExercises = session.recordedExercises.slice(0, 4);
  const hiddenCount = session.recordedExercises.length - visibleExercises.length;

  return (
    <Card
      mode="contained"
      style={[
        styles.workoutCard,
        {
          backgroundColor: highlighted
            ? colors.surfaceContainerHigh
            : colors.surfaceContainer,
        },
      ]}
    >
      <Card.Content>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text variant="headlineSmall" style={styles.strong}>
              {session.blueprint.name}
            </Text>
            <Text
              variant="bodySmall"
              style={{ color: colors.onSurfaceVariant, marginTop: spacing[1] }}
            >
              {t('home.exercise_count', {
                count: session.recordedExercises.length,
              })}
            </Text>
          </View>
          {session.isStarted ? (
            <View
              style={[
                styles.statusPill,
                { backgroundColor: colors.primaryContainer },
              ]}
            >
              <View
                style={[styles.statusDot, { backgroundColor: colors.primary }]}
              />
              <Text
                variant="labelMedium"
                style={{ color: colors.onPrimaryContainer, fontWeight: '700' }}
              >
                {t('generic.active.label')}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.exercisePreview}>
          {visibleExercises.map((exercise, index) => (
            <View
              key={`${exercise.blueprint.name}-${index}`}
              style={styles.exerciseRow}
            >
              <Text
                variant="labelMedium"
                style={[styles.exerciseNumber, { color: colors.primary }]}
              >
                {(index + 1).toString().padStart(2, '0')}
              </Text>
              <Text variant="bodyMedium" numberOfLines={1} style={{ flex: 1 }}>
                {exercise.blueprint.name}
              </Text>
              {exercise.type === 'RecordedWeightedExercise' ? (
                <Text
                  variant="labelMedium"
                  style={{ color: colors.onSurfaceVariant }}
                >
                  {exercise.potentialSets.length} × {exercise.blueprint.repsPerSet}
                </Text>
              ) : null}
            </View>
          ))}
          {hiddenCount > 0 ? (
            <Text
              variant="labelMedium"
              style={{ color: colors.onSurfaceVariant, marginTop: spacing[1] }}
            >
              {t('home.more_exercises', { count: hiddenCount })}
            </Text>
          ) : null}
        </View>
      </Card.Content>

      <CardActions style={styles.workoutActions}>
        {onDelete ? (
          <IconButton
            testID="clear-current-workout"
            icon="delete"
            accessibilityLabel={t('workout.clear_current.confirm.title')}
            onPress={onDelete}
          />
        ) : null}
        <Button
          mode="contained"
          icon="playArrow"
          testID={testID}
          contentStyle={{ minHeight: 48 }}
          style={{ flex: 1 }}
          onPress={() => {
            void impactAsync(ImpactFeedbackStyle.Light);
            onAction();
          }}
        >
          {actionLabel}
        </Button>
      </CardActions>
    </Card>
  );
}

function HomeLoadingState() {
  const { colors } = useAppTheme();
  const { t } = useTranslate();

  return (
    <View style={styles.screen}>
      <GainsLabWordmark compact />
      <ScreenHeading title={t('home.title')} subtitle={t('home.subtitle')} />
      <Card
        mode="contained"
        style={[
          styles.loadingCard,
          { backgroundColor: colors.surfaceContainer },
        ]}
      >
        <Card.Content style={styles.loadingCardContent}>
          <Loader loadingText={t('startup.finalizing')} />
        </Card.Content>
      </Card>
    </View>
  );
}

export default function Index() {
  const upcomingSessions = useAppSelector((s) => s.program.upcomingSessions);
  const dispatch = useDispatch();
  const currentBodyweight = upcomingSessions
    .map((x) => x.at(0)?.bodyweight)
    .unwrapOr(undefined);
  const [selectedSession, setSelectedSession] = useState<Session | undefined>();

  useFocusEffect(
    useCallback(() => {
      // Refresh the UI-critical data immediately. Network backup/publishing can
      // wait until after the tab transition and first paint.
      dispatch(fetchUpcomingSessions());
      const maintenanceTimer = setTimeout(() => {
        dispatch(publishUnpublishedSessions());
        dispatch(executeRemoteBackup({}));
      }, HOME_MAINTENANCE_DELAY_MS);

      return () => clearTimeout(maintenanceTimer);
    }, [dispatch]),
  );

  const createFreeformSession = () => {
    const newSession = Session.freeformSession(
      LocalDate.now(),
      currentBodyweight,
    );
    setSelectedSession(newSession);
  };

  return (
    <FullHeightScrollView
      scrollStyle={{ paddingHorizontal: spacing.pageHorizontalMargin }}
      contentContainerStyle={{ paddingBottom: spacing[8] }}
    >
      <Stack.Screen
        options={{
          title: 'GainsLab',
          headerShown: false,
        }}
      />
      <MigrateToWeightUnitsWizard />
      <Remote
        value={upcomingSessions}
        loading={() => <HomeLoadingState />}
        success={(upcoming) => (
          <ListUpcomingWorkouts
            selectSession={setSelectedSession}
            upcoming={upcoming}
            createFreeformSession={createFreeformSession}
          />
        )}
      />
      <CurrentWorkoutReplacer
        session={selectedSession}
        clearSession={() => setSelectedSession(undefined)}
      />
    </FullHeightScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    gap: spacing[3],
    paddingTop: spacing[4],
  },
  strong: {
    fontWeight: '800',
    letterSpacing: -0.35,
  },
  planSummary: {
    borderRadius: 18,
    marginBottom: spacing[1],
  },
  planSummaryContent: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  workoutList: {
    gap: spacing[3],
  },
  workoutCard: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    borderRadius: 999,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 99,
  },
  exercisePreview: {
    gap: spacing[2],
    marginTop: spacing[4],
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: 28,
  },
  exerciseNumber: {
    width: 22,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  workoutActions: {
    gap: spacing[1],
    paddingHorizontal: spacing[3],
    paddingBottom: spacing[3],
  },
  freeformButton: {
    marginTop: spacing[1],
    marginBottom: spacing[3],
  },
  loadingCard: {
    minHeight: 180,
    borderRadius: 22,
  },
  loadingCardContent: {
    minHeight: 180,
    justifyContent: 'center',
  },
});
