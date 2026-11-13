import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBufferSink, createLogger } from '@/lib/logger/logger';

import { captureError } from './capture-error';
import {
  addBreadcrumb,
  captureException,
  captureMessage,
  configureMonitoring,
  createLoggerMonitoringTransport,
  resetMonitoring,
  setMonitoringUser,
} from './monitoring';

function fakeTransport() {
  return {
    captureException: vi.fn(),
    captureMessage: vi.fn(),
    setUser: vi.fn(),
    addBreadcrumb: vi.fn(),
  };
}

describe('monitoring seam', () => {
  afterEach(() => {
    resetMonitoring();
  });

  it('routes the facade to the configured transport', () => {
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

  it('captureError (folder 12) delegates through the seam — call site unchanged', () => {
    const transport = fakeTransport();
    configureMonitoring(transport);
    captureError(new Error('via'), { source: 'react' });
    expect(transport.captureException).toHaveBeenCalledWith(expect.any(Error), { source: 'react' });
  });

  it('logger-backed transport writes exceptions to the logger', () => {
    const sink = createBufferSink();
    configureMonitoring(createLoggerMonitoringTransport(createLogger({ minLevel: 'debug', sink })));
    captureException(new Error('logged'));
    expect(sink.records[0]?.level).toBe('error');
    expect(sink.records[0]?.message).toBe('logged');
  });
});
