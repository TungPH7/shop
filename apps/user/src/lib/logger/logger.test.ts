import { expect, test, vi } from 'vitest';

import { consoleSink, createBufferSink, createLogger } from '~/lib/logger/logger';

test('gates messages below minLevel', () => {
  const sink = createBufferSink();
  const log = createLogger({ minLevel: 'warn', sink });
  log.debug('d');
  log.info('i');
  log.warn('w');
  log.error('e');
  expect(sink.records).toHaveLength(2);
  expect(sink.records.map((record) => record.level)).toEqual(['warn', 'error']);
});

test('attaches structured fields and the injected timestamp', () => {
  const sink = createBufferSink();
  const log = createLogger({ minLevel: 'debug', sink, now: () => 1000 });
  log.info('hi', { a: 1 });
  expect(sink.records[0]?.fields).toEqual({ a: 1 });
  expect(sink.records[0]?.timestamp).toBe(1000);
});

test('child merges parent bindings + child bindings + call fields', () => {
  const sink = createBufferSink();
  const log = createLogger({ minLevel: 'debug', sink, bindings: { app: 'x' } });
  log.child({ reqId: 'r1' }).info('hi', { n: 2 });
  expect(sink.records[0]?.fields).toEqual({ app: 'x', reqId: 'r1', n: 2 });
});

test('consoleSink serializes an Error field instead of "{}" and uses the console method by level', () => {
  // Bằng chứng errorReplacer hoạt động: name/message của Error xuất hiện trong dòng JSON in ra,
  // thay vì `{}` (Error có prop non-enumerable → JSON.stringify thường bỏ qua).
  const lines: string[] = [];
  vi.spyOn(console, 'error').mockImplementation((line: string) => {
    lines.push(line);
  });
  consoleSink.write({
    level: 'error',
    message: 'oops',
    fields: { err: new Error('deep') },
    timestamp: 0,
  });
  expect(lines).toHaveLength(1);
  expect(lines[0]).toContain('"msg":"oops"');
  expect(lines[0]).toContain('"message":"deep"');
});
