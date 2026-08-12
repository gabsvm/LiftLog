import { useAppTheme } from '@/hooks/useAppTheme';
import { ActivityIndicator } from 'react-native';

export function IndeterminateProgress() {
  const { colors } = useAppTheme();
  return <ActivityIndicator size="small" color={colors.primary} />;
}
