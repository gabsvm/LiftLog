/**
 * Provide a bounded set of one-tap rep counts, even when the exercise target
 * is large. The text input always allows any nonnegative integer.
 */
export function getQuickRepOptions(target: number, current?: number): number[] {
  const normalizedTarget = Number.isSafeInteger(target) ? Math.max(0, target) : 0;
  const options =
    normalizedTarget <= 10
      ? Array.from({ length: normalizedTarget + 3 }, (_, count) => count)
      : [0, 1, 2, 3, ...Array.from({ length: 5 }, (_, offset) => normalizedTarget - 2 + offset)];

  if (current !== undefined && Number.isSafeInteger(current) && current >= 0) {
    options.push(current);
  }
  return [...new Set(options.filter((count) => Number.isSafeInteger(count) && count >= 0))].sort((a, b) => a - b);
}
