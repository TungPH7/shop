import { describe, expect, it } from 'vitest';

import { createTestQueryClient } from '@/testing/render';

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

describe('createTestQueryClient', () => {
  it('runs the writes of a test with the network mode of the app', () => {
    expect(createTestQueryClient().getDefaultOptions().mutations?.networkMode).toBe(
      createQueryClient().getDefaultOptions().mutations?.networkMode,
    );
  });
});
