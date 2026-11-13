import {
  consoleSink,
  createLogger,
  type Logger,
  type LogFields,
  type LogLevel,
} from '@/lib/logger/logger';

export interface MonitoringUser {
  readonly id: string;
  readonly email?: string;
}

export interface Breadcrumb {
  readonly category: string;
  readonly message: string;
  readonly level?: LogLevel;
  readonly data?: LogFields;
}

// The observability boundary (Sentry-ready). Swapping the transport sends
// exceptions / messages / user-context anywhere (Sentry, console, a buffer in
// tests) WITHOUT touching call sites — the same DI-seam idea as the API auth
// bridge (folder 07). `lib/*` never imports the Sentry SDK directly: it stays
// behind this interface so it is swappable, tree-shakeable and testable.
export interface MonitoringTransport {
  captureException(error: unknown, context?: LogFields): void;
  captureMessage(message: string, level?: LogLevel, context?: LogFields): void;
  setUser(user: MonitoringUser | null): void;
  addBreadcrumb(breadcrumb: Breadcrumb): void;
}

// Adapts any Logger into a MonitoringTransport. This is the DEFAULT wiring: until
// a real provider (Sentry) is configured at deploy, observability routes through
// the leveled logger so nothing is ever swallowed silently.
export function createLoggerMonitoringTransport(logger: Logger): MonitoringTransport {
  return {
    captureException(error, context) {
      const message = error instanceof Error ? error.message : 'Non-Error exception captured';
      logger.error(message, { ...context, error });
    },
    captureMessage(message, level = 'info', context) {
      logger[level](message, context);
    },
    setUser(user) {
      logger.debug('monitoring.setUser', { user });
    },
    addBreadcrumb(breadcrumb) {
      logger.debug(`breadcrumb: ${breadcrumb.category}`, {
        message: breadcrumb.message,
        ...breadcrumb.data,
      });
    },
  };
}

// Env-free default keeps THIS module import-safe everywhere (tests/Node). The app
// upgrades it at bootstrap (app/observability) to the env-gated app logger.
function defaultTransport(): MonitoringTransport {
  return createLoggerMonitoringTransport(createLogger({ minLevel: 'info', sink: consoleSink }));
}

let currentTransport: MonitoringTransport = defaultTransport();

export function configureMonitoring(transport: MonitoringTransport): void {
  currentTransport = transport;
}

export function resetMonitoring(): void {
  currentTransport = defaultTransport();
}

// Convenience facade — call sites use these, not the transport directly.
export function captureException(error: unknown, context?: LogFields): void {
  currentTransport.captureException(error, context);
}

export function captureMessage(message: string, level?: LogLevel, context?: LogFields): void {
  currentTransport.captureMessage(message, level, context);
}

export function setMonitoringUser(user: MonitoringUser | null): void {
  currentTransport.setUser(user);
}

export function addBreadcrumb(breadcrumb: Breadcrumb): void {
  currentTransport.addBreadcrumb(breadcrumb);
}
