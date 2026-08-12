import Icon from '@/components/presentation/foundation/gesture-wrappers/icon';
import { AppIconSource } from '@/components/presentation/foundation/ms-icon-source';
import { spacing, useAppTheme } from '@/hooks/useAppTheme';
import { ReactNode } from 'react';
import { View } from 'react-native';
import { Card, Text } from 'react-native-paper';

export default function SingleValueStatisticCard(props: {
  title: string;
  value: string | ReactNode;
  icon: AppIconSource;
}) {
  const { colors } = useAppTheme();
  return (
    <Card mode="contained" style={{ flex: 1 }}>
      <Card.Content
        style={{
          gap: spacing[3],
          minHeight: 116,
          justifyContent: 'space-between',
          padding: spacing[4],
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing[2],
          }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.primaryContainer,
            }}
          >
            <Icon size={17} source={props.icon} color={colors.primary} />
          </View>
          <Text
            variant="labelMedium"
            style={{ color: colors.onSurfaceVariant, flex: 1 }}
            numberOfLines={2}
          >
            {props.title}
          </Text>
        </View>
        <Text variant="titleLarge" style={{ fontWeight: '800' }}>
          {props.value}
        </Text>
      </Card.Content>
    </Card>
  );
}
