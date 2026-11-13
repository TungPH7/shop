import { type Metadata } from 'next';

import { localizedAlternates } from '~/lib/seo/alternates';

type BuildPageMetadataInput = {
  /** Locale hiện tại (chuỗi từ `params`); helper tự validate. */
  locale: string;
  /** Tiêu đề trang (đã dịch). Sẽ được ghép vào title template ở root layout: `%s · siteName`. */
  title: string;
  /** Meta description (đã dịch). Bỏ qua nếu trang không cần. */
  description?: string;
  /** Href LOGIC (không tiền tố locale), vd `/products`. Dùng dựng canonical + hreflang. */
  pathname: string;
  /** `false` cho trang riêng tư/tiện ích → noindex (mặc định `true` = trang công khai). */
  index?: boolean;
};

/**
 * Gom lại logic `Metadata` lặp ở mọi trang (folder 21) → mỗi page chỉ giải i18n rồi gọi helper.
 *  - Trang công khai (`index: true`): title + description + `alternates` (canonical/hreflang).
 *  - Trang noindex (`index: false`): title + `robots:{index:false,follow:false}`, KHÔNG hreflang
 *    (trang không vào index thì khai canonical/alternate là thừa).
 *
 * ⚠️ `exactOptionalPropertyTypes` (folder 02): spread có điều kiện thay vì gán `undefined`.
 */
export function buildPageMetadata({
  locale,
  title,
  description,
  pathname,
  index = true,
}: BuildPageMetadataInput): Metadata {
  const base: Metadata = { title, ...(description ? { description } : {}) };

  if (!index) {
    return { ...base, robots: { index: false, follow: false } };
  }
  return { ...base, alternates: localizedAlternates(locale, pathname) };
}
