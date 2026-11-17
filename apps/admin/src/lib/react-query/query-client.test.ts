import { describe, expect, it } from 'vitest';

import { createQueryClient } from './query-client';

describe('createQueryClient', () => {
  it('sends every write even when the browser says it is offline, so none waits for the network (NFR19)', () => {
    const options = createQueryClient().getDefaultOptions();

    expect(options.mutations?.networkMode).toBe('always');
  });

  it('leaves reads on the default network mode, paused while offline', () => {
    const options = createQueryClient().getDefaultOptions();

    expect(options.queries).not.toHaveProperty('networkMode');
  });

  it('never retries a write', () => {
    expect(createQueryClient().getDefaultOptions().mutations?.retry).toBe(false);
  });
});
