// Leveled, structured logging abstraction. PURE + env-free (the env-gated
// singleton lives in app-logger.ts) so this module is import-safe everywhere,
// including Node/tests — same factory↔singleton split as api-client↔api (folder 07).

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

// Structured context attached to a log record — log OBJECTS, not concatenated
// strings, so logs stay queryable once shipped to a platform.
export type LogFields = Record<string, unknown>;

export interface LogRecord {
  readonly level: LogLevel;
  readonly message: string;
  readonly fields: LogFields;
  readonly timestamp: number;
}

// A sink is WHERE records go (console, an in-memory buffer, an HTTP endpoint, an
// observability platform). Swapping the sink redirects every log without
// touching a single call site.
export interface LogSink {
  write(record: LogRecord): void;
}

export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  /** A logger that merges `bindings` into every record (inherited context). */
  child(bindings: LogFields): Logger;
}

export interface LoggerOptions {
  minLevel: LogLevel;
  sink: LogSink;
  bindings?: LogFields;
  /** Injectable clock for deterministic tests. */
  now?: () => number;
}

export function createLogger(options: LoggerOptions): Logger {
  const { minLevel, sink, bindings = {}, now = Date.now } = options;
  const threshold = LEVEL_ORDER[minLevel];

  function log(level: LogLevel, message: string, fields?: LogFields): void {
    // Gated-out levels return BEFORE building the record (cheap in production,
    // where minLevel is 'warn' so debug/info do almost no work).
    if (LEVEL_ORDER[level] < threshold) return;
    sink.write({ level, message, fields: { ...bindings, ...fields }, timestamp: now() });
  }

  return {
    debug: (message, fields) => log('debug', message, fields),
    info: (message, fields) => log('info', message, fields),
    warn: (message, fields) => log('warn', message, fields),
    error: (message, fields) => log('error', message, fields),
    child: (childBindings) =>
      createLogger({ minLevel, sink, bindings: { ...bindings, ...childBindings }, now }),
  };
}

// Default sink: the browser console, one native method per level (so DevTools
// styling/filtering by level still works). no-console is not enabled in this repo.
export const consoleSink: LogSink = {
  write({ level, message, fields }) {
    const rest: LogFields[] = Object.keys(fields).length > 0 ? [fields] : [];
    console[level](message, ...rest);
  },
};

// In-memory sink for tests / batching before a flush.
export function createBufferSink(): LogSink & { readonly records: LogRecord[] } {
  const records: LogRecord[] = [];
  return {
    records,
    write(record) {
      records.push(record);
    },
  };
}
