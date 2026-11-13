import { clientEnv } from '~/config/env/client';
import {
  consoleSink,
  createLogger,
  type Logger,
  type LogLevel,
  type LogSink,
} from '~/lib/logger/logger';

// VÌ SAO file RIÊNG (tách khỏi `logger.ts`): `logger.ts` là factory THUẦN, không đọc env → test
// được mà không cần stub env. File này là SINGLETON đã "cấu hình theo môi trường" — chọn `minLevel`
// theo `NODE_ENV` + gắn sink mặc định. App code import `logger` ở đây; test import `createLogger`
// + sink buffer trực tiếp (không đụng singleton này).
//
// ⭐ Isomorphic: CHỈ đọc `clientEnv.NODE_ENV` (biến `shared` — an toàn cả server lẫn client; KHÔNG
// `import 'server-only'`, KHÔNG đọc biến server) → cùng MỘT `logger` dùng được ở instrumentation
// (server), DAL (server) lẫn error boundary (client). Đó là lý do tầng log phải 0-dep + isomorphic:
// `pino` (Node-only) sẽ VỠ nếu lọt vào bundle client → để dành (§18 chưa-làm), cắm qua một sink mới.

// Prod chỉ giữ `info` trở lên (bớt ồn + rẻ); dev mở `debug`; test im hơn (chỉ `warn`/`error`) để log
// app không làm rác output test.
function resolveMinLevel(): LogLevel {
  switch (clientEnv.NODE_ENV) {
    case 'production':
      return 'info';
    case 'test':
      return 'warn';
    default:
      return 'debug';
  }
}

// ⭐ Folder 20 — SINK HOÁN ĐỔI ĐƯỢC (DI, cùng kiểu seam với monitoring/analytics). `logger` được tạo
// MỘT LẦN với một "delegating sink" trỏ tới `currentSink`; đổi `currentSink` (vd lúc server boot → pino)
// KHÔNG tạo lại `logger`, nên mọi nơi đang GIỮ tham chiếu `logger` (instrumentation/monitoring/analytics
// import sẵn) vẫn ghi đúng đích mới. Mặc định = `consoleSink` (isomorphic, an toàn client/edge). pino
// (Node-only) cắm ở SERVER qua `configureLoggerSink` trong `instrumentation.register()` → KHÔNG bao giờ
// lọt vào bundle client. Đây chính là "lời hứa" của seam folder 18: đổi đích log = đổi MỘT sink.
let currentSink: LogSink = consoleSink;

/** Đổi đích log (vd server boot: cắm pino). MỘT chỗ duy nhất để swap — call-site không đổi. */
export function configureLoggerSink(sink: LogSink): void {
  currentSink = sink;
}

/** Trả về mặc định (consoleSink). Dùng trong test `afterEach` để các test độc lập. */
export function resetLoggerSink(): void {
  currentSink = consoleSink;
}

// Sink ổn định bọc quanh `currentSink`: giữ `logger` bất biến trong khi vẫn đổi được đích bên dưới.
const delegatingSink: LogSink = {
  write(record) {
    currentSink.write(record);
  },
};

export const logger: Logger = createLogger({
  minLevel: resolveMinLevel(),
  sink: delegatingSink,
  bindings: { app: 'tungph7-web' },
});
