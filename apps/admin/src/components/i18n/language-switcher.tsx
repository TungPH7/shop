import { useTranslation } from 'react-i18next';

import { isLocale } from '@/lib/i18n/config';
import { useLocale } from '@/lib/i18n/use-locale';

// Headless language switcher — proves runtime language switching. UI-agnostic
// (Phase 1.1): a plain native <select>; Phase 1.2 swaps in a styled control,
// the useLocale contract unchanged.
export function LanguageSwitcher() {
  const { t } = useTranslation();
  const { locale, locales, labels, setLocale } = useLocale();

  return (
    <label>
      {t('language.label')}{' '}
      <select
        value={locale}
        onChange={(event) => {
          if (isLocale(event.target.value)) {
            setLocale(event.target.value);
          }
        }}
      >
        {locales.map((value) => (
          <option key={value} value={value}>
            {labels[value]}
          </option>
        ))}
      </select>
    </label>
  );
}
