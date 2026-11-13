import { env } from '@/config/env';

import { consoleSink, createLogger, type Logger } from './logger';

// App-wide logger singleton: verbose in development, warnings + errors only in
// production (debug/info gated out → no noisy or leaky logs in prod builds).
// Imports `env`, so — like the api/queryClient singletons — it is NOT
// Node-importable; tests use the pure factory in logger.ts instead.
export const logger: Logger = createLogger({
  minLevel: env.isDev ? 'debug' : 'warn',
  sink: consoleSink,
});
