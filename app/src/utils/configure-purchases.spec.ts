import { describe, expect, it, vi } from 'vitest';
import { configurePurchasesIfAvailable } from './configure-purchases';

describe('configurePurchasesIfAvailable', () => {
  it('continues startup when the API key is not present', async () => {
    const configure = vi.fn();
    const log = vi.fn();

    expect(await configurePurchasesIfAvailable(undefined, configure, log)).toBe(false);
    expect(await configurePurchasesIfAvailable(' ', configure, log)).toBe(false);
    expect(configure).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledTimes(2);
  });

  it('configures the SDK when a key is present', async () => {
    const configure = vi.fn();
    const log = vi.fn();

    expect(await configurePurchasesIfAvailable('test-key', configure, log)).toBe(true);
    expect(configure).toHaveBeenCalledExactlyOnceWith('test-key');
    expect(log).not.toHaveBeenCalled();
  });

  it('does not block startup when SDK configuration throws', async () => {
    const configure = vi.fn(() => {
      throw new Error('Invalid API key');
    });
    const log = vi.fn();

    expect(await configurePurchasesIfAvailable('bad-key', configure, log)).toBe(false);
    expect(log).toHaveBeenCalledTimes(1);
  });

  it('also handles asynchronous SDK failures', async () => {
    const configure = vi.fn().mockRejectedValue(new Error('Unavailable'));
    const log = vi.fn();

    expect(await configurePurchasesIfAvailable('test-key', configure, log)).toBe(false);
    expect(log).toHaveBeenCalledTimes(1);
  });
});
