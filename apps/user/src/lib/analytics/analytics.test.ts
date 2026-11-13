import { afterEach, expect, test } from 'vitest';

import {
  configureAnalytics,
  createBufferAnalyticsSink,
  identify,
  resetAnalytics,
  track,
} from '~/lib/analytics/analytics';

afterEach(() => {
  resetAnalytics();
});

test('track routes to the configured sink with name / properties / timestamp', () => {
  const sink = createBufferAnalyticsSink();
  configureAnalytics(sink, { now: () => 5 });
  track('product_created', { id: 'p1' });
  expect(sink.events[0]).toEqual({
    name: 'product_created',
    properties: { id: 'p1' },
    timestamp: 5,
  });
});

test('identify routes the user to the sink', () => {
  const sink = createBufferAnalyticsSink();
  configureAnalytics(sink);
  identify({ id: 'u1', traits: { plan: 'pro' } });
  expect(sink.users[0]?.id).toBe('u1');
});

test('filter drops sampled-out events', () => {
  const sink = createBufferAnalyticsSink();
  configureAnalytics(sink, { filter: (event) => event.name !== 'ignored' });
  track('kept');
  track('ignored');
  expect(sink.events).toHaveLength(1);
  expect(sink.events[0]?.name).toBe('kept');
});

test('reset returns to a no-op sink', () => {
  const sink = createBufferAnalyticsSink();
  configureAnalytics(sink);
  resetAnalytics();
  track('after');
  expect(sink.events).toHaveLength(0);
});
