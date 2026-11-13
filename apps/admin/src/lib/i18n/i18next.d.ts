import 'i18next';

import type common from './locales/en/common.json';
import type product from './locales/en/product.json';

// Type-safe translation keys: `t('nav.home')` / `t('product:count', { count })` are
// checked against the English resources (the source of truth for keys), so a typo
// becomes a compile error. The top-level import makes this a module so the
// `declare module` augmentation merges correctly.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof common;
      product: typeof product;
    };
  }
}
