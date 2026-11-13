import { configureAnalytics, consoleAnalyticsSink, track } from '@/lib/analytics/analytics';
import { logger } from '@/lib/logger/app-logger';
import {
  captureException,
  configureMonitoring,
  createLoggerMonitoringTransport,
} from '@/lib/monitoring/monitoring';

// Bootstrap observability ONCE before render (Vercel `advanced-init-once`):
//   1) route the monitoring seam through the env-gated app logger,
//   2) enable analytics to the console in development,
//   3) install global handlers for errors the React boundaries CANNOT catch —
//      uncaught errors and unhandled promise rejections (event handlers, async
//      code). Together with folder 12's boundaries this closes the loop: React
//      render crashes → boundary; everything else → these handlers.
//
// AT DEPLOY this is the ONLY file that changes to plug in real providers:
//   import * as Sentry from '@sentry/react';
//   Sentry.init({ dsn: env.sentryDsn, integrations: [Sentry.browserTracingIntegration()] });
//   configureMonitoring({
//     captureException: (e, c) => Sentry.captureException(e, { extra: c }),
//     captureMessage:   (m, l, c) => Sentry.captureMessage(m, { level: l, extra: c }),
//     setUser:          (u) => Sentry.setUser(u),
//     addBreadcrumb:    (b) => Sentry.addBreadcrumb(b),
//   });
//   configureAnalytics(segmentSink);
export function setupObservability(): void {
  configureMonitoring(createLoggerMonitoringTransport(logger));

  if (import.meta.env.DEV) {
    configureAnalytics(consoleAnalyticsSink);
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
      captureException(event.error, { source: 'window.onerror', message: event.message });
    });
    window.addEventListener('unhandledrejection', (event) => {
      captureException(event.reason, { source: 'unhandledrejection' });
    });
  }

  logger.info('app.boot', { mode: import.meta.env.MODE });
  track('app_opened', { mode: import.meta.env.MODE });
}
