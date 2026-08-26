import PotentialSetCounter from '@/components/presentation/workout/weighted/potential-set-counter';
import { spacing } from '@/hooks/useAppTheme';
import { RecordedWeightedExercise } from '@/models/session-models';
import { View } from 'react-native';
import ExerciseSection from '@/components/presentation/workout/exercise-section';
import { OffsetDateTime } from '@js-joda/core';

interface WeightedExerciseProps {
  recordedExercise: RecordedWeightedExercise;
  previousRecordedExercises: RecordedWeightedExercise[];
  toStartNext: boolean;
  isReadonly: boolean;
  showPreviousButton: boolean;

  timeProvider: () => OffsetDateTime;
  updateExercise: (
    ex: RecordedWeightedExercise,
    options?: { resetTimer?: boolean },
  ) => void;
  onEditExercise: () => void;
  onRemoveExercise: () => void;
}

export default function WeightedExercise(props: WeightedExerciseProps) {
  const { updateExercise, timeProvider } = props;
  const { recordedExercise } = props;

  const setToStartNext = recordedExercise.potentialSets.findIndex(
    (x) => !x.set,
  );

  return (
    <ExerciseSection
      recordedExercise={props.recordedExercise}
      previousRecordedExercises={props.previousRecordedExercises}
      toStartNext={props.toStartNext}
      isReadonly={props.isReadonly}
      showPreviousButton={props.showPreviousButton}
      updateExercise={(exercise) =>
        updateExercise(exercise as RecordedWeightedExercise)
      }
      onEditExercise={props.onEditExercise}
      onRemoveExercise={props.onRemoveExercise}
    >
      <View style={{ flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap' }}>
        {recordedExercise.potentialSets.map((set, index) => (
          <PotentialSetCounter
            isReadonly={props.isReadonly}
            key={index}
            maxReps={recordedExercise.blueprint.repsPerSet}
            onTap={() => {
              const previousSet = set.set;
              const newExercise = recordedExercise.withCycledRepCount(
                index,
                timeProvider(),
              );
              const newSet = newExercise.getSet(index).set;
              // Completing/uncompleting a set and resetting the rest timer must be
              // one session update. Two Redux updates here caused duplicate
              // persistence + worker broadcasts on every normal set tap.
              updateExercise(newExercise, {
                resetTimer: !previousSet || !newSet,
              });
            }}
            previousRepCount={
              props.previousRecordedExercises.at(0)?.potentialSets[index]?.set
                ?.repsCompleted
            }
            onUpdateReps={(reps) => {
              updateExercise(
                recordedExercise.withRepCount(index, reps, timeProvider()),
                { resetTimer: true },
              );
            }}
            onUpdateWeight={(w, applyTo) =>
              updateExercise(recordedExercise.withWeight(index, w, applyTo))
            }
            set={set}
            toStartNext={
              props.toStartNext && setToStartNext === index && !props.isReadonly
            }
            weightIncrement={
              recordedExercise.blueprint.progressiveOverload.weightIncrement
            }
          />
        ))}
      </View>
    </ExerciseSection>
  );
}
