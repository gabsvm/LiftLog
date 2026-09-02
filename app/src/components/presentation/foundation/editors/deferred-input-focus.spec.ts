import { describe, expect, it, vi } from 'vitest';
import { scheduleDeferredInputFocus } from './deferred-input-focus';

describe('scheduleDeferredInputFocus', () => {
  it('defers focus until the scheduled interaction callback runs', () => {
    const focus = vi.fn();
    let scheduled: (() => void) | undefined;
    const cancel = vi.fn();

    scheduleDeferredInputFocus(
      { current: { focus } },
      (callback) => {
        scheduled = callback;
        return { cancel };
      },
    );

    expect(focus).not.toHaveBeenCalled();

    scheduled?.();

    expect(focus).toHaveBeenCalledTimes(1);
  });

  it('returns a cleanup that cancels pending focus work', () => {
    const cancel = vi.fn();

    const cleanup = scheduleDeferredInputFocus(
      { current: { focus: vi.fn() } },
      () => ({ cancel }),
    );

    cleanup();

    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('does not fail if the input is gone before the deferred callback runs', () => {
    let scheduled: (() => void) | undefined;
    const ref: { current: { focus: () => void } | null } = {
      current: { focus: vi.fn() },
    };

    scheduleDeferredInputFocus(ref, (callback) => {
      scheduled = callback;
      return { cancel: vi.fn() };
    });

    ref.current = null;

    expect(() => scheduled?.()).not.toThrow();
  });
});
