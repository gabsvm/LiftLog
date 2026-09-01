import PotentialSetCounter from '@/components/presentation/workout/weighted/potential-set-counter';
import { spacing } from '@/hooks/useAppTheme';
import {
  PotentialSet,
  RecordedWeightedExercise,
  WeightAppliesTo,
} from '@/models/session-models';
import { View } from 'react-native';
import ExerciseSection from '@/components/presentation/workout/exercise-section';
import { OffsetDateTime } from '@js-joda/core';
import { memo, useCallback, useRef } from 'react';
import { Weight } from '@/models/weight';
import BigNumber from 'bignumber.js';

interface WeightedExerciseProps {
  recordedExercise: RecordedWeightedExercise;
  previousRecordedExercises: RecordedWeightedExercise[];
  toStartNext: boolean;
  isReadonly: boolean;
  showPreviousButton: boolean;
  supersetLabel?: string;
  supersetConnectBefore?: boolean;
  supersetConnectAfter?: boolean;

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
  const recordedExerciseRef = useRef(recordedExercise);
  recordedExerciseRef.current = recordedExercise;

  const setToStartNext = recordedExercise.potentialSets.findIndex(
    (x) => !x.set,
  );

  const commitExerciseUpdate = useCallback(
    (
      newExercise: RecordedWeightedExercise,
      options?: { resetTimer?: boolean },
    ) => {
      // Keep the interaction snapshot ahead of React rendering. Rapid taps on
      // multiple sets of the same exercise can arrive before the component
      // receives the Redux update back through props; without this optimistic
      // ref update, a later tap can be calculated from the older exercise and
      // overwrite the previous completion.
      recordedExerciseRef.current = newExercise;
      updateExercise(newExercise, options);
    },
    [updateExercise],
  );

  const handleTapSet = useCallback(
    (index: number) => {
      const exercise = recordedExerciseRef.current;
      const previousSet = exercise.getSet(index).set;
      const newExercise = exercise.withCycledRepCount(index, timeProvider());
      const newSet = newExercise.getSet(index).set;
      // Completing/uncompleting a set and resetting the rest timer must be
      // one session update. Two Redux updates here caused duplicate
      // persistence + worker broadcasts on every normal set tap.
      commitExerciseUpdate(newExercise, {
        resetTimer: !previousSet || !newSet,
      });
    },
    [commitExerciseUpdate, timeProvider],
  );

  const handleUpdateReps = useCallback(
    (index: number, reps: number | undefined) => {
      const exercise = recordedExerciseRef.current;
      commitExerciseUpdate(exercise.withRepCount(index, reps, timeProvider()), {
        resetTimer: true,
      });
    },
    [commitExerciseUpdate, timeProvider],
  );

  const handleUpdateWeight = useCallback(
    (index: number, weight: Weight, applyTo: WeightAppliesTo) => {
      const exercise = recordedExerciseRef.current;
      commitExerciseUpdate(exercise.withWeight(index, weight, applyTo));
    },
    [commitExerciseUpdate],
  );

  return (
    <ExerciseSection
      recordedExercise={props.recordedExercise}
      previousRecordedExercises={props.previousRecordedExercises}
      toStartNext={props.toStartNext}
      isReadonly={props.isReadonly}
      showPreviousButton={props.showPreviousButton}
      supersetLabel={props.supersetLabel}
      supersetConnectBefore={props.supersetConnectBefore}
      supersetConnectAfter={props.supersetConnectAfter}
      updateExercise={(exercise) => updateExercise(exercise)}
      onEditExercise={props.onEditExercise}
      onRemoveExercise={props.onRemoveExercise}
    >
      <View style={{ flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap' }}>
        {recordedExercise.potentialSets.map((set, index) => (
          <MemoizedWeightedSet
            key={index}
            index={index}
            set={set}
            isReadonly={props.isReadonly}
            maxReps={recordedExercise.blueprint.repsPerSet}
            previousRepCount={
              props.previousRecordedExercises.at(0)?.potentialSets[index]?.set
                ?.repsCompleted
            }
            toStartNext={
              props.toStartNext && setToStartNext === index && !props.isReadonly
            }
            weightIncrement={
              recordedExercise.blueprint.progressiveOverload.weightIncrement
            }
            onTapSet={handleTapSet}
            onUpdateReps={handleUpdateReps}
            onUpdateWeight={handleUpdateWeight}
          />
        ))}
      </View>
    </ExerciseSection>
  );
}

interface WeightedSetProps {
  index: number;
  set: PotentialSet;
  weightIncrement: BigNumber;
  maxReps: number;
  previousRepCount: number | undefined;
  toStartNext: boolean;
  isReadonly: boolean;
  onTapSet: (index: number) => void;
  onUpdateReps: (index: number, reps: number | undefined) => void;
  onUpdateWeight: (
    index: number,
    weight: Weight,
    applyTo: WeightAppliesTo,
  ) => void;
}

const MemoizedWeightedSet = memo(function WeightedSet(props: WeightedSetProps) {
  return (
    <PotentialSetCounter
      isReadonly={props.isReadonly}
      maxReps={props.maxReps}
      onTap={() => props.onTapSet(props.index)}
      previousRepCount={props.previousRepCount}
      onUpdateReps={(reps) => props.onUpdateReps(props.index, reps)}
      onUpdateWeight={(weight, applyTo) =>
        props.onUpdateWeight(props.index, weight, applyTo)
      }
      set={props.set}
      toStartNext={props.toStartNext}
      weightIncrement={props.weightIncrement}
    />
  );
});
