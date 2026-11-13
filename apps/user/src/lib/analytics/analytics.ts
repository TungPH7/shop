import { clientEnv } from '~/config/env/client';
import { logger } from '~/lib/logger/app-logger';

// Tầng ANALYTICS — sự kiện SẢN PHẨM (feature usage, Web Vitals, conversion…). KHÁC Monitoring:
// Monitoring = lỗi/triage (an toàn, KHÔNG bỏ sót); Analytics = đo lường, BEST-EFFORT (bỏ/sample
// được). Cùng kiểu seam: interface `AnalyticsSink` + DI → đổi GA/Segment/PostHog = đổi sink.

export interface AnalyticsEvent {
  readonly name: string;
  readonly properties?: Record<string, unknown> | undefined;
  readonly timestamp: number;
}

export interface AnalyticsUser {
  readonly id: string;
  readonly traits?: Record<string, unknown>;
}

/** SEAM của tầng analytics (DI). Deploy: viết sink cho GA/Segment/PostHog rồi `configureAnalytics`. */
export interface AnalyticsSink {
  track(event: AnalyticsEvent): void;
  identify(user: AnalyticsUser): void;
}

export interface AnalyticsOptions {
  /** Lọc/sample sự kiện (trả `false` = bỏ). */
  filter?: (event: AnalyticsEvent) => boolean;
  /** Tiêm clock cho test. */
  now?: () => number;
}

/** Bỏ mọi sự kiện — mặc định khi chưa cắm provider (prod chưa có vendor → không làm gì, an toàn). */
export const noopAnalyticsSink: AnalyticsSink = {
  track() {},
  identify() {},
};

/** Sink dev: in qua Logger để DEV thấy sự kiện mà không cần vendor. */
export const loggerAnalyticsSink: AnalyticsSink = {
  track(event) {
    logger.info('analytics.track', {
      event: event.name,
      properties: event.properties,
      timestamp: event.timestamp,
    });
  },
  identify(user) {
    logger.info('analytics.identify', { userId: user.id, traits: user.traits });
  },
};

export interface BufferAnalyticsSink extends AnalyticsSink {
  readonly events: AnalyticsEvent[];
  readonly users: AnalyticsUser[];
}

/** Sink test: gom sự kiện/user vào mảng để assert. */
export function createBufferAnalyticsSink(): BufferAnalyticsSink {
  const events: AnalyticsEvent[] = [];
  const users: AnalyticsUser[] = [];
  return {
    events,
    users,
    track(event) {
      events.push(event);
    },
    identify(user) {
      users.push(user);
    },
  };
}

// Mặc định theo môi trường: dev → in qua Logger (DEV thấy ngay); test/prod → noop (prod cắm vendor
// qua `configureAnalytics` lúc deploy). KHÔNG cần file bootstrap riêng như SPA (Next không có một
// `main.tsx` chung cho client) → default tự gate theo `NODE_ENV`.
let currentSink: AnalyticsSink =
  clientEnv.NODE_ENV === 'development' ? loggerAnalyticsSink : noopAnalyticsSink;
let currentOptions: AnalyticsOptions = {};

export function configureAnalytics(sink: AnalyticsSink, options: AnalyticsOptions = {}): void {
  currentSink = sink;
  currentOptions = options;
}

export function resetAnalytics(): void {
  currentSink = noopAnalyticsSink;
  currentOptions = {};
}

export function track(name: string, properties?: Record<string, unknown>): void {
  const now = currentOptions.now ?? (() => Date.now());
  const event: AnalyticsEvent = { name, properties, timestamp: now() };
  if (currentOptions.filter && !currentOptions.filter(event)) return; // sample-out
  currentSink.track(event);
}

export function identify(user: AnalyticsUser): void {
  currentSink.identify(user);
}
