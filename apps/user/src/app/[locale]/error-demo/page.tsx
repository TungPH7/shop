import { Suspense } from 'react';

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ErrorDemoOutcome } from '~/features/error-demo/components/error-demo-outcome';
import { buildPageMetadata } from '~/lib/seo/metadata';

/** Trang demo lỗi = trang demo → noindex (folder 21). Title đã dịch; KHÔNG khai hreflang. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'ErrorDemo' });
  return buildPageMetadata({ locale, title: t('title'), pathname: '/error-demo', index: false });
}

/**
 * Trang `/[locale]/error-demo` — MỎNG (app/ = routing + composition). Route TĨNH (không segment `[id]`
 * động) ⇒ root layout `[locale]/layout` đọc `params.locale` vẫn TĨNH — đây là lý do chọn vehicle này
 * cho folder 17 (tập trung TẦNG LỖI, không kéo theo migration `next/root-params`).
 *
 * ⚠️ Toàn bộ UI tương tác (gồm các `<Link>` kịch bản) nằm trong `ErrorDemoOutcome` được bọc `<Suspense>`:
 * trang ĐỌC `searchParams` (request-time) → next-intl `<Link>` đặt ở STATIC SHELL của một route có
 * searchParams sẽ kích hoạt blocking-route (cacheComponents). Đẩy chúng vào dynamic-hole là hợp lệ.
 */
export default async function ErrorDemoPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <Suspense fallback={null}>
      <ErrorDemoOutcome searchParams={searchParams} />
    </Suspense>
  );
}
