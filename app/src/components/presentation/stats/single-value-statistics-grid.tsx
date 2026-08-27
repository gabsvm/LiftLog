import { spacing } from '@/hooks/useAppTheme';
import { Children, ReactNode } from 'react';
import { View } from 'react-native';

export function SingleValueStatisticsGrid(props: { children: ReactNode[] }) {
  const items = Children.toArray(props.children);
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing[2],
      }}
    >
      {items.map((item, index) => (
        <View
          key={index}
          style={{
            flexBasis: '48%',
            flexGrow: 1,
            minWidth: 0,
          }}
        >
          {item}
        </View>
      ))}
    </View>
  );
}
