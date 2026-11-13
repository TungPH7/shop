import 'server-only';

import pino, { type DestinationStream, type LoggerOptions } from 'pino';

import { type LogRecord, type LogSink } from '~/lib/logger/logger';

// ⭐ Folder 20 — một `LogSink` chạy bằng pino (logger Node hiệu năng cao, in JSON). Đây là MINH CHỨNG cho
// "lời hứa" của seam observability (folder 18): đổi đích log = VIẾT MỘT SINK MỚI, KHÔNG đụng call-site.
// `consoleSink` (folder 18) đã cố tình in JSON hình pino (`level`/`time`/`msg`) nên khi swap sang pino thật,
// hệ thu log (Loki/Grafana…) KHÔNG phải đổi parser.
//
// ⚠️ `import 'server-only'`: pino dùng API Node (stream/process) → sẽ VỠ nếu lọt vào bundle client. Sink
//    này CHỈ được nạp ở server qua `instrumentation.register()` (guard `NEXT_RUNTIME==='nodejs'` + dynamic
//    import) → client/edge giữ `consoleSink`.
// ⚠️ KHÔNG dùng transport / `pino-pretty`: pino transport chạy bằng **worker_threads** — đúng thứ khiến
//    Turbopack 16 vỡ bundling khi truy vết worker (vercel/next.js#86099). Ta dùng đích ĐỒNG BỘ mặc định
//    (stdout) → tránh worker hoàn toàn. Kèm `serverExternalPackages:['pino']` ở next.config để Turbopack
//    KHÔNG bundle pino (để Node `require` lúc runtime).

const PINO_OPTIONS = {
  // Gating mức log đã do `createLogger` (facade folder 18) lo TRƯỚC khi gọi sink → để pino nhận hết
  // ('trace') để tránh gate HAI LẦN (ngưỡng thật nằm ở `app-logger.resolveMinLevel`).
  level: 'trace',
  // Khoá thông điệp = 'msg' (mặc định pino; khai tường minh cho trùng `consoleSink`).
  messageKey: 'msg',
  // pino mặc định in `level` dạng SỐ (30) → ép về NHÃN ('info') cho khớp `consoleSink`.
  formatters: { level: (label: string) => ({ level: label }) },
  // Giữ message/stack của Error trong field `error`/`err` (vai trò như `errorReplacer` của consoleSink).
  serializers: { error: pino.stdSerializers.err, err: pino.stdSerializers.err },
} satisfies LoggerOptions;

/**
 * Factory để TEST được (truyền đích thu dòng JSON); prod gọi `pinoSink` (đích mặc định = stdout).
 * Map `LogRecord` (kiểu chung của seam) → lời gọi pino `level(mergingObject, message)`.
 */
export function createPinoSink(destination?: DestinationStream): LogSink {
  const pinoLogger = destination ? pino(PINO_OPTIONS, destination) : pino(PINO_OPTIONS);
  return {
    write(record: LogRecord) {
      pinoLogger[record.level]({ ...record.fields }, record.message);
    },
  };
}

export const pinoSink: LogSink = createPinoSink();
