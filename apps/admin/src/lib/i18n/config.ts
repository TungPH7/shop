// Pure i18n config (no i18next import) — the single source for the supported
// locale list, reused by the i18n init, the useLocale facade, and tests.

export const locales = ['en', 'vi'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';
export const defaultNS = 'common';

// localStorage key for the persisted language choice — matches the repo's
// `tungph7.*` key convention (folders 09/10).
export const STORAGE_KEY = 'tungph7.i18n.lang'; // gitleaks:allow reason: the name of a localStorage key, not a secret

export const localeLabels: Readonly<Record<Locale, string>> = {
  en: 'English',
  vi: 'Tiếng Việt',
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
