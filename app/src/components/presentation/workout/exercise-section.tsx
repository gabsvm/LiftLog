import ItemTitle from '@/components/presentation/foundation/item-title';
import WeightFormat from '@/components/presentation/foundation/weight-format';
import {
  gainsLabRadii,
  gainsLabTouchTarget,
} from '@/components/presentation/foundation/gainslab-ui';
import { spacing, useAppTheme } from '@/hooks/useAppTheme';
import {
  RecordedExercise,
  RecordedWeightedExercise,
} from '@/models/session-models';
import { ReactNode, useState } from 'react';
import { Linking, View } from 'react-native';
import { Menu, Text, Tooltip } from 'react-native-paper';
import { useTranslate } from '@tolgee/react';
import PreviousExerciseViewer from '@/components/presentation/workout/weighted/previous-exercise-viewer';
import ConfirmationDialog from '@/components/presentation/foundation/confirmation-dialog';
import ExerciseNotesDisplay from '@/components/presentation/workout/exercise-notes-display';
import RecordedExerciseNotesEditor from '@/components/presentation/workout/recorded-exercise-notes-editor';
import IconButton from '@/components/presentation/foundation/gesture-wrappers/icon-button';
import { useRouter } from 'expo-router';

interface ExerciseSectionProps<T extends RecordedExercise> {
  recordedExercise: T;
  previousRecordedExercises: RecordedExercise[];
  toStartNext: boolean;
  isReadonly: boolean;
  showPreviousButton: boolean;
  supersetLabel?: string;
  supersetConnectBefore?: boolean;
  supersetConnectAfter?: boolean;

  children: ReactNode;

  updateExercise: (value: T) => void;
  onEditExercise: () => void;
  onRemoveExercise: () => void;
}

export default function ExerciseSection<T extends RecordedExercise>(
  props: ExerciseSectionProps<T>,
) {
  const { updateExercise, onRemoveExercise } = props;
  const { colors } = useAppTheme();
  const openUrl = (url: string) => {
    void Linking.canOpenURL(url).then(() => Linking.openURL(url));
  };
  const { t } = useTranslate();
  const { push } = useRouter();
  const { recordedExercise } = props;
  const [menuVisible, setMenuVisible] = useState(false);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [previousDialogOpen, setPreviousDialogOpen] = useState(false);
  const [removeExerciseDialogOpen, setRemoveExerciseDialogOpen] =
    useState(false);
  const showStats = recordedExercise instanceof RecordedWeightedExercise;
  const isCompletedWeightedExercise =
    recordedExercise instanceof RecordedWeightedExercise &&
    recordedExercise.potentialSets.length > 0 &&
    recordedExercise.potentialSets.every((potentialSet) => !!potentialSet.set);
  const previousWeightedExercise = showStats
    ? props.previousRecordedExercises.find(
        (exercise) => exercise instanceof RecordedWeightedExercise,
      )
    : undefined;
  const previousCompletedSets =
    previousWeightedExercise instanceof RecordedWeightedExercise
      ? previousWeightedExercise.potentialSets.flatMap((potentialSet) =>
          potentialSet.set ? [potentialSet.set.repsCompleted] : [],
        )
      : [];
  const previousWeight =
    previousWeightedExercise instanceof RecordedWeightedExercise
      ? (previousWeightedExercise.potentialSets.find(
          (potentialSet) => !!potentialSet.set,
        )?.weight ?? previousWeightedExercise.potentialSets.at(0)?.weight)
      : undefined;
  const showPreviousSummary = previousCompletedSets.length > 0;
  const supersetConnectorAnchor = spacing[4] + spacing[2] + 14;

  const interactiveButtons = props.isReadonly ? (
    <View style={{ height: gainsLabTouchTarget.minimum }} />
  ) : (
    <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
      {props.showPreviousButton ? (
        <Tooltip title={t('workout.previously_completed.label')}>
          <IconButton
            testID="prev-exercise-btn"
            icon={'history'}
            accessibilityLabel={t('workout.previously_completed.label')}
            onPress={() => setPreviousDialogOpen(true)}
          />
        </Tooltip>
      ) : null}
      <Menu
        visible={menuVisible}
        onDismiss={() => setMenuVisible(false)}
        anchor={
          <IconButton
            testID="more-exercise-btn"
            onPress={() => setMenuVisible(true)}
            icon={'moreHoriz'}
            accessibilityLabel={`${t('navigation.more')}: ${recordedExercise.blueprint.name}`}
          />
        }
      >
        {menuVisible ? (
          <>
            <Menu.Item
              onPress={() => {
                props.onEditExercise();
                setMenuVisible(false);
              }}
              testID="exercise-edit-menu-button"
              leadingIcon={'edit'}
              title={t('generic.edit.button')}
            />
            <Menu.Item
              testID="exercise-notes-more-btn"
              title={t('generic.notes.label')}
              leadingIcon={'notes'}
              onPress={() => {
                setNotesDialogOpen(true);
                setMenuVisible(false);
              }}
            />
            {showStats ? (
              <Menu.Item
                onPress={() => {
                  push(
                    `/stats/expanded-weighted-exercise?exerciseName=${encodeURIComponent(recordedExercise.blueprint.name)}`,
                    { withAnchor: true },
                  );
                  setMenuVisible(false);
                }}
                testID="exercise-stats-menu-button"
                leadingIcon={'analytics'}
                title={t('stats.stats.title')}
              />
            ) : null}
            <Menu.Item
              onPress={() => {
                setRemoveExerciseDialogOpen(true);
                setMenuVisible(false);
              }}
              leadingIcon={'delete'}
              title={t('generic.remove.button')}
            />
            {!!props.recordedExercise.blueprint.link && (
              <Menu.Item
                onPress={() => {
                  openUrl(props.recordedExercise.blueprint.link);
                  setMenuVisible(false);
                }}
                leadingIcon={'openInBrowser'}
                title={t('generic.open_link.button')}
              />
            )}
          </>
        ) : null}
      </Menu>
    </View>
  );

  return (
    <View style={{ position: 'relative', paddingBottom: spacing[3] }}>
      {props.supersetLabel ? (
        <>
          <View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                left: spacing.pageHorizontalMargin - spacing[2],
                width: 2,
                borderRadius: 1,
                backgroundColor: colors.primary,
                opacity: 0.58,
              },
              props.supersetConnectBefore && props.supersetConnectAfter
                ? { top: 0, bottom: 0 }
                : props.supersetConnectBefore
                  ? { top: 0, height: supersetConnectorAnchor }
                  : { top: supersetConnectorAnchor, bottom: 0 },
            ]}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: spacing.pageHorizontalMargin - spacing[2],
              top: supersetConnectorAnchor,
              width: spacing[2],
              height: 2,
              backgroundColor: colors.primary,
              opacity: 0.58,
            }}
          />
        </>
      ) : null}

      <View
        style={{
          flexDirection: 'column',
          gap: spacing[4],
          paddingBlock: spacing[4],
          paddingHorizontal: spacing.pageHorizontalMargin,
          marginHorizontal: spacing.pageHorizontalMargin,
          borderRadius: gainsLabRadii.card,
          borderWidth: 1,
          borderColor: props.toStartNext ? colors.primary + '70' : 'transparent',
          backgroundColor: props.toStartNext
            ? colors.surfaceContainerHigh
            : isCompletedWeightedExercise
              ? colors.surfaceContainerLow
              : colors.surfaceContainer,
          overflow: 'hidden',
        }}
        testID="weighted-exercise"
      >
        <View>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <View
              style={{
                flex: 1,
                minWidth: 0,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing[2],
              }}
            >
              {props.supersetLabel ? (
                <View
                  style={{
                    minWidth: 34,
                    height: 28,
                    paddingHorizontal: spacing[1],
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: colors.primary,
                    borderRadius: gainsLabRadii.pill,
                    backgroundColor: colors.surfaceContainerHighest,
                  }}
                >
                  <Text
                    variant="labelMedium"
                    style={{ color: colors.primary, fontWeight: '800' }}
                  >
                    {props.supersetLabel}
                  </Text>
                </View>
              ) : null}
              <ItemTitle
                testID="weighted-exercise-title"
                style={{ marginVertical: spacing[2] }}
                title={recordedExercise.blueprint.name}
              />
            </View>
            {interactiveButtons}
          </View>
          {showPreviousSummary ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: spacing[1],
                marginTop: -spacing[1],
                marginBottom: spacing[3],
              }}
            >
              <Text
                variant="labelSmall"
                style={{
                  color: colors.onSurfaceVariant,
                  fontWeight: '800',
                  letterSpacing: 0.7,
                  textTransform: 'uppercase',
                }}
              >
                {t('generic.previous.button')}
              </Text>
              <Text
                variant="labelSmall"
                style={{ color: colors.onSurfaceVariant }}
              >
                ·
              </Text>
              <WeightFormat
                weight={previousWeight}
                color="onSurfaceVariant"
                fontSize="text-xs"
                fontWeight="700"
                decimalPlaces={2}
              />
              <Text
                variant="labelSmall"
                style={{
                  color: colors.onSurfaceVariant,
                  fontVariant: ['tabular-nums'],
                }}
              >
                × {previousCompletedSets.join(' · ')}
              </Text>
            </View>
          ) : null}
          {props.children}
          <ExerciseNotesDisplay
            exercise={props.recordedExercise}
            previousExercise={props.previousRecordedExercises.at(0)}
          />
        </View>

        {notesDialogOpen ? (
          <RecordedExerciseNotesEditor
            exerciseName={recordedExercise.blueprint.name}
            onDismiss={() => setNotesDialogOpen(false)}
            open
            notes={recordedExercise.notes}
            onUpdateNotes={(notes) =>
              updateExercise(recordedExercise.with({ notes }) as T)
            }
          />
        ) : null}
        {removeExerciseDialogOpen ? (
          <ConfirmationDialog
            headline={t('exercise.remove.confirm.title')}
            textContent={t('exercise.remove.confirm.body')}
            okText={t('generic.remove.button')}
            open
            onOk={() => {
              setRemoveExerciseDialogOpen(false);
              onRemoveExercise();
            }}
            onCancel={() => setRemoveExerciseDialogOpen(false)}
            preventCancel={false}
          />
        ) : null}
        {previousDialogOpen ? (
          <PreviousExerciseViewer
            name={recordedExercise.blueprint.name}
            previousRecordedExercises={props.previousRecordedExercises}
            close={() => setPreviousDialogOpen(false)}
            open
          />
        ) : null}
      </View>
    </View>
  );
}
