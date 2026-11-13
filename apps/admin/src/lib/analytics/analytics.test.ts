import { afterEach, describe, expect, it } from 'vitest';

import {
  configureAnalytics,
  createBufferAnalyticsSink,
  identify,
  resetAnalytics,
  track,
} from './analytics';

describe('analytics seam', () => {
  afterEach(() => {
    resetAnalytics();
  });

  it('track routes to the configured sink with name/props/timestamp', () => {
    const sink = createBufferAnalyticsSink();
    configureAnalytics(sink, { now: () => 5 });
    track('product_created', { id: 'p1' });
    expect(sink.events[0]).toEqual({
      name: 'product_created',
      properties: { id: 'p1' },
      timestamp: 5,
    });
  });

  it('identify routes to the sink', () => {
    const sink = createBufferAnalyticsSink();
    configureAnalytics(sink);
    identify({ id: 'u1', traits: { plan: 'pro' } });
    expect(sink.users[0]?.id).toBe('u1');
  });

  it('filter drops sampled-out events', () => {
    const sink = createBufferAnalyticsSink();
    configureAnalytics(sink, { filter: (event) => event.name !== 'ignored' });
    track('kept');
    track('ignored');
    expect(sink.events).toHaveLength(1);
    expect(sink.events[0]?.name).toBe('kept');
  });

  it('reset returns to a no-op sink', () => {
    const sink = createBufferAnalyticsSink();
    configureAnalytics(sink);
    resetAnalytics();
    track('after');
    expect(sink.events).toHaveLength(0);
  });
});
