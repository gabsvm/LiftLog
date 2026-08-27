import {
  selectCurrentSession,
  SessionTarget,
  setCurrentSession,
} from '@/store/current-session';
import { Card, Icon, Text } from 'react-native-paper';
import { useDispatch, useStore } from 'react-redux';
import { View } from 'react-native';
import EmptyInfo from '@/components/presentation/foundation/empty-info';
import { useAppTheme, spacing, font } from '@/hooks/useAppTheme';
import { T, useTranslate } from '@tolgee/react';
import ItemList from '@/components/presentation/foundation/item-list';
import {
  RecordedCardioExercise,
  RecordedExercise,
  RecordedWeightedExercise,
  Session,
} from '@/models/session-models';
import WeightedExercise from '@/components/presentation/workout/weighted/weighted-exercise';
import WeightDisplay from '@/components/presentation/foundation/editors/weight-display';
import BigNumber from 'bignumber.js';
import RestTimer from '@/components/presentation/workout/rest-timer';
import { memo, ReactNode, useCallback, useState } from 'react';
import FullHeightScrollView from '@/components/layout/full-height-scroll-view';
import {
  ExerciseBlueprint,
  KeyedExerciseBlueprint,
} from '@/models/blueprint-models';
import FullScreenDialog from '@/components/presentation/foundation/full-screen-dialog';
import { ExerciseEditor } from '@/components/presentation/workout-editor/exercise-editor';
import { LocalTime, OffsetDateTime, ZoneId } from '@js-joda/core';
import { useAppSelector, useAppSelectorWithArg } from '@/store';
import { selectRecentlyCompletedExercises } from '@/store/stored-sessions';
import FloatingBottomContainer from '@/components/presentation/foundation/floating-bottom-container';
import { SurfaceText } from '@/components/presentation/foundation/surface-text';
import { CardioExercise } from '@/components/presentation/workout/cardio/cardio-exercise';
import WeightFormat from '../presentation/foundation/weight-format';
import { formatDuration } from '@/utils/format-date';

const BODYWEIGHT_INCREMENT = new BigNumber('0.1');

type UpdateSession = (reducer: (session: Session) => Session) => void;

export default function SessionComponent(props: {
  target: SessionTarget;
  showBodyweight: boolean;
  header?: ReactNode;
  openPostWorkoutSummary?: () => void;
}) {
  const { colors } = useAppTheme();
  const useImperialUnits = useAppSelector((x) => x.settings.useImperialUnits);
  const { t } = useTranslate();
  const { getState } = useStore();
  const session = useAppSelectorWithArg(selectCurrentSession, props.target);
  const dispatch = useDispatch();
  const recentlyCompletedExercises = useAppSelectorWithArg(
    selectRecentlyCompletedExercises,
    10,
  );

  const updateSession = useCallback<UpdateSession>(
    (reducer) => {
      const latestSession = selectCurrentSession(getState(), props.target);
      if (!latestSession) {
        return;
      }
      dispatch(
        setCurrentSession({
          session: reducer(latestSession),
          target: props.target,
        }),
      );
    },
    [dispatch, getState, props.target],
  );

  const timeProvider = useCallback(() => {
    if (props.target === 'workoutSession') {
      return OffsetDateTime.now();
    }
    const latestSession = selectCurrentSession(getState(), props.target);
    return (
      latestSession?.lastExercise?.latestTime ??
      (latestSession?.date ?? session?.date)
        ?.atTime(LocalTime.now())
        .atZone(ZoneId.systemDefault())
        .toOffsetDateTime() ??
      OffsetDateTime.now()
    );
  }, [getState, props.target, session?.date]);

  const resetTimer = useCallback(
    (time: OffsetDateTime | undefined) => {
      updateSession((s) => s.with({ restTimerStartTime: time }));
    },
    [updateSession],
  );

  const isReadonly =
    props.target === 'feedSession' || props.target === 'sharedSession';

  const [exerciseToEditIndex, setExerciseToEditIndex] = useState<
    number | undefined
  >(undefined);
  const [editingExerciseBlueprint, setEditingExerciseBlueprint] = useState<
    ExerciseBlueprint | undefined
  >(undefined);
  const [exerciseEditorOpen, setExerciseEditorOpen] = useState(false);

  const beginEditExercise = useCallback(
    (index: number, blueprint: ExerciseBlueprint) => {
      setEditingExerciseBlueprint(blueprint);
      setExerciseToEditIndex(index);
      setExerciseEditorOpen(true);
    },
    [],
  );

  const handleEditExercise = () => {
    if (editingExerciseBlueprint !== undefined) {
      if (exerciseToEditIndex !== undefined) {
        updateSession((s) =>
          s.withEditedExercise(
            exerciseToEditIndex,
            editingExerciseBlueprint,
            useImperialUnits,
          ),
        );
        setExerciseToEditIndex(undefined);
      } else {
        updateSession((s) =>
          s.withAddedExercise(editingExerciseBlueprint, useImperialUnits),
        );
      }
      setExerciseEditorOpen(false);
    }
  };

  if (!session) {
    return <Text>{t('generic.loading.label')}</Text>;
  }

  const nextExercise = session.nextExercise;
  const lastExercise = session.lastExercise;
  const exerciseKeys = buildExerciseKeys(session.recordedExercises);

  const notesComponent = session.blueprint.notes ? (
    <Card
      mode="contained"
      style={{
        marginVertical: spacing[2],
        marginHorizontal: spacing.pageHorizontalMargin,
      }}
    >
      <Card.Content
        style={{
          gap: spacing[4],
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <Icon source={'text'} size={20} />
        <View style={{ paddingRight: spacing[2] }}>
          <SurfaceText>{session.blueprint.notes}</SurfaceText>
        </View>
      </Card.Content>
    </Card>
  ) : null;

  const emptyInfo =
    session.recordedExercises.length === 0 ? (
      <EmptyInfo style={{ marginVertical: spacing[8] }}>
        <SurfaceText>
          {t('workout.contains_no_exercises.message')} {'\n'}
        </SurfaceText>
        <SurfaceText>{t('exercise.add_hint.body')}</SurfaceText>
      </EmptyInfo>
    ) : null;

  const bodyweight = props.showBodyweight ? (
    <Card
      style={{ marginHorizontal: spacing.pageHorizontalMargin }}
      mode="contained"
      testID="bodyweight-card"
    >
      <Card.Content
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text
          style={{
            ...font['text-xl'],
            fontWeight: 'bold',
            color: colors.onSurface,
          }}
        >
          {t('exercise.bodyweight.label')}
        </Text>
        <WeightDisplay
          allowNull={true}
          weight={session.bodyweight}
          updateWeight={(bodyweight) =>
            updateSession((s) => s.with({ bodyweight }))
          }
          increment={BODYWEIGHT_INCREMENT}
          label={t('exercise.bodyweight.label')}
        />
      </Card.Content>
    </Card>
  ) : null;

  const lastRecordedSet =
    lastExercise instanceof RecordedWeightedExercise
      ? lastExercise.lastRecordedSet
      : undefined;
  const showRestTimer =
    props.target === 'workoutSession' &&
    nextExercise instanceof RecordedWeightedExercise &&
    lastExercise instanceof RecordedWeightedExercise &&
    !!session.restTimerStartTime;
  const lastSetFailed =
    lastRecordedSet?.set &&
    lastExercise instanceof RecordedWeightedExercise &&
    lastRecordedSet.set.repsCompleted < lastExercise.blueprint.repsPerSet;
  const restTimer = showRestTimer ? (
    <View style={{ flex: 1 }}>
      <RestTimer
        rest={lastExercise.blueprint.restBetweenSets}
        startTime={session.restTimerStartTime}
        failed={!!lastSetFailed}
        resetTimer={() => resetTimer(OffsetDateTime.now())}
      />
    </View>
  ) : undefined;

  const floatingBottomContainer = isReadonly ? null : (
    <FloatingBottomContainer
      additionalContent={
        <View style={{ alignItems: 'center' }}>{restTimer}</View>
      }
    />
  );

  const workoutSummary = (
    <Card
      mode="contained"
      onPress={
        props.target === 'workoutSession'
          ? props.openPostWorkoutSummary
          : undefined
      }
      style={{ margin: spacing.pageHorizontalMargin }}
    >
      <Card.Content>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Text variant="bodyMedium">
            <T keyName="workout.total_weight_lifted.label" />
          </Text>
          <WeightFormat
            fontWeight="bold"
            color="primary"
            weight={session.totalWeightLifted}
          />
        </View>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Text variant="bodyMedium">
            <T keyName="workout.total_time.label" />
          </Text>
          <Text
            variant="bodyMedium"
            style={{ color: colors.primary, fontWeight: 'bold' }}
          >
            {(session.duration &&
              formatDuration(session.duration, 'hours-mins')) ||
              '-'}
          </Text>
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <FullHeightScrollView floatingChildren={floatingBottomContainer}>
      {props.header}
      {notesComponent}
      {emptyInfo}
      <ItemList
        items={session.recordedExercises}
        keyExtractor={(_, index) => exerciseKeys[index] ?? String(index)}
        renderItem={(recordedExercise, index) => (
          <MemoizedSessionExerciseItem
            index={index}
            recordedExercise={recordedExercise}
            previousRecordedExercises={recentlyCompletedExercises(
              recordedExercise.blueprint,
            )}
            toStartNext={nextExercise === recordedExercise}
            isReadonly={isReadonly}
            showPreviousButton={props.target === 'workoutSession'}
            timeProvider={timeProvider}
            updateSession={updateSession}
            beginEditExercise={beginEditExercise}
          />
        )}
      />
      {bodyweight}
      {workoutSummary}
      <FullScreenDialog
        avoidKeyboard
        title={
          exerciseToEditIndex === undefined
            ? t('exercise.add.title')
            : t('exercise.edit.title')
        }
        action={
          exerciseToEditIndex === undefined
            ? t('generic.add.button')
            : t('generic.update.button')
        }
        open={exerciseEditorOpen}
        onAction={handleEditExercise}
        onClose={() => setExerciseEditorOpen(false)}
      >
        {editingExerciseBlueprint ? (
          <ExerciseEditor
            exercise={editingExerciseBlueprint}
            updateExercise={setEditingExerciseBlueprint}
          />
        ) : null}
      </FullScreenDialog>
    </FullHeightScrollView>
  );
}

interface SessionExerciseItemProps {
  index: number;
  recordedExercise: RecordedExercise;
  previousRecordedExercises: RecordedExercise[];
  toStartNext: boolean;
  isReadonly: boolean;
  showPreviousButton: boolean;
  timeProvider: () => OffsetDateTime;
  updateSession: UpdateSession;
  beginEditExercise: (index: number, blueprint: ExerciseBlueprint) => void;
}

const MemoizedSessionExerciseItem = memo(
  function SessionExerciseItem(props: SessionExerciseItemProps) {
    const {
      index,
      recordedExercise,
      previousRecordedExercises,
      toStartNext,
      isReadonly,
      showPreviousButton,
      timeProvider,
      updateSession,
      beginEditExercise,
    } = props;

    const editExercise = useCallback(
      () => beginEditExercise(index, recordedExercise.blueprint),
      [beginEditExercise, index, recordedExercise.blueprint],
    );
    const removeExercise = useCallback(
      () => updateSession((s) => s.withRemovedExercise(index)),
      [index, updateSession],
    );
    const updateWeightedExercise = useCallback(
      (
        exercise: RecordedWeightedExercise,
        options?: { resetTimer?: boolean },
      ) => {
        updateSession((s) => {
          const updatedSession = s.withExercise(index, exercise);
          return options?.resetTimer
            ? updatedSession.with({
                restTimerStartTime: updatedSession.lastExercise?.latestTime,
              })
            : updatedSession;
        });
      },
      [index, updateSession],
    );
    const updateCardioExercise = useCallback(
      (reducer: (exercise: RecordedCardioExercise) => RecordedCardioExercise) => {
        updateSession((s) => {
          const currentExercise = s.recordedExercises[index];
          if (!(currentExercise instanceof RecordedCardioExercise)) {
            return s;
          }
          return s.withExercise(index, reducer(currentExercise));
        });
      },
      [index, updateSession],
    );

    if (recordedExercise instanceof RecordedWeightedExercise) {
      return (
        <WeightedExercise
          timeProvider={timeProvider}
          recordedExercise={recordedExercise}
          toStartNext={toStartNext}
          updateExercise={updateWeightedExercise}
          onEditExercise={editExercise}
          onRemoveExercise={removeExercise}
          isReadonly={isReadonly}
          showPreviousButton={showPreviousButton}
          previousRecordedExercises={
            previousRecordedExercises as RecordedWeightedExercise[]
          }
        />
      );
    }

    return (
      <CardioExercise
        recordedExercise={recordedExercise}
        updateExercise={updateCardioExercise}
        toStartNext={toStartNext}
        onEditExercise={editExercise}
        onRemoveExercise={removeExercise}
        isReadonly={isReadonly}
        showPreviousButton={showPreviousButton}
        previousRecordedExercises={
          previousRecordedExercises as RecordedCardioExercise[]
        }
      />
    );
  },
  (previous, next) =>
    previous.index === next.index &&
    previous.recordedExercise === next.recordedExercise &&
    previous.toStartNext === next.toStartNext &&
    previous.isReadonly === next.isReadonly &&
    previous.showPreviousButton === next.showPreviousButton &&
    previous.timeProvider === next.timeProvider &&
    previous.updateSession === next.updateSession &&
    previous.beginEditExercise === next.beginEditExercise &&
    sameExerciseReferences(
      previous.previousRecordedExercises,
      next.previousRecordedExercises,
    ),
);

function buildExerciseKeys(exercises: readonly RecordedExercise[]): string[] {
  const occurrences = new Map<string, number>();
  return exercises.map((exercise) => {
    const base = KeyedExerciseBlueprint.fromExerciseBlueprint(
      exercise.blueprint,
    ).toString();
    const occurrence = occurrences.get(base) ?? 0;
    occurrences.set(base, occurrence + 1);
    return `${exercise.type}:${base}:${occurrence}`;
  });
}

function sameExerciseReferences(
  previous: RecordedExercise[],
  next: RecordedExercise[],
): boolean {
  return (
    previous === next ||
    (previous.length === next.length &&
      previous.every((exercise, index) => exercise === next[index]))
  );
}
