import { useTranslation } from 'react-i18next';

import { useTheme } from '@/stores/theme/use-theme';
import { themeValues, type Theme } from '@/stores/theme/theme-slice';

function isTheme(value: string): value is Theme {
  return (themeValues as readonly string[]).includes(value);
}

// Light, Dark or System (the default). The store holds the choice; main.tsx mirrors
// it onto <html data-theme> (stores/theme/apply-theme.ts), and tokens.css does the rest.
export function ThemeSwitcher() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

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
        {themeValues.map((value) => (
          <option key={value} value={value}>
            {t(`theme.${value}`)}
          </option>
        ))}
      </select>
    </label>
  );
}
