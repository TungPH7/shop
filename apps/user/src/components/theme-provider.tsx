'use client';

import { type ReactNode } from 'react';

import { ThemeProvider as NextThemesProvider } from 'next-themes';

// ─────────────────────────────────────────────────────────────────────────────
// DEV-ONLY — nuốt cảnh báo FALSE-POSITIVE của React 19: "Encountered a script tag
// while rendering React component". next-themes chèn <script> anti-FOUC; React 19
// cảnh báo MỌI <script> render phía CLIENT (script render client KHÔNG tự chạy).
// Đổi locale = next-intl re-render layout [locale] TRÊN CLIENT (router.replace đổi
// segment) → next-themes re-emit <script> lúc client-render → cảnh báo nổ (dòng 99).
// Vì sao đây là false-positive an toàn: <script> CHẠY ĐÚNG lúc SSR (anti-FOUC còn
// nguyên), lúc re-render nó vô-hại (no-op). Vì sao KHÔNG có cách "đúng hơn":
//   • next-themes unmaintained (>1 năm không release) → không có fix thượng nguồn;
//   • <html lang={locale}> BẮT BUỘC ở [locale] → đổi locale PHẢI re-render <html>
//     + toàn cây bên trong (gồm provider) → KHÔNG nâng provider ra ngoài vùng
//     re-render được. → Lọc cảnh báo = cách thực dụng, đồng thuận (shadcn-ui #10104).
// Phủ luôn <JsonLd> (cùng lớp: <script type="application/ld+json"> inline). Hạn chế:
// ẩn MỌI cảnh báo "script tag" (chấp nhận — DEV-only + khớp thông điệp chính xác).
// Prod KHÔNG ảnh hưởng: React strip cảnh báo ở prod + khối bị guard NODE_ENV (DCE).
// Cờ idempotent chống Fast-Refresh bọc chồng wrapper. Chi tiết: docs 22 §4.1.
// ─────────────────────────────────────────────────────────────────────────────
type PatchedConsoleError = typeof console.error & { __scriptTagWarningSilenced?: true };

if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
  const current = console.error as PatchedConsoleError;
  if (!current.__scriptTagWarningSilenced) {
    const original = console.error;
    const patched = ((...args: unknown[]) => {
      if (typeof args[0] === 'string' && args[0].includes('Encountered a script tag')) return;
      original(...args);
    }) as PatchedConsoleError;
    patched.__scriptTagWarningSilenced = true;
    console.error = patched;
  }
}

/**
 * Seam điều khiển theme (S4) — MỘT chỗ DUY NHẤT cấu hình next-themes cho toàn app.
 *
 * Vì sao next-themes (KHÔNG cookie, KHÔNG tự xây) — để GIỮ PPR dưới cacheComponents:
 *  - Theme được giải HOÀN TOÀN phía client (localStorage + blocking script next-themes
 *    chèn vào <head>) → server KHÔNG đọc request-time. Cách "có vẻ server-first hơn" là
 *    đọc cookie ở root layout để set <html data-theme> lại VỠ static shell TOÀN APP
 *    (đúng bài học folder 17: "Uncached data outside <Suspense> tại layout") → giết PPR
 *    mọi route. Nghịch lý: localStorage-client lại là lựa chọn đúng cho kiến trúc PPR.
 *  - `attribute="class"` → toggle class `.dark` trên <html> (khớp Tailwind v4/shadcn ở
 *    Phase 1.2; light = `:root` mặc định, không có `.light` rule). next-themes chỉ
 *    THÊM/BỚT class theme nên GIỮ NGUYÊN class `sans.variable` (next/font). Script sửa
 *    class TRƯỚC hydrate → lệch <html> → đã có `suppressHydrationWarning` từ folder 01.
 *  - Anti-FOUC: blocking script chạy ĐỒNG BỘ trước paint (next-themes lo, đọc localStorage
 *    + resolve `system` qua matchMedia). `disableTransitionOnChange` tắt CSS transition
 *    lúc đổi để không "nháy" màu. `enableColorScheme` (mặc định) → next-themes set
 *    `color-scheme` cho control gốc (scrollbar/input) khớp theme — nên tokens.css KHÔNG
 *    khai color-scheme (1 chủ-sở-hữu).
 *  - Inline script của next-themes hợp CSP folder 19 (`script-src 'self' 'unsafe-inline'`,
 *    no-nonce để giữ PPR) — KHÔNG cần truyền `nonce`.
 *
 * Là Client Component ở gần root NHƯNG KHÔNG đọc request-time / KHÔNG `Math.random()`
 * (khác provider Redux folder 14) → an toàn ở static shell. (Verify: `next build` mọi
 * route vẫn `◐` sau khi mount provider này.)
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
