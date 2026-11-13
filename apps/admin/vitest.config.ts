import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Standalone test config — plain @vitejs/plugin-react (NO React Compiler babel
// pass from vite.config; tests don't need it). jsdom environment; globals OFF
// because tsconfig sets `types: []`, so tests import { describe, it, expect }
// from 'vitest' explicitly (no ambient globals, no tsconfig juggling).
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Mirror the `@/*` → src alias (vitest.config is separate from vite.config).
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/testing/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    clearMocks: true,
    restoreMocks: true,
    // env.ts validates VITE_API_URL at import → provide one for the test run so
    // the api singleton can be imported without the fail-fast throwing.
    env: { VITE_API_URL: 'http://localhost:3000' },
    coverage: {
      provider: 'v8',
      // The default reporters plus lcov: the CI of ai-orchestrator reads coverage/lcov.info to measure the lines a PR
      // changes.
      reporter: ['text', 'html', 'clover', 'json', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      // Exclude what is not meaningfully UNIT-testable so the % reflects tested
      // logic, not boilerplate: test files/utils, type decls, the entry, env +
      // env-coupled singletons, app composition/bootstrap + route shells (E2E
      // territory, step 3), and the Vite-glob i18n init.
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/testing/**',
        'src/**/*.d.ts',
        'src/main.tsx',
        // env.ts stays in: the CI of ai-orchestrator needs every file a PR changes in coverage/lcov.info (SHOP-1).
        'src/config/paths.ts',
        'src/app/provider.tsx',
        'src/app/router.ts',
        'src/app/routes.tsx',
        'src/app/configure-auth.ts',
        'src/app/observability.ts',
        'src/app/layouts/**',
        'src/app/routes/**',
        'src/lib/api/api.ts',
        'src/lib/react-query/query-client.ts',
        'src/lib/logger/app-logger.ts',
        'src/lib/i18n/i18n.ts',
      ],
      // Ratchet FLOOR — a regression safety-net, NOT a target to chase (Fowler /
      // Google Testing: coverage finds untested code, it is not a quality score;
      // forcing a high % breeds bogus tests). Measured baseline: stmts 82 / branches
      // 70 / funcs 77 / lines 82. lines/statements/functions sit a couple points
      // below for headroom (CI fails on a real regression, tolerates churn);
      // branches floor = baseline (the common "branches lower than lines" shape).
      // Raise as coverage grows. Next gaps: api-client 401-refresh, get-product,
      // logout. Enforced in CI (folder 18); `pnpm test:coverage` checks locally.
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 75,
        lines: 80,
      },
    },
  },
});
