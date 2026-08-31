import Button from '@/components/presentation/foundation/gesture-wrappers/button';
import { T } from '@tolgee/react';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

import { Portal, TextInput } from 'react-native-paper';
import { GainsLabDialog } from '@/components/presentation/foundation/gainslab-overlays';

export default function RecordedExerciseNotesEditor(props: {
  exerciseName: string;
  open: boolean;
  notes: string | undefined;
  onUpdateNotes: (n: string) => void;
  onDismiss: () => void;
}) {
  const { open, notes, onUpdateNotes, onDismiss, exerciseName } = props;
  const [editorNotes, setEditorNotes] = useState(notes ?? '');

  useEffect(() => {
    setEditorNotes(notes || '');
  }, [notes]);
  return (
    open && (
      <Portal>
        <KeyboardAvoidingView
          behavior={'height'}
          style={{
            flex: 1,
            pointerEvents: open ? 'box-none' : 'none',
          }}
        >
          <GainsLabDialog visible={open} onDismiss={onDismiss}>
            <GainsLabDialog.Title>
              <T
                keyName="workout.notes_for.title"
                params={{ name: exerciseName }}
              />
            </GainsLabDialog.Title>
            <GainsLabDialog.Content>
              <TextInput
                defaultValue={editorNotes}
                multiline
                mode="outlined"
                numberOfLines={6}
                onChangeText={setEditorNotes}
              />
            </GainsLabDialog.Content>
            <GainsLabDialog.Actions>
              <Button
                testID="cancel-notes"
                onPress={() => {
                  onDismiss();
                  setEditorNotes(notes || '');
                }}
              >
                <T keyName="generic.cancel.button" />
              </Button>
              <Button
                testID="save-notes"
                onPress={() => {
                  onUpdateNotes(editorNotes);
                  onDismiss();
                }}
              >
                <T keyName="generic.save.button" />
              </Button>
            </GainsLabDialog.Actions>
          </GainsLabDialog>
        </KeyboardAvoidingView>
      </Portal>
    )
  );
}
