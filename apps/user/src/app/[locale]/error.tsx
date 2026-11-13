'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

import { captureError } from '~/lib/monitoring/capture-error';

/**
 * Error Boundary cho segment `[locale]` (fix folder 12: render-error làm SẬP app).
 *
 * VÌ SAO cần file này: route `/products` fetch data qua DAL (`getProducts`). Khi backend trả lỗi
 * (vd **429** do rate-limit khi bấm "Refresh products" liên tục) → `request()` ném `ApiError` LÚC
 * RENDER. Không có Error Boundary nào trong `app/` ⇒ lỗi render leo tới root ⇒ **sập cả trang**
 * (overlay dev / trang lỗi prod). Next bọc CHILDREN của segment trong React Error Boundary này nên
 * lỗi được BẮT tại đây → hiện UI dự phòng thay vì sập.
 *
 * Đặc thù `error.tsx` (Next.js App Router):
 *  - **BẮT BUỘC `'use client'`** — Error Boundary chạy ở client.
 *  - Bắt lỗi của page + các segment CON, NHƯNG **không** bắt lỗi của chính `[locale]/layout.tsx`
 *    (lỗi trong layout phải do boundary của segment CHA bắt → đó là việc của `app/global-error.tsx`).
 *    Vì vậy nó render BÊN TRONG `[locale]/layout` → vẫn còn `LanguageSwitcher`/`SiteFooter` +
 *    `NextIntlClientProvider`, nên `useTranslations` đọc đúng locale (i18n forward sẵn xuống client).
 *  - ⭐ **`unstable_retry()` (Next 16.2)** thay `reset()`: re-FETCH + render lại boundary. Hợp với
 *    lỗi data transient như **429** (cửa sổ rate-limit ~60s qua → fetch lại là khỏi). `reset()` (cũ)
 *    chỉ render lại KHÔNG đảm bảo fetch lại. (`unstable_` = API có thể đổi; docs Next hiện khuyên dùng
 *    nó cho mọi recovery.)
 *  - ⚠️ **Production:** Next che `error.message` (chỉ còn `error.digest`) để KHÔNG rò nội bộ ra
 *    client; message/stack thật chỉ log ở SERVER. ⇒ KHÔNG branch theo `error.status`/message ở đây.
 *    (Phân loại lỗi theo taxonomy domain làm ở SERVER qua `normalizeError` — folder 17.)
 */
export default function LocaleError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const t = useTranslations('Error');

  useEffect(() => {
    // Báo lỗi qua seam observability (folder 18) thay cho `console.error` trần. Phía CLIENT, prod
    // che message (chỉ còn digest) → `captureError` chuẩn hoá + log digest để khớp với bản ghi ĐẦY
    // ĐỦ mà `onRequestError` đã ghi phía SERVER (instrumentation.ts). captureError nuốt-an-toàn
    // (fire-and-forget) nên không làm hỏng UI dự phòng. Xem doc 02 (double-capture là CỐ Ý).
    captureError(error, { source: 'react-error-boundary', digest: error.digest });
  }, [error]);

  return (
    <main role="alert">
      <h1>{t('title')}</h1>
      <p>{t('description')}</p>
      <button type="button" onClick={() => unstable_retry()}>
        {t('retry')}
      </button>
    </main>
  );
}
