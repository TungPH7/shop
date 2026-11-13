import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

// ⭐ Validate env NGAY khi nạp config → `next build`/`next dev` FAIL SỚM nếu env
// thiếu/sai (trước cả khi compile), thay vì lỗi mơ hồ lúc chạy (khuyến nghị t3-env).
import './src/config/env/server';

// Security headers + CSP (folder 19). Import TƯƠNG ĐỐI (không `~`) — bộ biên dịch config của Next
// KHÔNG áp tsconfig `paths` (bài học folder 15). File thuần 0-dep.
import { buildSecurityHeaders } from './src/config/security-headers';

// Build static-gen mặc định chạy ~ (số core − 1) worker SONG SONG → máy/CI RAM thấp dễ OOM HỆ THỐNG
// khi trang có nhiều client island (folder 12). Escape hatch opt-in: `NEXT_BUILD_LOW_MEM=1` → ép 1
// worker (chậm hơn nhưng ít RAM). KHÔNG set env → build thật giữ NGUYÊN parallelism. (Bài học folder
// 12: cờ heap `--max-old-space-size` MỘT MÌNH không đủ — OOM ở đây là do TỔNG RAM nhiều worker, không
// phải giới hạn heap của 1 process; heap log chỉ ~57MB mà vẫn "promotion failed".)
const lowMemBuild = process.env.NEXT_BUILD_LOW_MEM === '1';

const nextConfig: NextConfig = {
  // ⭐ Folder 10 — Cache Components: dynamic-by-default + opt-in cache (`use cache` /
  // `cacheLife` / `cacheTag`) + PPR (static shell + streaming). Cờ TOP-LEVEL (16.2.9 không
  // còn experimental; gộp ppr + dynamicIO + useCache thành một). Đánh đổi: static export &
  // edge runtime KHÔNG hỗ trợ (ta deploy Node/platform → OK).
  cacheComponents: true,

  // ⭐ Folder 20 — React Compiler (auto-memoization). Cờ TOP-LEVEL (16.x đã tốt nghiệp khỏi
  // `experimental`; KHÔNG vi phạm luật no-experimental §5 — đây là tuỳ chọn ổn định + RC vừa lên
  // 1.0 stable). Bù renders thừa tự động → bớt useMemo/useCallback tay. Tương thích Turbopack:
  // Next chèn một tối ưu SWC chỉ áp Babel-plugin (`babel-plugin-react-compiler`) cho file CÓ JSX/Hook
  // → build chậm hơn rất ít so với "Babel mọi file". Header/CSP/PPR KHÔNG đổi (chỉ tối ưu render).
  reactCompiler: true,

  // ⭐ Folder 20 — pino (LogSink server-only, folder 18→20): KHÔNG bundle pino, để Node `require` lúc
  // runtime → tránh Turbopack 16 vỡ bundling khi truy vết worker_threads của pino (vercel/next.js#86099).
  // Next 16.1+ đã TỰ thêm pino vào danh sách này; ta khai TƯỜNG MINH cho rõ ý + chống đổi danh sách ngầm.
  // ⭐ Folder 24 — 'msw': E2E mock chạy trong server (instrumentation, chỉ khi E2E_API_MOCKING=1). Ngoại
  // hoá để Turbopack KHÔNG bundle @mswjs/interceptors (patch http Node) → tránh lỗi bundling; chỉ được
  // `require` khi cờ E2E bật. devDependency → prod thật (không set cờ) không bao giờ nạp.
  serverExternalPackages: ['pino', 'msw'],

  // ⭐ Folder 20 — next/image: allowlist host ảnh REMOTE được tối ưu (bảo mật phía SERVER). Trình duyệt
  // CHỈ thấy `/_next/image?...` (same-origin) — optimizer FETCH host remote ở SERVER rồi proxy về → nên
  // CSP `img-src 'self'` (folder 19) VẪN ĐỦ, KHÔNG phải nới host (song song "thắng lợi BFF" connect-src).
  // picsum.photos = ảnh placeholder demo (backend trả URL ảnh giả example.com). Ảnh CDN THẬT → thêm host vào đây.
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'picsum.photos' }],
  },

  // Hạ số worker build khi RAM thấp (chỉ khi NEXT_BUILD_LOW_MEM=1) — xem ghi chú trên.
  ...(lowMemBuild ? { experimental: { cpus: 1 } } : {}),

  // ⭐ Security headers + CSP (folder 19) — áp cho MỌI response. CSP TĨNH (không nonce) để GIỮ
  // cacheComponents/PPR (nonce ép dynamic → mất static shell, docs Next). Header là tầng RESPONSE,
  // KHÔNG ảnh hưởng render → routes vẫn `◐` PPR. Dev nới `unsafe-eval`/`ws:` cho React-debug + HMR.
  // eslint-disable-next-line @typescript-eslint/require-await -- NextConfig.headers() khai trả Promise (async-by-contract); không có await thật, giống use-cache folder 10.
  async headers() {
    const isDev = process.env.NODE_ENV === 'development';
    return [{ source: '/(.*)', headers: buildSecurityHeaders(isDev) }];
  },

  // Các tuỳ chọn còn lại bật dần theo đúng folder dạy nó:
  //   • reactCompiler         → folder 20 (performance — cần babel-plugin-react-compiler)
  //   • images.remotePatterns → folder 20 (next/image)
  //   • typedRoutes           → folder 08 (routing, nếu muốn <Link> type-safe)
  // Turbopack là bundler MẶC ĐỊNH của Next 16 (dev + build) → không cần khai báo gì;
  // muốn quay lại webpack thì chạy `next build --webpack`.
};

// next-intl (folder 09): bọc NextConfig + trỏ tới file getRequestConfig.
// Plugin lo wiring messages/locale cho RSC + client; env import ở trên vẫn fail-fast trước.
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

export default withNextIntl(nextConfig);
