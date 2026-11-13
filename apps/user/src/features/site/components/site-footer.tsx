import { buildCopyrightNotice } from '~/features/site/model/site';
import { siteConfig } from '~/lib/site-config';

interface SiteFooterProps {
  /** Năm bản quyền — composition root (layout) bơm vào từ `getCopyrightYear` (`use cache`). */
  year: number;
}

/**
 * Footer của site. **Server Component** ĐỒNG BỘ (mặc định — KHÔNG `"use client"`) → unit-test được.
 *
 * Minh hoạ phụ thuộc MỘT CHIỀU `shared → features → app`:
 *   - `~/lib/site-config`        → feature dùng tầng SHARED  ✅ (một chiều)
 *   - `~/features/site/model/...`→ import trong CÙNG feature  ✅
 *
 * ⭐ Folder 10: KHÔNG đọc `new Date()` tại đây nữa (current-time bị cấm lúc prerender dưới
 * Cache Components). Năm được tính ở `getCopyrightYear` (`use cache`) rồi TRUYỀN xuống làm prop
 * → footer giữ THUẦN/đồng bộ (test được) và vào được static shell.
 */
export function SiteFooter({ year }: SiteFooterProps) {
  const notice = buildCopyrightNotice({ name: siteConfig.name }, year);

  return (
    <footer>
      <small>{notice}</small>
    </footer>
  );
}
