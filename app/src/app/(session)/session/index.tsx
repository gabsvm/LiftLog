import ConfirmationDialog from '@/components/presentation/foundation/confirmation-dialog';
import SessionComponent from '@/components/smart/session-component';
import SessionMoreMenuComponent from '@/components/smart/session-more-menu-component';
import { useAppSelector, useAppSelectorWithArg } from '@/store';
import {
  finishCurrentWorkout,
  selectCurrentSession,
} from '@/store/current-session';
import { useTranslate } from '@tolgee/react';
import { Stack, useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { spacing, useAppTheme } from '@/hooks/useAppTheme';
import { StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';

export default function Index() {
  const dispatch = useDispatch();
  const session = useAppSelectorWithArg(selectCurrentSession, 'workoutSession');
  const showPostWorkoutSummary = useAppSelector(
    (x) => x.settings.showPostWorkoutSummary,
  );
  const keepAwake = useAppSelector(
    (x) => x.settings.keepScreenAwakeDuringWorkout,
  );
  const { dismissTo, push } = useRouter();
  const { t } = useTranslate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [postWorkoutSessionId, setPostWorkoutSessionId] = useState<
    string | undefined
  >(undefined);

  const save = (force = false) => {
    const finishedSessionId = session?.id;
    if (session) {
      if (!force && !session.isComplete) {
        setConfirmOpen(true);
        return;
      }
      setConfirmOpen(false);
    }
    if (showPostWorkoutSummary) {
      setPostWorkoutSessionId(finishedSessionId);
      if (finishedSessionId) {
        push(
          `/session/post-workout?sessionId=${encodeURIComponent(finishedSessionId)}&source=finished`,
        );
        return;
      }
    } else {
      dispatch(finishCurrentWorkout('workoutSession'));
      dismissTo('/');
    }
  };
  useEffect(() => {
    if (!session && !postWorkoutSessionId) {
      dismissTo('/');
    }
  }, [session, dismissTo, postWorkoutSessionId]);
  const showBodyweight = useAppSelector((x) => x.settings.showBodyweight);

  return (
    <>
      {keepAwake && <KeepAwake />}
      <Stack.Screen
        options={{
          title: t('workout.workout.label'),
        }}
      />
      <SessionMoreMenuComponent target="workoutSession" save={save} />
      <SessionComponent
        target="workoutSession"
        showBodyweight={showBodyweight}
        header={session ? <LiveWorkoutHeader session={session} /> : undefined}
        openPostWorkoutSummary={() => {
          if (!session?.id) {
            return;
          }
          push(
            `/session/post-workout?sessionId=${encodeURIComponent(session.id)}&source=live`,
          );
        }}
      />
      <ConfirmationDialog
        okText={t('generic.finish.button')}
        onOk={() => save(true)}
        onCancel={() => setConfirmOpen(false)}
        textContent={t('workout.finish.incomplete.body')}
        headline={t('workout.finish.confirm.title')}
        open={confirmOpen}
      />
    </>
  );
}

function LiveWorkoutHeader({
  session,
}: {
  session: NonNullable<ReturnType<typeof selectCurrentSession>>;
}) {
  const { colors } = useAppTheme();
  const { t } = useTranslate();
  const complete = session.recordedExercises.filter(
    (exercise) => exercise.isComplete,
  ).length;
  const total = session.recordedExercises.length;
  const progress = total === 0 ? 0 : complete / total;

  return (
    <View style={styles.liveHeader}>
      <Text style={[styles.liveLabel, { color: colors.primary }]}>
        {t('workout.live.label')}
      </Text>
      <Text variant="headlineMedium" style={styles.liveTitle}>
        {session.blueprint.name}
      </Text>
      <Card
        mode="contained"
        style={[
          styles.progressCard,
          { backgroundColor: colors.surfaceContainer },
        ]}
      >
        <Card.Content style={styles.progressContent}>
          <View style={{ flex: 1 }}>
            <Text variant="labelLarge">
              {t('workout.live.progress', { complete, total })}
            </Text>
            <View
              style={[
                styles.progressTrack,
                { backgroundColor: colors.outlineVariant },
              ]}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: colors.primary,
                    width: `${progress * 100}%`,
                  },
                ]}
              />
            </View>
          </View>
          <Text
            variant="titleLarge"
            style={{ color: colors.primary, fontWeight: '800' }}
          >
            {Math.round(progress * 100)}%
          </Text>
        </Card.Content>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  liveHeader: {
    paddingHorizontal: spacing.pageHorizontalMargin,
    paddingTop: spacing[4],
    paddingBottom: spacing[2],
  },
  liveLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  liveTitle: {
    fontWeight: '800',
    letterSpacing: -0.8,
    marginTop: spacing[1],
    marginBottom: spacing[4],
  },
  progressCard: {
    borderRadius: 18,
  },
  progressContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
  },
  progressTrack: {
    height: 6,
    overflow: 'hidden',
    borderRadius: 99,
    marginTop: spacing[3],
  },
  progressFill: {
    height: '100%',
    borderRadius: 99,
  },
});

/**
 * Allows us to conditionally keep the screen awake, as we cannot use hooks conditionally
 */
function KeepAwake() {
  useKeepAwake();
  return <></>;
}
