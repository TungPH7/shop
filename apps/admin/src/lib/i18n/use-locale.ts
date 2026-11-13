import { useTranslation } from 'react-i18next';

import { defaultLocale, isLocale, type Locale, localeLabels, locales } from './config';

export interface UseLocale {
  locale: Locale;
  locales: readonly Locale[];
  labels: Readonly<Record<Locale, string>>;
  setLocale: (locale: Locale) => void;
}

// Facade over react-i18next (the seam): components read/switch language through
// this, never touching i18n internals directly. Language state is owned by
// i18next (single source of truth) and persisted by the language detector — it is
// NOT duplicated into Redux, mirroring "server state lives in Query, not Redux".
export function useLocale(): UseLocale {
  const { i18n } = useTranslation();
  // resolvedLanguage normalizes region codes (e.g. `en-US` → `en`) against
  // supportedLngs; fall back defensively to the default.
  const resolved = i18n.resolvedLanguage ?? i18n.language;
  return {
    locale: isLocale(resolved) ? resolved : defaultLocale,
    locales,
    labels: localeLabels,
    setLocale: (locale) => {
      void i18n.changeLanguage(locale);
    },
  };
}
