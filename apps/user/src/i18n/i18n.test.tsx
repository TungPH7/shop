import { useTranslations } from 'next-intl';
import { describe, expect, test } from 'vitest';

import { renderWithProviders, screen } from '~/testing/render';

// Component thăm dò: thực thi ICU qua next-intl với messages THẬT (en/vi) → chứng minh
// plural + interpolation hoạt động end-to-end (không stub engine).
function Probe({ count }: { count: number }) {
  const t = useTranslations('Home');
  return (
    <>
      <p data-testid="plural">{t('localesSupported', { count })}</p>
      <p data-testid="interp">{t('currentLanguage', { locale: 'xx' })}</p>
    </>
  );
}

describe('next-intl — ICU plural + interpolation', () => {
  test('en: phân biệt one vs other', () => {
    const { rerender } = renderWithProviders(<Probe count={1} />, { locale: 'en' });
    expect(screen.getByTestId('plural')).toHaveTextContent('1 language supported');
    rerender(<Probe count={5} />);
    expect(screen.getByTestId('plural')).toHaveTextContent('5 languages supported');
  });

  test('vi: chỉ 1 dạng (other) cho mọi count', () => {
    renderWithProviders(<Probe count={1} />, { locale: 'vi' });
    expect(screen.getByTestId('plural')).toHaveTextContent('Hỗ trợ 1 ngôn ngữ');
  });

  test('interpolation thay biến {locale}', () => {
    renderWithProviders(<Probe count={1} />, { locale: 'en' });
    expect(screen.getByTestId('interp')).toHaveTextContent('Current language (from URL): xx');
  });
});
