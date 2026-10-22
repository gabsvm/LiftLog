import { describe, expect, it } from 'vitest';
import { getQuickRepOptions } from './quick-rep-options';

describe('getQuickRepOptions', () => {
  it('preserves convenient one-tap entry for ordinary rep targets', () => {
    expect(getQuickRepOptions(8)).toEqual(Array.from({ length: 11 }, (_, i) => i));
  });

  it('bounds button count for large rep targets', () => {
    const options = getQuickRepOptions(10_000);
    expect(options.length).toBeLessThanOrEqual(10);
    expect(options).toContain(10_000);
    expect(options).toContain(10_002);
  });

  it('keeps a previously entered rep count available', () => {
    expect(getQuickRepOptions(30, 17)).toContain(17);
    expect(getQuickRepOptions(30, 30).filter((value) => value === 30)).toHaveLength(1);
  });

  it('handles invalid targets without allocating an unbounded array', () => {
    expect(getQuickRepOptions(Number.POSITIVE_INFINITY)).toEqual([0, 1, 2]);
    expect(getQuickRepOptions(-500)).toEqual([0, 1, 2]);
  });
});
