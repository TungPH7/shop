import { afterEach, expect, test, vi } from 'vitest';

import { createBufferSink, createLogger } from '~/lib/logger/logger';
import {
  addBreadcrumb,
  captureException,
  captureMessage,
  configureMonitoring,
  createLoggerMonitoringTransport,
  type MonitoringTransport,
  resetMonitoring,
  setMonitoringUser,
} from '~/lib/monitoring/monitoring';

afterEach(() => {
  resetMonitoring();
});

function fakeTransport() {
  return {
    captureException: vi.fn(),
    captureMessage: vi.fn(),
    setUser: vi.fn(),
    addBreadcrumb: vi.fn(),
  } satisfies MonitoringTransport;
}

test('facade routes every call to the configured transport', () => {
  const transport = fakeTransport();
  configureMonitoring(transport);
  const error = new Error('boom');

  captureException(error, { source: 'test' });
  captureMessage('hi', 'warn', { k: 1 });
  setMonitoringUser({ id: '1' });
  addBreadcrumb({ category: 'nav', message: 'click' });

  expect(transport.captureException).toHaveBeenCalledWith(error, { source: 'test' });
  expect(transport.captureMessage).toHaveBeenCalledWith('hi', 'warn', { k: 1 });
  expect(transport.setUser).toHaveBeenCalledWith({ id: '1' });
  expect(transport.addBreadcrumb).toHaveBeenCalledWith({ category: 'nav', message: 'click' });
});

test('logger-backed transport writes exceptions to the logger at error level', () => {
  const sink = createBufferSink();
  configureMonitoring(createLoggerMonitoringTransport(createLogger({ minLevel: 'debug', sink })));
  captureException(new Error('logged'));
  expect(sink.records).toHaveLength(1);
  expect(sink.records[0]?.level).toBe('error');
  expect(sink.records[0]?.message).toBe('logged');
});

test('logger-backed captureMessage maps the level through to the logger', () => {
  const sink = createBufferSink();
  configureMonitoring(createLoggerMonitoringTransport(createLogger({ minLevel: 'debug', sink })));
  captureMessage('careful', 'warn', { a: 1 });
  expect(sink.records[0]?.level).toBe('warn');
  expect(sink.records[0]?.fields).toMatchObject({ a: 1 });
});
