'use client';

import { useEffect } from 'react';

import { sans } from '~/config/fonts';
import { captureError } from '~/lib/monitoring/capture-error';

// The stylesheets of the root layout, in the same order: when the layout fails on the server, Next sends only the CSS
// that this file imports (SHOP-10).
import '~/styles/tokens.css';
import '~/styles/components.css';
import '~/app/globals.css';

/**
 * GLOBAL ERROR BOUNDARY — lưới an toàn CUỐI CÙNG của cả app. Đặt ở GỐC `app/` (KHÔNG trong `[locale]`).
 *
 * VÌ SAO cần, khi đã có `[locale]/error.tsx`? Vì `error.tsx` **không bọc layout CÙNG segment** với nó
 * (xác nhận docs Next): `[locale]/error.tsx` bắt lỗi của `[locale]/page` + con, NHƯNG KHÔNG bắt lỗi
 * phát ra TỪ `[locale]/layout.tsx` (nơi có `<html>`, `NextIntlClientProvider`, `SiteFooter`,
 * `AuthStatus`…). Lỗi trong root layout leo lên segment CHA = `app` gốc — chỉ `global-error.tsx` ở đó
 * mới bắt được. Không có file này ⇒ lỗi root layout = màn hình trắng.
 *
 * Đặc thù (docs Next 16):
 *  - **THAY THẾ root layout khi kích hoạt** ⇒ phải TỰ khai `<html>` + `<body>`, nạp lại ba file CSS của layout
 *    (`tokens.css`, `components.css`, `globals.css`) và đặt class font `sans.variable` lên `<html>`.
 *  - Nằm NGOÀI `NextIntlClientProvider` (provider sống trong layout vừa hỏng) ⇒ **KHÔNG có i18n** ⇒
 *    nội dung là **fallback TIẾNG ANH hardcode** (đúng yêu cầu plan §394 "English fallback").
 *  - Là Client Component (`'use client'`); **không** export được `metadata` ⇒ dùng `<title>` của React.
 *  - Hiển thị ở **cả dev lẫn prod** (global-error bật cho dev từ Next 15.2).
 *  - `unstable_retry()` (Next 16.2): thử render lại boundary (re-fetch + re-render). Với lỗi cấu hình
 *    root layout thường KHÔNG transient → retry có thể lặp lại lỗi; vẫn cấp nút để user thử.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // Prod che `error.message` (chỉ còn `digest`) → báo qua seam (folder 18) để dò log server tương
    // ứng. global-error nằm NGOÀI provider i18n nhưng `captureError` (logger console) không cần i18n.
    captureError(error, { source: 'global-error', digest: error.digest });
  }, [error]);

  return (
    <html lang="en" className={sans.variable}>
      <body>
        <title>Something went wrong</title>
        {/* The frame of the layout (SHOP-11) without its bar and footer: the --gutter on each side of the page. */}
        <div className="site-shell">
          <main role="alert">
            <h1>Something went wrong</h1>
            <p>
              A critical error occurred and the page could not be displayed. Please try again in a
              moment.
            </p>
            <button type="button" onClick={() => unstable_retry()}>
              Try again
            </button>
          </main>
        </div>
      </body>
    </html>
  );
}
