import {
  getGainsLabDialogStyle,
  getGainsLabMenuStyle,
} from './gainslab-ui';
import { describe, expect, it } from 'vitest';

describe('GainsLab overlay styles', () => {
  const colors = {
    surfaceContainerHigh: '#1B1F1C',
    surfaceContainerHighest: '#252A26',
    outlineVariant: '#41483F',
  };

  it('uses the GainsLab dialog surface and focus radius', () => {
    expect(getGainsLabDialogStyle(colors)).toEqual({
      backgroundColor: colors.surfaceContainerHigh,
      borderColor: colors.outlineVariant,
      borderRadius: 20,
      borderWidth: 1,
    });
  });

  it('uses a distinct elevated surface for menus', () => {
    expect(getGainsLabMenuStyle(colors)).toEqual({
      backgroundColor: colors.surfaceContainerHighest,
      borderColor: colors.outlineVariant,
      borderRadius: 12,
      borderWidth: 1,
    });
  });
});
