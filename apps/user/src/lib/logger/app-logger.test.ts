import { afterEach, expect, test } from 'vitest';

import { configureLoggerSink, logger, resetLoggerSink } from '~/lib/logger/app-logger';
import { createBufferSink } from '~/lib/logger/logger';

// `logger` (singleton) được tạo với minLevel theo NODE_ENV. Trong test NODE_ENV='test' → minLevel='warn',
// nên dùng `logger.warn`/`error` để vượt gate (info/debug bị bỏ — đúng thiết kế).
afterEach(() => {
  resetLoggerSink();
});

test('configureLoggerSink chuyển hướng output của logger sang sink mới (giữ bindings)', () => {
  const buffer = createBufferSink();
  configureLoggerSink(buffer);
  logger.warn('routed', { k: 1 });
  expect(buffer.records).toHaveLength(1);
  expect(buffer.records[0]?.message).toBe('routed');
  // `app` binding (folder 18) vẫn được gắn dù đã đổi sink → chứng minh `logger` KHÔNG bị tạo lại.
  expect(buffer.records[0]?.fields).toMatchObject({ app: 'tungph7-web', k: 1 });
});

test('resetLoggerSink khôi phục sink mặc định (console) → buffer không còn nhận', () => {
  const buffer = createBufferSink();
  configureLoggerSink(buffer);
  resetLoggerSink();
  logger.warn('after-reset');
  expect(buffer.records).toHaveLength(0);
});
