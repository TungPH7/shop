import { describe, expect, it } from 'vitest';

import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { renderWithProviders, screen } from '@/testing/render';

// Component smoke test: proves the full harness — render helper (providers),
// i18n (testI18n + useTranslation), user-event interaction, and runtime language
// switching with re-render.
describe('LanguageSwitcher', () => {
  it('renders the control with both locales (English labels)', () => {
    renderWithProviders(<LanguageSwitcher />);
    expect(screen.getByText('Language')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'English' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Tiếng Việt' })).toBeInTheDocument();
  });

  it('switches language at runtime', async () => {
    const { user } = renderWithProviders(<LanguageSwitcher />);
    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('en');

    await user.selectOptions(select, 'vi');

    // react-i18next re-renders after changeLanguage resolves → label is Vietnamese.
    expect(await screen.findByText('Ngôn ngữ')).toBeInTheDocument();
    expect(select).toHaveValue('vi');
  });
});
