import { describe, expect, it } from 'vitest';

import { createBufferSink, createLogger } from './logger';

describe('createLogger', () => {
  it('gates messages below minLevel', () => {
    const sink = createBufferSink();
    const log = createLogger({ minLevel: 'warn', sink });
    log.debug('d');
    log.info('i');
    log.warn('w');
    log.error('e');
    expect(sink.records).toHaveLength(2);
    expect(sink.records.map((record) => record.level)).toEqual(['warn', 'error']);
  });

  it('attaches structured fields and the injected timestamp', () => {
    const sink = createBufferSink();
    const log = createLogger({ minLevel: 'debug', sink, now: () => 1000 });
    log.info('hi', { a: 1 });
    expect(sink.records[0]?.fields).toEqual({ a: 1 });
    expect(sink.records[0]?.timestamp).toBe(1000);
  });

  it('child merges parent bindings + child bindings + call fields', () => {
    const sink = createBufferSink();
    const log = createLogger({ minLevel: 'debug', sink, bindings: { app: 'x' } });
    log.child({ reqId: 'r1' }).info('hi', { n: 2 });
    expect(sink.records[0]?.fields).toEqual({ app: 'x', reqId: 'r1', n: 2 });
  });
});
