import { afterEach, expect, test, vi } from 'vitest';

import {
  configureAnalytics,
  createBufferAnalyticsSink,
  resetAnalytics,
} from '~/lib/analytics/analytics';
import { renderWithProviders } from '~/testing/render';

import { WebVitals, type WebVitalMetric } from '~/components/web-vitals';

// `useReportWebVitals` của Next bị mock để bắt callback rồi tự gọi với metric giả → kiểm tra metric
// chảy đúng vào seam Analytics (dùng lại type `WebVitalMetric` export từ component).
let captured: ((metric: WebVitalMetric) => void) | undefined;

vi.mock('next/web-vitals', () => ({
  useReportWebVitals: (callback: (metric: WebVitalMetric) => void) => {
    captured = callback;
  },
}));

afterEach(() => {
  resetAnalytics();
  captured = undefined;
});

test('WebVitals forwards a metric to the analytics seam as a web_vital event', () => {
  const sink = createBufferAnalyticsSink();
  configureAnalytics(sink);

  renderWithProviders(<WebVitals />);
  expect(captured).toBeDefined();

  captured?.({ name: 'LCP', value: 1234, id: 'v1', rating: 'good', navigationType: 'navigate' });

  expect(sink.events).toHaveLength(1);
  expect(sink.events[0]?.name).toBe('web_vital');
  expect(sink.events[0]?.properties).toMatchObject({ name: 'LCP', value: 1234, rating: 'good' });
});
