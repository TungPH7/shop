// @vitest-environment node
import { expect, test } from 'vitest';

import { createPinoSink } from '~/lib/logger/pino-sink';

// pino là Node-only → test chạy môi trường `node` (jsdom có `window`/thiếu stream API). `server-only`
// được alias sang stub no-op trong vitest.config (folder 11) nên import pino-sink không ném.

/** Đích thu các dòng JSON pino ghi ra (thay stdout) để assert nội dung. */
function collectingStream() {
  const lines: string[] = [];
  return {
    lines,
    write(chunk: string) {
      lines.push(chunk);
    },
  };
}

test('pinoSink ghi MỘT dòng JSON / record với msg + fields, level dạng NHÃN (không phải số)', () => {
  const dest = collectingStream();
  const sink = createPinoSink(dest);
  sink.write({ level: 'info', message: 'hello', fields: { a: 1 }, timestamp: 0 });

  expect(dest.lines).toHaveLength(1);
  const obj = JSON.parse(dest.lines[0]!) as Record<string, unknown>;
  expect(obj.msg).toBe('hello');
  expect(obj.level).toBe('info'); // nhãn 'info', KHÔNG phải 30 (formatters.level)
  expect(obj.a).toBe(1);
  expect(typeof obj.time).toBe('number'); // pino tự đóng dấu thời gian (epoch ms)
});

test('pinoSink giữ message + stack của Error qua serializer (không ra "{}")', () => {
  const dest = collectingStream();
  const sink = createPinoSink(dest);
  sink.write({
    level: 'error',
    message: 'boom',
    fields: { error: new Error('deep') },
    timestamp: 0,
  });

  const obj = JSON.parse(dest.lines[0]!) as {
    msg: string;
    error: { message: string; stack: string };
  };
  expect(obj.msg).toBe('boom');
  expect(obj.error.message).toBe('deep');
  expect(typeof obj.error.stack).toBe('string');
});
