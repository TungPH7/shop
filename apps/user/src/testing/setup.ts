import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { server } from './msw/server';

// MSW: giả lập network cho cả suite. Request KHÔNG có handler -> BÁO LỖI to
// (onUnhandledRequest:'error') để thiếu handler lộ ra ngay, không "treo" âm thầm.
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  // RTL auto-cleanup chỉ chạy khi bật globals; ta để globals:false -> dọn cây React
  // bằng tay sau mỗi test.
  cleanup();
  // Gỡ handler đăng ký per-test (server.use) -> mỗi test độc lập, không rò sang nhau.
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
