import { connection } from 'next/server';

import { SnapshotView } from './snapshot-view';

interface LivePanelProps {
  title: string;
  hint: string;
  generatedAtLabel: string;
}

/**
 * Panel DỮ LIỆU ĐỘNG (request-time). `await connection()` đánh dấu "chỉ chạy khi có request"
 * → Next KHÔNG prerender phần này; nó là **dynamic hole**, BẮT BUỘC nằm trong `<Suspense>`
 * ở component cha (thiếu Suspense → lỗi blocking-route). Mốc thời gian tạo MỖI request → đổi
 * mỗi lần tải.
 *
 * i18n đã giải ở orchestrator (prerender được nhờ `setRequestLocale`) rồi TRUYỀN string xuống
 * → panel động không phụ thuộc lookup dịch theo request-scope (luật next-intl × use cache).
 */
export async function LivePanel({ title, hint, generatedAtLabel }: LivePanelProps) {
  await connection();
  // Mô phỏng I/O request-time chậm (~600ms) → Suspense fallback HIỆN ra trước, phần này
  // stream vào sau → thấy rõ "static shell tới ngay, dynamic hole tới sau" (PPR).
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 600);
  });
  const generatedAt = new Date().toISOString();

  return (
    <SnapshotView
      title={title}
      hint={hint}
      generatedAtLabel={generatedAtLabel}
      generatedAt={generatedAt}
      timeId="live-time"
    />
  );
}
