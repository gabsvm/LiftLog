import type { AppThemeColors } from '@/hooks/useAppTheme';

export const gainsLabRadii = {
  hero: 20,
  card: 16,
  compact: 12,
  control: 12,
  focus: 20,
  pill: 999,
} as const;

export const gainsLabTouchTarget = {
  minimum: 48,
  primaryAction: 52,
} as const;

export const gainsLabMotion = {
  pressMs: 110,
  setCompletionMs: 140,
  progressMs: 200,
  modalMs: 240,
} as const;

type GainsLabOverlayColors = Pick<
  AppThemeColors,
  'surfaceContainerHigh' | 'surfaceContainerHighest' | 'outlineVariant'
>;

export function getGainsLabDialogStyle(colors: GainsLabOverlayColors) {
  return {
    backgroundColor: colors.surfaceContainerHigh,
    borderColor: colors.outlineVariant,
    borderRadius: gainsLabRadii.focus,
    borderWidth: 1,
  };
}

export function getGainsLabMenuStyle(colors: GainsLabOverlayColors) {
  return {
    backgroundColor: colors.surfaceContainerHighest,
    borderColor: colors.outlineVariant,
    borderRadius: gainsLabRadii.compact,
    borderWidth: 1,
  };
}
