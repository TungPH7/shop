import i18next, { type i18n } from 'i18next';
import { initReactI18next } from 'react-i18next';

import enCategory from '@/lib/i18n/locales/en/category.json';
import enCommon from '@/lib/i18n/locales/en/common.json';
import enProduct from '@/lib/i18n/locales/en/product.json';
import viCategory from '@/lib/i18n/locales/vi/category.json';
import viCommon from '@/lib/i18n/locales/vi/common.json';
import viProduct from '@/lib/i18n/locales/vi/product.json';

// A synchronous test i18n instance: real resources inline (no lazy backend, no
// language detector), Suspense OFF so components render without an async gate.
// Created once; setup.ts resets the language to 'en' after each test.
export const testI18n: i18n = i18next.createInstance();

void testI18n.use(initReactI18next).init({
  resources: {
    en: { common: enCommon, product: enProduct, category: enCategory },
    vi: { common: viCommon, product: viProduct, category: viCategory },
  },
  lng: 'en',
  fallbackLng: 'en',
  ns: ['common', 'product', 'category'],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});
