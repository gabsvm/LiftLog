import { describe, expect, it, vi } from 'vitest';
import { scheduleDeferredInputFocus } from './deferred-input-focus';

describe('scheduleDeferredInputFocus', () => {
  it('does not focus before the scheduled interaction callback runs', () => {
    const focus = vi.fn();
    let scheduled: (() => void) | undefined;
    const cleanup = scheduleDeferredInputFocus({ current: { focus } }, (callback) => {
      scheduled = callback;
      return { cancel: vi.fn() };
    });

    expect(focus).not.toHaveBeenCalled();
    scheduled?.();
    expect(focus).toHaveBeenCalledOnce();
    cleanup();
  });

  it('cancels the pending task and ignores a late callback after close', () => {
    const cancel = vi.fn();
    const focus = vi.fn();
    let scheduled: (() => void) | undefined;
    const cleanup = scheduleDeferredInputFocus({ current: { focus } }, (callback) => {
      scheduled = callback;
      return { cancel };
    });

    cleanup();
    expect(cancel).toHaveBeenCalledOnce();
    scheduled?.();
    expect(focus).not.toHaveBeenCalled();
  });

  it('does nothing if the input has unmounted before focus runs', () => {
    const focus = vi.fn();
    let scheduled: (() => void) | undefined;
    const ref: { current: { focus: () => void } | null } = { current: { focus } };

    scheduleDeferredInputFocus(ref, (callback) => {
      scheduled = callback;
      return { cancel: vi.fn() };
    });

    ref.current = null;
    expect(() => scheduled?.()).not.toThrow();
    expect(focus).not.toHaveBeenCalled();
  });
});
