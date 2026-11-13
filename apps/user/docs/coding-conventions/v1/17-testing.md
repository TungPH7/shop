# 17 — Testing

## 17.1 Bốn tầng — `[MUST]` biết test gì ở đâu

| Tầng            | Công cụ             | Phủ cái gì                                                         |
| --------------- | ------------------- | ------------------------------------------------------------------ |
| **Static**      | TypeScript + ESLint | Kiểu, ranh giới tầng, naming                                       |
| **Unit**        | Vitest + RTL        | Hàm thuần, schema, component **đồng bộ**, island riêng lẻ          |
| **Integration** | Vitest + RTL        | Nhiều island + nhiều seam trong **một** cây component              |
| **E2E**         | Playwright + axe    | Render ở **server**, PPR, auth thật, đổi ngôn ngữ/theme, a11y động |

> **[MUST]** Async Server Component **không** unit/integration-test được → chỉ E2E phủ. Vì vậy phần hiển thị đáng test phải tách thành **view đồng bộ** (→ §05).

## 17.2 Quy ước file — `[MUST]`

- Unit/integration: `*.test.ts(x)` **colocated** cạnh source. ❌ Không dùng thư mục `__tests__/`.
- E2E: `e2e/*.spec.ts` (tách hoàn toàn khỏi `src/**/*.test.*`).
- Harness dùng chung ở `src/testing/`: `render.tsx` (render seam), `setup.ts`, `msw/`, `stubs/`.
- Test colocated trong `src/app/` **không** bị Next coi là route (đã verify).

## 17.3 Viết unit test — `[MUST]`

```ts
import { expect, test } from 'vitest'; // globals: false → import tường minh
```

- **[MUST]** Query theo **vai trò người dùng**: `getByRole`, `getByLabelText`, `getByText`. ❌ Không `querySelector` theo class/id, không test implementation detail.
- **[MUST]** Component cần provider → dùng **`renderWithProviders`** (`~/testing/render.tsx`), không tự dựng provider ad-hoc. Đây là **một chỗ duy nhất** để thêm provider mới (Redux, i18n, Query…).
- **[SHOULD]** Ưu tiên test ở `model/` (hàm thuần, schema) — rẻ nhất, ổn định nhất.
- Test đặt tên theo **hành vi**, không theo tên hàm: `'trả về lỗi khi mật khẩu xác nhận không khớp'`.

## 17.4 `@vitest-environment node` — `[MUST]` khi nào

Mặc định là `jsdom`. Thêm chỉ thị này ở đầu file khi test đụng **code server-only**:

```ts
// @vitest-environment node
```

Bắt buộc cho: http client (đọc `env.API_URL` — biến server; jsdom có `window` nên t3-env tưởng là client rồi ném lỗi), session-seal, env, `getCurrentUser`, logic Server Action.

## 17.5 MSW — `[MUST]`

Mock ở **biên network**, không mock `fetch` thủ công.

- Unit: `src/testing/msw/{handlers,server}.ts` với `onUnhandledRequest: 'error'` — thiếu handler là báo lỗi to (cố ý).
- Override từng test bằng `server.use(...)`.
- Handler phải khớp **shape thật** của backend → Zod ở biên sẽ bắt drift (→ §08).

## 17.6 Mock seam, đừng mock sâu — `[MUST]`

Mock đúng **ranh giới** đã thiết kế:

| Test                      | Mock cái gì                                          |
| ------------------------- | ---------------------------------------------------- |
| Logic Server Action       | `next/cache`, `getCurrentUser`, hàm DAL              |
| DAL / http client         | **MSW** (không mock `fetch`)                         |
| Client island             | Module action (để không kéo `next/cache` vào client) |
| Component dùng navigation | `vi.mock('~/i18n/navigation')`                       |
| Theme switcher            | `vi.mock('next-themes')`                             |

❌ Không mock nội bộ của thư viện, không mock những thứ nằm sâu dưới seam.

## 17.7 Integration test — `[SHOULD]`

Khẳng định điều unit không với tới: nhiều hệ state **cùng tồn tại mà không giao thoa** (vd đổi `view` của nuqs không đụng `density` của Redux).

Hai bẫy cô lập state phải nhớ:

1. `getQueryClient` là **singleton trình duyệt** → cache TanStack rò **giữa các test trong cùng file** (Vitest cô lập theo **file**, không theo test).
2. Redux density **persist localStorage** → `beforeEach(() => localStorage.clear())`.

## 17.8 E2E — `[MUST]`

- **Chạy trên production build**: `pnpm build` → `next start` (port 3100, khác dev 3000). PPR/prerender/async-RSC chỉ đúng ở prod.
- **Mock backend bằng MSW chạy TRONG server**, không dùng `page.route` — App Router fetch ở **server**, `page.route` của trình duyệt mù hoàn toàn với nó. Bật qua `instrumentation.ts` với gate 2 lớp: `NEXT_RUNTIME === 'nodejs'` **và** `E2E_API_MOCKING === '1'`.
- Vì state mock dùng chung → chạy **serial**: `fullyParallel: false`, `workers: 1`, `reuseExistingServer: false`.
- Query theo **vai trò** như RTL.
- a11y: `@axe-core/playwright` quét WCAG A/AA — **bổ trợ** cho `jsx-a11y` (tĩnh), không thay thế.
- `pnpm e2e` **không** chạy ở pre-commit (chậm, cần browser + build) → chạy tay và ở CI.

## 17.9 Coverage — `[MUST]` hiểu đúng

Ngưỡng trong `vitest.config.ts`: `statements 70` · `branches 55` · `functions 72` · `lines 70`.

- Đây là **SÀN chống tụt** (ratchet), đặt **dưới** baseline đo thực — **không phải mục tiêu**. ❌ Không chạy đua tăng số (chống gaming).
- Đã loại khỏi mẫu số: `src/app/**`, `instrumentation.ts`, `proxy.ts`, `src/testing/**` — đây là "lãnh địa E2E", không unit-test được.
- **Server-first có unit-% thấp hơn SPA về bản chất** — nhiều logic nằm ở async RSC do E2E phủ. Đừng so sánh với dự án SPA.
- Coverage là công cụ **tìm chỗ chưa test**, không phải điểm chất lượng.

## 17.10 Definition of Done — `[MUST]`

Một thay đổi chỉ xong khi **tất cả** đều xanh:

```bash
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build
```

Cộng thêm:

- Route mới hiện **`◐`** trong build output (PPR không vỡ).
- Verify tay bằng **`pnpm dev`** — bắt buộc khi có `<form action>` hoặc provider client (chỉ dev mới bắt lỗi blocking-route, → §07).
- Viết test **liên tục trong lúc code**, ❌ không dồn vào cuối.
