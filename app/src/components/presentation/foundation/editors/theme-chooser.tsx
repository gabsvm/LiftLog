import { ColorSchemeSeed } from '@/store/settings';
import { T, useTranslate } from '@tolgee/react';
import { List } from 'react-native-paper';
import Button from '@/components/presentation/foundation/gesture-wrappers/button';
import ListSwitch from '@/components/presentation/foundation/list-switch';

interface ThemeChooserProps {
  seed: ColorSchemeSeed;
  trueBlack: boolean;
  setTrueBlack: (t: boolean) => void;
  onUpdateTheme: (seed: ColorSchemeSeed) => void;
}

export default function ThemeChooser(props: ThemeChooserProps) {
  const { t } = useTranslate();

  return (
    <>
      <List.Item
        title={t('settings.theme.title')}
        right={() => (
          <Button
            mode={props.seed === 'default' ? 'contained-tonal' : 'text'}
            onPress={() => props.onUpdateTheme('default')}
          >
            <T keyName="generic.default.label" />
          </Button>
        )}
      />
      <ListSwitch
        headline={t('settings.app_configuration.true_black_dark_theme.title')}
        value={props.trueBlack}
        onValueChange={props.setTrueBlack}
      />
    </>
  );
}
