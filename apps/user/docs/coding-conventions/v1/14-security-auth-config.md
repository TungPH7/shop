# 14 — Security · Auth · Config

> Phòng thủ **nhiều lớp**: mỗi lớp tự chặn được, không lớp nào được phép tin lớp khác.

## 14.1 Environment variables — `[MUST]`

Env đã validate bằng `@t3-oss/env-nextjs` + Zod, tách **hai file**:

| File                       | Export      | Chứa                                                                      |
| -------------------------- | ----------- | ------------------------------------------------------------------------- |
| `src/config/env/client.ts` | `clientEnv` | Chỉ `NEXT_PUBLIC_*` + biến shared → an toàn vào bundle                    |
| `src/config/env/server.ts` | `env`       | `extends: [clientEnv]` + biến server (`API_URL`, `AUTH_SECRET` ≥32 ký tự) |

- **[MUST]** Đọc env **chỉ** qua `import { env } from '~/config/env/server'` (server) hoặc `clientEnv` (client). ❌ **Không đọc `process.env` thô** — mất kiểu và mất fail-fast.
  - Ngoại lệ duy nhất: marker runtime `process.env.NEXT_RUNTIME` trong `instrumentation.ts`.
- **[MUST]** Biến lộ ra client **bắt buộc** tiền tố `NEXT_PUBLIC_`. Secret **không bao giờ** ở nhóm này.
- **[MUST]** `runtimeEnv` phải liệt kê **đủ mọi biến** (Next chỉ nhúng biến được truy cập tường minh).
- **Fail-fast:** `next.config.ts` import `./src/config/env/server` ở đầu file → `build`/`dev` chết **ngay** nếu env thiếu/sai, kèm path + format lỗi.

> ⚠️ Hai lưu ý về `server.ts`: (1) **không** thêm `import 'server-only'` (file nằm trên đường nạp `next.config`, chạy Node thuần sẽ ném lỗi); (2) import `clientEnv` bằng đường dẫn **tương đối** `./client` — bộ biên dịch config không áp tsconfig `paths`.

## 14.2 File env & secret — `[MUST]`

| File               | Commit?      | Vai trò                                         |
| ------------------ | ------------ | ----------------------------------------------- |
| `.env.example`     | ✅           | Template — nguồn tham chiếu tên biến            |
| `.env.development` | ❌ gitignore | Env cho `next dev` (đủ biến, kể cả secret test) |
| `.env.production`  | ❌ gitignore | Env cho `next build` / `next start` local       |

- Clone repo → copy `.env.example` thành 2 file trên → điền.
- **[MUST] Secret production THẬT chỉ sống trên platform** (secret manager / biến môi trường của hosting), vào `process.env` với ưu tiên cao nhất. ❌ Không copy về laptop hay repo, kể cả file đã gitignore. Local dùng secret test/staging.
- Không có `.env.staging` — Next chỉ tự nạp `development` / `production` / `test`. Staging = build production + env staging do platform cấp.

## 14.3 Session — `[MUST]`

Backend ký JWT; **ta niêm phong cặp token vào cookie**:

- **JWE** (`EncryptJWT`, A256GCM) qua `jose`, khoá = SHA-256(`AUTH_SECRET`). Payload là bearer token nhạy cảm → **mã hoá**, không chỉ ký.
- Cookie **`__Host-session`**: `httpOnly` + `secure` + `sameSite: 'lax'` + `path: '/'`. Tiền tố `__Host-` buộc Secure + Path=/ + không Domain.
- Mở cookie thất bại (thiếu / giả mạo / hết hạn / sai shape) → trả `null`, **không ném**.

**Mô hình bảo mật:** ta verify **niêm phong của mình** (toàn vẹn), không verify chữ ký của backend (chỉ `decodeJwt` để lấy claims). Backend mới là nơi verify chữ ký thật mỗi request — defense-in-depth.

- **[MUST]** `createSession` / `deleteSession` **chỉ** chạy được trong Server Action hoặc Route Handler (nơi set được cookie). RSC render **không** refresh session được — access token hết hạn thì guard trả `null` → redirect `/login`.
- **[MUST]** `getSession` đọc được mọi nơi **nhưng ngoài** scope `'use cache'` (→ §07).

## 14.4 Authorization — `[MUST]`

| Lớp                         | Vai trò                 | Có phải ranh giới bảo mật?            |
| --------------------------- | ----------------------- | ------------------------------------- |
| `proxy.ts`                  | Routing / i18n          | ❌ **KHÔNG** (bài học CVE-2025-29927) |
| Ẩn nút, `<Can>`, `disabled` | UX                      | ❌ Không                              |
| **DAL + Server Action**     | Kiểm tra quyền thật     | ✅ Có                                 |
| **Backend**                 | Chốt cuối, luôn 401/403 | ✅ Có                                 |

Primitives ở `~/lib/auth/` (auth là hạ tầng **cắt ngang**, không thuộc feature nào — nhờ vậy mọi feature gate được nút mà không vi phạm cấm-import-chéo):

- `getCurrentUser()` — decode access token → `{ id, role }` | `null`. Rẻ, không gọi network. Dùng để re-authz trong Server Action.
- `getProfile()` — `GET /profile`, DTO tối thiểu qua Zod, bọc `cache()` để dedup trong một request, **session-gated** (chưa đăng nhập → trả `null`, không gọi backend).
- `hasPermission(method, path)` / `hasModule(module)` — vị từ **thuần**. Quyền đến **từ backend**, ❌ không hardcode ở frontend.
- `requireUser()` / `requireModule(m)` — guard server-side, redirect thay vì "chớp trang rồi đá ra".
- `<Can method path>` (`~/components/can.tsx`, Server Component) — ẩn/hiện ở mức element.

> **[MUST]** Component nào đọc cookie (guard, `getProfile`, `<Can>`, `AuthStatus`) **phải** nằm trong `<Suspense>` → shell tĩnh flush trước, redirect stream sau (→ §07).

## 14.5 Security headers & CSP — `[MUST]`

Logic thuần ở `src/config/security-headers.ts` (0-dep, test được), áp cho mọi response qua `next.config.ts` → `headers()`.

Headers: `Strict-Transport-Security` · `X-Content-Type-Options: nosniff` · `Referrer-Policy: strict-origin-when-cross-origin` · `X-Frame-Options: DENY` · `Permissions-Policy` (tắt camera/mic/geo).

**CSP là TĨNH, không dùng nonce** — `[MUST]` giữ nguyên nguyên tắc này:

> CSP dựa trên nonce sinh mỗi request ⇒ render **dynamic** ⇒ **mất static shell / PPR** trên toàn app. Nonce và PPR loại trừ nhau (docs Next). Vì vậy: `script-src 'self' 'unsafe-inline'` — đánh đổi có chủ đích (Next cần inline cho hydration). `strict-dynamic` và `experimental.sri` đều đòi nonce → **cấm**.

⭐ `connect-src 'self'` đủ dùng — vì kiến trúc BFF, trình duyệt chỉ gọi `/api/*` của ta (→ §05). Tương tự `img-src 'self'` đủ cho ảnh remote vì optimizer của `next/image` proxy qua same-origin (→ §15).

- **[MUST]** Import trong `next.config.ts` dùng đường dẫn **tương đối** (`./src/config/...`) và file phải thuần (không `~`, không `server-only`, không dependency).

## 14.6 XSS — `[MUST]`

- ESLint chặn `dangerouslySetInnerHTML` thô (`no-restricted-syntax`). Ưu tiên auto-escape của React.
- **Ngoại lệ duy nhất hiện tại:** `src/components/seo/json-ld.tsx` (bắt buộc dangerously để JSON không bị React escape; an toàn vì data typed tự dựng + đã `.replace(/</g, '\\u003c')` chặn `</script>`).
- Khi cần render HTML không tin cậy (rich-text) → dựng seam `<SafeHtml>` + DOMPurify và thêm file đó vào `ignores` của rule. ❌ Không tự mở rule tại chỗ.

## 14.7 CSRF & dependency — `[MUST]`

- Server Action có origin-check sẵn (Origin ≠ Host → từ chối). Mở thêm origin qua `serverActions.allowedOrigins`.
- Cookie `SameSite=lax` + `httpOnly` + `Secure` là lớp bổ sung.
- `pnpm audit --audit-level=high` là gate CI — fail ở **high/critical**. Moderate/low: đánh giá và **ghi lại quyết định** (hiện chấp nhận 1 moderate `postcss` transitive, không exploitable runtime).
- Bổ trợ: pin exact + lockfile + `allowBuilds` (→ §00).
