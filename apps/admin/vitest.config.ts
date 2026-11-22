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
    // No CSS is processed, as with `css: false`, except a `?raw` import: the text of a
    // stylesheet, which src/styles/layout-backdrop.test.ts reads (SHOP-88). With
    // `css: false` Vitest empties that text too.
    css: { include: [/\.css\?raw$/] },
    clearMocks: true,
    restoreMocks: true,
    // env.ts validates VITE_API_URL at import → provide one for the test run so
    // the api singleton can be imported without the fail-fast throwing.
    env: { VITE_API_URL: 'http://localhost:3000' },
    // Node would load nuqs on its own, and its react-router adapter would then import a
    // second copy of react-router, outside the router of the test ("useNavigate() may be
    // used only in the context of a <Router>"). Inlined, it shares the copy of the app.
    server: { deps: { inline: ['nuqs'] } },
    coverage: {
      provider: 'v8',
      // The default reporters plus lcov: the CI of ai-orchestrator reads coverage/lcov.info to measure the lines a PR
      // changes.
      reporter: ['text', 'html', 'clover', 'json', 'lcov'],
      // public/theme-init.js runs in the browser before the app, and has its own tests.
      include: ['src/**/*.{ts,tsx}', 'public/**/*.js'],
      // Exclude what is not meaningfully UNIT-testable so the % reflects tested
      // logic, not boilerplate: test files/utils, type decls, the entry, env +
      // env-coupled singletons, app composition/bootstrap + route shells (E2E
      // territory, step 3), and the Vite-glob i18n init.
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/testing/**',
        'src/**/*.d.ts',
        // env.ts stays in: the CI of ai-orchestrator needs every file a PR changes in coverage/lcov.info (SHOP-1).
        // So do main.tsx, the root layout and the home and about routes, which SHOP-8 changes, and the paths, the route
        // table and the admin route, which SHOP-17 changes, and the profile route, which SHOP-42 changes, and the add
        // route of products, which SHOP-20 adds (routes.test.tsx renders it). And the QueryClient factory, which SHOP-66
        // changes (query-client.test.ts).
        'src/app/provider.tsx',
        'src/app/router.ts',
        'src/app/configure-auth.ts',
        'src/app/observability.ts',
        'src/app/routes/{access-denied,login,not-found}/**',
        'src/app/routes/products/products-route.tsx',
        'src/app/routes/route-error.tsx',
        'src/lib/api/api.ts',
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
