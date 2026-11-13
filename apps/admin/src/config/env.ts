import { z } from 'zod';

/**
 * Typed, validated access to environment variables.
 *
 * Why validate with Zod (vs hand-rolled presence checks):
 * - One schema is the single source of truth for every required VITE_* var and
 *   reports ALL problems at once (not just the first missing one).
 * - Validates the value's *shape*, e.g. `z.url()` rejects a malformed URL — not
 *   merely "is it non-empty".
 * - Fails fast at module load: a misconfigured app refuses to boot with a clear,
 *   prettified message instead of failing later with a confusing network error.
 *
 * Security boundary: Vite only inlines `VITE_*` vars into the client bundle, and
 * everything resolved here ships to the browser (it is PUBLIC). Never put secrets
 * here — real secrets live on the server only. See .env.example.
 */

// Schema for the env vars WE own. Vite's built-ins (MODE/DEV/...) are guaranteed
// by the framework and read directly below (no need to validate them).
const envSchema = z.object({
  // Absolute http(s) URL of the backend API (see .env.development / .env.example).
  // `z.url()` is Zod 4's top-level URL format (`z.string().url()` is deprecated).
  // Or a path on this origin, `/api` by default: Caddy in the image of ai-orchestrator sends /api/* to the API of each
  // environment, and the dev server does the same, so one build serves Development, Staging and Production (SHOP-1).
  VITE_API_URL: z.union([z.url(), z.string().regex(/^\/(?!\/)/)]).default('/api'),
});

const parsed = envSchema.safeParse(import.meta.env);

if (!parsed.success) {
  // Surfaces as an uncaught error (Vite dev overlay / browser console) at boot.
  // `prettifyError` renders every issue as a readable multi-line report.
  throw new Error(`[env] Invalid environment variables:\n${z.prettifyError(parsed.error)}`);
}

interface AppEnv {
  /** Base URL of the backend API. */
  readonly apiUrl: string;
  /** Vite mode: 'development' | 'production' | 'test'. */
  readonly mode: string;
  /** True when running the dev server (`vite`). */
  readonly isDev: boolean;
}

export const env: AppEnv = {
  apiUrl: parsed.data.VITE_API_URL,
  mode: import.meta.env.MODE,
  isDev: import.meta.env.DEV,
};
