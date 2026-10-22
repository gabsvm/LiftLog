import { spacing, useAppTheme } from '@/hooks/useAppTheme';
import { PotentialSet } from '@/models/session-models';
import { T } from '@tolgee/react';
import { useEffect, useRef } from 'react';
import { InteractionManager, TextInput as NativeTextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import IconButton from '@/components/presentation/foundation/icon-button';
import { Chip, Dialog, Portal, TextInput } from 'react-native-paper';
import Button from '@/components/presentation/foundation/button';
import { useDerivedState } from '@/hooks/useDerivedState';
import { scheduleDeferredInputFocus } from '@/components/presentation/foundation/editors/deferred-input-focus';
import { getQuickRepOptions } from './quick-rep-options';

interface PotentialSetAdditionalActionsDialogProps {
  open: boolean;
  set: PotentialSet;
  repTarget: number;
  updateRepCount: (reps: number | undefined) => void;
  close: () => void;
}

export default function PotentialSetAdditionalActionsDialog({
  close,
  open,
  set,
  updateRepCount,
  repTarget,
}: PotentialSetAdditionalActionsDialogProps) {
  const { colors } = useAppTheme();
  const inputRef = useRef<NativeTextInput>(null);

  useEffect(() => {
    if (!open) return;
    return scheduleDeferredInputFocus(inputRef, (callback) => InteractionManager.runAfterInteractions(callback));
  }, [open]);
  const originalReps = set?.set?.repsCompleted;

  const [repCountText, setRepCountText] = useDerivedState(originalReps, (r) => r?.toString() ?? '');
  const parsedRepCount = Number(repCountText);
  const isValid = !repCountText || (Number.isSafeInteger(parsedRepCount) && parsedRepCount >= 0);
  const quickRepOptions = getQuickRepOptions(repTarget, isValid && repCountText ? parsedRepCount : undefined);

  const save = () => {
    if (!isValid) {
      return;
    }

    updateRepCount(repCountText ? parsedRepCount : undefined);
    close();
  };
  return (
    open && (
      <Portal>
        <KeyboardAvoidingView behavior={'height'} style={{ flex: 1, pointerEvents: open ? 'box-none' : 'none' }}>
          <Dialog visible={open} onDismiss={close}>
            <Dialog.Title>
              <T keyName="exercise.select_reps.title" />
            </Dialog.Title>
            <Dialog.Content>
              <TextInput
                ref={inputRef}
                label={<T keyName="exercise.reps.label" />}
                inputMode="numeric"
                value={repCountText}
                selectTextOnFocus
                error={!isValid}
                onChangeText={setRepCountText}
              />

              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: spacing[1],
                  paddingTop: spacing[2],
                }}
              >
                {quickRepOptions.map((count) => (
                  <Chip
                    key={count}
                    mode="outlined"
                    compact
                    selected={repCountText === String(count)}
                    showSelectedCheck={false}
                    selectedColor={colors.primary}
                    testID={`quick-reps-${count}`}
                    style={{ minHeight: 48, justifyContent: 'center' }}
                    onPress={() => {
                      setRepCountText(String(count));
                      updateRepCount(count);
                      close();
                    }}
                  >
                    {count}
                  </Chip>
                ))}
                <IconButton
                  mode="contained"
                  iconColor={colors.error}
                  containerColor={colors.errorContainer}
                  icon={'close'}
                  onPress={() => {
                    setRepCountText('');
                    updateRepCount(undefined);
                    close();
                  }}
                />
              </View>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={close}>{<T keyName="generic.cancel.button" />}</Button>
              <Button disabled={!isValid} onPress={save}>
                {<T keyName="generic.save.button" />}
              </Button>
            </Dialog.Actions>
          </Dialog>
        </KeyboardAvoidingView>
      </Portal>
    )
  );
}
