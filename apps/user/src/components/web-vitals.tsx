'use client';

import { useReportWebVitals } from 'next/web-vitals';

import { track } from '~/lib/analytics/analytics';

// Hình metric TỐI THIỂU ta cần: name/value/id luôn có; rating/navigationType chỉ có ở web-vital
// "thật" (metric custom của Next không có) → optional. ⭐ Tự khai type thay vì lấy từ
// `Parameters<typeof useReportWebVitals>`: type metric của Next tham chiếu package `web-vitals`
// (transitive dep) mà type-checker của ESLint KHÔNG resolve được → coi như `any` → vi phạm
// `no-unsafe-member-access`. Khai tường minh = an toàn kiểu + lint sạch; vẫn assignable khi truyền
// vào `useReportWebVitals`.
export interface WebVitalMetric {
  name: string;
  value: number;
  id: string;
  rating?: 'good' | 'needs-improvement' | 'poor';
  navigationType?: string;
}

// Callback ỔN ĐỊNH ở module-level: docs Next cảnh báo nếu reference callback đổi mỗi render thì hook
// sẽ replay lại toàn bộ metric đã thu → report TRÙNG. Để ngoài component = đúng 1 reference duy nhất.
function reportWebVital(metric: WebVitalMetric): void {
  // Web Vitals (LCP/CLS/INP/FCP/TTFB…) là sự kiện ĐO LƯỜNG → đẩy vào seam Analytics (best-effort),
  // KHÔNG phải Monitoring (lỗi). Deploy: `configureAnalytics(gaSink)` → metric tự chảy sang GA/RUM.
  track('web_vital', {
    name: metric.name,
    value: metric.value,
    id: metric.id,
    rating: metric.rating,
    navigationType: metric.navigationType,
  });
}

/**
 * Đo Core Web Vitals THẬT phía client (RUM — Real User Monitoring) qua `useReportWebVitals`
 * (`next/web-vitals`). Component `'use client'` trả `null` → mount ở root layout, giới hạn ranh giới
 * client đúng MỘT lá (docs Next): phần còn lại của layout vẫn là Server Component.
 */
export function WebVitals(): null {
  useReportWebVitals(reportWebVital);
  return null;
}
