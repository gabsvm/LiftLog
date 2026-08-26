/* eslint-disable no-restricted-imports */
import { GesturePressableProps } from '@/components/presentation/foundation/gesture-wrappers/pressable-props';
import { AppIconSource } from '@/components/presentation/foundation/ms-icon-source';
import {
  Button as NativeButton,
  ButtonProps as PaperButtonProps,
} from 'react-native-paper';

export type ButtonProps = {
  icon?: AppIconSource;
} & Omit<PaperButtonProps, 'icon'>;

export default function Button({
  onPress,
  onLongPress,
  disabled,
  ...rest
}: GesturePressableProps<ButtonProps>) {
  return (
    <NativeButton
      disabled={disabled}
      onPress={onPress}
      onLongPress={onLongPress}
      {...rest}
    />
  );
}
