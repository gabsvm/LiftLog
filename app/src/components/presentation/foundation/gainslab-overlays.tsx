import { useAppTheme } from '@/hooks/useAppTheme';
import { ComponentProps } from 'react';
import { Dialog as PaperDialog, Menu as PaperMenu } from 'react-native-paper';
import {
  getGainsLabDialogStyle,
  getGainsLabMenuStyle,
} from './gainslab-ui';

export const GainsLabDialog = Object.assign(
  function GainsLabDialog({
    style,
    ...props
  }: ComponentProps<typeof PaperDialog>) {
    const { colors } = useAppTheme();
    return (
      <PaperDialog
        {...props}
        style={[getGainsLabDialogStyle(colors), style]}
      />
    );
  },
  {
    Title: PaperDialog.Title,
    Content: PaperDialog.Content,
    Actions: PaperDialog.Actions,
    ScrollArea: PaperDialog.ScrollArea,
    Icon: PaperDialog.Icon,
  },
);

export const GainsLabMenu = Object.assign(
  function GainsLabMenu({
    contentStyle,
    ...props
  }: ComponentProps<typeof PaperMenu>) {
    const { colors } = useAppTheme();
    return (
      <PaperMenu
        {...props}
        mode="flat"
        contentStyle={[getGainsLabMenuStyle(colors), contentStyle]}
      />
    );
  },
  { Item: PaperMenu.Item },
);
