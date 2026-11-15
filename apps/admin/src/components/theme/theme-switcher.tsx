import { useTranslation } from 'react-i18next';

import { isTheme, useTheme } from '@/stores/theme/use-theme';

// Light, Dark or System (the default). The store holds the choice; main.tsx mirrors
// it onto <html data-theme> (stores/theme/apply-theme.ts), and tokens.css does the rest.
export function ThemeSwitcher() {
  const { t } = useTranslation();
  const { theme, themes, setTheme } = useTheme();

  return (
    <label className="pill__control">
      <span className="visually-hidden">{t('theme.label')}</span>
      <select
        className="pill__select"
        name="theme"
        value={theme}
        onChange={(event) => {
          if (isTheme(event.target.value)) {
            setTheme(event.target.value);
          }
        }}
      >
        {themes.map((value) => (
          <option key={value} value={value}>
            {t(`theme.${value}`)}
          </option>
        ))}
      </select>
    </label>
  );
}
