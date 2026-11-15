import { useTranslation } from 'react-i18next';

import { isLocale } from '@/lib/i18n/config';
import { useLocale } from '@/lib/i18n/use-locale';

// Runtime language switch: a native <select> in the tools pill of the shell (S1.1).
// The label is visually hidden but stays the accessible name of the control.
export function LanguageSwitcher() {
  const { t } = useTranslation();
  const { locale, locales, labels, setLocale } = useLocale();

  return (
    <label className="pill__control">
      <span className="visually-hidden">{t('language.label')}</span>
      <select
        className="pill__select"
        name="language"
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
