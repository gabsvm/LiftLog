import { spacing } from '@/hooks/useAppTheme';
import { RecordedExercise } from '@/models/session-models';
import { useAppSelector } from '@/store';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Card, Divider, Text } from 'react-native-paper';
import IconButton from '@/components/presentation/foundation/gesture-wrappers/icon-button';

interface ExerciseNotesDisplayProps {
  exercise: RecordedExercise;
  previousExercise: RecordedExercise | undefined;
}

export default function ExerciseNotesDisplay(props: ExerciseNotesDisplayProps) {
  const expandByDefault = useAppSelector(
    (x) => x.settings.notesExpandedByDefault,
  );
  const notes = props.exercise.notes ?? '';
  const blueprintNotes = props.exercise.blueprint.notes ?? '';
  const previousNotes = props.previousExercise?.notes
    ? 'Last time: ' + props.previousExercise.notes
    : '';
  const [expanded, setExpanded] = useState(expandByDefault);
  const hasNotes = !!(notes || blueprintNotes || previousNotes);

  const handleToggleExpanded = useCallback(() => {
    setExpanded((value) => !value);
  }, []);

  if (!hasNotes) {
    return undefined;
  }

  const collapsedText = notes || blueprintNotes || previousNotes;

  return (
    <Card
      mode="contained"
      onPress={handleToggleExpanded}
      style={{ marginTop: spacing[3] }}
    >
      <Card.Content
        style={{
          flexDirection: 'row',
          alignItems: expanded ? 'flex-start' : 'center',
          gap: spacing[1],
          paddingVertical: expanded ? spacing[3] : spacing[2],
        }}
      >
        <IconButton
          icon={expanded ? 'unfoldLess' : 'unfoldMore'}
          style={{ margin: 0, marginLeft: -spacing[2] }}
          onPress={handleToggleExpanded}
        />

        <View style={{ flex: 1, gap: spacing[2] }}>
          {!expanded ? (
            <Text numberOfLines={1}>{collapsedText}</Text>
          ) : (
            <>
              {!!notes && <Text testID="exercise-notes">{notes}</Text>}
              {!!notes && (!!blueprintNotes || !!previousNotes) ? <Divider /> : null}
              {!!blueprintNotes && (
                <Text testID="exercise-blueprint-notes">{blueprintNotes}</Text>
              )}
              {!!blueprintNotes && !!previousNotes ? <Divider /> : null}
              {!!previousNotes && (
                <Text testID="exercise-previous-notes">{previousNotes}</Text>
              )}
            </>
          )}
        </View>
      </Card.Content>
    </Card>
  );
}
