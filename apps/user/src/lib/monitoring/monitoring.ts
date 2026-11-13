import { logger } from '~/lib/logger/app-logger';
import { type LogFields, type Logger, type LogLevel } from '~/lib/logger/logger';

// Tầng MONITORING — báo cáo LỖI/sự cố để triage (Sentry-ready). KHÁC tầng Log (chẩn đoán chung) và
// Analytics (đo lường sản phẩm): Monitoring là AN TOÀN-CRITICAL — không bao giờ nuốt lỗi. Mặc định
// định tuyến qua Logger (0-dep); deploy đổi sang Sentry = thay MỘT transport, call-site không đổi.

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

/**
 * SEAM của tầng monitoring (DI). Core (`lib/*`, feature, app) chỉ gọi facade `captureException`…
 * bên dưới — KHÔNG bao giờ import SDK vendor trực tiếp. Cắm Sentry = `configureMonitoring(adapter)`.
 */
export interface MonitoringTransport {
  captureException(error: unknown, context?: LogFields): void;
  captureMessage(message: string, level?: LogLevel, context?: LogFields): void;
  setUser(user: MonitoringUser | null): void;
  addBreadcrumb(breadcrumb: Breadcrumb): void;
}

/**
 * Transport MẶC ĐỊNH (0-dep): định tuyến mọi thứ qua Logger. Exception → `logger.error` (kèm cả
 * Error gốc trong fields để `errorReplacer` của consoleSink giữ stack). Nhờ vậy ngay khi CHƯA cắm
 * vendor, lỗi server vẫn ra log có cấu trúc — không "mất tích".
 */
export function createLoggerMonitoringTransport(log: Logger): MonitoringTransport {
  return {
    captureException(error, context) {
      const message = error instanceof Error ? error.message : 'Non-Error exception captured';
      log.error(message, { ...context, error });
    },
    captureMessage(message, level = 'info', context) {
      log[level](message, context);
    },
    setUser(user) {
      log.debug('monitoring.setUser', { user });
    },
    addBreadcrumb(breadcrumb) {
      log.debug(`breadcrumb:${breadcrumb.category}`, {
        message: breadcrumb.message,
        ...breadcrumb.data,
      });
    },
  };
}

// State DI ở module-level: 1 transport hiện hành cho cả app. Default = logger-backed.
let currentTransport: MonitoringTransport = createLoggerMonitoringTransport(logger);

/** Đổi transport (vd deploy: cắm Sentry). MỘT chỗ duy nhất thay đổi để swap vendor. */
export function configureMonitoring(transport: MonitoringTransport): void {
  currentTransport = transport;
}

/** Trả về default (logger-backed). Dùng trong test `afterEach` để các test độc lập. */
export function resetMonitoring(): void {
  currentTransport = createLoggerMonitoringTransport(logger);
}

// --- Facade: API app gọi (không bao giờ chạm `currentTransport`/SDK trực tiếp) -------------------
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
