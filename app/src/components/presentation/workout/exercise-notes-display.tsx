import { spacing, useAppTheme } from '@/hooks/useAppTheme';
import { RecordedExercise } from '@/models/session-models';
import { useAppSelector } from '@/store';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Card, Divider, Icon, Text } from 'react-native-paper';

interface ExerciseNotesDisplayProps {
  exercise: RecordedExercise;
  previousExercise: RecordedExercise | undefined;
}

export default function ExerciseNotesDisplay(props: ExerciseNotesDisplayProps) {
  const { colors } = useAppTheme();
  const expandByDefault = useAppSelector(
    (x) => x.settings.notesExpandedByDefault,
  );
  const notes = props.exercise.notes ?? '';
  const blueprintNotes = props.exercise.blueprint.notes ?? '';
  const previousNotes = props.previousExercise?.notes
    ? 'Last time: ' + props.previousExercise.notes
    : '';
  const templateOnly = !!blueprintNotes && !notes && !previousNotes;
  const [expanded, setExpanded] = useState(() =>
    templateOnly ? false : expandByDefault,
  );
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
      testID="exercise-notes-card"
    >
      <Card.Content
        style={{
          minHeight: expanded ? undefined : 40,
          flexDirection: 'row',
          alignItems: expanded ? 'flex-start' : 'center',
          gap: expanded ? spacing[2] : spacing[1],
          paddingVertical: expanded ? spacing[3] : spacing[1],
          paddingHorizontal: expanded ? spacing[3] : spacing[2],
        }}
      >
        <View style={{ paddingTop: expanded ? 2 : 0 }}>
          <Icon
            source={expanded ? 'unfoldLess' : 'notes'}
            size={expanded ? 19 : 17}
            color={colors.onSurfaceVariant}
          />
        </View>

        <View style={{ flex: 1, gap: spacing[2] }}>
          {!expanded ? (
            <Text
              variant="bodySmall"
              numberOfLines={1}
              style={{ color: colors.onSurfaceVariant }}
            >
              {collapsedText}
            </Text>
          ) : (
            <>
              {!!notes && <Text testID="exercise-notes">{notes}</Text>}
              {!!notes && (!!blueprintNotes || !!previousNotes) ? (
                <Divider />
              ) : null}
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

        {!expanded ? (
          <Icon source="unfoldMore" size={18} color={colors.onSurfaceVariant} />
        ) : null}
      </Card.Content>
    </Card>
  );
}
