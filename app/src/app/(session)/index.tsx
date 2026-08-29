import CardActions from '@/components/presentation/foundation/card-actions';
import ConfirmationDialog from '@/components/presentation/foundation/confirmation-dialog';
import FullHeightScrollView from '@/components/layout/full-height-scroll-view';
import Icon from '@/components/presentation/foundation/gesture-wrappers/icon';
import IconButton from '@/components/presentation/foundation/gesture-wrappers/icon-button';
import { GainsLabWordmark } from '@/components/presentation/foundation/gainslab-brand';
import {
  gainsLabRadii,
  gainsLabTouchTarget,
} from '@/components/presentation/foundation/gainslab-ui';
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
import { Card, Menu, Text } from 'react-native-paper';
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
    <View style={styles.planBlock}>
      <SectionHeading title={t('home.plan.section')} />
      <Card
        mode="contained"
        onPress={() => push('/settings/program-list', { withAnchor: true })}
        style={[
          styles.planSummary,
          { backgroundColor: colors.surfaceContainerLow },
        ]}
      >
        <Card.Content style={styles.planSummaryContent}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="titleMedium" numberOfLines={1} style={styles.strong}>
              {plan.name}
            </Text>
            <Text
              variant="bodySmall"
              style={{ color: colors.onSurfaceVariant, marginTop: spacing[0.5] }}
            >
              {t('plan.manage.subtitle')}
            </Text>
          </View>
          <Icon source="chevronRight" size={22} color={colors.onSurfaceVariant} />
        </Card.Content>
      </Card>
    </View>
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

      {currentSession ? (
        <ActiveWorkoutCard
          session={currentSession}
          actionLabel={t('workout.resume.button')}
          testID="resume-workout-button"
          onAction={() => selectSession(currentSession)}
          onDelete={() => setConfirmDeleteSessionOpen(true)}
        />
      ) : null}

      {!!upcoming.length ? (
        <>
          <SectionHeading
            title={t('home.up_next')}
            detail={t('home.up_next_hint')}
          />
          <View style={styles.workoutList}>
            {upcoming.map((session) => (
              <UpcomingWorkoutCard
                key={session.id}
                session={session}
                onAction={() => selectSession(session)}
              />
            ))}
          </View>
        </>
      ) : null}

      <Button
        mode="outlined"
        icon="fitnessCenter"
        style={styles.freeformButton}
        contentStyle={{ minHeight: gainsLabTouchTarget.minimum }}
        onPress={createFreeformSession}
      >
        {t('workout.freeform.title')}
      </Button>

      <PlanSummary />

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

function ActiveWorkoutCard({
  session,
  actionLabel,
  testID,
  onAction,
  onDelete,
}: {
  session: Session;
  actionLabel: string;
  testID: string;
  onAction: () => void;
  onDelete: () => void;
}) {
  const { colors } = useAppTheme();
  const { t } = useTranslate();
  const [menuVisible, setMenuVisible] = useState(false);
  const { completedSets, totalSets } = getSessionSetProgress(session);
  const progress = totalSets === 0 ? 0 : completedSets / totalSets;
  const visibleExercises = session.recordedExercises.slice(0, 3);
  const hiddenCount = session.recordedExercises.length - visibleExercises.length;

  const handleResume = () => {
    void impactAsync(ImpactFeedbackStyle.Light);
    onAction();
  };

  return (
    <Card
      mode="contained"
      style={[
        styles.activeWorkoutCard,
        {
          backgroundColor: colors.surfaceContainerHigh,
          borderColor: colors.primary,
        },
      ]}
    >
      <Card.Content>
        <View style={styles.activeCardTopRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.microLabel, { color: colors.primary }]}> 
              {t('workout.current.title')}
            </Text>
            <Text
              variant="headlineSmall"
              numberOfLines={2}
              style={[styles.strong, styles.activeWorkoutTitle]}
            >
              {session.blueprint.name}
            </Text>
          </View>
          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <IconButton
                icon="moreHoriz"
                accessibilityLabel={`${t('navigation.more')}: ${session.blueprint.name}`}
                onPress={() => setMenuVisible(true)}
              />
            }
          >
            {menuVisible ? (
              <Menu.Item
                leadingIcon="delete"
                title={t('generic.clear.button')}
                onPress={() => {
                  setMenuVisible(false);
                  onDelete();
                }}
              />
            ) : null}
          </Menu>
        </View>

        <View style={styles.activeProgressHeader}>
          <Text
            variant="labelMedium"
            style={{ color: colors.onSurfaceVariant, fontVariant: ['tabular-nums'] }}
          >
            {completedSets}/{totalSets}
          </Text>
          <Text
            variant="labelMedium"
            style={{ color: colors.primary, fontWeight: '800' }}
          >
            {t('generic.active.label')}
          </Text>
        </View>
        <View
          style={[
            styles.progressTrack,
            { backgroundColor: colors.outlineVariant },
          ]}
        >
          <View
            style={[
              styles.progressFill,
              { backgroundColor: colors.primary, width: `${progress * 100}%` },
            ]}
          />
        </View>

        <View style={styles.activeExercisePreview}>
          {visibleExercises.map((exercise, index) => (
            <ExercisePreviewRow
              key={`${exercise.blueprint.name}-${index}`}
              index={index}
              name={exercise.blueprint.name}
            />
          ))}
          {hiddenCount > 0 ? (
            <Text
              variant="labelMedium"
              style={{ color: colors.onSurfaceVariant }}
            >
              {t('home.more_exercises', { count: hiddenCount })}
            </Text>
          ) : null}
        </View>
      </Card.Content>

      <CardActions style={styles.activeWorkoutActions}>
        <Button
          mode="contained"
          icon="playArrow"
          testID={testID}
          contentStyle={{ minHeight: gainsLabTouchTarget.primaryAction }}
          style={{ flex: 1 }}
          onPress={handleResume}
        >
          {actionLabel}
        </Button>
      </CardActions>
    </Card>
  );
}

function UpcomingWorkoutCard({
  session,
  onAction,
}: {
  session: Session;
  onAction: () => void;
}) {
  const { colors } = useAppTheme();
  const { t } = useTranslate();
  const visibleExercises = session.recordedExercises.slice(0, 3);
  const hiddenCount = session.recordedExercises.length - visibleExercises.length;

  const handlePress = () => {
    void impactAsync(ImpactFeedbackStyle.Light);
    onAction();
  };

  return (
    <Card
      mode="contained"
      onPress={handlePress}
      accessibilityLabel={session.blueprint.name}
      style={[
        styles.upcomingWorkoutCard,
        { backgroundColor: colors.surfaceContainer },
      ]}
    >
      <Card.Content>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="titleLarge" numberOfLines={2} style={styles.strong}>
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
          <Icon source="chevronRight" size={22} color={colors.onSurfaceVariant} />
        </View>

        <View style={styles.exercisePreview}>
          {visibleExercises.map((exercise, index) => (
            <ExercisePreviewRow
              key={`${exercise.blueprint.name}-${index}`}
              index={index}
              name={exercise.blueprint.name}
            />
          ))}
          {hiddenCount > 0 ? (
            <Text
              variant="labelMedium"
              style={{ color: colors.onSurfaceVariant }}
            >
              {t('home.more_exercises', { count: hiddenCount })}
            </Text>
          ) : null}
        </View>
      </Card.Content>
    </Card>
  );
}

function ExercisePreviewRow({ index, name }: { index: number; name: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.exerciseRow}>
      <Text
        variant="labelMedium"
        style={[styles.exerciseNumber, { color: colors.primary }]}
      >
        {(index + 1).toString().padStart(2, '0')}
      </Text>
      <Text variant="bodyMedium" numberOfLines={1} style={{ flex: 1 }}>
        {name}
      </Text>
    </View>
  );
}

function getSessionSetProgress(session: Session) {
  let completedSets = 0;
  let totalSets = 0;

  for (const exercise of session.recordedExercises) {
    if (exercise.type === 'RecordedWeightedExercise') {
      totalSets += exercise.potentialSets.length;
      for (const set of exercise.potentialSets) {
        if (set.set) completedSets += 1;
      }
    } else {
      totalSets += exercise.sets.length;
      for (const set of exercise.sets) {
        if (set.isCompletelyFilled) completedSets += 1;
      }
    }
  }

  return { completedSets, totalSets };
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
  microLabel: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  activeWorkoutCard: {
    borderRadius: gainsLabRadii.hero,
    borderWidth: 1,
    overflow: 'hidden',
  },
  activeCardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
  },
  activeWorkoutTitle: {
    marginTop: spacing[1],
  },
  activeProgressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing[4],
  },
  progressTrack: {
    height: 4,
    overflow: 'hidden',
    borderRadius: gainsLabRadii.pill,
    marginTop: spacing[2],
  },
  progressFill: {
    height: '100%',
    borderRadius: gainsLabRadii.pill,
  },
  activeExercisePreview: {
    gap: spacing[2],
    marginTop: spacing[4],
  },
  activeWorkoutActions: {
    paddingHorizontal: spacing[3],
    paddingBottom: spacing[3],
    paddingTop: spacing[1],
  },
  workoutList: {
    gap: spacing[3],
  },
  upcomingWorkoutCard: {
    borderRadius: gainsLabRadii.card,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  exercisePreview: {
    gap: spacing[2],
    marginTop: spacing[3],
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
  freeformButton: {
    marginTop: spacing[1],
  },
  planBlock: {
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  planSummary: {
    borderRadius: gainsLabRadii.card,
  },
  planSummaryContent: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  loadingCard: {
    minHeight: 180,
    borderRadius: gainsLabRadii.hero,
  },
  loadingCardContent: {
    minHeight: 180,
    justifyContent: 'center',
  },
});
