import { z } from 'zod';

import { themeValues, type Theme } from '@/stores/theme/theme-slice';

// localStorage is untrusted external input → validate on read (type-at-boundary,
// same principle as env.ts and API responses). The payload is versioned and
// minimal so an old/foreign value is rejected cleanly instead of corrupting the
// store (Vercel `client-localstorage-schema`). Bumping SCHEMA_VERSION makes any
// previously stored value fail validation → graceful fallback to the default.
const STORAGE_KEY = 'tungph7.theme';
const SCHEMA_VERSION = 1;

const persistedThemeSchema = z.object({
  v: z.literal(SCHEMA_VERSION),
  theme: z.enum(themeValues),
});

export function loadTheme(): Theme | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return undefined;
    const json: unknown = JSON.parse(raw);
    const parsed = persistedThemeSchema.safeParse(json);
    // Unknown shape / older version → ignore and fall back to the default.
    return parsed.success ? parsed.data.theme : undefined;
  } catch {
    // No storage (SSR/tests/private mode) or invalid JSON → ignore.
    return undefined;
  }
}

export function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: SCHEMA_VERSION, theme }));
  } catch {
    // Quota exceeded or storage unavailable → non-fatal, skip persistence.
  }
}
