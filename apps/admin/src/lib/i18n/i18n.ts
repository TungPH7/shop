import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import resourcesToBackend from 'i18next-resources-to-backend';
import { initReactI18next } from 'react-i18next';

import { defaultLocale, defaultNS, locales, STORAGE_KEY } from './config';
import enCommon from './locales/en/common.json';
import viCommon from './locales/vi/common.json';

// Lazy namespaces via Vite's `import.meta.glob` — statically analyzable, so each
// locale/namespace JSON is code-split into its own chunk and fetched on demand
// (Vercel `bundle-dynamic-imports`). We use glob rather than a raw template-literal
// `import()` because Vite's analyzer needs the explicit, static glob form.
// `common` is EXCLUDED from the glob (it is bundled eagerly below) — otherwise
// Rollup warns the dynamic import is ineffective since it is also statically imported.
const localeModules = import.meta.glob(['./locales/*/*.json', '!./locales/*/common.json'], {
  import: 'default',
}) as Record<string, () => Promise<Record<string, unknown>>>;

// The `common` namespace is bundled EAGERLY (always needed → no flash on first
// paint or language switch for the app shell); everything else is lazy.
void i18n
  .use(LanguageDetector)
  .use(
    resourcesToBackend((language: string, namespace: string) => {
      const loader = localeModules[`./locales/${language}/${namespace}.json`];
      if (!loader) {
        return Promise.reject(
          new Error(`[i18n] Missing locale resource: ${language}/${namespace}`),
        );
      }
      return loader();
    }),
  )
  .use(initReactI18next)
  .init({
    resources: {
      en: { common: enCommon },
      vi: { common: viCommon },
    },
    partialBundledLanguages: true,
    fallbackLng: defaultLocale,
    supportedLngs: [...locales],
    defaultNS,
    ns: [defaultNS],
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: STORAGE_KEY,
      caches: ['localStorage'],
    },
    // React already escapes interpolated values → disable i18next's escaping.
    interpolation: { escapeValue: false },
  });
