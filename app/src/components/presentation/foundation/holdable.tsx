import { triggerClickHaptic } from '~/modules/native-lib/src/ReactNativeHapticsModule';
import { ReactNode, useCallback, useMemo } from 'react';
import { View, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

export type HoldableProps = {
  children: ReactNode;
  onLongPress: () => void;
  duration?: number;
  disabled?: boolean;
  style?: ViewStyle;
};

/**
 * Long-press wrapper for the few controls which genuinely need hold behavior.
 *
 * The previous implementation started an animation and a slow-rise haptic on
 * every pointer-down, even when the interaction ended as a normal tap/scroll.
 * That forced JS/native work onto the hottest touch path in the workout. Keep
 * the recognizer native and only cross to JS once a real long press succeeds.
 */
export default function Holdable({
  children,
  onLongPress,
  duration = 500,
  style,
  disabled,
}: HoldableProps) {
  const handleLongPress = useCallback(() => {
    triggerClickHaptic();
    onLongPress();
  }, [onLongPress]);

  const gesture = useMemo(
    () =>
      disabled
        ? Gesture.Manual()
        : Gesture.LongPress()
            .minDuration(duration)
            .runOnJS(true)
            .onStart(handleLongPress),
    [disabled, duration, handleLongPress],
  );

  return (
    <GestureDetector gesture={gesture}>
      <View style={style}>{children}</View>
    </GestureDetector>
  );
}
