import {
  selectCurrentSession,
  SessionTarget,
  setCurrentSession,
} from '@/store/current-session';
import { Card, Icon, Text } from 'react-native-paper';
import { useDispatch, useStore } from 'react-redux';
import { Platform, View } from 'react-native';
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
import { memo, ReactNode, useCallback, useRef, useState } from 'react';
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
import {
  cycleWeightedSetWithNativeWriter,
  NativeWeightedSetWriterCursor,
} from '@/services/native-weighted-set-writer';

const BODYWEIGHT_INCREMENT = new BigNumber('0.1');
const NATIVE_WEIGHTED_SET_WRITER_EXPERIMENT_ENABLED =
  process.env.EXPO_PUBLIC_GAINS_NATIVE_SET_WRITER === '1' ||
  process.env.EXPO_PUBLIC_GAINS_NATIVE_SET_WRITER === 'true';

type UpdateSession = (reducer: (session: Session) => Session) => void;
type CycleWeightedSet = (
  exerciseIndex: number,
  setIndex: number,
  time: OffsetDateTime,
) => RecordedWeightedExercise | undefined;

type SupersetVisual = {
  label?: string;
  connectBefore: boolean;
  connectAfter: boolean;
};

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
  const nativeWeightedSetWriterCursorRef = useRef<NativeWeightedSetWriterCursor>(
    {
      sessionId: '',
      revision: 0,
      disabled: false,
    },
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

  const cycleWeightedSet = useCallback<CycleWeightedSet>(
    (exerciseIndex, setIndex, time) => {
      const latestSession = selectCurrentSession(getState(), props.target);
      if (!latestSession) {
        return undefined;
      }

      const result = cycleWeightedSetWithNativeWriter({
        session: latestSession,
        exerciseIndex,
        setIndex,
        time,
        cursor: nativeWeightedSetWriterCursorRef.current,
      });
      nativeWeightedSetWriterCursorRef.current = result.cursor;

      // The native experiment owns only the mutation. Redux remains the single
      // Session commit/persistence boundary, so this dispatch occurs exactly
      // once whether Kotlin succeeds or the writer falls back to RN.
      dispatch(
        setCurrentSession({
          session: result.session,
          target: props.target,
        }),
      );

      const updatedExercise = result.session.recordedExercises[exerciseIndex];
      return updatedExercise?.type === 'RecordedWeightedExercise'
        ? updatedExercise
        : undefined;
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
  const nativeWeightedSetWriterEnabled =
    NATIVE_WEIGHTED_SET_WRITER_EXPERIMENT_ENABLED &&
    Platform.OS === 'android' &&
    props.target === 'workoutSession';

  const [exerciseToEditIndex, setExerciseToEditIndex] = useState<
    number | undefined
  >(undefined);
  const [editingExerciseBlueprint, setEditingExerciseBlueprint] = useState<
    ExerciseBlueprint | undefined
  >(undefined);
  const [exerciseEditorOpen, setExerciseEditorOpen] = useState(false);
  const [sessionNotesExpanded, setSessionNotesExpanded] = useState(false);

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
  const supersetVisuals = buildSupersetVisuals(session.recordedExercises);

  const notesComponent = session.blueprint.notes ? (
    <Card
      mode="contained"
      onPress={() => setSessionNotesExpanded((expanded) => !expanded)}
      style={{
        marginVertical: spacing[2],
        marginHorizontal: spacing.pageHorizontalMargin,
      }}
    >
      <Card.Content
        style={{
          minHeight: sessionNotesExpanded ? undefined : 42,
          gap: spacing[2],
          flexDirection: 'row',
          alignItems: sessionNotesExpanded ? 'flex-start' : 'center',
          paddingVertical: sessionNotesExpanded ? spacing[3] : spacing[1],
          paddingHorizontal: spacing[3],
        }}
      >
        <View style={{ paddingTop: sessionNotesExpanded ? 2 : 0 }}>
          <Icon
            source={sessionNotesExpanded ? 'unfoldLess' : 'text'}
            size={18}
            color={colors.onSurfaceVariant}
          />
        </View>
        <View style={{ flex: 1 }}>
          {sessionNotesExpanded ? (
            <SurfaceText>{session.blueprint.notes}</SurfaceText>
          ) : (
            <Text
              variant="bodySmall"
              numberOfLines={1}
              style={{ color: colors.onSurfaceVariant }}
            >
              {session.blueprint.notes}
            </Text>
          )}
        </View>
        {!sessionNotesExpanded ? (
          <Icon source="unfoldMore" size={18} color={colors.onSurfaceVariant} />
        ) : null}
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
        renderItem={(recordedExercise, index) => {
          const supersetVisual = supersetVisuals[index];
          return (
            <MemoizedSessionExerciseItem
              index={index}
              recordedExercise={recordedExercise}
              previousRecordedExercises={recentlyCompletedExercises(
                recordedExercise.blueprint,
              )}
              toStartNext={nextExercise === recordedExercise}
              isReadonly={isReadonly}
              showPreviousButton={props.target === 'workoutSession'}
              supersetLabel={supersetVisual?.label}
              supersetConnectBefore={supersetVisual?.connectBefore ?? false}
              supersetConnectAfter={supersetVisual?.connectAfter ?? false}
              timeProvider={timeProvider}
              updateSession={updateSession}
              cycleWeightedSet={
                nativeWeightedSetWriterEnabled ? cycleWeightedSet : undefined
              }
              beginEditExercise={beginEditExercise}
            />
          );
        }}
      />
      {bodyweight}
      {workoutSummary}
      {exerciseEditorOpen ? (
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
          open
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
      ) : null}
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
  supersetLabel?: string;
  supersetConnectBefore: boolean;
  supersetConnectAfter: boolean;
  timeProvider: () => OffsetDateTime;
  updateSession: UpdateSession;
  cycleWeightedSet?: CycleWeightedSet;
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
      supersetLabel,
      supersetConnectBefore,
      supersetConnectAfter,
      timeProvider,
      updateSession,
      cycleWeightedSet,
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
    const cycleWeightedSetForExercise = useCallback(
      (setIndex: number, time: OffsetDateTime) =>
        cycleWeightedSet?.(index, setIndex, time),
      [cycleWeightedSet, index],
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
          nativeCycleSet={
            cycleWeightedSet ? cycleWeightedSetForExercise : undefined
          }
          onEditExercise={editExercise}
          onRemoveExercise={removeExercise}
          isReadonly={isReadonly}
          showPreviousButton={showPreviousButton}
          supersetLabel={supersetLabel}
          supersetConnectBefore={supersetConnectBefore}
          supersetConnectAfter={supersetConnectAfter}
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
    previous.supersetLabel === next.supersetLabel &&
    previous.supersetConnectBefore === next.supersetConnectBefore &&
    previous.supersetConnectAfter === next.supersetConnectAfter &&
    previous.timeProvider === next.timeProvider &&
    previous.updateSession === next.updateSession &&
    previous.cycleWeightedSet === next.cycleWeightedSet &&
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

function buildSupersetVisuals(
  exercises: readonly RecordedExercise[],
): SupersetVisual[] {
  const visuals: SupersetVisual[] = exercises.map(() => ({
    connectBefore: false,
    connectAfter: false,
  }));
  let groupIndex = 0;
  let index = 0;

  while (index < exercises.length - 1) {
    const first = exercises[index];
    const next = exercises[index + 1];
    if (
      !(first instanceof RecordedWeightedExercise) ||
      !first.blueprint.supersetWithNext ||
      !(next instanceof RecordedWeightedExercise)
    ) {
      index += 1;
      continue;
    }

    let endIndex = index + 1;
    while (endIndex < exercises.length - 1) {
      const current = exercises[endIndex];
      const following = exercises[endIndex + 1];
      if (
        !(current instanceof RecordedWeightedExercise) ||
        !current.blueprint.supersetWithNext ||
        !(following instanceof RecordedWeightedExercise)
      ) {
        break;
      }
      endIndex += 1;
    }

    const groupName = getSupersetGroupName(groupIndex);
    groupIndex += 1;
    for (
      let groupExerciseIndex = index;
      groupExerciseIndex <= endIndex;
      groupExerciseIndex += 1
    ) {
      visuals[groupExerciseIndex] = {
        label: `${groupName}${groupExerciseIndex - index + 1}`,
        connectBefore: groupExerciseIndex > index,
        connectAfter: groupExerciseIndex < endIndex,
      };
    }
    index = endIndex + 1;
  }

  return visuals;
}

function getSupersetGroupName(index: number): string {
  return index < 26 ? String.fromCharCode(65 + index) : `S${index + 1}`;
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
