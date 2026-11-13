import { type ReactElement, type ReactNode } from 'react';

import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';

import { defaultLocale, type Locale } from '~/config/i18n';
import { StoreProvider } from '~/stores/store-provider';

import enMessages from '../../messages/en.json';
import viMessages from '../../messages/vi.json';

// Messages thật theo locale → test render đúng chuỗi đã dịch (không stub giả).
const messagesByLocale: Record<Locale, typeof enMessages> = {
  en: enMessages,
  vi: viMessages,
};

// SEAM tăng trưởng cho mọi test component. Provider toàn app thêm Ở ĐÂY (Redux/Query/
// theme...). Folder 09: bọc NextIntlClientProvider → mọi component dùng `useTranslations`/
// `useLocale` render được trong test (jsdom dùng bản client của next-intl).
function makeWrapper(locale: Locale) {
  return function AllProviders({ children }: { children: ReactNode }) {
    return (
      <StoreProvider>
        <NextIntlClientProvider locale={locale} messages={messagesByLocale[locale]}>
          {children}
        </NextIntlClientProvider>
      </StoreProvider>
    );
  };
}

export interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Locale cho NextIntlClientProvider (mặc định `en`). Đổi để test bản dịch khác. */
  locale?: Locale;
}

export interface RenderWithProvidersResult extends RenderResult {
  user: ReturnType<typeof userEvent.setup>;
}

// Render component trong AllProviders + kèm user-event đã setup, trả về cùng RTL result.
export function renderWithProviders(
  ui: ReactElement,
  { locale = defaultLocale, ...options }: RenderWithProvidersOptions = {},
): RenderWithProvidersResult {
  return {
    user: userEvent.setup(),
    ...render(ui, { wrapper: makeWrapper(locale), ...options }),
  };
}

export { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
export { userEvent };
