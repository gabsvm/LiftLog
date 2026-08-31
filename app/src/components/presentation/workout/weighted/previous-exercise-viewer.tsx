import EmptyInfo from '@/components/presentation/foundation/empty-info';
import ExerciseSummary from '@/components/presentation/summary/exercise-summary';
import { spacing } from '@/hooks/useAppTheme';
import { RecordedExercise } from '@/models/session-models';
import { T } from '@tolgee/react';
import { View } from 'react-native';
import { Portal } from 'react-native-paper';
import Button from '@/components/presentation/foundation/gesture-wrappers/button';
import { GainsLabDialog } from '@/components/presentation/foundation/gainslab-overlays';

function PreviousExerciseContent(props: {
  previousRecordedExercises: RecordedExercise[];
}) {
  return (
    <View style={{ gap: spacing[2] }}>
      {props.previousRecordedExercises.map((ex, i) => (
        <ExerciseSummary
          key={i}
          exercise={ex}
          isFilled
          showWeight
          showName={false}
          showDate={true}
        />
      ))}
      {props.previousRecordedExercises.length ? undefined : (
        <View style={{ height: 100 }}>
          <EmptyInfo>
            <T keyName="exercise.never_done_before.message" />
          </EmptyInfo>
        </View>
      )}
    </View>
  );
}

export default function PreviousExerciseViewer(props: {
  name: string;
  previousRecordedExercises: RecordedExercise[];
  open: boolean;
  close: () => void;
}) {
  return (
    <Portal>
      <GainsLabDialog visible={props.open} onDismiss={props.close}>
        <GainsLabDialog.Title>
          <T
            keyName="exercise.previous_sessions_for.title"
            params={{ exercise: props.name }}
          />
        </GainsLabDialog.Title>
        <GainsLabDialog.Content>
          <PreviousExerciseContent
            previousRecordedExercises={props.previousRecordedExercises}
          />
        </GainsLabDialog.Content>
        <GainsLabDialog.Actions>
          <Button onPress={props.close}>
            <T keyName="generic.close.button" />
          </Button>
        </GainsLabDialog.Actions>
      </GainsLabDialog>
    </Portal>
  );
}
