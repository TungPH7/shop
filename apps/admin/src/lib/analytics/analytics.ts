// Product-analytics seam. Like the logger sink and the monitoring transport, the
// destination is pluggable: dev → console, production → Segment / GA4 / PostHog
// via `configureAnalytics`, WITHOUT changing the `track`/`identify` call sites.
//
// Adapted from the user's MFE `observability` package, simplified for a single
// SPA: we call `track()` directly. That package routes through an event-bus only
// because multiple remotes share one host's analytics — indirection a single
// SPA does not need.

export interface AnalyticsEvent {
  /** snake_case event name, e.g. `product_created`. */
  readonly name: string;
  readonly properties?: Record<string, unknown> | undefined;
  /** epoch ms, stamped at capture. */
  readonly timestamp: number;
}

export interface AnalyticsUser {
  readonly id: string;
  readonly traits?: Record<string, unknown>;
}

export interface AnalyticsSink {
  track(event: AnalyticsEvent): void;
  identify(user: AnalyticsUser): void;
}

export interface AnalyticsOptions {
  /** Return false to drop an event (sampling / consent / kill-switch). */
  filter?: (event: AnalyticsEvent) => boolean;
  /** Injectable clock for deterministic tests. */
  now?: () => number;
}

const noopSink: AnalyticsSink = {
  track() {
    /* no-op until a provider is configured */
  },
  identify() {
    /* no-op until a provider is configured */
  },
};

let currentSink: AnalyticsSink = noopSink;
let currentFilter: ((event: AnalyticsEvent) => boolean) | undefined;
let now: () => number = Date.now;

export function configureAnalytics(sink: AnalyticsSink, options: AnalyticsOptions = {}): void {
  currentSink = sink;
  currentFilter = options.filter;
  now = options.now ?? Date.now;
}

export function resetAnalytics(): void {
  currentSink = noopSink;
  currentFilter = undefined;
  now = Date.now;
}

export function track(name: string, properties?: Record<string, unknown>): void {
  const event: AnalyticsEvent = { name, properties, timestamp: now() };
  if (currentFilter && !currentFilter(event)) return;
  currentSink.track(event);
}

export function identify(user: AnalyticsUser): void {
  currentSink.identify(user);
}

// Default dev sink — prints events; production swaps in a real provider.
export const consoleAnalyticsSink: AnalyticsSink = {
  track(event) {
    console.debug('[analytics] track', event.name, event.properties ?? {});
  },
  identify(user) {
    console.debug('[analytics] identify', user.id);
  },
};

// In-memory sink for tests.
export function createBufferAnalyticsSink(): AnalyticsSink & {
  readonly events: AnalyticsEvent[];
  readonly users: AnalyticsUser[];
} {
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
