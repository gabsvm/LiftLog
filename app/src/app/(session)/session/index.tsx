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
import { Text } from 'react-native-paper';

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
  const progress = totalSets === 0 ? 0 : completedSets / totalSets;

  return (
    <View style={styles.liveHeader}>
      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.liveLabel, { color: colors.primary }]}>
            {t('workout.live.label')}
          </Text>
          <Text variant="headlineMedium" style={styles.liveTitle}>
            {session.blueprint.name}
          </Text>
        </View>
        <Text
          variant="titleMedium"
          style={{ color: colors.primary, fontWeight: '800' }}
        >
          {completedSets}/{totalSets}
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
            {
              backgroundColor: colors.primary,
              width: `${progress * 100}%`,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  liveHeader: {
    paddingHorizontal: spacing.pageHorizontalMargin,
    paddingTop: spacing[4],
    paddingBottom: spacing[3],
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing[4],
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
  },
  progressTrack: {
    height: 5,
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
