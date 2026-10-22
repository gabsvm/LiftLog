import { spacing } from '@/hooks/useAppTheme';
import { ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { FlatGrid } from 'react-native-super-grid';

export function SingleValueStatisticsGrid(props: { children: ReactNode[] }) {
  const gridSpacing = spacing[2];
  const { width } = useWindowDimensions();
  const maxColumns = width >= 1000 ? 4 : width >= 700 ? 3 : width < 360 ? 1 : 2;
  return (
    <FlatGrid
      scrollEnabled={false}
      data={props.children}
      spacing={gridSpacing}
      maxItemsPerRow={maxColumns}
      style={{ marginHorizontal: -gridSpacing }}
      renderItem={({ item }) => <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-start' }}>{item}</View>}
    />
  );
}
