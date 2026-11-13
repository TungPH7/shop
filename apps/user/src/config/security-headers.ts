// Security headers + Content-Security-Policy — THUẦN, 0-dep. Tách ra file riêng (thay vì nhét inline
// trong next.config) để: (1) unit-test được chính sách; (2) một nguồn-sự-thật cho policy; (3) giữ
// next.config gọn.
//
// ⚠️ File này được next.config.ts import bằng ĐƯỜNG DẪN TƯƠNG ĐỐI (`./src/config/security-headers`)
// — bộ biên dịch config của Next KHÔNG áp tsconfig `paths` (`~`) (bài học folder 15). Vì vậy file
// PHẢI thuần (KHÔNG `~` alias, KHÔNG `server-only`, KHÔNG dep). Test thì import qua `~` (Vitest resolve).

/**
 * ⭐ CHIẾN LƯỢC CSP = static (KHÔNG nonce) → GIỮ cacheComponents/PPR (folder 10-17).
 *
 * Docs Next chính thức: **nonce-based CSP KHÔNG tương thích PPR** — nonce sinh per-request nên phải
 * render DYNAMIC; static shell prerender lúc build không có nonce. Dùng nonce ⇒ ép TOÀN BỘ trang
 * dynamic ⇒ mất static shell + CDN cache + PPR. Ta đã đầu tư PPR xuyên suốt folder 10-17 → chọn CSP
 * tĩnh, đổi lại `script-src 'unsafe-inline'` (không nonce thì Next cần nó cho inline bootstrap script
 * — `self.__next_f` RSC payload + hydration). Đây là đánh đổi CÓ CHỦ ĐÍCH, không phải bỏ sót.
 *
 * Muốn bỏ `unsafe-inline` mà vẫn tĩnh: `experimental.sri` (hash-based) — nhưng EXPERIMENTAL → vi phạm
 * luật "cấm experimental trong prod" (plan §5) → để dành. Muốn strict-dynamic: nonce → mất PPR.
 *
 * `isDev`: dev cần `'unsafe-eval'` (React dùng eval dựng stack lỗi — docs Next; prod KHÔNG cần) +
 * `ws:`/`wss:` ở `connect-src` cho HMR websocket của Next dev.
 */
export function buildContentSecurityPolicy(isDev: boolean): string {
  const directives = [
    `default-src 'self'`,
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'unsafe-inline'`, // Next + CSS-in-JS chèn <style> inline
    `img-src 'self' blob: data:`, // chưa render ảnh ngoài (DTO bỏ images, folder 11); next/image qua /_next/image = self
    `font-src 'self'`,
    // ⭐ BFF (folder 11) = thắng lợi server-first cho CSP: trình duyệt CHỈ gọi `/api/*` của CHÍNH ta
    // (server mới gọi backend NestJS) → `connect-src 'self'` là đủ. KHÁC SPA sibling phải mở
    // `connect-src` tới origin backend (vì SPA gọi backend trực tiếp từ trình duyệt). Dev: +ws cho HMR.
    `connect-src 'self'${isDev ? ' ws: wss:' : ''}`,
    `object-src 'none'`, // chặn <object>/<embed>/<applet> (vector chèn plugin)
    `base-uri 'self'`, // chặn <base> bị chèn để đổi base URL (đánh lừa đường dẫn tương đối)
    `form-action 'self'`, // form chỉ submit về self (Server Action POST = self)
    `frame-ancestors 'none'`, // chống clickjacking (tương đương X-Frame-Options: DENY, bản CSP mới)
    `upgrade-insecure-requests`, // nâng http→https cho subresource (vô hại trên localhost http)
  ];
  return directives.join('; ');
}

export interface HttpHeader {
  key: string;
  value: string;
}

/**
 * Bộ header bảo mật áp cho MỌI response (next.config `headers()`), bổ sung quanh CSP. Đây là các
 * "default rủi-ro-thấp" (best practice: thêm trước, rồi mới siết CSP). KHÔNG đụng rendering → an toàn
 * với cacheComponents/PPR (header là tầng response, không phải tầng render).
 */
export function buildSecurityHeaders(isDev: boolean): HttpHeader[] {
  return [
    { key: 'Content-Security-Policy', value: buildContentSecurityPolicy(isDev) },
    // HSTS: ép HTTPS 2 năm + subdomain + preload. Trình duyệt CHỈ tôn trọng qua HTTPS → vô hại trên
    // localhost http (bị bỏ qua). Đặt sẵn để prod (sau TLS) tự an toàn.
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
    { key: 'X-Content-Type-Options', value: 'nosniff' }, // chặn MIME-sniffing (trình duyệt không đoán kiểu)
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }, // rò ít referrer khi sang origin khác
    { key: 'X-Frame-Options', value: 'DENY' }, // fallback cho trình duyệt cũ chưa hiểu frame-ancestors
    // Tắt API nhạy cảm không dùng (camera/mic/định vị) + browsing-topics (FLoC/Topics).
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
    },
  ];
}
