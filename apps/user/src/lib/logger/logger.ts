// Tầng LOG — factory THUẦN, 0-dep, isomorphic (chạy cả server lẫn client), KHÔNG đọc env.
//
// VÌ SAO có tầng này (thay vì `console.log` rải rác): `console.log` (1) không phân CẤP độ → không
// tắt được log ồn ở prod; (2) không CẤU TRÚC → string nối tay khó query/grep ở hệ log tập trung;
// (3) đóng cứng ĐÍCH đến → luôn là stdout, không đổi sang HTTP/file/vendor được. Logger này tách
// đúng 3 thứ đó ra: `minLevel` (gating), `LogFields` (structured), `LogSink` (đích cắm được).
//
// ⭐ Đây là CORE 0-dep của seam observability (folder 18). Mặc định in JSON ra console; đổi sang
// `pino`/HTTP/vendor sau = viết MỘT `LogSink` mới, KHÔNG đụng call-site. Hình JSON in ra cố ý trùng
// `pino` (`level`/`time`/`msg`) → mai sau swap pino thì hệ thu log (Loki/Grafana…) không phải đổi.

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogFields = Record<string, unknown>;

export interface LogRecord {
  readonly level: LogLevel;
  readonly message: string;
  readonly fields: LogFields;
  readonly timestamp: number;
}

/** Đích đến của log — cắm được (console / buffer test / HTTP / vendor). Đây là "seam" của tầng log. */
export interface LogSink {
  write(record: LogRecord): void;
}

export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  /** Logger con kế thừa + bổ sung bindings (vd gắn `requestId` cho cả vòng đời 1 request). */
  child(bindings: LogFields): Logger;
}

export interface LoggerOptions {
  minLevel: LogLevel;
  sink: LogSink;
  /** Field gắn SẴN vào mọi record (vd `{ app: 'web' }`). */
  bindings?: LogFields;
  /** Tiêm clock cho test (mặc định `Date.now`). */
  now?: () => number;
}

// Thứ tự ưu tiên để gating: chỉ ghi record có mức ≥ minLevel.
const LEVEL_PRIORITY: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export function createLogger(options: LoggerOptions): Logger {
  const { minLevel, sink, bindings = {}, now = () => Date.now() } = options;
  const threshold = LEVEL_PRIORITY[minLevel];

  function emit(level: LogLevel, message: string, fields?: LogFields): void {
    if (LEVEL_PRIORITY[level] < threshold) return; // gating: bỏ log dưới ngưỡng (rẻ ở prod)
    sink.write({ level, message, fields: { ...bindings, ...fields }, timestamp: now() });
  }

  return {
    debug: (message, fields) => emit('debug', message, fields),
    info: (message, fields) => emit('info', message, fields),
    warn: (message, fields) => emit('warn', message, fields),
    error: (message, fields) => emit('error', message, fields),
    child: (childBindings) =>
      createLogger({ ...options, bindings: { ...bindings, ...childBindings } }),
  };
}

// JSON.stringify BỎ QUA prop non-enumerable của Error (name/message/stack) → log một Error trần sẽ
// ra `{}` (mất hết thông tin). Replacer này "mở" Error thành object thường để giữ message/stack/cause
// khi serialize. Áp đệ quy (stringify gọi replacer cho cả `cause` lồng nhau).
function errorReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack, cause: value.cause };
  }
  return value;
}

/**
 * Sink mặc định: in MỘT dòng JSON ra console. Khoá cố ý trùng `pino` (`level`/`time`/`msg`) để khi
 * đổi sang pino, hệ thu log không phải đổi parser. Đây là RANH GIỚI console DUY NHẤT được phép —
 * app code phải đi qua logger, KHÔNG gọi `console.*` trực tiếp (ESLint `no-console` chặn chỗ khác).
 */
export const consoleSink: LogSink = {
  write(record) {
    const line = JSON.stringify(
      { level: record.level, time: record.timestamp, msg: record.message, ...record.fields },
      errorReplacer,
    );
    // `console.debug` không nhất quán giữa các môi trường → 'debug' map về 'log'; còn lại trùng tên.
    const method = record.level === 'debug' ? 'log' : record.level;
    // eslint-disable-next-line no-console -- logger sink = ranh giới console DUY NHẤT được phép (xem doc trên).
    console[method](line);
  },
};

export interface BufferSink extends LogSink {
  readonly records: LogRecord[];
}

/** Sink cho test: gom record vào mảng để assert (thay vì in ra console). */
export function createBufferSink(): BufferSink {
  const records: LogRecord[] = [];
  return {
    records,
    write(record) {
      records.push(record);
    },
  };
}
