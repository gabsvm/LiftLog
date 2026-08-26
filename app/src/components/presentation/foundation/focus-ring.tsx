import { useAppTheme, spacing } from '@/hooks/useAppTheme';
import { ReactNode, useEffect, useRef } from 'react';
import { View, ViewProps, Animated, Easing } from 'react-native';

export const ANIMATION_DURATION = 180;

export default function FocusRing({
  isSelected,
  children,
  radius,
  style,
  padding,
  ...rest
}: {
  isSelected: boolean;
  children: ReactNode;
  radius?: number;
  padding?: number;
} & ViewProps) {
  const { colors } = useAppTheme();
  padding ??= 5;

  const growAnim = useRef(new Animated.Value(isSelected ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(growAnim, {
      toValue: isSelected ? 1 : 0,
      duration: ANIMATION_DURATION,
      easing: Easing.out(Easing.cubic),
      // The previous implementation animated top/bottom/left/right and border
      // width on JS for 600ms after every set. Opacity/scale can run entirely on
      // the native driver, keeping set interactions responsive on slower phones.
      useNativeDriver: true,
    }).start();
  }, [isSelected, growAnim]);

  const scale = growAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.97, 1],
  });

  return (
    <View style={style}>
      <Animated.View
        pointerEvents="none"
        style={{
          borderColor: colors.outline,
          position: 'absolute',
          top: -padding,
          bottom: -padding,
          left: -padding,
          right: -padding,
          opacity: growAnim,
          transform: [{ scale }],
          borderRadius: radius ?? spacing[14],
          borderWidth: 3,
        }}
        {...rest}
      />
      {children}
    </View>
  );
}
