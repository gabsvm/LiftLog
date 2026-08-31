import { CardioTrackerCard } from '@/components/presentation/workout/cardio/cardio-tracker-card';
import Button from '@/components/presentation/foundation/gesture-wrappers/button';
import { useAppTheme, font } from '@/hooks/useAppTheme';
import { T } from '@tolgee/react';
import { ReactNode, useState } from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Portal, Text } from 'react-native-paper';
import { GainsLabDialog } from '@/components/presentation/foundation/gainslab-overlays';

export function CardioValueSelector(props: {
  children: ReactNode;
  buttonText: string;
  label: string;
  onSave: () => void;
  onButtonPress: () => void;
  onHold: () => void;
  style?: ViewStyle;
}) {
  const { buttonText, children, label, onButtonPress, onHold, onSave } = props;
  const { colors } = useAppTheme();
  const [dialogOpen, setDialogOpen] = useState(false);
  return (
    <CardioTrackerCard onHold={onHold}>
      <Button
        mode="text"
        labelStyle={font['text-xl']}
        onPress={() => {
          onButtonPress();
          setDialogOpen(true);
        }}
      >
        {buttonText}
      </Button>
      <Text style={[styles.bigText, { color: colors.onSecondaryContainer }]}>
        {label}
      </Text>
      {dialogOpen && (
        <Portal>
          <KeyboardAvoidingView
            behavior={'height'}
            style={{ flex: 1, pointerEvents: dialogOpen ? 'box-none' : 'none' }}
          >
            <GainsLabDialog visible={dialogOpen} onDismiss={() => setDialogOpen(false)}>
              <GainsLabDialog.Title>{label}</GainsLabDialog.Title>
              <GainsLabDialog.Content
                style={[
                  { flexDirection: 'row', alignItems: 'center' },
                  props.style,
                ]}
              >
                {children}
              </GainsLabDialog.Content>
              <GainsLabDialog.Actions>
                <Button onPress={() => setDialogOpen(false)}>
                  <T keyName="generic.cancel.button" />
                </Button>
                <Button
                  onPress={() => {
                    setDialogOpen(false);
                    onSave();
                  }}
                >
                  <T keyName="generic.save.button" />
                </Button>
              </GainsLabDialog.Actions>
            </GainsLabDialog>
          </KeyboardAvoidingView>
        </Portal>
      )}
    </CardioTrackerCard>
  );
}

const styles = StyleSheet.create({
  bigText: {
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    ...font['text-xl'],
  },
});
