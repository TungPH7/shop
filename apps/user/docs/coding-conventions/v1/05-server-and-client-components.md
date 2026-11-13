# 05 — Server & Client Components

> Ranh giới server/client là trục **thứ hai**, độc lập với ranh giới tầng ở §02. Đừng nhầm hai trục.

## 5.1 Mặc định là Server Component — `[MUST]`

Mọi component là Server Component trừ khi có `"use client"` ở đầu file. Chỉ thêm `"use client"` khi cần **một trong**:

- Event handler (`onClick`, `onChange`, `onSubmit`)
- React state / effect (`useState`, `useReducer`, `useSyncExternalStore`)
- Browser API (`localStorage`, `window`, `IntersectionObserver`)
- Hook của thư viện client (`useForm`, `useQuery`, `useQueryState`, `useTheme`)

❌ Không thêm `"use client"` chỉ vì "component này có UI" hay "cho chắc".

## 5.2 Island nhỏ nhất có thể — `[MUST]`

`"use client"` **lan xuống toàn bộ cây con**. Vì vậy phải đặt ở lá, không ở gốc.

```
❌ page (client) ──► toàn bộ trang vào bundle client
✅ page (server) ──► ProductList (server) ──► DeleteProductButton ("use client")
```

Trong repo, các island điển hình đều nhỏ và một mục đích: `delete-product-button.tsx`, `view-toggle.tsx`, `density-toggle.tsx`, `theme-switcher.tsx`, `language-switcher.tsx`.

## 5.3 Donut pattern — `[MUST]` khi cần bọc Client quanh Server

Client Component **không thể import** Server Component, nhưng **có thể nhận qua `children`**.

```tsx
// ✅ Provider client bọc nội dung server qua children ("donut")
<ThemeProvider>
  {' '}
  {/* "use client" */}
  <ServerContent /> {/* vẫn render ở server */}
</ThemeProvider>;

// ❌ import trực tiếp — kéo ServerContent sang client
('use client');
import { ServerContent } from './server-content';
```

## 5.4 Chốt ranh giới bằng `server-only` — `[MUST]`

Mọi module chạm secret / token / gọi backend phải có dòng đầu:

```ts
import 'server-only';
```

Áp dụng cho: `lib/http/client.ts`, toàn bộ `lib/auth/*`, mọi `features/*/server/*`, `lib/logger/pino-sink.ts`.

Lỡ import từ Client Component → **build fail**, thay vì âm thầm rò secret vào bundle.

> ⚠️ **Ngoại lệ:** `src/config/env/server.ts` **không** có `server-only` vì nằm trên đường nạp `next.config.ts` (chạy trong Node thuần, `server-only` sẽ ném lỗi). Bảo vệ ở đây bằng tách file client/server + chốt runtime của t3-env (→ §14).

## 5.5 Client không gọi backend — `[MUST]`

Đây là app **BFF**. Trình duyệt chỉ được nói chuyện với chính origin của mình.

| Luồng                                                  | Hợp lệ?                                 |
| ------------------------------------------------------ | --------------------------------------- |
| RSC → DAL (`features/*/server`) → `lib/http` → backend | ✅ mặc định                             |
| Client → Server Action → DAL → backend                 | ✅ cho mutation                         |
| Client → Route Handler `/api/*` → DAL → backend        | ✅ khi cần fetch phía client (TanStack) |
| Client → `fetch('https://backend...')`                 | ❌ cấm                                  |

Lợi ích kèm theo: CSP giữ được `connect-src 'self'` (→ §14).

## 5.6 Truyền dữ liệu qua ranh giới — `[MUST]`

- Props từ Server → Client phải **serializable** (không hàm, không `Date` phức tạp, không class instance). Hàm chỉ truyền được nếu là Server Action.
- **Chỉ truyền dữ liệu đã tối giản.** Đừng ném cả object backend sang client — dùng DTO tối thiểu từ Zod (→ §08). Field lọt sang client là field bị lộ.
- i18n: giải chuỗi **ở server** rồi truyền string xuống, thay vì bắt client tải catalog (→ §11).

## 5.7 Async Server Component & khả năng test — `[MUST]`

**Async Server Component không unit-test được** (giới hạn chính thức của Next + Vitest). Vì vậy:

```tsx
// ✅ tách 2 phần
// page/orchestrator: async, lo await params + gọi DAL + giải i18n
export default async function ProductsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const products = await getProducts();
  return <ProductListView products={products} title={t('title')} />;
}

// view: ĐỒNG BỘ, thuần props → unit-test bằng RTL
export function ProductListView({ products, title }: Props) { … }
```

Quy tắc rút ra:

- **[MUST]** Phần hiển thị đáng test → tách ra component **đồng bộ** (`*-view`).
- **[MUST]** `<Link>` / `useRouter` cần router context → đặt ở page/orchestrator, không nhét vào view đang unit-test.
- Phần async còn lại được phủ bằng **E2E** (→ §17).

## 5.8 Checklist trước khi thêm `"use client"` — `[SHOULD]`

1. Có thể giữ ở server không? (đa số là có)
2. Nếu cần state → có thể đẩy state lên **URL** (nuqs) để giữ server không? (→ §10)
3. Nếu buộc phải client → đã tách nhỏ nhất có thể chưa?
4. Component này có nằm trong static shell không? Nếu nó đọc request-time hoặc random → phải nằm trong `<Suspense>` (→ §07).
