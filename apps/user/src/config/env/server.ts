import { createEnv } from '@t3-oss/env-nextjs';
import * as z from 'zod';

// ⭐ Import TƯƠNG ĐỐI (không dùng alias `~`) — DUY NHẤT ở đây, có lý do: file này nằm trên đường
// nạp `next.config.ts` (fail-fast), mà bộ biên dịch config của Next KHÔNG áp tsconfig `paths` cho
// import chuỗi → `~/config/env/client` sẽ "Cannot find module" lúc nạp config. `./client` resolve
// đúng ở CẢ config-transpile lẫn runtime. (Mọi file khác vẫn dùng `~`.)
import { clientEnv } from './client';

/**
 * Env phía SERVER — biến chỉ-server (bí mật) + KẾ THỪA client qua `extends`.
 *
 * ⭐ `extends: [clientEnv]`: gộp env client vào → code server đọc MỘT `env` có đủ
 * `API_URL`/`AUTH_SECRET` (server) lẫn `NEXT_PUBLIC_SITE_URL`/`NODE_ENV` (kế thừa). Client thì
 * chỉ import `clientEnv` → không bao giờ thấy tên biến server.
 *
 * ⭐ Vì sao file này KHÔNG `import 'server-only'` (dù chứa secret): nó nằm trên đường import
 * fail-fast của `next.config.ts` (`import './src/config/env/server'`). `next.config` chạy ở
 * Node thuần (không phải bundle react-server) → `server-only` sẽ NÉM ngay lúc nạp config (bài
 * học folder 11: package thật throw trong Node). Bảo vệ ở đây = (1) bản thân việc TÁCH file
 * (client không import file này) + (2) chốt runtime của t3-env (đọc biến server ở client → throw).
 * Các module KHÔNG nằm trên đường config (`lib/auth/*`, `lib/http/*`) vẫn giữ `server-only`.
 *
 * `AUTH_SECRET`: khoá bí mật để NIÊM PHONG (mã hoá JWE) cookie phiên bằng jose (folder 15).
 * Tối thiểu 32 ký tự (chống brute-force); ta SHA-256 nó thành khoá 32-byte cho A256GCM
 * (xem `~/lib/auth/session-seal`) nên độ dài đầu vào được chuẩn hoá. KHÔNG bao giờ `NEXT_PUBLIC_*`;
 * secret prod thật chỉ sống trên platform.
 */
export const env = createEnv({
  extends: [clientEnv],
  server: {
    // URL backend cho DAL phía server (BFF — folder 11); deploy có thể là URL nội bộ/riêng tư.
    API_URL: z.url(),
    AUTH_SECRET: z.string().min(32, 'AUTH_SECRET phải có tối thiểu 32 ký tự'),
  },
  runtimeEnv: {
    API_URL: process.env.API_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
  },
  emptyStringAsUndefined: true,
  // `next build` has no secret: the deployer of ai-orchestrator builds one image for every environment and gives each
  // its own secrets when the container starts. The first import of this file at run time checks them (SHOP-1).
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION || process.env.NEXT_PHASE === 'phase-production-build',
});
