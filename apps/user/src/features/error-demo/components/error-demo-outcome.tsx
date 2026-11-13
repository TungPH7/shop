import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { simulateLookup } from '~/features/error-demo/model/simulate-lookup';
import { Link } from '~/i18n/navigation';

/**
 * Phần ĐỘNG của trang error-demo (đọc `searchParams` ⇒ bọc `<Suspense>` ở page). Render TOÀN BỘ UI
 * tương tác (tiêu đề + các `<Link>` kịch bản nằm trong dynamic-hole này, tránh blocking-route ở static
 * shell). Rẽ nhánh theo `?case` để minh hoạ 3 cách hệ thống PHẢN ỨNG với lỗi (folder 17):
 *  - `notfound` → `notFound()` ⇒ Next render `not-found.tsx` GẦN NHẤT (của segment này).
 *  - `throw`    → ném lỗi THẬT/bất ngờ ⇒ leo tới `[locale]/error.tsx` (Error Boundary) thay vì sập.
 *  - `expected` → lỗi DỰ KIẾN qua `Result` ⇒ xử lý TẠI CHỖ (hiện thông báo, giữ trang).
 */
export async function ErrorDemoOutcome({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations('ErrorDemo');
  const demoCase = (await searchParams).case;

  if (demoCase === 'notfound') {
    notFound();
  }
  if (demoCase === 'throw') {
    // Lỗi THẬT mô phỏng (bug/5xx) → KHÔNG bắt ⇒ error.tsx hiện UI dự phòng (prod che message, chỉ digest).
    throw new Error('Simulated unexpected failure (error-demo)');
  }

  // Lỗi DỰ KIẾN: Result.err → xử lý tại chỗ (thông báo), KHÔNG ném. Mặc định: nhắc chọn kịch bản.
  let notice = t('pickScenario');
  if (demoCase === 'expected') {
    const result = simulateLookup(true);
    if (!result.ok) {
      notice = t('expectedNotice');
    }
  }

  return (
    <main>
      <h1>{t('title')}</h1>
      <p>{t('intro')}</p>
      <ul>
        <li>
          <Link href="/error-demo?case=notfound">{t('linkNotFound')}</Link>
        </li>
        <li>
          <Link href="/error-demo?case=throw">{t('linkThrow')}</Link>
        </li>
        <li>
          <Link href="/error-demo?case=expected">{t('linkExpected')}</Link>
        </li>
        <li>
          <Link href="/error-demo">{t('reset')}</Link>
        </li>
      </ul>
      <p role="status">{notice}</p>
    </main>
  );
}
